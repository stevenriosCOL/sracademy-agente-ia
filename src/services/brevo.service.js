const axios = require('axios');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class BrevoService {
  constructor() {
    this.client = axios.create({
      baseURL: config.BREVO_API_URL,
      timeout: 15000,
      headers: {
        'api-key': config.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json'
      }
    });
  }

  validarEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email || '');
  }

  async isEmailBlacklisted(email) {
    if (config.MOCK_LIBRO_ENTREGA) {
      return false;
    }

    try {
      const response = await this.client.get(`/contacts/${encodeURIComponent(email)}`);
      return Boolean(response.data?.emailBlacklisted);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return false;
      }

      Logger.error('Error consultando blacklist Brevo:', error.response?.data || error.message);
      return false;
    }
  }

  async enviarLibroPDF({ email, nombre, producto, pdfUrl, comboUrl, codigoDescuento }) {
    if (config.MOCK_LIBRO_ENTREGA) {
      Logger.info('🧪 MOCK: Email enviado', { email, producto });
      return { messageId: `mock-${Date.now()}` };
    }

    const payload = {
      to: [{ email, name: nombre }],
      sender: {
        email: config.BREVO_SENDER_EMAIL,
        name: config.BREVO_SENDER_NAME
      },
      templateId: config.BREVO_TEMPLATE_ENTREGA_PDF,
      params: {
        NOMBRE: nombre,
        PDF_URL: pdfUrl,
        COMBO_URL: comboUrl || pdfUrl,
        CODIGO_DESCUENTO: codigoDescuento,
        WHATSAPP_SOPORTE: config.WHATSAPP_SOPORTE,
        PRODUCTO: producto === 'combo' ? 'Combo PDF + MP3' : 'Libro PDF'
      }
    };

    const response = await this.client.post('/smtp/email', payload);
    Logger.info('✅ Email enviado via Brevo', { messageId: response.data?.messageId });
    return { messageId: response.data?.messageId };
  }

  async agregarContactoLista(email, nombre) {
    if (config.MOCK_LIBRO_ENTREGA) {
      Logger.info('🧪 MOCK: Contacto agregado a lista', { email });
      return true;
    }

    const payload = {
      email,
      attributes: {
        FIRSTNAME: nombre
      },
      listIds: config.BREVO_LISTA_COMPRADORES ? [config.BREVO_LISTA_COMPRADORES] : [],
      updateEnabled: true
    };

    await this.client.post('/contacts', payload);
    Logger.info('✅ Contacto agregado a lista Brevo', { email });
    return true;
  }
}

module.exports = new BrevoService();