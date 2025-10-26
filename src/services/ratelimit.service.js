const Redis = require('ioredis');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class RateLimitService {
  constructor() {
    this.useRedis = config.USE_REDIS;
    this.inMemoryStore = new Map(); // Fallback para desarrollo sin Redis
    
    if (this.useRedis && config.REDIS_URL) {
      try {
        // Configuración para Upstash Redis con TLS
        this.redis = new Redis(config.REDIS_URL, {
          tls: {
            rejectUnauthorized: false // Necesario para Upstash
          },
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              Logger.error('Redis: Max retries reached, falling back to in-memory');
              this.useRedis = false;
              return null;
            }
            return Math.min(times * 100, 2000);
          },
          enableReadyCheck: true,
          enableOfflineQueue: false
        });

        this.redis.on('connect', () => {
          Logger.info('✅ Redis conectado correctamente');
        });

        this.redis.on('ready', () => {
          Logger.info('✅ Redis listo para recibir comandos');
        });

        this.redis.on('error', (err) => {
          Logger.error('❌ Redis error:', err);
        });

        this.redis.on('close', () => {
          Logger.warn('⚠️ Conexión Redis cerrada');
        });

      } catch (error) {
        Logger.error('Error inicializando Redis, usando memoria:', error);
        this.useRedis = false;
      }
    } else {
      Logger.warn('⚠️ Redis no configurado, usando rate limit en memoria (solo desarrollo)');
    }
  }

  /**
   * Verifica si un usuario ha excedido el límite de mensajes
   * Retorna: { allowed: boolean, count: number, remaining: number }
   */
  async checkRateLimit(subscriberId) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `rate:${subscriberId}:${today}`;

    try {
      if (this.useRedis && this.redis && this.redis.status === 'ready') {
        // Usar Redis
        const count = await this.redis.incr(key);
        
        if (count === 1) {
          // Primera request del día, establecer expiración
          await this.redis.expire(key, config.RATE_LIMIT_WINDOW);
        }

        const allowed = count <= config.RATE_LIMIT_MAX;
        const remaining = Math.max(0, config.RATE_LIMIT_MAX - count);

        Logger.debug(`Rate limit [Redis] - ${subscriberId}: ${count}/${config.RATE_LIMIT_MAX}`);

        return { allowed, count, remaining };
      } else {
        // Usar memoria (solo desarrollo)
        const current = this.inMemoryStore.get(key) || 0;
        const newCount = current + 1;
        this.inMemoryStore.set(key, newCount);

        // Limpiar memoria cada 24 horas (simple)
        setTimeout(() => this.inMemoryStore.delete(key), config.RATE_LIMIT_WINDOW * 1000);

        const allowed = newCount <= config.RATE_LIMIT_MAX;
        const remaining = Math.max(0, config.RATE_LIMIT_MAX - newCount);

        Logger.debug(`Rate limit [Memory] - ${subscriberId}: ${newCount}/${config.RATE_LIMIT_MAX}`);

        return { allowed, count: newCount, remaining };
      }
    } catch (error) {
      Logger.error('Error en rate limit:', error);
      // En caso de error, permitir la request
      return { allowed: true, count: 0, remaining: config.RATE_LIMIT_MAX };
    }
  }

  /**
   * Obtiene el mensaje de límite excedido según idioma
   */
  getRateLimitMessage(language = 'es') {
    const messages = {
      es: '⚠️ Has alcanzado el límite de 30 mensajes por día. Por favor, intenta mañana o contáctanos en hola@vuelasim.com',
      en: '⚠️ You have reached the limit of 30 messages per day. Please try again tomorrow or contact us at hola@vuelasim.com',
      pt: '⚠️ Você atingiu o limite de 30 mensagens por dia. Por favor, tente amanhã ou entre em contato em hola@vuelasim.com'
    };

    return messages[language] || messages.es;
  }

  /**
   * Cierra la conexión de Redis (para cleanup)
   */
  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      Logger.info('Redis desconectado');
    }
  }
}

module.exports = new RateLimitService();