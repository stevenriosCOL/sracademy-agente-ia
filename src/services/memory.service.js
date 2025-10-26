const Logger = require('../utils/logger.util');

/**
 * Servicio de memoria conversacional por subscriber_id
 * Almacena las últimas N interacciones en memoria
 */
class MemoryService {
  constructor() {
    this.conversations = new Map();
    this.maxMessagesPerUser = 10; // Mantener últimas 10 interacciones
  }

  /**
   * Obtiene el historial de conversación de un usuario
   */
  getHistory(subscriberId) {
    if (!this.conversations.has(subscriberId)) {
      return [];
    }

    return this.conversations.get(subscriberId);
  }

  /**
   * Agrega un mensaje al historial
   */
  addMessage(subscriberId, role, content) {
    if (!this.conversations.has(subscriberId)) {
      this.conversations.set(subscriberId, []);
    }

    const history = this.conversations.get(subscriberId);
    
    history.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });

    // Mantener solo los últimos N mensajes
    if (history.length > this.maxMessagesPerUser * 2) {
      history.splice(0, history.length - (this.maxMessagesPerUser * 2));
    }

    Logger.debug(`Memoria actualizada para ${subscriberId}: ${history.length} mensajes`);
  }

  /**
   * Formatea el historial para OpenAI
   */
  formatHistoryForOpenAI(subscriberId) {
    const history = this.getHistory(subscriberId);
    
    return history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Limpia el historial de un usuario
   */
  clearHistory(subscriberId) {
    this.conversations.delete(subscriberId);
    Logger.debug(`Memoria limpiada para ${subscriberId}`);
  }

  /**
   * Limpia historiales antiguos (cleanup periódico)
   */
  cleanup(maxAgeHours = 24) {
    const now = new Date();
    let cleaned = 0;

    for (const [subscriberId, history] of this.conversations.entries()) {
      if (history.length === 0) continue;

      const lastMessage = history[history.length - 1];
      const lastTimestamp = new Date(lastMessage.timestamp);
      const hoursDiff = (now - lastTimestamp) / (1000 * 60 * 60);

      if (hoursDiff > maxAgeHours) {
        this.conversations.delete(subscriberId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.info(`🧹 Memoria limpiada: ${cleaned} conversaciones antiguas eliminadas`);
    }
  }
}

// Instancia singleton
const memoryService = new MemoryService();

// Cleanup automático cada hora
setInterval(() => {
  memoryService.cleanup();
}, 60 * 60 * 1000);

module.exports = memoryService;