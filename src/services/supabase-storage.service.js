const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class SupabaseStorageService {
  async getLibroUrls(producto) {
    try {
      // Retornar URLs directas de Google Drive
      const pdfUrl = config.LIBRO_PDF_URL;
      const comboUrl = config.LIBRO_COMBO_URL;

      if (!pdfUrl) {
        return { pdfUrl: null, comboUrl: null, error: 'LIBRO_PDF_URL no configurado' };
      }

      if (producto === 'combo' && !comboUrl) {
        return { pdfUrl: null, comboUrl: null, error: 'LIBRO_COMBO_URL no configurado' };
      }

      return {
        pdfUrl: producto === 'combo' ? comboUrl : pdfUrl,
        comboUrl: producto === 'combo' ? comboUrl : null,
        error: null
      };
    } catch (error) {
      Logger.error('Error en getLibroUrls:', error);
      return { pdfUrl: null, comboUrl: null, error: error.message };
    }
  }
}

module.exports = new SupabaseStorageService();