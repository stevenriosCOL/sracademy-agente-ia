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
  WHATSAPP_SOPORTE: '+573006926613'
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

// ═══════════════════════════════════════════════════════════════
// DETECTAR SI ES IMAGEN (comprobante de pago)
// ═══════════════════════════════════════════════════════════════

Logger.info('🧪 DEBUG mensaje pre-imagen', { subscriber_id, mensaje });

// Mejorar detección de URLs de imágenes (con querystrings)
const esImagen = mensaje && (
  /\.(jpg|jpeg|png|webp|gif|bmp)/i.test(mensaje) || // ✅ El punto ya funciona en regex
  mensaje.toLowerCase().includes('/image') ||
  mensaje.toLowerCase().includes('/media') ||
  mensaje.toLowerCase().includes('/photo') ||
  mensaje.toLowerCase().includes('imgur.com') ||
  mensaje.toLowerCase().includes('cdn') ||
  (mensaje.startsWith('http') && (
    mensaje.includes('image') ||
    mensaje.includes('photo') ||
    mensaje.includes('img') ||
    mensaje.includes('pic')
  ))
);

Logger.info('🔍 Detección imagen', { esImagen, url: mensaje?.substring(0, 100) });

if (esImagen) {
  Logger.info('📸 Imagen detectada', { subscriber_id, url: mensaje.substring(0, 100) });

  // Buscar compra pendiente
  const compraPendiente = await supabaseService.getCompraPendiente(subscriber_id);

  Logger.info('🔍 Compra pendiente', { 
    subscriber_id, 
    existe: !!compraPendiente,
    estado: compraPendiente?.estado,
    tiene_comprobante: !!compraPendiente?.comprobante_url
  });

  // CASO 1: Sin compra pendiente
  if (!compraPendiente) {
    Logger.info('ℹ️ Imagen sin compra pendiente', { subscriber_id });
    
    const response = `Recibí una imagen 📸. ¿Es un comprobante de pago del libro? Responde SÍ o NO.`;
    
    await saveAnalytics(
      subscriber_id,
      nombre,
      'IMAGEN_SIN_CONTEXTO',
      mensaje,
      response,
      false,
      startTime
    );
    
    return res.json({ response });
  }

  // CASO 2: Ya tiene comprobante guardado (verificar PRIMERO)
  if (compraPendiente.comprobante_url && compraPendiente.comprobante_url.trim() !== '') {
    Logger.info('⚠️ Ya existe comprobante previo', {
      subscriber_id,
      compra_id: compraPendiente.id,
      estado: compraPendiente.estado,
      comprobante_existente: compraPendiente.comprobante_url.substring(0, 50)
    });

    const fechaComprobante = compraPendiente.fecha_comprobante 
      ? new Date(compraPendiente.fecha_comprobante).toLocaleDateString('es-CO')
      : 'hace poco';

    const response = `Ya tengo tu comprobante registrado del ${fechaComprobante}. Si necesitas actualizar algo, escribe 'hablar con Steven'.`;
    
    await saveAnalytics(
      subscriber_id,
      nombre,
      'COMPROBANTE_DUPLICADO',
      mensaje,
      response,
      false,
      startTime
    );
    
    return res.json({ response });
  }

  // CASO 3: Estado no válido para comprobante (solo 'pendiente' acepta)
  if (compraPendiente.estado !== 'pendiente') {
    Logger.info('⚠️ Imagen recibida pero estado no válido', {
      subscriber_id,
      compra_id: compraPendiente.id,
      estado: compraPendiente.estado
    });

    const response = `Ya recibí tu comprobante anteriormente. Steven lo está verificando.`;
    
    await saveAnalytics(
      subscriber_id,
      nombre,
      'IMAGEN_ESTADO_INVALIDO',
      mensaje,
      response,
      false,
      startTime
    );
    
    return res.json({ response });
  }

  // CASO 4: ✅ TODO VÁLIDO - Procesar como comprobante
  Logger.info('✅ Compra pendiente encontrada (estado válido para comprobante)', {
    compra_id: compraPendiente.id,
    estado: compraPendiente.estado
  });

  // Guardar comprobante (ya actualiza estado a 'comprobante_recibido')
  const guardado = await supabaseService.updateCompraComprobante(compraPendiente.id, mensaje);
  
  if (!guardado) {
    Logger.error('❌ Error guardando comprobante', { compra_id: compraPendiente.id });
    return res.json({
      response: `Hubo un error guardando tu comprobante. Por favor, inténtalo de nuevo o contacta a Steven.`
    });
  }

  // Marcar como interesado (no comprador hasta verificar)
  await supabaseService.markLibroInteresado(subscriber_id);

  // Notificar a Steven
  await notifyAdmin(
    subscriber_id,
    nombre,
    `📸 COMPROBANTE LIBRO RECIBIDO

Compra ID: ${compraPendiente.id}
Cliente: ${compraPendiente.nombre_completo}
Email: ${compraPendiente.email}
Celular: ${compraPendiente.celular}
País: ${compraPendiente.pais}
Método: ${compraPendiente.metodo_pago}
Producto: ${compraPendiente.producto || 'pdf'}
Monto: $${compraPendiente.monto_usd} USD

Comprobante: ${mensaje}

ACCIÓN REQUERIDA:
1️⃣ Verificar pago en ${compraPendiente.metodo_pago}
2️⃣ Si correcto → Enviar ${compraPendiente.producto === 'combo' ? 'PDF + MP3' : 'PDF'} del libro
3️⃣ Activar acceso al curso complementario
4️⃣ Añadir a grupo WhatsApp estudiantes`,
    'COMPROBANTE_LIBRO'
  );

  await saveAnalytics(
    subscriber_id,
    nombre,
    'COMPROBANTE_LIBRO',
    'Imagen de comprobante',
    'Comprobante recibido',
    true,
    startTime
  );

  return res.json({
    response: `Perfecto ${nombre}! Recibí tu comprobante 📸

Estoy verificando el pago ahora mismo.

Te confirmo y envío el libro en máximo 2 horas (generalmente antes).

Si es urgente, Steven te responderá por este mismo chat. Gracias por tu paciencia 🙏`
  });
}

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

// ═══════════════════════════════════════════════════════════════
// DETECTAR DATOS DEL COMPRADOR (nombre + email + celular)
// ═══════════════════════════════════════════════════════════════

const datosCapturaResult = await detectarDatosComprador(subscriber_id, mensaje);

if (datosCapturaResult.detected) {
  // ✅ FIX BUG 3: VALIDAR CONTEXTO DE LIBRO
  const memoryService = require('../services/memory.service');
  const memoriaReciente = memoryService.getHistory(subscriber_id, 15);
  
  const textoMemoriaValidacion = memoriaReciente
    .map(m => {
      const texto = typeof m === 'string' ? m : (m.content || m.message || '');
      return (texto || '').toLowerCase();
    })
    .join(' ');
  
  const mencionaLibroReciente =
    textoMemoriaValidacion.includes('libro') ||
    textoMemoriaValidacion.includes('30 días') ||
    textoMemoriaValidacion.includes('30 dias') ||
    textoMemoriaValidacion.includes('peor enemigo') ||
    (textoMemoriaValidacion.includes('comprar') && (
      textoMemoriaValidacion.includes('pdf') ||
      textoMemoriaValidacion.includes('combo')
    ));
  
  if (!mencionaLibroReciente) {
    Logger.info('📋 Datos detectados pero NO en contexto de libro', { subscriber_id });
    // No hacer nada, dejar que continúe el flujo normal
  } else {
    Logger.info('📋 Datos del comprador detectados EN CONTEXTO DE LIBRO', {
      subscriber_id,
      nombre: datosCapturaResult.nombre,
      email: datosCapturaResult.email
    });

    // Obtener país y método de pago de la memoria
    const memoriaRecienteInfo = memoryService.getHistory(subscriber_id, 10);

    const textoMemoria = memoriaRecienteInfo
      .map(m => {
        const texto = typeof m === 'string' ? m : (m.content || m.message || '');
        return (texto || '').toLowerCase();
      })
      .join(' ');

    // ✅ FIX BUG 4: AGREGAR VENEZUELA Y ECUADOR
    let pais = null;
    const paises = {
      'colombia': 'Colombia',
      'méxico': 'México',
      'mexico': 'México',
      'argentina': 'Argentina',
      'chile': 'Chile',
      'perú': 'Perú',
      'peru': 'Perú',
      'españa': 'España',
      'spain': 'España',
      'venezuela': 'Venezuela',
      'ecuador': 'Ecuador'
    };

    for (const [key, value] of Object.entries(paises)) {
      if (textoMemoria.includes(key)) {
        pais = value;
        break;
      }
    }

    // Detectar método de pago
    let metodoPago = null;
    if (textoMemoria.includes('mercado pago') || textoMemoria.includes('mercadopago')) {
      metodoPago = 'mercado_pago';
    } else if (textoMemoria.includes('llave') || textoMemoria.includes('bre b') || textoMemoria.includes('breb')) {
      metodoPago = 'llave_breb';
    } else if (textoMemoria.includes('bancolombia')) {
      metodoPago = 'bancolombia';
    } else if (textoMemoria.includes('cripto') || textoMemoria.includes('usdt') || textoMemoria.includes('bitcoin')) {
      metodoPago = 'criptomonedas';
    }

    if (pais && metodoPago) {
      // ✅ FIX BUG 2: PREVENIR DUPLICADOS
      const compraPendiente = await supabaseService.getCompraPendiente(subscriber_id);
      
      if (compraPendiente) {
        Logger.info('⚠️ Ya existe compra pendiente', { 
          compra_id: compraPendiente.id, 
          subscriber_id 
        });

        const response = `Ya tengo tu solicitud de compra registrada ✓

Ahora solo envíame la captura del comprobante de pago 📸`;

        await saveAnalytics(
          subscriber_id,
          nombre,
          'COMPRA_YA_EXISTE',
          mensaje,
          response,
          false,
          startTime
        );

        return res.json({ response });
      }

      // ✅ FIX BUG 1: GUARDAR PRODUCTO CORRECTO
      const montoUSD = (textoMemoria.includes('combo') ||
        textoMemoria.includes('premium') ||
        textoMemoria.includes('audiolibro') ||
        textoMemoria.includes('audio') ||
        textoMemoria.includes('mp3'))
        ? 29.99
        : 19.99;
      
      const productoLibro = montoUSD === 29.99 ? 'combo' : 'pdf';

      // Crear registro en libro_compras
      const compraCreada = await supabaseService.createCompraLibro({
        subscriber_id: subscriber_id,
        nombre_completo: datosCapturaResult.nombre,
        email: datosCapturaResult.email,
        celular: datosCapturaResult.celular,
        pais: pais,
        metodo_pago: metodoPago,
        monto_usd: montoUSD,
        producto: productoLibro
      });

      if (compraCreada) {
        Logger.info('✅ Compra libro creada', {
          compra_id: compraCreada.id,
          subscriber_id,
          metodo_pago: metodoPago,
          producto: productoLibro,  // ✅ Log del producto correcto
          monto_usd: montoUSD
        });

        // Marcar lead como interesado en libro
        await supabaseService.markLibroInteresado(subscriber_id);

        const response = `Perfecto ${nombre}! Ya tengo tus datos ✓

Ahora envíame la captura del comprobante de pago 📸

Te confirmo la recepción del libro en máximo 30 minutos después de verificar el pago.`;

        await saveAnalytics(
          subscriber_id,
          nombre,
          'DATOS_COMPRADOR_LIBRO',
          mensaje,
          response,
          false,
          startTime
        );

        return res.json({ response });
      }
    }
  }
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
    // DETECTAR CONTEXTO DE COMPRA DEL LIBRO (ROBUSTO)
    // ═══════════════════════════════════════
    let contextoCompra = null;
    let productoLibro = null; // 'pdf' | 'combo'

    const memoryService = require('../services/memory.service');
    const memoriaReciente = memoryService.getHistory(subscriber_id, 12);

    const ultimosMensajes = memoriaReciente
      .map(m => {
        const texto = typeof m === 'string' ? m : (m.content || m.message || '');
        return (texto || '').toLowerCase();
      })
      .join(' ');

    const mencionaLibroEnHistorial =
      ultimosMensajes.includes('libro') ||
      ultimosMensajes.includes('30 días') ||
      ultimosMensajes.includes('30 dias') ||
      ultimosMensajes.includes('peor enemigo');

    const mencionaLibroEnMensaje =
      mensaje.toLowerCase().includes('libro') ||
      mensaje.toLowerCase().includes('30 días') ||
      mensaje.toLowerCase().includes('30 dias') ||
      mensaje.toLowerCase().includes('peor enemigo');

    const flujoLibroActivo = mencionaLibroEnMensaje || mencionaLibroEnHistorial;

    // detectar producto (pdf vs combo) por mensaje o historial
    const mencionaCombo =
      mensaje.toLowerCase().includes('combo') ||
      mensaje.toLowerCase().includes('premium') ||
      mensaje.toLowerCase().includes('audiolibro') ||
      mensaje.toLowerCase().includes('audio') ||
      mensaje.toLowerCase().includes('mp3') ||
      ultimosMensajes.includes('combo') ||
      ultimosMensajes.includes('premium') ||
      ultimosMensajes.includes('audiolibro') ||
      ultimosMensajes.includes('mp3');

    productoLibro = mencionaCombo ? 'combo' : 'pdf';

    if (flujoLibroActivo && (intent === 'LEAD_CALIENTE' || intent === 'COMPRA_LIBRO_PROCESO')) {
      const paises = ['colombia', 'méxico', 'mexico', 'argentina', 'chile', 'perú', 'peru', 'españa', 'spain', 'venezuela', 'ecuador'];
      const tienePais = paises.some(p => ultimosMensajes.includes(p) || mensaje.toLowerCase().includes(p));

      const metodos = ['mercado pago', 'mercadopago', 'llave', 'bre b', 'breb', 'bancolombia', 'cripto', 'usdt', 'bitcoin'];
      const tieneMetodo = metodos.some(m => ultimosMensajes.includes(m) || mensaje.toLowerCase().includes(m));

      const emailRegex = /@/;
      const telefonoRegex = /\+?\d{10,}/;
      const tieneDatos = emailRegex.test(ultimosMensajes) && telefonoRegex.test(ultimosMensajes);

      if (!tienePais) contextoCompra = 'ESPERANDO_PAIS';
      else if (!tieneMetodo) contextoCompra = 'ESPERANDO_METODO';
      else if (!tieneDatos) contextoCompra = 'ESPERANDO_DATOS';
      else contextoCompra = 'ESPERANDO_COMPROBANTE';

      Logger.info('📚 CONTEXTO COMPRA LIBRO', { contextoCompra, productoLibro, tienePais, tieneMetodo, tieneDatos });
    }

    // ═══════════════════════════════════════
    // EJECUTAR AGENTE IA
    // ═══════════════════════════════════════
    const respuesta = await agentsService.executeAgent(
      intent,
      emotion,
      subscriber_id,
      nombre,
      mensaje,
      idioma,
      nivel,
      contextoCompra
    );

    // ═══════════════════════════════════════
    // NOTIFICACIONES SEGÚN CASO
    // ═══════════════════════════════════════
    const fueEscalado = intent === 'ESCALAMIENTO' || intent === 'SITUACION_DELICADA';
    const esLeadCaliente = intent === 'LEAD_CALIENTE' || urgencia === 'alta';

    if (fueEscalado || esLeadCaliente || intent === 'SOPORTE_ESTUDIANTE') {
      const tipo = esLeadCaliente ? 'LEAD_CALIENTE' :
        intent === 'SOPORTE_ESTUDIANTE' ? 'SOPORTE_ESTUDIANTE' :
          intent;
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
    } else if (intent === 'LIBRO_30_DIAS') {
      // PRIMERO: Crear/actualizar lead base
      await updateLeadStatus(subscriber_id, nombre, phone, leadUpdates);

      // LUEGO: Marcar campos específicos del libro
      await supabaseService.markLibroInteresado(subscriber_id);

      // Detectar si dio click en compra (si respuesta contiene el link)
      if (respuesta.includes('stevenriosfx.com/libros/30-dias-peor-enemigo')) {
        await supabaseService.markLibroClickCompra(subscriber_id);
      }

      // ⭐ NUEVO: Detectar si ya compró el libro
      const mensajeComproCompra = [
        'ya compré el libro',
        'ya compre el libro',
        'compré el libro',
        'compre el libro',
        'ya lo compré',
        'ya lo compre',
        'adquirí el libro',
        'adquiri el libro'
      ];

      if (mensajeComproCompra.some(kw => mensaje.toLowerCase().includes(kw))) {
        await supabaseService.markLibroComprador(subscriber_id);

        // Detectar día actual si lo menciona
        const matchDia = mensaje.match(/día (\d+)/i) || mensaje.match(/dia (\d+)/i);
        if (matchDia) {
          const dia = parseInt(matchDia[1]);
          if (dia >= 1 && dia <= 30) {
            await supabaseService.updateLibroDiaActual(subscriber_id, dia);
          }
        }
      }

      // Detectar objeciones en el mensaje
      const objeciones = {
        'caro': ['caro', 'precio', 'mucho dinero', 'está caro', 'es caro'],
        'tiempo': ['no tengo tiempo', 'sin tiempo', 'muy ocupado', 'ejercicios diarios'],
        'confianza': ['no confío', 'es real', 'funciona', 'seguro'],
        'gratis': ['gratis', 'gratuito', 'sin pagar', 'free']
      };

      for (const [tipo, keywords] of Object.entries(objeciones)) {
        if (keywords.some(kw => mensaje.toLowerCase().includes(kw))) {
          await supabaseService.saveLibroObjecion(subscriber_id, tipo);
          break;
        }
      }

    } else if (intent === 'QUEJA' && detectLibroMencion(mensaje)) {
      // PRIMERO: Crear/actualizar lead base
      await updateLeadStatus(subscriber_id, nombre, phone, leadUpdates);

      // LUEGO: Marcar campos del libro
      await supabaseService.markLibroInteresado(subscriber_id);

      // Detectar objeciones
      if (mensaje.toLowerCase().includes('caro')) {
        await supabaseService.saveLibroObjecion(subscriber_id, 'caro');
      }
    } else {
      // Para todos los demás intents
      await updateLeadStatus(subscriber_id, nombre, phone, leadUpdates);
    }

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

function detectLibroMencion(mensaje) {
  const keywords = [
    'libro',
    'pdf',
    '30 días',
    '30 dias',
    'peor enemigo',
    'disciplina mental',
    'sistema 30',
    'programa 30'
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

📚 Principiante: Academy ($297, 12 meses)
💪 Con experiencia: Professional ($597, 18 meses)
🚀 Estrategia completa: Master ($997, 24 meses + 18 sesiones 1-1)
👑 Prop Firms + Mentoría: Elite ($1,797, 3 años + 48 sesiones 1-1)

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

    let notification = "";

    if (tipo === "LEAD_CALIENTE") {
      notification = `🔥 LEAD CALIENTE - SR Academy

👤 ${nombre}
📱 ID: ${subscriberId}
💬 "${mensaje}"

⚡ Este lead quiere pagar/comprar`;
    } else if (tipo === "SITUACION_DELICADA") {
      notification = `⚠️ SITUACIÓN DELICADA - SR Academy

👤 ${nombre}
📱 ID: ${subscriberId}
💬 "${mensaje}"

🚨 Posible crisis emocional/pérdida grande`;
    } else if (tipo === "COMPROBANTE_LIBRO") {
      // El mensaje ya viene formateado desde donde se llama
      notification = mensaje;
    } else if (tipo === "SOPORTE_ESTUDIANTE") {
      notification = `🎓 SOPORTE ESTUDIANTE - SR Academy

👤 ${nombre}
📱 ID: ${subscriberId}
💬 "${mensaje}"

⚠️ Estudiante con problema de acceso/plataforma
🚨 REVISAR Y RESOLVER EN 2-4 HORAS`;
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
      timestamp: new Date().toISOString(),
    });

    Logger.info("📢 Admin notificado", { tipo, subscriberId });
  } catch (error) {
    Logger.error("Error notificando admin:", error);
  }
}

// ═══════════════════════════════════════
// DETECTAR DATOS DEL COMPRADOR
// ═══════════════════════════════════════

async function detectarDatosComprador(subscriberId, mensaje) {
  try {
    // Detectar email
    const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = mensaje.match(emailRegex);

    // Detectar teléfono (con o sin +)
    const telefonoRegex = /[\+]?[0-9]{10,15}/;
    const telefonoMatch = mensaje.match(telefonoRegex);

    // Si tiene email Y teléfono, probablemente son datos del comprador
    if (emailMatch && telefonoMatch) {
      // Extraer nombre (todas las líneas que no sean email ni teléfono)
      const lineas = mensaje.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      let nombre = '';
      for (const linea of lineas) {
        // Si la línea no contiene @ ni números de teléfono, probablemente es el nombre
        if (!linea.includes('@') && !telefonoRegex.test(linea)) {
          nombre = linea;
          break;
        }
      }

      // Si no encontramos nombre en líneas separadas, intentar extraer del texto completo
      if (!nombre) {
        // Buscar palabras antes del email que sean probablemente el nombre
        const textoSinEmail = mensaje.split(emailMatch[0])[0].trim();
        const textoSinTelefono = textoSinEmail.replace(telefonoRegex, '').trim();
        nombre = textoSinTelefono || 'Cliente';
      }

      return {
        detected: true,
        nombre: nombre,
        email: emailMatch[0],
        celular: telefonoMatch[0]
      };
    }

    return { detected: false };
  } catch (error) {
    Logger.error('Error detectando datos comprador:', error);
    return { detected: false };
  }
}

module.exports = router;



