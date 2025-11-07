const express = require('router');
const router = express.Router();
const manychatService = require('../services/manychat.service');
const Logger = require('../utils/logger.util');

/**
 * Endpoint para generar link de pago desde ManyChat
 * Llamado cuando usuario acepta pagar consultoría
 */
router.post('/generate-link', async (req, res) => {
  try {
    const { nombre, whatsapp, subscriber_id } = req.body;

    if (!nombre || !whatsapp) {
      return res.status(400).json({ 
        error: 'nombre y whatsapp son requeridos' 
      });
    }

    Logger.info('💰 Solicitud de link de pago', { nombre, whatsapp });

    // Generar link llamando al backend de pagos
    const result = await manychatService.generatePaymentLink(nombre, whatsapp, 25);

    if (result.success) {
      const response = `🧾 ¡Excelente! Aquí tienes tu enlace de pago personalizado:

${result.link}

🔖 *Código de sesión:* ${result.codigo}

📌 Tu sesión se agenda únicamente después de completar el pago.
🧠 Al completarlo, envíame el código que recibes por email.`;

      return res.json({ 
        response,
        link: result.link,
        codigo: result.codigo
      });
    } else {
      return res.status(500).json({ 
        error: 'Error generando link de pago',
        details: result.error
      });
    }

  } catch (error) {
    Logger.error('Error en /generate-link:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor' 
    });
  }
});

module.exports = router;