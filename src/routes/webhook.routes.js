const express = require('express');
const router = express.Router();
const rateLimitService = require('../services/ratelimit.service');
const classifierService = require('../services/classifier.service');
const agentsService = require('../services/agents.service');
const supabaseService = require('../services/supabase.service');
const manychatService = require('../services/manychat.service');
const { detectLanguage } = require('../utils/language.util');
const Logger = require('../utils/logger.util');

// ✅ Whisper service
const whisperService = require('../services/whisper.service');

// Links de SR Academy - ACTUALIZADOS 2025
const LINKS = {
  CURSO_GRATUITO: 'https://www.youtube.com/playlist?list=PLtik6WwJuNioT_cIRjR9kEfpjA62wNntK',
  PRICING: 'https://stevenriosfx.com/pricing',
  WHATSAPP_VENTAS: '+573006926613',
  WHATSAPP_SOPORTE: '+573142735697'
};

/**
 * Webhook principal de ManyChat para SR Academy
 * ✅ RUTA CORRECTA: '/'
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();

  try {
    // ✅ EXTRAER DATOS DE subscriber_data
    const data = req.body;

    const subscriber_id = data.id || data.subscriber_id;
    const first_name = data.first_name || data.name;
    const last_name = data.last_name || '';
    const phone = data.phone || data.whatsapp_phone;
    const last_input_text = data.last_input_text || data.text;

    Logger.info('📥 Datos recibidos de ManyChat', {
      subscriber_id,
      first_name,
      last_input_text: last_input_text ? last_input_text.substring(0, 50) : '[vacío]'
    });

    if (!subscriber_id) {
      Logger.warn('⚠️ Request inválido - falta subscriber_id');
      return res.status(400).json({ error: 'subscriber_id es requerido' });
    }

    const nombre = first_name || 'Trader';
    let mensaje = last_input_text;

    // Sanitizar mensaje
    if (mensaje) {
      mensaje = mensaje.trim();
      if (mensaje.length > 1000) {
        mensaje = mensaje.substring(0, 1000);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // DETECTAR SI ES AUDIO
    // ═══════════════════════════════════════════════════════════════
    
    const esAudio = mensaje && (
      mensaje.includes('.ogg') || 
      mensaje.includes('.mp3') || 
      mensaje.includes('.m4a') ||
      mensaje.includes('.wav')
    );

    if (esAudio) {
      Logger.info('🎤 Audio detectado, transcribiendo...');
      
      try {
        const transcription = await whisperService.transcribeAudio(mensaje);
        mensaje = transcription.text;

        Logger.info('✅ Audio transcrito', { preview: mensaje.substring(0, 100) });
        
        // Guardar transcripción
        try {
          const { error } = await supabaseService.supabase
            .from('sracademy_audio_transcriptions')
            .insert({
              subscriber_id: subscriber_id,
              audio_url: last_input_text,
              transcription: mensaje,
              duracion_segundos: transcription.duration || null,
              idioma: 'es',
              created_at: new Date().toISOString()
            });

          if (error) {
            Logger.warn('⚠️ Error guardando transcripción:', error);
          } else {
            Logger.info('💾 Transcripción guardada en Supabase');
          }
        } catch (saveError) {
          Logger.warn('⚠️ No se pudo guardar transcripción:', saveError.message);
        }

      } catch (error) {
        Logger.error('❌ Error transcribiendo audio:', error);
        return res.json({ 
          response: 'Disculpa, no pude escuchar tu audio. ¿Podrías escribirme en texto?' 
        });
      }
    }

    // Validar mensaje
    if (!mensaje || mensaje.trim().length === 0) {
      return res.json({
        response: 'No recibí tu mensaje. ¿Podrías intentarlo de nuevo?'
      });
    }

    Logger.info('📨 [SR Academy] Mensaje recibido', { subscriber_id, nombre, mensaje });

    // ═══════════════════════════════════════
    // DETECCIÓN DE PALABRAS CLAVE ESPECIALES
    // Solo casos MUY específicos que no requieren IA
    // ═══════════════════════════════════════

    // LISTO - Completó el curso gratuito
    if (detectCursoCompletado(mensaje)) {
      Logger.info('🎓 Usuario completó curso gratuito', { subscriber_id });

      const response = getCursoCompletadoMessage(nombre);

      await updateLeadStatus(subscriber_id, nombre, phone, {
        curso_gratuito_completado: true
      });

      await saveAnalytics(subscriber_id, nombre, 'CURSO_COMPLETADO', mensaje, response, false, startTime);

      return res.json({ response });
    }

    // SITUACIÓN DELICADA - Pérdida, desesperación (crítico)
    if (detectSituacionDelicada(mensaje)) {
      Logger.info('⚠️ SITUACIÓN DELICADA detectada', { subscriber_id, nombre });

      const response = getSituacionDelicadaMessage(nombre);

      // Notificar a Steven siempre en casos delicados
      await notifyAdmin(subscriber_id, nombre, mensaje, 'SITUACION_DELICADA');

      await saveAnalytics(subscriber_id, nombre, 'SITUACION_DELICADA', mensaje, response, true, startTime);

      return res.json({ response });
    }

    // ═══════════════════════════════════════
    // RATE LIMITING
    // ═══════════════════════════════════════
    const rateLimitResult = await rateLimitService.checkRateLimit(subscriber_id);

    if (!rateLimitResult.allowed) {
      const limitMessage = `Has alcanzado el límite de mensajes por hoy. Intenta mañana o escríbenos al WhatsApp: ${LINKS.WHATSAPP_SOPORTE}`;
      Logger.warn('❌ Rate limit excedido', { subscriber_id });
      return res.json({ response: limitMessage });
    }

    // ═══════════════════════════════════════
    // CLASIFICACIÓN IA
    // ═══════════════════════════════════════
    const idioma = detectLanguage(mensaje);
    Logger.info(`🌍 Idioma detectado: ${idioma}`);

    const { intent, emotion, nivel, urgencia } = await classifierService.classify(mensaje, idioma);
    Logger.info(`📂 Clasificación SR Academy`, { intent, emotion, nivel, urgencia });

    // ═══════════════════════════════════════
    // EJECUTAR AGENTE IA
    // TODO pasa por aquí ahora (precios, membresías, etc)
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
    // NOTIFICACIONES SEGÚN CASO
    // ═══════════════════════════════════════
    const fueEscalado = intent === 'ESCALAMIENTO' || intent === 'SITUACION_DELICADA';
    const esLeadCaliente = intent === 'LEAD_CALIENTE' || urgencia === 'alta';

    if (fueEscalado || esLeadCaliente) {
      const tipo = esLeadCaliente ? 'LEAD_CALIENTE' : intent;
      await notifyAdmin(subscriber_id, nombre, mensaje, tipo);
    }

    // ═══════════════════════════════════════
    // ACTUALIZAR LEAD EN SUPABASE
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
    // GUARDAR ANALYTICS
    // ═══════════════════════════════════════
    await saveAnalytics(subscriber_id, nombre, intent, mensaje, respuesta, fueEscalado, startTime, idioma, emotion);

    // ═══════════════════════════════════════
    // RESPONDER
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
      response: `Disculpa, tuve un problema técnico. Escríbenos al WhatsApp: ${LINKS.WHATSAPP_SOPORTE}`
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

function getCursoCompletadoMessage(nombre) {
  return `¡Felicitaciones ${nombre}! 🎉

Terminar el curso ya te pone adelante del 90% que nunca termina lo que empieza.

El siguiente paso según tu nivel:

📚 Principiante: Academy ($497, 12 meses)
💪 Con experiencia: Professional ($997, 18 meses)
🚀 Avanzado: Master ($1,997, 24 meses)
👑 Mentoría 1-1: Elite ($2,997, 3 años)

Compara todas aquí: ${LINKS.PRICING}

¿Cuál se ajusta a tu situación actual?`;
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


