const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase.service');
const Logger = require('../utils/logger.util');

/**
 * POST /webhook/feedback-sracademy
 * Recibe feedback de los usuarios sobre las respuestas del bot
 */
router.post('/feedback-sracademy', async (req, res) => {
  try {
    const { subscriber_id, nombre_cliente, calificacion, comentario, categoria_conversacion } = req.body;

    // Validar campos requeridos
    if (!subscriber_id || !calificacion) {
      return res.status(400).json({
        success: false,
        error: 'subscriber_id y calificacion son requeridos'
      });
    }

    // Validar que calificación esté entre 1 y 5
    const rating = parseInt(calificacion);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'La calificación debe ser un número entre 1 y 5'
      });
    }

    // Guardar feedback
    await supabaseService.saveFeedback({
      subscriber_id,
      nombre_cliente: nombre_cliente || 'Usuario',
      calificacion: rating,
      comentario: comentario || '',
      categoria_conversacion: categoria_conversacion || 'general'
    });

    Logger.info('✅ Feedback guardado', { 
      subscriber_id, 
      calificacion: rating 
    });

    res.status(200).json({
      success: true,
      message: '¡Gracias por tu feedback! Nos ayuda a mejorar. 🙏'
    });

  } catch (error) {
    Logger.error('❌ Error guardando feedback:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error procesando el feedback'
    });
  }
});

/**
 * GET /webhook/feedback-stats
 * Obtiene estadísticas de feedback (para uso interno/admin)
 */
router.get('/feedback-stats', async (req, res) => {
  try {
    // Por ahora retornamos un placeholder
    // Puedes implementar la lógica completa después
    res.status(200).json({
      success: true,
      message: 'Endpoint de estadísticas - próximamente',
      data: {}
    });

  } catch (error) {
    Logger.error('❌ Error obteniendo stats:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas'
    });
  }
});

module.exports = router;