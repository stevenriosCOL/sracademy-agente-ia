const express = require('express');
const router = express.Router();
const rateLimitService = require('../services/ratelimit.service');
const classifierService = require('../services/classifier.service');
const agentsService = require('../services/agents.service');
const manychatService = require('../services/manychat.service');
const supabaseService = require('../services/supabase.service');
const { detectLanguage, getContextualGreeting } = require('../utils/language.util');
const { sanitizeText, sanitizeEscalationMessage, sanitizeSubscriberId } = require('../utils/sanitize.util');
const Logger = require('../utils/logger.util');

/**
 * POST /webhook/vuelasim-bot
 * Webhook principal que recibe mensajes de ManyChat
 * Replica exactamente el flujo del workflow de n8n
 */
router.post('/vuelasim-bot', async (req, res) => {
  const startTime = Date.now();
  
  try {
    Logger.info('🔵 Webhook recibido', { body: req.body });

    // 1. EXTRAER DATOS (nodo "Extraer" de n8n)
    const body = req.body || {};
    let subscriberId = body.subscriber_id || body.key || 'unknown';
    subscriberId = sanitizeSubscriberId(subscriberId);
    
    const mensaje = sanitizeText(body.last_input_text || body.text || '');
    const nombre = body.first_name || 'viajero';
    const phone = body.phone || body.whatsapp_phone || '';

    if (!mensaje) {
      Logger.warn('⚠️ Mensaje vacío recibido', { subscriberId });
      return res.status(400).json({ error: 'Mensaje vacío' });
    }

    // 2. DETECCIÓN DE IDIOMA (función detectarIdioma de n8n)
    const idioma = detectLanguage(mensaje);
    const saludo = getContextualGreeting(idioma);

    Logger.info('📋 Datos extraídos', {
      subscriberId,
      nombre,
      idioma,
      mensajeLength: mensaje.length
    });

    // 3. RATE LIMITING (nodo "If4" de n8n)
    const rateLimitCheck = await rateLimitService.checkRateLimit(subscriberId);
    
    if (!rateLimitCheck.allowed) {
      Logger.warn('🚫 Rate limit excedido', { 
        subscriberId, 
        count: rateLimitCheck.count 
      });

      const limitMessage = rateLimitService.getRateLimitMessage(idioma);
      await manychatService.sendMessage(subscriberId, limitMessage);

      return res.status(200).json({ 
        status: 'rate_limited',
        message: 'Rate limit excedido'
      });
    }

    Logger.info(`✅ Rate limit OK: ${rateLimitCheck.count}/${rateLimitService.maxMessages}`);

    // 4. CLASIFICACIÓN (nodo "Clasificador" de n8n)
    const categoria = await classifierService.classify(mensaje, idioma);
    Logger.info(`🎯 Categoría: ${categoria}`);

    // 5. EJECUTAR AGENTE SEGÚN CATEGORÍA (nodos Ventas/Soporte/Tecnico/Escalamiento)
    const context = {
      subscriberId,
      nombre,
      idioma,
      saludo,
      phone
    };

    const respuestaBot = await agentsService.executeAgent(categoria, mensaje, context);

    // 6. NOTIFICAR ADMIN SI ES ESCALAMIENTO (nodo "Notificar?")
    if (categoria === 'ESCALAMIENTO') {
      const mensajeLimpio = sanitizeEscalationMessage(mensaje);
      await manychatService.notifyAdmin({
        subscriberId,
        nombre,
        mensaje: mensajeLimpio,
        timestamp: new Date().toISOString()
      });
    }

    // 7. ENVIAR RESPUESTA A MANYCHAT (nodo "Enviar")
    const sendResult = await manychatService.sendMessage(subscriberId, respuestaBot);

    if (!sendResult.success) {
      Logger.error('Error enviando respuesta a ManyChat', sendResult);
    }

    // 8. GUARDAR ANALYTICS (nodo "Guardar Analytics")
    const duracion = Date.now() - startTime;
    await supabaseService.saveAnalytics({
      subscriber_id: subscriberId,
      nombre_cliente: nombre,
      categoria: categoria,
      mensaje_cliente: mensaje,
      respuesta_bot: respuestaBot,
      fue_escalado: categoria === 'ESCALAMIENTO',
      duracion_ms: duracion,
      idioma: idioma
    });

    Logger.info('✅ Webhook procesado exitosamente', {
      subscriberId,
      categoria,
      duracion: `${duracion}ms`
    });

    // Responder a ManyChat
    return res.status(200).json({
      status: 'success',
      categoria: categoria,
      duracion_ms: duracion
    });

  } catch (error) {
    Logger.error('❌ Error procesando webhook:', error);
    
    return res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;