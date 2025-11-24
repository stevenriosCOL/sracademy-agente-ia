require('dotenv').config();

module.exports = {
  // ═══════════════════════════════════════
  // SERVER
  // ═══════════════════════════════════════
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // ═══════════════════════════════════════
  // OPENAI
  // ═══════════════════════════════════════
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL_CLASSIFIER: process.env.OPENAI_MODEL_CLASSIFIER || 'gpt-4o-mini',
  OPENAI_MODEL_AGENT: process.env.OPENAI_MODEL_AGENT || 'gpt-4o',

  // ═══════════════════════════════════════
  // SUPABASE
  // ═══════════════════════════════════════
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // ═══════════════════════════════════════
  // REDIS (Rate Limiting)
  // ═══════════════════════════════════════
  REDIS_URL: process.env.REDIS_URL,
  USE_REDIS: process.env.USE_REDIS === 'true',

  // ═══════════════════════════════════════
  // MANYCHAT
  // ═══════════════════════════════════════
  MANYCHAT_API_KEY: process.env.MANYCHAT_API_KEY,
  MANYCHAT_API_URL: process.env.MANYCHAT_API_URL || 'https://api.manychat.com/fb/sending/sendContent',

  // ═══════════════════════════════════════
  // ADMIN (Tu subscriber_id en ManyChat)
  // ═══════════════════════════════════════
  ADMIN_SUBSCRIBER_ID: process.env.ADMIN_SUBSCRIBER_ID,

  // ═══════════════════════════════════════
  // RATE LIMITING
  // ═══════════════════════════════════════
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 50,
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 86400,

  // ═══════════════════════════════════════
  // SR ACADEMY - LINKS Y CONFIG
  // ═══════════════════════════════════════
  CURSO_GRATUITO_URL: process.env.CURSO_GRATUITO_URL || 'https://www.youtube.com/playlist?list=PLtik6WwJuNioT_cIRjR9kEfpjA62wNntK',
  MEMBRESIA_URL: process.env.MEMBRESIA_URL || 'https://stevenriosfx.com/ofertadela%C3%B1o',
  WHATSAPP_ACADEMIA: process.env.WHATSAPP_ACADEMIA || '+573142735697',

  // ═══════════════════════════════════════
  // MERCADO PAGO (Opcional - para pagos futuros)
  // ═══════════════════════════════════════
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
};