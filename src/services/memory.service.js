const supabaseService = require('./supabase.service');
const Logger = require('../utils/logger.util');

/**
 * Servicio de memoria conversacional PERSISTENTE
 * Almacena en Supabase + cache local en RAM
 */
class MemoryService {
  constructor() {
    // Cache local para reducir queries a Supabase
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutos
    this.maxMessagesPerUser = 20; // Aumentado a 20 (antes era 10)
  }

  /**
   * Obtiene el historial de conversación (Supabase + cache)
   */
  async getHistory(subscriberId, limit = 20) {
    try {
      const cacheKey = `session_${subscriberId}`;
      
      // Intentar desde cache primero
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.CACHE_TTL) {
          Logger.debug(`💨 Historial desde cache para ${subscriberId}`);
          return cached.data;
        }
      }
      
      // Obtener desde Supabase (persistente)
      const history = await supabaseService.getMemory(subscriberId, limit);
      
      // Cachear resultado
      this.cache.set(cacheKey, {
        data: history,
        timestamp: Date.now()
      });
      
      Logger.debug(`💾 Historial desde Supabase para ${subscriberId}: ${history.length} mensajes`);
      return history;
      
    } catch (error) {
      Logger.error('Error obteniendo historial:', error);
      return [];
    }
  }

  /**
   * Agrega un mensaje al historial (Supabase + cache)
   */
  async addMessage(subscriberId, role, content) {
    try {
      // Guardar en Supabase (persistente)
      await supabaseService.saveMemory(subscriberId, role, content);
      
      // Invalidar cache para forzar refresh
      const cacheKey = `session_${subscriberId}`;
      this.cache.delete(cacheKey);
      
      Logger.debug(`💾 Mensaje guardado en Supabase para ${subscriberId}: ${role}`);
      return true;
      
    } catch (error) {
      Logger.error('Error guardando mensaje:', error);
      return false;
    }
  }

  /**
   * Formatea el historial para OpenAI
   */
  async formatHistoryForOpenAI(subscriberId) {
    const history = await this.getHistory(subscriberId);
    
    return history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Limpia el historial de un usuario (cache + Supabase)
   */
  async clearHistory(subscriberId) {
    try {
      const cacheKey = `session_${subscriberId}`;
      this.cache.delete(cacheKey);
      
      // Opcional: también eliminar de Supabase si lo necesitas
      // (Por ahora solo limpiamos cache, Supabase se limpia automáticamente)
      
      Logger.debug(`🧹 Cache limpiado para ${subscriberId}`);
      return true;
    } catch (error) {
      Logger.error('Error limpiando historial:', error);
      return false;
    }
  }

  /**
   * Limpia cache antiguo (ejecutar periódicamente)
   */
  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.info(`🧹 Cache limpiado: ${cleaned} sesiones expiradas`);
    }
  }
}

// Instancia singleton
const memoryService = new MemoryService();

// Cleanup de cache cada 10 minutos
setInterval(() => {
  memoryService.cleanupCache();
}, 10 * 60 * 1000);

module.exports = memoryService;