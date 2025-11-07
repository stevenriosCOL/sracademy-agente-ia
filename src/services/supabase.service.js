const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class SupabaseService {
  constructor() {
    this.supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

/**
   * Guardar conversación en analytics
   */
  async saveAnalytics(data) {
    try {
      const { error } = await this.supabase
        .from('sensora_analytics')
        .insert({
          timestamp: new Date().toISOString(),
          subscriber_id: data.subscriber_id,           // ✅ Con guion bajo
          nombre_cliente: data.nombre_cliente,         // ✅ Nombre correcto
          categoria: data.categoria,
          mensaje_cliente: data.mensaje_cliente,       // ✅ Nombre correcto
          respuesta_bot: data.respuesta_bot,           // ✅ Nombre correcto
          fue_escalado: data.fue_escalado || false,    // ✅ Con guion bajo
          duracion_ms: data.duracion_ms,               // ✅ Con guion bajo
          idioma: data.idioma
        });

      if (error) {
        Logger.error('Error guardando analytics:', error);
        return false;
      }

      Logger.info('✅ Analytics guardado', { subscriber_id: data.subscriber_id });
      return true;
    } catch (error) {
      Logger.error('Error en saveAnalytics:', error);
      return false;
    }
  }

  /**
   * Buscar en knowledge base (RAG)
   */
  async searchKnowledge(embedding, topK = 6) {
    try {
      const { data, error } = await this.supabase.rpc('match_sensora_knowledge', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: topK
      });

      if (error) {
        Logger.error('Error en searchKnowledge:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      Logger.error('Error en searchKnowledge:', error);
      return [];
    }
  }

  /**
   * Guardar mensaje en memoria conversacional
   */
  async saveMemory(sessionId, role, content) {
    try {
      const { error } = await this.supabase
        .from('sensora_chat_memory')
        .insert({
          session_id: sessionId,
          role: role,
          content: content,
          created_at: new Date().toISOString()
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

  /**
   * Obtener historial de memoria
   */
  async getMemory(sessionId, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('sensora_chat_memory')
        .select('role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        Logger.error('Error obteniendo memoria:', error);
        return [];
      }

      // Retornar en orden cronológico (más antiguo primero)
      return (data || []).reverse();
    } catch (error) {
      Logger.error('Error en getMemory:', error);
      return [];
    }
  }

  /**
   * Actualizar o crear lead scoring (uso general)
   */
  async upsertLeadScoring(data) {
    try {
      const { error } = await this.supabase
        .from('sensora_lead_scoring')
        .upsert({
          subscriber_id: data.subscriberId,
          first_name: data.firstName,
          phone: data.phone,
          score: data.score || 0,
          company_size: data.companySize,
          industry: data.industry,
          country: data.country,
          pain_points: data.painPoints || [],
          budget_range: data.budgetRange,
          qualified: data.qualified || false,
          notes: data.notes,
          last_interaction: new Date().toISOString()
        }, {
          onConflict: 'subscriber_id'
        });

      if (error) {
        Logger.error('Error actualizando lead scoring:', error);
        return false;
      }

      Logger.info('✅ Lead scoring actualizado', { subscriberId: data.subscriberId });
      return true;
    } catch (error) {
      Logger.error('Error en upsertLeadScoring:', error);
      return false;
    }
  }

  /**
   * Obtener lead scoring de un usuario
   */
  async getLeadScoring(subscriberId) {
    try {
      const { data, error } = await this.supabase
        .from('sensora_lead_scoring')
        .select('*')
        .eq('subscriber_id', subscriberId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no encontrado
        Logger.error('Error obteniendo lead scoring:', error);
        return null;
      }

      return data;
    } catch (error) {
      Logger.error('Error en getLeadScoring:', error);
      return null;
    }
  }

  /**
   * Limpiar memoria antigua (más de 7 días)
   */
  async cleanOldMemory() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { error } = await this.supabase
        .from('sensora_chat_memory')
        .delete()
        .lt('created_at', sevenDaysAgo.toISOString());

      if (error) {
        Logger.error('Error limpiando memoria antigua:', error);
        return false;
      }

      Logger.info('✅ Memoria antigua limpiada');
      return true;
    } catch (error) {
      Logger.error('Error en cleanOldMemory:', error);
      return false;
    }
  }

  /**
   * Actualizar lead scoring cuando califica en DIAGNOSTICO
   * (versión compacta a partir de qualificationData)
   */
  async updateLeadQualification(subscriberId, qualificationData) {
    try {
      const leadData = {
        subscriber_id: subscriberId,
        first_name: qualificationData.nombre,
        company_size: qualificationData.companySize,
        industry: qualificationData.industry,
        country: qualificationData.country,
        pain_points: qualificationData.painPoints || [],
        score: qualificationData.score || 50,
        qualified: true,
        last_interaction: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('sensora_lead_scoring')
        .upsert(leadData, { onConflict: 'subscriber_id' });

      if (error) {
        Logger.error('Error actualizando lead scoring (DIAGNOSTICO):', error);
        return false;
      }

      Logger.info('✅ Lead calificado guardado desde DIAGNOSTICO', { subscriberId });
      return true;
    } catch (error) {
      Logger.error('Error en updateLeadQualification:', error);
      return false;
    }
  }

  /**
   * Guardar feedback de cliente
   */
  async saveFeedback(data) {
    try {
      const feedback = {
        subscriber_id: data.subscriber_id,
        nombre_cliente: data.nombre_cliente,
        calificacion: data.calificacion,
        categoria_conversacion: data.categoria_conversacion || null,
        comentario: data.comentario || null,
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('sensora_feedback')
        .insert([feedback]);

      if (error) {
        Logger.error('Error guardando feedback:', error);
        return false;
      }

      Logger.info('✅ Feedback guardado', { subscriber_id: data.subscriber_id });
      return true;
    } catch (error) {
      Logger.error('Error en saveFeedback:', error);
      return false;
    }
  }

    /**
   * Guardar registro de pago (link generado) en Supabase
   */
  async savePayment(data) {
    try {
      const { error } = await this.supabase
        .from('sensora_payments') // 👈 asegúrate de crear esta tabla en Supabase
        .insert({
          subscriber_id: data.subscriberId,
          nombre_cliente: data.nombreCliente,
          whatsapp: data.whatsapp,
          monto: data.monto,
          codigo_sesion: data.codigoSesion,
          link_pago: data.linkPago,
          estado_pago: data.estadoPago || 'pending',
          metadata: data.metadata || null,
          created_at: new Date().toISOString()
        });

      if (error) {
        Logger.error('Error guardando pago en Supabase:', error);
        return false;
      }

      Logger.info('✅ Pago guardado en Supabase', {
        subscriberId: data.subscriberId,
        codigoSesion: data.codigoSesion
      });

      return true;
    } catch (error) {
      Logger.error('Error en savePayment:', error);
      return false;
    }
  }


  /**
   * Obtener última conversación de un usuario (para asociar feedback)
   */
  async getLastConversation(subscriberId) {
    try {
      const { data, error } = await this.supabase
        .from('sensora_analytics')
        .select('categoria, timestamp')
        .eq('subscriber_id', subscriberId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no encontrado
        Logger.error('Error obteniendo última conversación:', error);
        return null;
      }

      return data;
    } catch (error) {
      Logger.error('Error en getLastConversation:', error);
      return null;
    }
  }
}

module.exports = new SupabaseService();

