require('dotenv').config();

module.exports = {
  // Server
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL_CLASSIFIER: process.env.OPENAI_MODEL_CLASSIFIER || 'gpt-4o-mini',
  OPENAI_MODEL_AGENT: process.env.OPENAI_MODEL_AGENT || 'gpt-4o',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Redis
  REDIS_URL: process.env.REDIS_URL,
  USE_REDIS: process.env.USE_REDIS === 'true',

  // ManyChat
  MANYCHAT_TOKEN: process.env.MANYCHAT_TOKEN,
  MANYCHAT_API_URL: process.env.MANYCHAT_API_URL || 'https://api.manychat.com/fb/sending/sendContent',

  // Admin
  ADMIN_SUBSCRIBER_ID: process.env.ADMIN_SUBSCRIBER_ID || '312252988',

  // Rate Limiting
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 30,
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 86400, // 24 horas en segundos
};