const axios = require('axios');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class ManyChatService {
  constructor() {
    // API correcta para WhatsApp
    this.apiUrl = 'https://api.manychat.com/fb/sending/sendContent';
    this.token = config.MANYCHAT_API_KEY;
    this.adminId = config.ADMIN_SUBSCRIBER_ID;

    if (!this.token) {
      Logger.warn('⚠️ MANYCHAT_API_KEY no está configurado.');
    }

    if (!this.adminId) {
      Logger.warn('⚠️ ADMIN_SUBSCRIBER_ID no está configurado. No se enviarán notificaciones.');
    }
  }

  /**
   * Enviar mensaje a WhatsApp via ManyChat API
   */
  async sendMessage(subscriberId, text) {
    try {
      if (!this.token) {
        Logger.warn('⚠️ No se puede enviar mensaje: falta MANYCHAT_API_KEY');
        return { success: false, error: 'API key no configurada' };
      }

      Logger.info('📤 Enviando mensaje vía ManyChat', { 
        subscriberId, 
        textLength: text.length 
      });

      const payload = {
        subscriber_id: subscriberId,
        data: {
          version: 'v2',
          content: {
            messages: [
              {
                type: 'text',
                text: text
              }
            ]
          }
        },
        message_tag: 'ACCOUNT_UPDATE'
      };

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      Logger.info('✅ Mensaje enviado a ManyChat', {
        status: response.status,
        subscriberId
      });

      return { success: true, data: response.data };

    } catch (error) {
      Logger.error('❌ Error enviando mensaje ManyChat:', {
        subscriberId,
        status: error.response?.status,
        error: error.response?.data || error.message
      });

      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Notificar al admin sobre evento importante
   */
  async notifyAdmin(escalationData) {
    try {
      if (!this.adminId) {
        Logger.warn('⚠️ No se puede notificar: ADMIN_SUBSCRIBER_ID no configurado');
        return { success: false, error: 'Admin ID no configurado' };
      }

      const { subscriberId, nombre, mensaje, timestamp } = escalationData;

      const adminMessage = `🚨 *NOTIFICACIÓN SR ACADEMY*

*Cliente:* ${nombre}
*ID:* ${subscriberId}
*Mensaje:* "${mensaje}"

Requiere atención.`;

      const result = await this.sendMessage(this.adminId, adminMessage);

      if (result.success) {
        Logger.info('✅ Admin notificado correctamente', { subscriberId });
      } else {
        Logger.error('❌ Error notificando admin', {
          subscriberId,
          error: result.error
        });
      }

      return result;

    } catch (error) {
      Logger.error('❌ Error en notifyAdmin:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ManyChatService();

