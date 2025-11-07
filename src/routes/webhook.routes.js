const express = require('express');
const router = express.Router();
const rateLimitService = require('../services/ratelimit.service');
const classifierService = require('../services/classifier.service');
const agentsService = require('../services/agents.service');
const supabaseService = require('../services/supabase.service');
const manychatService = require('../services/manychat.service');
const { detectLanguage } = require('../utils/language.util');
const { sanitizeInput } = require('../utils/sanitize.util');
const Logger = require('../utils/logger.util');

/**
 * Webhook principal de ManyChat para Sensora AI
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();

  try {
    // 1. Extraer datos de ManyChat
    const { subscriber_id, first_name, last_input_text, phone } = req.body;

    if (!subscriber_id || !last_input_text) {
      Logger.warn('Request inválido - faltan campos', req.body);
      return res.status(400).json({ error: 'subscriber_id y last_input_text son requeridos' });
    }

    const mensaje = sanitizeInput(last_input_text);
    const nombre = first_name || 'Cliente';

    Logger.info('📨 Mensaje recibido', { subscriber_id, nombre, mensaje });

    // 2. DETECCIÓN DE CÓDIGOS ESPECIALES (ANTES del rate limit)
    
    // CÓDIGO DIAGNÓSTICO (SENS-XXXX)
    const diagMatch = mensaje.match(/SENS-(\d{4})/i);
    if (diagMatch) {
      Logger.info('🎯 Código diagnóstico detectado:', diagMatch[0]);
      const response = getPostDiagnosticoMessage(nombre);
      
      await supabaseService.saveAnalytics({
        subscriber_id,
        nombre_cliente: nombre,
        categoria: 'POST_DIAGNOSTICO',
        mensaje_cliente: mensaje,
        respuesta_bot: response,
        fue_escalado: false,
        duracion_ms: Date.now() - startTime,
        idioma: 'es'
      });

      return res.json({ response });
    }

    // CÓDIGO PAGO (P-XXXX)
    const pagoMatch = mensaje.match(/P-([A-Z0-9]{5})/i);
    if (pagoMatch) {
      Logger.info('💳 Código de pago detectado:', pagoMatch[0]);
      const response = getPostPagoMessage(nombre);
      
      // Notificar a admin
      await manychatService.notifyAdmin({
        subscriberId: subscriber_id,
        nombre,
        mensaje: `🎉 PAGO CONFIRMADO - Código: ${pagoMatch[0]}\nCliente listo para agendar sesión`,
        timestamp: new Date().toISOString()
      });

      await supabaseService.saveAnalytics({
        subscriber_id,
        nombre_cliente: nombre,
        categoria: 'POST_PAGO',
        mensaje_cliente: mensaje,
        respuesta_bot: response,
        fue_escalado: true,
        duracion_ms: Date.now() - startTime,
        idioma: 'es'
      });

      return res.json({ response });
    }

    // DETECCIÓN DE INTENCIÓN DE PAGAR SESIÓN (keywords)
    const wantsPaidSession = detectPaidSessionIntent(mensaje);
    if (wantsPaidSession) {
      Logger.info('💰 Cliente quiere sesión pagada - solicitando datos');
      
      const response = `Perfecto! Para generar tu link de pago personalizado necesito:

📝 *Nombre completo:* (como aparecerá en el recibo)
📱 *WhatsApp:* (para enviarte el código de sesión)

¿Me confirmas esos dos datos?`;

      await supabaseService.saveAnalytics({
        subscriber_id,
        nombre_cliente: nombre,
        categoria: 'SOLICITUD_PAGO',
        mensaje_cliente: mensaje,
        respuesta_bot: response,
        fue_escalado: false,
        duracion_ms: Date.now() - startTime,
        idioma: 'es'
      });

      return res.json({ response });
    }

    // DETECCIÓN DE DATOS PARA GENERAR LINK (nombre + teléfono en el mensaje)
    const paymentData = extractPaymentData(mensaje, nombre, phone);
    if (paymentData.hasData) {
      Logger.info('💳 Generando link de pago', paymentData);
      
      const paymentResult = await manychatService.generatePaymentLink(
        paymentData.nombre,
        paymentData.whatsapp,
        25
      );

      if (paymentResult.success) {
        const response = `🧾 ¡Excelente! Aquí tienes tu enlace de pago personalizado:

${paymentResult.link}

🔖 *Código de sesión:* ${paymentResult.codigo}

📌 Tu sesión se agenda después de completar el pago.
🧠 Al pagar recibirás un código (P-XXXXX) por email. Envíamelo aquí para coordinar tu horario.

💡 Tip: El pago de $25 USD se descuenta si decides trabajar con nosotros.`;

        await supabaseService.saveAnalytics({
          subscriber_id,
          nombre_cliente: nombre,
          categoria: 'LINK_PAGO_GENERADO',
          mensaje_cliente: mensaje,
          respuesta_bot: response,
          fue_escalado: false,
          duracion_ms: Date.now() - startTime,
          idioma: 'es'
        });

        return res.json({ response });
      } else {
        const response = `Disculpa, hubo un error generando tu link de pago. Por favor escríbeme a steven@getsensora.com y te ayudo directamente.`;
        return res.json({ response });
      }
    }

    // 3. Rate limiting (solo para conversaciones normales)
    const rateLimitResult = rateLimitService.checkLimit(subscriber_id);
    
    if (!rateLimitResult.allowed) {
      const limitMessage = `Has alcanzado el límite de ${rateLimitResult.limit} mensajes por día. Intenta mañana o escríbenos a steven@getsensora.com`;
      Logger.warn('❌ Rate limit excedido', { subscriber_id });
      return res.json({ response: limitMessage });
    }

    // 4. Detectar idioma
    const idioma = detectLanguage(mensaje);
    Logger.info(`🌍 Idioma detectado: ${idioma}`);

    // 5. Clasificar mensaje
    const categoria = await classifierService.classify(mensaje, idioma);
    Logger.info(`📂 Categoría: ${categoria}`);

    // 6. Ejecutar agente correspondiente
    const respuesta = await agentsService.executeAgent(
      categoria,
      subscriber_id,
      nombre,
      mensaje,
      idioma
    );

    // 7. Notificar admin si es escalamiento
    const fueEscalado = categoria === 'ESCALAMIENTO';
    if (fueEscalado) {
      await manychatService.notifyAdmin({
        subscriberId: subscriber_id,
        nombre,
        mensaje,
        timestamp: new Date().toISOString()
      });
    }

    // 8. Guardar analytics
    await supabaseService.saveAnalytics({
      subscriber_id,
      nombre_cliente: nombre,
      categoria,
      mensaje_cliente: mensaje,
      respuesta_bot: respuesta,
      fue_escalado: fueEscalado,
      duracion_ms: Date.now() - startTime,
      idioma
    });

    // 9. Responder
    Logger.info('✅ Respuesta generada', { 
      subscriber_id, 
      categoria, 
      duracion: Date.now() - startTime 
    });

    return res.json({ response: respuesta });

  } catch (error) {
    Logger.error('❌ Error en webhook:', error);
    return res.status(500).json({ 
      response: 'Disculpa, tuve un problema técnico. Por favor escribe a steven@getsensora.com'
    });
  }
});

/**
 * Detecta si el mensaje indica intención de pagar sesión
 */
function detectPaidSessionIntent(mensaje) {
  const keywords = [
    'quiero la sesión pagada',
    'me interesa la de $25',
    'prefiero la pagada',
    'sí, quiero pagar',
    'acepto la sesión de 25',
    'quiero agendar pagando'
  ];

  const mensajeNorm = mensaje.toLowerCase();
  return keywords.some(kw => mensajeNorm.includes(kw));
}

/**
 * Extrae datos de pago del mensaje (nombre + teléfono)
 */
function extractPaymentData(mensaje, defaultNombre, defaultPhone) {
  // Buscar patrón: Nombre: X, WhatsApp: Y
  const pattern = /nombre[:\s]*([^\n,]+)[,\n]*whatsapp[:\s]*(\+?\d+)/i;
  const match = mensaje.match(pattern);

  if (match) {
    return {
      hasData: true,
      nombre: match[1].trim(),
      whatsapp: match[2].trim()
    };
  }

  // Si no encuentra el patrón pero hay un teléfono en el mensaje
  const phonePattern = /(\+\d{10,15})/;
  const phoneMatch = mensaje.match(phonePattern);
  
  if (phoneMatch && defaultNombre) {
    return {
      hasData: true,
      nombre: defaultNombre,
      whatsapp: phoneMatch[1]
    };
  }

  return { hasData: false };
}

/**
 * Mensaje después de completar diagnóstico (SENS-XXXX)
 */
function getPostDiagnosticoMessage(nombre) {
  return `¡Gracias por completar el diagnóstico, ${nombre}! 🎉

Revisé tu información y tu caso tiene potencial real de automatización.

📞 *¿Te gustaría tener una sesión estratégica 1:1?*

En 30-45 minutos analizamos:
- Tu operación actual en detalle
- 3-5 automatizaciones específicas para tu caso
- Cotización exacta y timeline de implementación

💰 Inversión: $25 USD (se descuentan si trabajamos juntos)

¿Te interesa agendarla? Responde *"Sí, quiero la sesión pagada"* y te ayudo con el pago.`;
}

/**
 * Mensaje después de confirmar pago (P-XXXX)
 */
function getPostPagoMessage(nombre) {
  return `¡Pago confirmado, ${nombre}! ✅

Tu sesión estratégica ya está lista para agendarse.

📅 *Dime tu disponibilidad:*
¿Qué día y hora te viene mejor? 

Ejemplos: 
- "Martes 10am"
- "Jueves 3pm"
- "Viernes en la mañana"

⏰ Horarios disponibles: Lunes a Viernes, 9am - 6pm (GMT-5 Bogotá)

Te confirmo en los próximos minutos y te envío el link de Google Meet. 

¿Cuándo te gustaría tu sesión?`;
}

module.exports = router;