const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class SupabaseService {
  constructor() {
    this.client = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY
    );

    // ✅ PASO 2 — Arreglar cliente Supabase (CRÍTICO)
    this.supabase = this.client;
  }

  // ═══════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════

  async saveAnalytics(data) {
    try {
      const { error } = await this.client
        .from('sracademy_analytics')
        .insert({
          subscriber_id: data.subscriber_id,
          nombre_cliente: data.nombre_cliente,
          categoria: data.categoria,
          emocion: data.emocion || 'NEUTRAL',
          mensaje_cliente: data.mensaje_cliente,
          respuesta_bot: data.respuesta_bot,
          fue_escalado: data.fue_escalado || false,
          duracion_ms: data.duracion_ms,
          idioma: data.idioma || 'es'
        });

      if (error) {
        Logger.error('Error guardando analytics:', error);
        return false;
      }

      Logger.info('✅ Analytics guardado');
      return true;
    } catch (error) {
      Logger.error('Error en saveAnalytics:', error);
      return false;
    }
  }

  // ═══════════════════════════════════════
  // LEADS
  // ═══════════════════════════════════════

  async upsertLead(data) {
    try {
      const { error } = await this.client
        .from('sracademy_leads')
        .upsert({
          subscriber_id: data.subscriber_id,
          first_name: data.first_name,
          phone: data.phone,
          nivel: data.nivel,
          curso_gratuito_enviado: data.curso_gratuito_enviado,
          curso_gratuito_completado: data.curso_gratuito_completado,
          membresia_enviada: data.membresia_enviada,
          interesado_membresia: data.interesado_membresia,
          interesado_curso_pago: data.interesado_curso_pago,
          producto_interes: data.producto_interes,
          etiquetas: data.etiquetas,
          heat_score: data.heat_score,
          ultima_interaccion: data.ultima_interaccion,
          total_mensajes: data.total_mensajes,
          score: data.score,
          qualified: data.qualified,
          notes: data.notes,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'subscriber_id'
        });

      if (error) {
        Logger.error('Error en upsertLead:', error);
        return false;
      }

      Logger.info('✅ Lead actualizado', { subscriber_id: data.subscriber_id });
      return true;
    } catch (error) {
      Logger.error('Error en upsertLead:', error);
      return false;
    }
  }

  async getLead(subscriberId) {
    try {
      const { data, error } = await this.client
        .from('sracademy_leads')
        .select('*')
        .eq('subscriber_id', subscriberId)
        .single();

      if (error && error.code !== 'PGRST116') {
        Logger.error('Error obteniendo lead:', error);
        return null;
      }

      return data;
    } catch (error) {
      Logger.error('Error en getLead:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════
  // MEMORIA CONVERSACIONAL (Persistente)
  // ═══════════════════════════════════════

  async saveMemory(sessionId, role, content) {
    try {
      const { error } = await this.client
        .from('sracademy_chat_memory')
        .insert({
          session_id: sessionId,
          role: role,
          content: content
        });

      if (error) {
        Logger.error('Error guardando memoria:', error);
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Error en saveMemory:', error);
      return false;
    }
  }

  async getMemory(sessionId, limit = 20) {
    try {
      const { data, error } = await this.client
        .from('sracademy_chat_memory')
        .select('role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        Logger.error('Error obteniendo memoria:', error);
        return [];
      }

      // Invertir para orden cronológico
      return (data || []).reverse();
    } catch (error) {
      Logger.error('Error en getMemory:', error);
      return [];
    }
  }

  async getLastConversation(sessionId) {
    try {
      const { data, error } = await this.client
        .from('sracademy_analytics')
        .select('categoria')
        .eq('subscriber_id', sessionId)
        // ✅ PASO 1.1 — Fix BUG analytics
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        return null;
      }

      return data?.categoria || null;
    } catch (error) {
      Logger.error('Error en getLastConversation:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════
  // FEEDBACK
  // ═══════════════════════════════════════

  async saveFeedback(data) {
    try {
      const { error } = await this.client
        .from('sracademy_feedback')
        .insert({
          subscriber_id: data.subscriber_id,
          nombre_cliente: data.nombre_cliente,
          calificacion: data.calificacion,
          categoria_conversacion: data.categoria_conversacion,
          comentario: data.comentario
        });

      if (error) {
        Logger.error('Error guardando feedback:', error);
        return false;
      }

      Logger.info('✅ Feedback guardado');
      return true;
    } catch (error) {
      Logger.error('Error en saveFeedback:', error);
      return false;
    }
  }

  // ═══════════════════════════════════════
  // RAG - BÚSQUEDA DE CONOCIMIENTO
  // ═══════════════════════════════════════

  async searchKnowledge(queryEmbedding, threshold = 0.7, count = 5) {
    try {
      const { data, error } = await this.client
        .rpc('match_sracademy_knowledge', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: count
        });

      if (error) {
        Logger.error('Error en búsqueda RAG:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      Logger.error('Error en searchKnowledge:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════
  // SEGUIMIENTOS
  // ═══════════════════════════════════════

  async createSeguimiento(subscriberId, tipo, fechaProgramada) {
    try {
      const { error } = await this.client
        .from('sracademy_seguimientos')
        .insert({
          subscriber_id: subscriberId,
          tipo: tipo,
          fecha_programada: fechaProgramada,
          enviado: false
        });

      if (error) {
        Logger.error('Error creando seguimiento:', error);
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Error en createSeguimiento:', error);
      return false;
    }
  }

  async getSeguimientosPendientes(fecha) {
    try {
      const { data, error } = await this.client
        .from('sracademy_seguimientos')
        .select('*')
        .eq('fecha_programada', fecha)
        .eq('enviado', false);

      if (error) {
        Logger.error('Error obteniendo seguimientos:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      Logger.error('Error en getSeguimientosPendientes:', error);
      return [];
    }
  }

  async markSeguimientoEnviado(id) {
    try {
      const { error } = await this.client
        .from('sracademy_seguimientos')
        .update({ enviado: true })
        .eq('id', id);

      if (error) {
        Logger.error('Error marcando seguimiento:', error);
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Error en markSeguimientoEnviado:', error);
      return false;
    }
  }

  // ═══════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════

  async cleanOldMemory(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error } = await this.client
        .from('sracademy_chat_memory')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        Logger.error('Error limpiando memoria antigua:', error);
        return false;
      }

      Logger.info(`🧹 Memoria antigua limpiada (>${daysOld} días)`);
      return true;
    } catch (error) {
      Logger.error('Error en cleanOldMemory:', error);
      return false;
    }
  }

  // ═══════════════════════════════════════
  // ESTADÍSTICAS (para dashboard futuro)
  // ═══════════════════════════════════════

  async getStats(startDate, endDate) {
    try {
      const { data, error } = await this.client
        .from('sracademy_analytics')
        .select('categoria, fue_escalado')
        // ✅ PASO 1.2 — Fix BUG analytics
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) {
        Logger.error('Error obteniendo stats:', error);
        return null;
      }

      // Procesar estadísticas
      const stats = {
        total: data.length,
        porCategoria: {},
        escalamientos: 0
      };

      data.forEach(row => {
        stats.porCategoria[row.categoria] = (stats.porCategoria[row.categoria] || 0) + 1;
        if (row.fue_escalado) stats.escalamientos++;
      });

      return stats;
    } catch (error) {
      Logger.error('Error en getStats:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════
  // AUDIO TRANSCRIPTIONS
  // ═══════════════════════════════════════

  async saveAudioTranscription(data) {
    try {
      const { error } = await this.client
        .from('sracademy_audio_transcriptions')
        .insert({
          subscriber_id: data.subscriber_id,
          audio_url: data.audio_url,
          transcription: data.transcription,
          duracion_segundos: data.duracion_segundos,
          idioma: data.idioma || 'es',
          created_at: new Date().toISOString()
        });

      if (error) {
        Logger.error('Error guardando transcripción:', error);
        return false;
      }

      Logger.info('💾 Transcripción guardada en Supabase');
      return true;

    } catch (error) {
      Logger.error('Error en saveAudioTranscription:', error);
      return false;
    }
  }

  // ═══════════════════════════════════════
  // LIBRO 30 DÍAS - TRACKING
  // ═══════════════════════════════════════

  async updateLibroStatus(subscriberId, updates) {
    try {
      const { error } = await this.client
        .from('sracademy_leads')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('subscriber_id', subscriberId);

      if (error) {
        Logger.error('Error actualizando status libro:', error);
        return false;
      }

      Logger.info('✅ Libro status actualizado', { subscriber_id: subscriberId, updates });
      return true;
    } catch (error) {
      Logger.error('Error en updateLibroStatus:', error);
      return false;
    }
  }

  async markLibroInteresado(subscriberId) {
    return this.updateLibroStatus(subscriberId, {
      libro_interesado: true,
      libro_ultimo_contacto: new Date().toISOString()
    });
  }

  async markLibroClickCompra(subscriberId) {
    return this.updateLibroStatus(subscriberId, {
      libro_click_compra: new Date().toISOString(),
      libro_ultimo_contacto: new Date().toISOString()
    });
  }

  async markLibroComprador(subscriberId, diaActual = 1) {
    return this.updateLibroStatus(subscriberId, {
      libro_comprador: true,
      libro_fecha_compra: new Date().toISOString(),
      libro_dia_actual: diaActual,
      libro_ultimo_contacto: new Date().toISOString()
    });
  }

  async saveLibroObjecion(subscriberId, objecion) {
    return this.updateLibroStatus(subscriberId, {
      libro_objecion: objecion,
      libro_ultimo_contacto: new Date().toISOString()
    });
  }

  async updateLibroDiaActual(subscriberId, dia) {
    return this.updateLibroStatus(subscriberId, {
      libro_dia_actual: dia,
      libro_ultimo_contacto: new Date().toISOString()
    });
  }

  // ═══════════════════════════════════════
  // LIBRO - COMPRAS Y VERIFICACIÓN
  // ═══════════════════════════════════════

  async createCompraLibro(data) {
    try {
      const { data: result, error } = await this.client
        .from('libro_compras')
        // ✅ PASO 3 — Producto PDF vs Combo (CRÍTICO)
        .insert({
          subscriber_id: data.subscriber_id,
          nombre_completo: data.nombre_completo,
          email: data.email,
          celular: data.celular,
          pais: data.pais,
          metodo_pago: data.metodo_pago,

          producto: data.producto || 'pdf',

          monto_usd: data.monto_usd || (data.producto === 'combo' ? 29.99 : 19.99),

          estado: 'pendiente',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        Logger.error('Error creando compra libro:', error);
        return null;
      }

      Logger.info('✅ Compra libro creada', {
        subscriber_id: data.subscriber_id,
        compra_id: result.id
      });

      return result;
    } catch (error) {
      Logger.error('Error en createCompraLibro:', error);
      return null;
    }
  }

  async getCompraPendiente(subscriberId) {
    try {
      const { data, error } = await this.client
        .from('libro_compras')
        .select('*')
        .eq('subscriber_id', subscriberId)
        // ✅ PASO 5 — Ajustar búsqueda de compra pendiente
        .in('estado', ['pendiente', 'comprobante_recibido', 'verificando'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        Logger.error('Error obteniendo compra pendiente:', error);
        return null;
      }

      return data;
    } catch (error) {
      Logger.error('Error en getCompraPendiente:', error);
      return null;
    }
  }

  async getLatestCompraBySubscriber(subscriberId) {
    try {
      const { data, error } = await this.client
        .from('libro_compras')
        .select('*')
        .eq('subscriber_id', subscriberId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        Logger.error('Error obteniendo última compra:', error);
        return null;
      }

      return data || null;
    } catch (error) {
      Logger.error('Error en getLatestCompraBySubscriber:', error);
      return null;
    }
  }

  async updateCompraComprobante(compraId, comprobanteUrl) {
    try {
      const { error } = await this.client
        .from('libro_compras')
        // ✅ PASO 4 — Corregir comprobante (MUY IMPORTANTE)
        .update({
          comprobante_url: comprobanteUrl,
          estado: 'comprobante_recibido',
          fecha_comprobante: new Date().toISOString()
        })
        .eq('id', compraId);

      if (error) {
        Logger.error('Error actualizando comprobante:', error);
        return false;
      }

      Logger.info('✅ Comprobante guardado', { compra_id: compraId });
      return true;
    } catch (error) {
      Logger.error('Error en updateCompraComprobante:', error);
      return false;
    }
  }

  async aprobarCompraLibro(compraId) {
    try {
      const { error } = await this.client
        .from('libro_compras')
        .update({
          estado: 'aprobado',
          fecha_verificacion: new Date().toISOString(),
          verificado_por: 'steven',
          pdf_enviado: false,
          accesos_enviados: false
        })
        .eq('id', compraId);

      if (error) {
        Logger.error('Error aprobando compra:', error);
        return false;
      }

      Logger.info('✅ Compra libro aprobada', { compra_id: compraId });
      return true;
    } catch (error) {
      Logger.error('Error en aprobarCompraLibro:', error);
      return false;
    }
  }

  async rechazarCompraLibro(compraId, motivo) {
    try {
      const { error } = await this.client
        .from('libro_compras')
        .update({
          estado: 'rechazado',
          fecha_verificacion: new Date().toISOString(),
          verificado_por: 'steven',
          notas: motivo
        })
        .eq('id', compraId);

      if (error) {
        Logger.error('Error rechazando compra:', error);
        return false;
      }

      Logger.info('⚠️ Compra libro rechazada', { compra_id: compraId, motivo });
      return true;
    } catch (error) {
      Logger.error('Error en rechazarCompraLibro:', error);
      return false;
    }
  }

  async marcarPDFEnviado(compraId) {
    try {
      const { error } = await this.client
        .from('libro_compras')
        .update({
          pdf_enviado: true
        })
        .eq('id', compraId);

      if (error) {
        Logger.error('Error marcando PDF enviado:', error);
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Error en marcarPDFEnviado:', error);
      return false;
    }
  }

  async marcarAccesosEnviados(compraId) {
    try {
      const { error } = await this.client
        .from('libro_compras')
        .update({
          accesos_enviados: true
        })
        .eq('id', compraId);

      if (error) {
        Logger.error('Error marcando accesos enviados:', error);
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Error en marcarAccesosEnviados:', error);
      return false;
    }
  }

  async getComprasLibroPendientes() {
    try {
      const { data, error } = await this.client
        .from('libro_compras')
        .select('*')
        .in('estado', ['pendiente', 'verificando'])
        .order('created_at', { ascending: false });

      if (error) {
        Logger.error('Error obteniendo compras pendientes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      Logger.error('Error en getComprasLibroPendientes:', error);
      return [];
    }
  }

  async getComprasLibroAprobadas(limit = 50) {
    try {
      const { data, error } = await this.client
        .from('libro_compras')
        .select('*')
        .eq('estado', 'aprobado')
        .order('fecha_verificacion', { ascending: false })
        .limit(limit);

      if (error) {
        Logger.error('Error obteniendo compras aprobadas:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      Logger.error('Error en getComprasLibroAprobadas:', error);
      return [];
    }
  }

  async getStatsComprasLibro() {
    try {
      const { data, error } = await this.client
        .from('libro_compras')
        .select('estado, metodo_pago');

      if (error) {
        Logger.error('Error obteniendo stats compras:', error);
        return null;
      }

      const stats = {
        total: data.length,
        pendientes: data.filter(c => c.estado === 'pendiente').length,
        verificando: data.filter(c => c.estado === 'verificando').length,
        aprobadas: data.filter(c => c.estado === 'aprobado').length,
        rechazadas: data.filter(c => c.estado === 'rechazado').length,
        por_metodo: {}
      };

      data.forEach(compra => {
        const metodo = compra.metodo_pago;
        stats.por_metodo[metodo] = (stats.por_metodo[metodo] || 0) + 1;
      });

      return stats;
    } catch (error) {
      Logger.error('Error en getStatsComprasLibro:', error);
      return null;
    }
  }
    // ═══════════════════════════════════════
  // LIBRO - MÉTODOS ADICIONALES PARA WEBHOOK
  // ═══════════════════════════════════════

  async getCompraById(compraId) {
    try {
      const { data, error } = await this.client
        .from('libro_compras')
        .select('*')
        .eq('id', compraId)
        .single();

      if (error && error.code !== 'PGRST116') {
        Logger.error('Error obteniendo compra por ID:', error);
        return null;
      }

      return data;
    } catch (error) {
      Logger.error('Error en getCompraById:', error);
      return null;
    }
  }

  async createLibroEmailLog(data) {
    try {
      const { error } = await this.client
        .from('libro_email_logs')
        .insert({
          compra_id: data.compra_id,
          email: data.email,
          tipo: data.tipo,
          brevo_message_id: data.brevo_message_id,
          estado: data.estado,
          error_mensaje: data.error_mensaje,
          enviado_at: data.enviado_at || new Date().toISOString()
        });

      if (error) {
        Logger.error('Error creando log de email:', error);
        return false;
      }

      Logger.info('✅ Email log creado', { compra_id: data.compra_id, tipo: data.tipo });
      return true;
    } catch (error) {
      Logger.error('Error en createLibroEmailLog:', error);
      return false;
    }
  }

  async getLibroEmailLogByCompraTipo(compraId, tipo) {
    try {
      const { data, error } = await this.client
        .from('libro_email_logs')
        .select('*')
        .eq('compra_id', compraId)
        .eq('tipo', tipo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        Logger.error('Error obteniendo email log:', error);
        return null;
      }

      return data;
    } catch (error) {
      Logger.error('Error en getLibroEmailLogByCompraTipo:', error);
      return null;
    }
  }

  async createLibroDescuento(data) {
    try {
      const { error } = await this.client
        .from('libro_descuentos')
        .insert({
          compra_id: data.compra_id,
          codigo: data.codigo,
          porcentaje: data.porcentaje || 10,
          valido_hasta: data.valido_hasta
        });

      if (error) {
        Logger.error('Error creando descuento:', error);
        return false;
      }

      Logger.info('✅ Código de descuento creado', { codigo: data.codigo });
      return true;
    } catch (error) {
      Logger.error('Error en createLibroDescuento:', error);
      return false;
    }
  }

  async getLibroDescuentoByCompra(compraId) {
    try {
      const { data, error } = await this.client
        .from('libro_descuentos')
        .select('*')
        .eq('compra_id', compraId)
        .single();

      if (error && error.code !== 'PGRST116') {
        Logger.error('Error obteniendo descuento:', error);
        return null;
      }

      return data;
    } catch (error) {
      Logger.error('Error en getLibroDescuentoByCompra:', error);
      return null;
    }
  }

  async marcarEnvioPdf(compraId, nuevoEstado = 'aprobado') {
    try {
      const { error } = await this.client
        .from('libro_compras')
        .update({
          estado: nuevoEstado,
          fecha_envio_pdf: new Date().toISOString()
        })
        .eq('id', compraId);

      if (error) {
        Logger.error('Error marcando envío PDF:', error);
        return false;
      }

      Logger.info('✅ Envío PDF marcado', { compra_id: compraId, estado: nuevoEstado });
      return true;
    } catch (error) {
      Logger.error('Error en marcarEnvioPdf:', error);
      return false;
    }
  }

  // ═══════════════════════════════════════
// FLOW STATE (FSM) - Persistente
// ═══════════════════════════════════════

async getFlowState(subscriberId) {
  try {
    const { data, error } = await this.client
      .from('sracademy_leads')
      .select('flow_state, selected_product, selected_country, selected_method, flow_updated_at, proof_received_at')
      .eq('subscriber_id', subscriberId)
      .single();

    if (error && error.code !== 'PGRST116') {
      Logger.error('Error obteniendo flow state:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    Logger.error('Error en getFlowState:', error);
    return null;
  }
}

async updateFlowState(subscriberId, updates) {
  try {
    const payload = {
      subscriber_id: subscriberId,
      ...updates,
      flow_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await this.client
      .from('sracademy_leads')
      .upsert(payload, { onConflict: 'subscriber_id' });

    if (error) {
      Logger.error('Error actualizando flow state:', error);
      return false;
    }

    return true;
  } catch (error) {
    Logger.error('Error en updateFlowState:', error);
    return false;
  }
}

async clearFlowState(subscriberId) {
  try {
    const { error } = await this.client
      .from('sracademy_leads')
      .update({
        flow_state: 'IDLE',
        selected_product: null,
        selected_country: null,
        selected_method: null,
        proof_received_at: null,
        flow_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('subscriber_id', subscriberId);

    if (error) {
      Logger.error('Error limpiando flow state:', error);
      return false;
    }

    return true;
  } catch (error) {
    Logger.error('Error en clearFlowState:', error);
    return false;
  }
}
}

module.exports = new SupabaseService();


