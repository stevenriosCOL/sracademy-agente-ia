const express = require('express');
const router = express.Router();
const config = require('../config/env.config');
const supabaseService = require('../services/supabase.service');
const supabaseStorageService = require('../services/supabase-storage.service');
const brevoService = require('../services/brevo.service');
const manychatService = require('../services/manychat.service');
const Logger = require('../utils/logger.util');

const mockState = {
  logs: [],
  descuentos: []
};

function createWebhookRateLimiter() {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const windowMs = config.WEBHOOK_RATE_LIMIT_WINDOW * 1000;
    const max = config.WEBHOOK_RATE_LIMIT_MAX;

    const entry = requests.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }

    entry.count += 1;
    requests.set(key, entry);

    if (entry.count > max) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    return next();
  };
}

function isAuthorized(req) {
  const secret = req.headers['x-supabase-webhook-secret'];
  return secret && config.SUPABASE_WEBHOOK_SECRET && secret === config.SUPABASE_WEBHOOK_SECRET;
}

function buildCodigoDescuento(subscriberId) {
  const safe = String(subscriberId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const suffix = safe.slice(-6) || Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LIBRO30-${suffix}`;
}

async function retry(asyncFn, attempts = 3, delayMs = 750) {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await asyncFn();
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function saveLog(data) {
  if (config.MOCK_LIBRO_ENTREGA) {
    mockState.logs.push({ ...data, enviado_at: data.enviado_at || new Date().toISOString() });
    return true;
  }

  return supabaseService.createLibroEmailLog(data);
}

router.post('/libro-entrega', createWebhookRateLimiter(), async (req, res) => {
  const start = Date.now();

  try {
    if (!config.MOCK_LIBRO_ENTREGA && !isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = req.body || {};
    const compraId = payload.compra_id;

    if (!config.MOCK_LIBRO_ENTREGA && !compraId) {
      return res.status(400).json({ error: 'compra_id es requerido' });
    }

    const compra = config.MOCK_LIBRO_ENTREGA
      ? {
          id: compraId || 1,
          subscriber_id: payload.subscriber_id || 'MOCK123',
          email: payload.email || 'mock@test.com',
          nombre_completo: payload.nombre_completo || 'Cliente Mock',
          producto: payload.producto || 'pdf',
          pdf_enviado: true
        }
      : await supabaseService.getCompraById(compraId);

    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    if (!compra.pdf_enviado) {
      return res.status(409).json({ error: 'Compra sin aprobación de envío' });
    }

    const email = compra.email;
    const nombre = compra.nombre_completo || 'Cliente';
    const producto = compra.producto || 'pdf';

    if (!brevoService.validarEmail(email)) {
      await saveLog({
        compra_id: compra.id,
        email,
        tipo: 'entrega_pdf',
        estado: 'failed',
        error_mensaje: 'Email inválido'
      });

      return res.status(400).json({ error: 'Email inválido' });
    }

    const yaEnviado = config.MOCK_LIBRO_ENTREGA
      ? mockState.logs.find(log => log.compra_id === compra.id && log.tipo === 'entrega_pdf' && log.estado === 'sent')
      : await supabaseService.getLibroEmailLogByCompraTipo(compra.id, 'entrega_pdf');

    if (yaEnviado && yaEnviado.estado === 'sent') {
      return res.status(409).json({ error: 'Email ya enviado', sent_at: yaEnviado.enviado_at });
    }

    const blacklisted = await brevoService.isEmailBlacklisted(email);
    if (blacklisted) {
      await saveLog({
        compra_id: compra.id,
        email,
        tipo: 'entrega_pdf',
        estado: 'failed',
        error_mensaje: 'Email en blacklist'
      });

      return res.status(400).json({ error: 'Email inválido' });
    }

    const { pdfUrl, comboUrl, error: storageError } = await supabaseStorageService.getLibroUrls(producto);
    if (storageError) {
      await saveLog({
        compra_id: compra.id,
        email,
        tipo: 'entrega_pdf',
        estado: 'failed',
        error_mensaje: storageError
      });

      return res.status(500).json({ error: 'PDF no disponible' });
    }

    const descuentoExistente = config.MOCK_LIBRO_ENTREGA
      ? mockState.descuentos.find(item => item.compra_id === compra.id)
      : await supabaseService.getLibroDescuentoByCompra(compra.id);

    const codigoDescuento = descuentoExistente?.codigo || buildCodigoDescuento(compra.subscriber_id);

    if (!descuentoExistente && !config.MOCK_LIBRO_ENTREGA) {
      const validoHasta = new Date();
      validoHasta.setDate(validoHasta.getDate() + config.CODIGO_DESCUENTO_VALIDEZ_DIAS);
      await supabaseService.createLibroDescuento({
        compra_id: compra.id,
        codigo: codigoDescuento,
        porcentaje: 10,
        valido_hasta: validoHasta.toISOString()
      });
    }

    if (config.MOCK_LIBRO_ENTREGA && !descuentoExistente) {
      mockState.descuentos.push({
        compra_id: compra.id,
        codigo: codigoDescuento
      });
    }

    let brevoMessageId = null;
    try {
      const response = await retry(() => brevoService.enviarLibroPDF({
        email,
        nombre,
        producto,
        pdfUrl,
        comboUrl,
        codigoDescuento
      }), 3, 800);
      brevoMessageId = response?.messageId || null;
    } catch (error) {
      await saveLog({
        compra_id: compra.id,
        email,
        tipo: 'entrega_pdf',
        estado: 'failed',
        error_mensaje: error.message || 'Error enviando email'
      });

      return res.status(500).json({ error: 'Error enviando email' });
    }

    try {
      await brevoService.agregarContactoLista(email, nombre);
    } catch (error) {
      await saveLog({
        compra_id: compra.id,
        email,
        tipo: 'entrega_pdf',
        estado: 'failed',
        error_mensaje: error.message || 'Error agregando contacto'
      });

      return res.status(500).json({ error: 'Error agregando contacto' });
    }

    const logPayload = {
      compra_id: compra.id,
      email,
      tipo: 'entrega_pdf',
      brevo_message_id: brevoMessageId,
      estado: 'sent'
    };

    if (config.MOCK_LIBRO_ENTREGA) {
      mockState.logs.push({ ...logPayload, enviado_at: new Date().toISOString() });
    } else {
      await supabaseService.createLibroEmailLog(logPayload);
      await supabaseService.markLibroComprador(compra.subscriber_id, 1);
      await supabaseService.marcarEnvioPdf(compra.id, 'aprobado');
    }

    const adminMessage = `📧 PDF ENVIADO EXITOSAMENTE

Compra ID: ${compra.id}
Cliente: ${nombre}
Email: ${email}
Producto: ${producto === 'combo' ? 'Combo PDF + MP3' : 'Libro PDF'}

✅ Email enviado con éxito
✅ Agregado a lista nurture
✅ Código descuento: ${codigoDescuento}

Revisa tus emails (BCC) para confirmación.`;

    await manychatService.notifyAdmin({
      subscriberId: compra.subscriber_id,
      nombre,
      mensaje: adminMessage,
      timestamp: new Date().toISOString(),
    });

    const durationMs = Date.now() - start;
    Logger.info('✅ Entrega libro completada', { compraId: compra.id, email, durationMs });

    return res.status(200).json({
      success: true,
      email_sent: true,
      compra_id: compra.id,
      brevo_message_id: brevoMessageId,
      codigo_descuento: codigoDescuento
    });
  } catch (error) {
    Logger.error('❌ Error en webhook libro-entrega:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;