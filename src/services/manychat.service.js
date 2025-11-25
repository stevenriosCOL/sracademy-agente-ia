const axios = require('axios');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class ManyChatService {
  constructor() {
    this.apiUrl = config.MANYCHAT_API_URL || 'https://api.manychat.com/fb/sending/sendContent';
    this.token = config.MANYCHAT_API_KEY;
    this.adminId = config.ADMIN_SUBSCRIBER_ID;

    if (!this.token) {
      Logger.warn('⚠️ MANYCHAT_API_KEY no está configurado.');
    }

    if (!this.adminId) {
      Logger.warn('⚠️ ADMIN_SUBSCRIBER_ID no está configurado. No se enviarán notificaciones.');
    }

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  /**
   * Enviar mensaje al usuario vía WhatsApp (ManyChat)
   */
  async sendMessage(subscriberId, text) {
    try {
      if (!this.token) {
        Logger.warn('⚠️ No se puede enviar mensaje: falta MANYCHAT_API_KEY');
        return { success: false, error: 'API key no configurada' };
      }

      Logger.info('📤 Enviando a ManyChat', { 
        subscriberId, 
        textLength: text.length 
      });

      // ✅ CLAVE: Agregar type: 'whatsapp'
      const payload = {
        subscriber_id: subscriberId,
        data: {
          version: 'v2',
          content: {
            type: 'whatsapp',  // ← ESTO ES CRÍTICO
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

      const response = await this.axiosInstance.post('', payload);

      Logger.info('📥 Respuesta de ManyChat', {
        status: response.status,
        data: response.data
      });

      if (response.status === 200 && response.data?.status === 'success') {
        Logger.info('✅ Mensaje enviado correctamente a ManyChat', { subscriberId });
        return { success: true, data: response.data };
      }

      Logger.error('❌ Respuesta inesperada de ManyChat', {
        status: response.status,
        data: response.data
      });

      return {
        success: false,
        error: 'Respuesta inesperada de ManyChat'
      };

    } catch (error) {
      Logger.error('❌ Error enviando a ManyChat:', {
        subscriberId,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Notificar a admin sobre escalamiento o evento importante
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
*Fecha:* ${timestamp || new Date().toLocaleString('es-CO')}

Requiere atención humana.`;

      const result = await this.sendMessage(this.adminId, adminMessage);

      if (result.success) {
        Logger.info('✅ Admin notificado', { subscriberId });
      } else {
        Logger.error('❌ Error notificando admin', {
          subscriberId,
          error: result.error
        });
      }

      return result;

    } catch (error) {
      Logger.error('Error en notifyAdmin:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ManyChatService();

