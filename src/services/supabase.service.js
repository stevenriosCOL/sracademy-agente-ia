const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class SupabaseService {
  constructor() {
    if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials no configuradas');
    }

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

    Logger.info('✅ Supabase cliente inicializado');
  }

  /**
   * Guarda analytics de conversación en bot_analytics
   */
  async saveAnalytics(data) {
    try {
      const analytics = {
        subscriber_id: data.subscriber_id,
        nombre_cliente: data.nombre_cliente,
        categoria: data.categoria,
        mensaje_cliente: data.mensaje_cliente,
        respuesta_bot: data.respuesta_bot,
        fue_escalado: data.fue_escalado || false,
        duracion_ms: data.duracion_ms || 0,
        idioma: data.idioma || 'es',
        timestamp: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('bot_analytics')
        .insert([analytics]);

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
   * Guarda feedback de cliente
   */
  async saveFeedback(data) {
    try {
      const feedback = {
        subscriber_id: data.subscriber_id,
        nombre_cliente: data.nombre_cliente,
        calificacion: data.calificacion,
        categoria_conversacion: data.categoria_conversacion || null,
        comentario: data.comentario || null,
        timestamp: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('feedback_clientes')
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
   * Busca la última conversación de un usuario (para feedback)
   */
  async getLastConversation(subscriberId) {
    try {
      const { data, error } = await this.supabase
        .from('bot_analytics')
        .select('categoria, timestamp')
        .eq('subscriber_id', subscriberId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        Logger.warn('No se encontró conversación previa:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      Logger.error('Error en getLastConversation:', error);
      return null;
    }
  }

  /**
   * Obtiene el cliente de Supabase para operaciones avanzadas
   */
  getClient() {
    return this.supabase;
  }
}

module.exports = new SupabaseService();