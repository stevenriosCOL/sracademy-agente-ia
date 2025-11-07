const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase.service');
const Logger = require('../utils/logger.util');

/**
 * POST /webhook/feedback-sensora
 * Recibe feedback de clientes desde ManyChat sobre calidad de servicio
 */
router.post('/feedback-sensora', async (req, res) => {
  try {
    Logger.info('📝 Feedback recibido', { body: req.body });

    const body = req.body || {};
    const subscriberId = body.subscriber_id || 'unknown';
    const nombre = body.nombre || body.first_name || 'Cliente';
    const calificacion = body.calificacion || 'sin_calificar';
    const comentario = body.comentario || null;

    // Validar calificación
    const calificacionesValidas = ['excelente', 'buena', 'regular', 'mala'];
    if (!calificacionesValidas.includes(calificacion.toLowerCase())) {
      Logger.warn('⚠️ Calificación inválida', { calificacion });
      return res.status(400).json({ 
        error: 'Calificación inválida. Debe ser: excelente, buena, regular o mala' 
      });
    }

    // Buscar última conversación del usuario
    const lastConversation = await supabaseService.getLastConversation(subscriberId);
    const categoriaConversacion = lastConversation?.categoria || null;

    // Guardar feedback
    const feedbackData = {
      subscriber_id: subscriberId,
      nombre_cliente: nombre,
      calificacion: calificacion.toLowerCase(),
      categoria_conversacion: categoriaConversacion,
      comentario: comentario
    };

    const saved = await supabaseService.saveFeedback(feedbackData);

    if (saved) {
      Logger.info('✅ Feedback guardado exitosamente', { 
        subscriberId, 
        calificacion 
      });

      return res.status(200).json({
        status: 'success',
        message: 'Gracias por tu feedback! Nos ayuda a mejorar.',
        data: {
          subscriber_id: subscriberId,
          calificacion: calificacion.toLowerCase()
        }
      });
    } else {
      return res.status(500).json({
        status: 'error',
        message: 'Error guardando feedback'
      });
    }

  } catch (error) {
    Logger.error('❌ Error procesando feedback:', error);
    
    return res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;