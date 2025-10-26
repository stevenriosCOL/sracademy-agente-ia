const axios = require('axios');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class ManyChatService {
  constructor() {
    this.apiUrl = 'https://api.manychat.com/fb/sending/sendContent';
    this.token = config.MANYCHAT_TOKEN;
    
    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  /**
   * Envía un mensaje de texto a ManyChat WhatsApp
   * Formato EXACTO del JSON de n8n que funciona
   */
  async sendMessage(subscriberId, text) {
    try {
      Logger.info('📤 Enviando a ManyChat', { subscriberId, textLength: text.length });

      // Formato EXACTO de n8n que funcionaba
      const payload = {
        subscriber_id: subscriberId,
        data: {
          version: "v2",
          content: {
            type: "whatsapp",  // ← ESTO ERA LO QUE FALTABA
            messages: [
              {
                type: "text",
                text: text
              }
            ]
          }
        },
        message_tag: "ACCOUNT_UPDATE"
      };

      const response = await this.axiosInstance.post('', payload);

      if (response.status === 200) {
        Logger.info('✅ Mensaje enviado a ManyChat', { subscriberId });
        return { success: true, data: response.data };
      }

      return { success: false, error: 'Respuesta inesperada de ManyChat' };

    } catch (error) {
      Logger.error('❌ Error enviando a ManyChat:', {
        subscriberId,
        error: error.message,
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
   * Notifica al admin sobre un escalamiento
   */
  async notifyAdmin(escalationData) {
    try {
      const { subscriberId, nombre, mensaje, timestamp } = escalationData;

      const adminMessage = `🚨 ESCALAMIENTO

Cliente: ${nombre}
ID: ${subscriberId}
Mensaje: "${mensaje}"
Fecha: ${timestamp}`;

      const result = await this.sendMessage(config.ADMIN_SUBSCRIBER_ID, adminMessage);

      if (result.success) {
        Logger.info('✅ Admin notificado sobre escalamiento', { subscriberId });
      } else {
        Logger.error('❌ Error notificando admin', { subscriberId });
      }

      return result;

    } catch (error) {
      Logger.error('Error en notifyAdmin:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ManyChatService();