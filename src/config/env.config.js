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
  WEBHOOK_RATE_LIMIT_MAX: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX) || 10,
  WEBHOOK_RATE_LIMIT_WINDOW: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW) || 60,

  // ═══════════════════════════════════════
  // SR ACADEMY - LINKS Y CONFIG
  // ═══════════════════════════════════════
  CURSO_GRATUITO_URL: process.env.CURSO_GRATUITO_URL || 'https://www.youtube.com/playlist?list=PLtik6WwJuNioT_cIRjR9kEfpjA62wNntK',
  MEMBRESIA_URL: process.env.MEMBRESIA_URL || 'https://stevenriosfx.com/ofertadela%C3%B1o',
  WHATSAPP_ACADEMIA: process.env.WHATSAPP_ACADEMIA || '+573142735697',
  WHATSAPP_SOPORTE: process.env.WHATSAPP_SOPORTE || '+573006926613',

    // ═══════════════════════════════════════
  // SR ACADEMY - SUPPORT API (Read-only)
  // ═══════════════════════════════════════
  SUPPORT_API_URL: process.env.SUPPORT_API_URL,
  SUPPORT_API_KEY: process.env.SUPPORT_API_KEY,

  // ═══════════════════════════════════════
  // BREVO (Email Marketing)
  // ═══════════════════════════════════════
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  BREVO_API_URL: process.env.BREVO_API_URL || 'https://api.brevo.com/v3',
  BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL,
  BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || 'Steven Rios FX',
  BREVO_TEMPLATE_ENTREGA_PDF: parseInt(process.env.BREVO_TEMPLATE_ENTREGA_PDF) || null,
  BREVO_LISTA_COMPRADORES: parseInt(process.env.BREVO_LISTA_COMPRADORES) || null,

  // ═══════════════════════════════════════
  // LIBRO - GOOGLE DRIVE LINKS
  // ═══════════════════════════════════════
  LIBRO_PDF_URL: process.env.LIBRO_PDF_URL,
  LIBRO_COMBO_URL: process.env.LIBRO_COMBO_URL,

  // ═══════════════════════════════════════
  // LIBRO - CONFIGURACIÓN
  // ═══════════════════════════════════════
  SUPABASE_WEBHOOK_SECRET: process.env.SUPABASE_WEBHOOK_SECRET,
  CODIGO_DESCUENTO_VALIDEZ_DIAS: parseInt(process.env.CODIGO_DESCUENTO_VALIDEZ_DIAS) || 30,
  MOCK_LIBRO_ENTREGA: process.env.MOCK_LIBRO_ENTREGA === 'true',

  // Webhook Security
MANYCHAT_WEBHOOK_SECRET: process.env.MANYCHAT_WEBHOOK_SECRET,
SUPABASE_WEBHOOK_SECRET: process.env.SUPABASE_WEBHOOK_SECRET,

  // ═══════════════════════════════════════
  // MERCADO PAGO (Opcional - para pagos futuros)
  // ═══════════════════════════════════════
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
};