const Logger = require('../utils/logger.util');

class ScoringService {
  /**
   * Calcula heat score (0-100) basado en comportamiento del lead
   */
  calculateHeatScore(leadData, interactionData = {}) {
    let score = 0;
    
    // ═══════════════════════════════════════
    // INTERÉS Y ACCIONES (50 puntos max)
    // ═══════════════════════════════════════
    if (leadData.qualified) score += 30;
    if (leadData.libro_comprador) score += 25;
    if (leadData.interesado_membresia) score += 20;
    if (leadData.libro_interesado) score += 15;
    if (leadData.curso_gratuito_completado) score += 15;
    if (leadData.curso_gratuito_enviado) score += 5;
    
    // ═══════════════════════════════════════
    // RECENCIA (30 puntos max)
    // ═══════════════════════════════════════
    const daysSinceLastUpdate = this._daysSince(leadData.updated_at);
    if (daysSinceLastUpdate < 1) score += 30;
    else if (daysSinceLastUpdate < 3) score += 20;
    else if (daysSinceLastUpdate < 7) score += 10;
    else if (daysSinceLastUpdate > 30) score -= 20;
    
// ═══════════════════════════════════════
// EMOCIÓN (20 puntos max) — set real del clasificador
// ═══════════════════════════════════════
if (interactionData.emocion) {
  const raw = String(interactionData.emocion || '').toUpperCase().trim();

  // ✅ Mapear legacy (por si llega algo viejo)
  const legacyMap = {
    'ANSIOSO': 'DESPERATE',
    'FRUSTRADO': 'FRUSTRATED',
    'MOTIVADO': 'EXCITED'
  };

  const e = legacyMap[raw] || raw;

  if (e === 'DESPERATE') score += 20;
  else if (e === 'ANGRY') score += 15;
  else if (e === 'FRUSTRATED') score += 12;
  else if (e === 'EXCITED') score += 10;
  else if (e === 'CURIOUS') score += 6;
  else if (e === 'NEUTRAL') score += 0;
}
    
    // ═══════════════════════════════════════
    // CATEGORÍA (40 puntos max)
    // ═══════════════════════════════════════
    if (interactionData.categoria) {
      if (interactionData.categoria === 'SITUACION_DELICADA') score += 50; // Override
      if (interactionData.categoria === 'LEAD_CALIENTE') score += 40;
      if (interactionData.categoria === 'COMPRA_LIBRO_PROCESO') score += 35;
      if (interactionData.categoria === 'INFO_PRODUCTOS') score += 20;
      if (interactionData.categoria === 'SOPORTE_ESTUDIANTE') score += 25;
    }
    
    // Normalizar a 0-100
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Determina prioridad basada en heat score
   */
  getPriority(score) {
    if (score >= 80) return 'CRÍTICO';
    if (score >= 60) return 'ALTO';
    if (score >= 40) return 'MEDIO';
    if (score >= 20) return 'BAJO';
    return 'MUY_BAJO';
  }
  
  _daysSince(date) {
    if (!date) return 999;
    return Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60 * 24));
  }
}

module.exports = new ScoringService();