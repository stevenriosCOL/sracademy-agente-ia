const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class SupabaseService {
  constructor() {
    this.client = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY
    );
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
        .order('timestamp', { ascending: false })
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
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

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
}

module.exports = new SupabaseService();

