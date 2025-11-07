const axios = require('axios');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class ManyChatService {
  constructor() {
    this.apiUrl = 'https://api.manychat.com/fb/sending/sendContent';
    this.token = config.MANYCHAT_API_KEY;
    
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
   * Enviar mensaje a usuario vía ManyChat
   */
  async sendMessage(subscriberId, text) {
    try {
      Logger.info('📤 Enviando a ManyChat', { subscriberId, textLength: text.length });

      const payload = {
        subscriber_id: subscriberId,
        data: {
          version: "v2",
          content: {
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
   * Notificar a admin sobre escalamiento o evento importante
   */
  async notifyAdmin(escalationData) {
    try {
      const { subscriberId, nombre, mensaje, timestamp } = escalationData;

      const adminMessage = `🚨 *NOTIFICACIÓN SENSORA AI*

*Cliente:* ${nombre}
*ID:* ${subscriberId}
*Mensaje:* "${mensaje}"
*Fecha:* ${timestamp}

Requiere atención humana.`;

      const result = await this.sendMessage(config.ADMIN_SUBSCRIBER_ID, adminMessage);

      if (result.success) {
        Logger.info('✅ Admin notificado', { subscriberId });
      } else {
        Logger.error('❌ Error notificando admin', { subscriberId });
      }

      return result;

    } catch (error) {
      Logger.error('Error en notifyAdmin:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generar link de pago para consultoría (llama a tu backend)
   */
  async generatePaymentLink(nombre, whatsapp, monto = 25) {
    try {
      Logger.info('💳 Generando link de pago', { nombre, whatsapp, monto });

      const response = await axios.post(
        'https://backend-sensora-2025-production.up.railway.app/webhooks/manychat',
        {
          nombre,
          whatsapp,
          monto: monto.toString()
        },
        { timeout: 10000 }
      );

      if (response.data && response.data.link && response.data.codigo) {
        Logger.info('✅ Link de pago generado', { codigo: response.data.codigo });
        return {
          success: true,
          link: response.data.link,
          codigo: response.data.codigo
        };
      }

      Logger.error('Respuesta inesperada del backend de pagos:', response.data);
      return { success: false, error: 'Respuesta inesperada' };

    } catch (error) {
      Logger.error('Error generando link de pago:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

module.exports = new ManyChatService();