/**
 * Sanitización de inputs para evitar problemas con APIs
 */

/**
 * Limpia texto para enviarlo a OpenAI o guardar en DB
 */
function sanitizeText(text, maxLength = 5000) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/"/g, "'") // Reemplazar comillas dobles por simples
    .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos de línea seguidos
    .trim()
    .substring(0, maxLength);
}

/**
 * Limpia texto para notificación de escalamiento (más restrictivo)
 */
function sanitizeEscalationMessage(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/"/g, "'")
    .replace(/\n/g, ' ')
    .trim()
    .substring(0, 500); // Límite de 500 caracteres para notificaciones
}

/**
 * Valida que un subscriber_id sea válido
 */
function sanitizeSubscriberId(subscriberId) {
  if (!subscriberId) return 'unknown';
  
  return String(subscriberId)
    .replace(/^user:/, '')
    .trim();
}

module.exports = {
  sanitizeText,
  sanitizeEscalationMessage,
  sanitizeSubscriberId
};