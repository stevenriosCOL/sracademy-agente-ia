const app = require('./app');
const config = require('./config/env.config');
const Logger = require('./utils/logger.util');

const PORT = config.PORT;

// Validar variables de entorno críticas
function validateEnvironment() {
  // Variables OBLIGATORIAS
  const requiredVars = [
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  // Variables OPCIONALES (warning si no están)
  const optionalVars = [
    'MANYCHAT_API_KEY',
    'ADMIN_SUBSCRIBER_ID'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    Logger.error('❌ Variables de entorno OBLIGATORIAS faltantes:', missing);
    Logger.error('Por favor configura tu archivo .env correctamente');
    process.exit(1);
  }

  // Verificar opcionales (solo warning)
  const missingOptional = optionalVars.filter(varName => !process.env[varName]);
  if (missingOptional.length > 0) {
    Logger.warn('⚠️ Variables opcionales no configuradas:', missingOptional);
    Logger.warn('El bot funcionará pero algunas funciones estarán limitadas');
  }

  Logger.info('✅ Variables de entorno validadas');
}

// Iniciar servidor
function startServer() {
  try {
    validateEnvironment();

    const server = app.listen(PORT, () => {
      Logger.info('═══════════════════════════════════════');
      Logger.info('🎓 SR ACADEMY - Agente IA');
      Logger.info('═══════════════════════════════════════');
      Logger.info(`🌍 Servidor corriendo en puerto ${PORT}`);
      Logger.info(`📝 Ambiente: ${config.NODE_ENV}`);
      Logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      Logger.info(`📡 Webhook: http://localhost:${PORT}/webhook/sracademy-bot`);
      Logger.info('═══════════════════════════════════════');
    });

    // Manejo de señales de terminación
    const gracefulShutdown = (signal) => {
      Logger.info(`\n${signal} recibido, cerrando servidor...`);
      
      server.close(() => {
        Logger.info('✅ Servidor cerrado correctamente');
        process.exit(0);
      });

      // Forzar cierre después de 10 segundos
      setTimeout(() => {
        Logger.error('⚠️ Forzando cierre del servidor');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Manejo de errores no capturados
    process.on('uncaughtException', (error) => {
      Logger.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      Logger.error('❌ Unhandled Rejection:', { reason, promise });
      process.exit(1);
    });

  } catch (error) {
    Logger.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();