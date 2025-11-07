// src/services/mercadopago.service.js
const mercadopago = require('mercadopago');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class MercadoPagoService {
  constructor() {
    if (!config.MERCADOPAGO_ACCESS_TOKEN) {
      Logger.error('⚠️ MERCADOPAGO_ACCESS_TOKEN no está configurado en env.config');
    } else {
      mercadopago.configure({
        access_token: config.MERCADOPAGO_ACCESS_TOKEN
      });
      Logger.info('✅ Mercado Pago configurado correctamente');
    }
  }

  /**
   * Genera un código de sesión tipo SENS-12345
   */
  generateSessionCode() {
    const random = Math.floor(10000 + Math.random() * 90000);
    return `SENS-${random}`;
  }

  /**
   * Crea un link de pago en Mercado Pago
   * @param {number} amount - monto en USD (o la moneda que uses)
   * @param {string} sessionCode - código de sesión (external_reference)
   */
  async createPaymentLink(amount, sessionCode, payerName = 'Cliente Sensora') {
    try {
      const preference = {
        items: [
          {
            title: 'Sesión estratégica Sensora AI',
            quantity: 1,
            unit_price: Number(amount),
            currency_id: 'USD'
          }
        ],
        external_reference: sessionCode,
        back_urls: {
          success: 'https://getsensora.com/gracias',
          pending: 'https://getsensora.com/pago-pendiente',
          failure: 'https://getsensora.com/pago-fallido'
        },
        auto_return: 'approved'
      };

      Logger.info('💳 Creando preferencia de Mercado Pago', {
        amount,
        sessionCode
      });

      const response = await mercadopago.preferences.create(preference);

      const initPoint = response.body.init_point;
      if (!initPoint) {
        Logger.error('❌ No se recibió init_point de Mercado Pago', response.body);
        return { success: false, error: 'NO_INIT_POINT' };
      }

      Logger.info('✅ Link de pago generado', { initPoint, sessionCode });

      return {
        success: true,
        link_pago: initPoint,
        codigo_sesion: sessionCode
      };
    } catch (error) {
      Logger.error('❌ Error generando link de Mercado Pago:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });

      return {
        success: false,
        error: 'MP_ERROR'
      };
    }
  }
}

module.exports = new MercadoPagoService();
