const express = require('express');
const router = express.Router();
const rateLimitService = require('../services/ratelimit.service');
const classifierService = require('../services/classifier.service');
const agentsService = require('../services/agents.service');
const supabaseService = require('../services/supabase.service');
const manychatService = require('../services/manychat.service');
const { detectLanguage } = require('../utils/language.util');
const Logger = require('../utils/logger.util');

// Links de SR Academy
const LINKS = {
  CURSO_GRATUITO: 'https://www.youtube.com/playlist?list=PLtik6WwJuNioT_cIRjR9kEfpjA62wNntK',
  MEMBRESIA: 'https://stevenriosfx.com/ofertadela%C3%B1o',
  WHATSAPP: '+573142735697'
};

// Función de sanitización
const sanitizeInput = (text) => {
  if (!text) return '';
  return String(text).trim().slice(0, 1000);
};

/**
 * Webhook principal de ManyChat para SR Academy
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
    const nombre = first_name || 'Trader';

    Logger.info('📨 [SR Academy] Mensaje recibido', { subscriber_id, nombre, mensaje });

    // ═══════════════════════════════════════
    // 2. DETECCIÓN DE PALABRAS CLAVE ESPECIALES
    // ═══════════════════════════════════════

    // LISTO - Completó el curso gratuito
    if (detectCursoCompletado(mensaje)) {
      Logger.info('🎓 Usuario completó curso gratuito', { subscriber_id });
      
      const response = getCursoCompletadoMessage(nombre);
      
      // Actualizar lead en Supabase
      await updateLeadStatus(subscriber_id, nombre, phone, {
        curso_gratuito_completado: true
      });

      await saveAnalytics(subscriber_id, nombre, 'CURSO_COMPLETADO', mensaje, response, false, startTime);

      return res.json({ response });
    }

    // CURSO GRATUITO - Pide el link del curso
    if (detectCursoGratuitoIntent(mensaje)) {
      Logger.info('📚 Usuario pide curso gratuito', { subscriber_id });
      
      const response = getCursoGratuitoMessage(nombre, subscriber_id);
      
      // Actualizar lead
      await updateLeadStatus(subscriber_id, nombre, phone, {
        curso_gratuito_enviado: true
      });

      await saveAnalytics(subscriber_id, nombre, 'CURSO_GRATUITO_ENVIADO', mensaje, response, false, startTime);

      return res.json({ response });
    }

    // MEMBRESÍA - Pide info de membresía directamente
    if (detectMembresiaIntent(mensaje)) {
      Logger.info('💰 Usuario pregunta por membresía', { subscriber_id });
      
      const response = getMembresiaMessage(nombre);
      
      await updateLeadStatus(subscriber_id, nombre, phone, {
        interesado_membresia: true
      });

      await saveAnalytics(subscriber_id, nombre, 'INFO_MEMBRESIA', mensaje, response, false, startTime);

      return res.json({ response });
    }

    // QUIERO PAGAR - Lead caliente
    if (detectQuierePagar(mensaje)) {
      Logger.info('🔥 LEAD CALIENTE - Quiere pagar', { subscriber_id, nombre });
      
      const response = getQuierePagarMessage(nombre);
      
      // Notificar a Steven (lead caliente)
      await notifyAdmin(subscriber_id, nombre, mensaje, 'LEAD_CALIENTE');
      
      await updateLeadStatus(subscriber_id, nombre, phone, {
        interesado_membresia: true,
        qualified: true
      });

      await saveAnalytics(subscriber_id, nombre, 'LEAD_CALIENTE', mensaje, response, true, startTime);

      return res.json({ response });
    }

    // HABLAR CON STEVEN - Escalamiento directo
    if (detectEscalamientoDirecto(mensaje)) {
      Logger.info('👤 Usuario pide hablar con Steven', { subscriber_id });
      
      const response = getEscalamientoMessage(nombre);
      
      await notifyAdmin(subscriber_id, nombre, mensaje, 'ESCALAMIENTO');

      await saveAnalytics(subscriber_id, nombre, 'ESCALAMIENTO', mensaje, response, true, startTime);

      return res.json({ response });
    }

    // SITUACIÓN DELICADA - Pérdida, desesperación
    if (detectSituacionDelicada(mensaje)) {
      Logger.info('⚠️ SITUACIÓN DELICADA detectada', { subscriber_id, nombre });
      
      const response = getSituacionDelicadaMessage(nombre);
      
      // Notificar a Steven siempre en casos delicados
      await notifyAdmin(subscriber_id, nombre, mensaje, 'SITUACION_DELICADA');

      await saveAnalytics(subscriber_id, nombre, 'SITUACION_DELICADA', mensaje, response, true, startTime);

      return res.json({ response });
    }

    // ═══════════════════════════════════════
    // 3. RATE LIMITING
    // ═══════════════════════════════════════
    const rateLimitResult = await rateLimitService.checkRateLimit(subscriber_id);
    
    if (!rateLimitResult.allowed) {
      const limitMessage = `Has alcanzado el límite de mensajes por hoy. Intenta mañana o escríbenos al WhatsApp: ${LINKS.WHATSAPP}`;
      Logger.warn('❌ Rate limit excedido', { subscriber_id });
      return res.json({ response: limitMessage });
    }

    // ═══════════════════════════════════════
    // 4. CLASIFICACIÓN IA
    // ═══════════════════════════════════════
    const idioma = detectLanguage(mensaje);
    Logger.info(`🌍 Idioma detectado: ${idioma}`);

    const { intent, emotion, nivel, urgencia } = await classifierService.classify(mensaje, idioma);
    Logger.info(`📂 Clasificación SR Academy`, { intent, emotion, nivel, urgencia });

    // ═══════════════════════════════════════
    // 5. EJECUTAR AGENTE
    // ═══════════════════════════════════════
    const respuesta = await agentsService.executeAgent(
      intent,
      emotion,
      subscriber_id,
      nombre,
      mensaje,
      idioma,
      nivel
    );

    // ═══════════════════════════════════════
    // 6. NOTIFICACIONES SEGÚN CASO
    // ═══════════════════════════════════════
    const fueEscalado = intent === 'ESCALAMIENTO' || intent === 'SITUACION_DELICADA';
    const esLeadCaliente = intent === 'LEAD_CALIENTE' || urgencia === 'alta';

    if (fueEscalado || esLeadCaliente) {
      const tipo = esLeadCaliente ? 'LEAD_CALIENTE' : intent;
      await notifyAdmin(subscriber_id, nombre, mensaje, tipo);
    }

    // ═══════════════════════════════════════
    // 7. ACTUALIZAR LEAD EN SUPABASE
    // ═══════════════════════════════════════
    const leadUpdates = {
      nivel: nivel
    };

    if (intent === 'APRENDER_CERO') {
      leadUpdates.nivel = 'cero';
      leadUpdates.curso_gratuito_enviado = true;
    } else if (intent === 'MEJORAR') {
      leadUpdates.nivel = 'intermedio';
    } else if (intent === 'INFO_PRODUCTOS') {
      leadUpdates.interesado_membresia = true;
    } else if (intent === 'LEAD_CALIENTE') {
      leadUpdates.interesado_membresia = true;
      leadUpdates.qualified = true;
    }

    await updateLeadStatus(subscriber_id, nombre, phone, leadUpdates);

    // ═══════════════════════════════════════
    // 8. GUARDAR ANALYTICS
    // ═══════════════════════════════════════
    await saveAnalytics(subscriber_id, nombre, intent, mensaje, respuesta, fueEscalado, startTime, idioma, emotion);

    // ═══════════════════════════════════════
    // 9. RESPONDER
    // ═══════════════════════════════════════
    Logger.info('✅ [SR Academy] Respuesta generada', { 
      subscriber_id, 
      intent, 
      emotion,
      duracion: Date.now() - startTime 
    });

    return res.json({ response: respuesta });

  } catch (error) {
    Logger.error('❌ Error en webhook SR Academy:', error);
    return res.status(500).json({ 
      response: `Disculpa, tuve un problema técnico. Escríbenos al WhatsApp: ${LINKS.WHATSAPP}`
    });
  }
});

// ═══════════════════════════════════════
// FUNCIONES DE DETECCIÓN
// ═══════════════════════════════════════

function detectCursoCompletado(mensaje) {
  const keywords = [
    'listo',
    'ya terminé',
    'ya termine',
    'terminé el curso',
    'termine el curso',
    'vi todo el curso',
    'completé el curso',
    'complete el curso',
    'ya lo vi todo',
    'ya vi las 12 horas'
  ];
  const m = mensaje.toLowerCase();
  return keywords.some(kw => m.includes(kw));
}

function detectCursoGratuitoIntent(mensaje) {
  const keywords = [
    'curso gratis',
    'curso gratuito',
    'quiero el curso',
    'dame el curso',
    'link del curso',
    'quiero aprender',
    'cómo empiezo',
    'como empiezo',
    'soy nuevo',
    'empezar desde cero',
    'no sé nada',
    'no se nada'
  ];
  const m = mensaje.toLowerCase();
  return keywords.some(kw => m.includes(kw));
}

function detectMembresiaIntent(mensaje) {
  const keywords = [
    'membresía',
    'membresia',
    'cuánto cuesta',
    'cuanto cuesta',
    'precio',
    'precios',
    'qué incluye',
    'que incluye',
    'platino',
    '$6',
    '6.99',
    '6 dólares',
    '6 dolares'
  ];
  const m = mensaje.toLowerCase();
  return keywords.some(kw => m.includes(kw));
}

function detectQuierePagar(mensaje) {
  const keywords = [
    'quiero pagar',
    'cómo pago',
    'como pago',
    'dónde pago',
    'donde pago',
    'quiero comprar',
    'lo compro',
    'me interesa comprar',
    'quiero la membresía',
    'quiero la membresia',
    'tomar la membresía',
    'adquirir'
  ];
  const m = mensaje.toLowerCase();
  return keywords.some(kw => m.includes(kw));
}

function detectEscalamientoDirecto(mensaje) {
  const keywords = [
    'hablar con steven',
    'contactar a steven',
    'quiero hablar con alguien',
    'hablar con un humano',
    'hablar con una persona',
    'necesito hablar con steven'
  ];
  const m = mensaje.toLowerCase();
  return keywords.some(kw => m.includes(kw));
}

function detectSituacionDelicada(mensaje) {
  const keywords = [
    'perdí todo',
    'perdi todo',
    'quemé mi cuenta',
    'queme mi cuenta',
    'estoy desesperado',
    'no sé qué hacer',
    'no se que hacer',
    'perdí mucho dinero',
    'perdi mucho dinero',
    'me arruiné',
    'me arruine',
    'deuda por trading',
    'préstamo para trading',
    'prestamo para trading'
  ];
  const m = mensaje.toLowerCase();
  return keywords.some(kw => m.includes(kw));
}

// ═══════════════════════════════════════
// MENSAJES PREDEFINIDOS
// ═══════════════════════════════════════

function getCursoGratuitoMessage(nombre, subscriberId) {
  return `¡Hola ${nombre}! 👋

Aquí tienes el curso gratuito de 12 horas. Es el mejor punto de partida para aprender trading desde cero:

📚 ${LINKS.CURSO_GRATUITO}

Te recomiendo verlo con calma y tomar notas. Es denso pero vale cada minuto.

Cuando lo termines, escríbeme LISTO y te cuento el siguiente paso. 💪`;
}

function getCursoCompletadoMessage(nombre) {
  return `¡Felicitaciones ${nombre}! 🎉

Terminar el curso ya te pone adelante del 90% que nunca termina lo que empieza.

El siguiente paso es la Membresía Platino por solo $6.99 USD:
✅ 4 meses de acceso a contenido premium
✅ Lives semanales con Steven
✅ Comunidad de +500 traders
✅ Ebook de Fibonacci gratis

Puedes verla aquí: ${LINKS.MEMBRESIA}

¿Tienes alguna pregunta? 💪`;
}

function getMembresiaMessage(nombre) {
  return `¡${nombre}! La Membresía Platino es la mejor forma de continuar 📚

Por solo $6.99 USD obtienes:
✅ 4 meses de acceso a +79 lecciones
✅ Lives semanales con Steven
✅ Comunidad de +500 traders
✅ Ebook Fibonacci gratis
✅ 2 eventos exclusivos

Puedes verla aquí: ${LINKS.MEMBRESIA}

¿Ya viste el curso gratuito de 12 horas? Si no, te recomiendo empezar por ahí:
${LINKS.CURSO_GRATUITO}`;
}

function getQuierePagarMessage(nombre) {
  return `¡Excelente decisión ${nombre}! 🔥

Puedes adquirir la Membresía Platino aquí:
${LINKS.MEMBRESIA}

El pago es seguro. Después de pagar tendrás acceso inmediato a:
✅ La plataforma con +79 lecciones
✅ Lives semanales
✅ La comunidad de traders

Si tienes problemas con el pago, escríbenos al WhatsApp: ${LINKS.WHATSAPP}

¡Bienvenido a SR Academy! 🚀`;
}

function getEscalamientoMessage(nombre) {
  return `Entendido ${nombre} 🤝

Ya le avisé a Steven y te responderá directamente por este chat en cuanto pueda.

Nuestro horario de atención es de 8am a 5pm (hora Colombia). Si escribes fuera de ese horario, te responderá al día siguiente.

¿Hay algo más en lo que pueda ayudarte mientras tanto?`;
}

function getSituacionDelicadaMessage(nombre) {
  return `${nombre}, entiendo que estás pasando por un momento muy difícil 💙

Perder duele. No solo el dinero, también la confianza y el tiempo invertido.

Mi recomendación más honesta: aléjate del mercado unos días. No operes desde la desesperación. El trading va a seguir ahí, pero tu bienestar es primero.

El peor error sería intentar recuperar lo perdido operando más. Eso casi siempre termina peor.

Ya le avisé a Steven de tu situación. Si quieres hablar con él directamente, te contactará pronto.

Una mala racha no te define como trader. 🙏`;
}

// ═══════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════

async function updateLeadStatus(subscriberId, nombre, phone, updates) {
  try {
    // Intentar actualizar, si no existe, insertar
    const leadData = {
      subscriber_id: subscriberId,
      first_name: nombre,
      phone: phone,
      ...updates,
      updated_at: new Date().toISOString()
    };

    await supabaseService.upsertLead(leadData);
  } catch (error) {
    Logger.error('Error actualizando lead:', error);
  }
}

async function saveAnalytics(subscriberId, nombre, categoria, mensaje, respuesta, fueEscalado, startTime, idioma = 'es', emotion = 'NEUTRAL') {
  try {
    await supabaseService.saveAnalytics({
      subscriber_id: subscriberId,
      nombre_cliente: nombre,
      categoria: categoria,
      emocion: emotion,
      mensaje_cliente: mensaje,
      respuesta_bot: respuesta,
      fue_escalado: fueEscalado,
      duracion_ms: Date.now() - startTime,
      idioma: idioma
    });
  } catch (error) {
    Logger.error('Error guardando analytics:', error);
  }
}

async function notifyAdmin(subscriberId, nombre, mensaje, tipo) {
  try {
    // Verificar si es horario de notificación (8am - 5pm Colombia)
    const now = new Date();
    const colombiaOffset = -5;
    const colombiaHour = (now.getUTCHours() + colombiaOffset + 24) % 24;
    
    const isBusinessHours = colombiaHour >= 8 && colombiaHour < 17;

    let notification = '';
    
    if (tipo === 'LEAD_CALIENTE') {
      notification = `🔥 LEAD CALIENTE - SR Academy

👤 ${nombre}
📱 ID: ${subscriberId}
💬 "${mensaje}"

⚡ Este lead quiere pagar/comprar`;
    } else if (tipo === 'SITUACION_DELICADA') {
      notification = `⚠️ SITUACIÓN DELICADA - SR Academy

👤 ${nombre}
📱 ID: ${subscriberId}
💬 "${mensaje}"

🚨 Posible crisis emocional/pérdida grande`;
    } else {
      notification = `👤 ESCALAMIENTO - SR Academy

👤 ${nombre}
📱 ID: ${subscriberId}
💬 "${mensaje}"

📞 Solicita hablar contigo`;
    }

    if (!isBusinessHours) {
      notification += `\n\n⏰ Mensaje fuera de horario (${colombiaHour}:00 Colombia)`;
    }

    await manychatService.notifyAdmin({
      subscriberId,
      nombre,
      mensaje: notification,
      timestamp: new Date().toISOString()
    });

    Logger.info('📢 Admin notificado', { tipo, subscriberId });
  } catch (error) {
    Logger.error('Error notificando admin:', error);
  }
}

module.exports = router;
