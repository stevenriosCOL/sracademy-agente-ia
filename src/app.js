const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const webhookRoutes = require('./routes/webhook.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const Logger = require('./utils/logger.util');

const app = express();

// =====================
// MIDDLEWARES GLOBALES
// =====================

// Seguridad con Helmet
app.use(helmet());

// CORS
app.use(cors());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging de requests
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// =====================
// HEALTH CHECK
// =====================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'SR Academy - Agente IA',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: '🎓 SR Academy - Agente IA API',
    version: '1.0.0',
    status: 'running',
    author: 'Steven Rios FX',
    endpoints: {
      health: 'GET /health',
      webhook: 'POST /webhook/sracademy-bot',
      feedback: 'POST /webhook/feedback-sracademy'
    }
  });
});

// =====================
// RUTAS
// =====================

app.use('/webhook', webhookRoutes);
app.use('/webhook', feedbackRoutes);

// =====================
// MANEJO DE ERRORES 404
// =====================

app.use((req, res) => {
  Logger.warn('404 - Ruta no encontrada', { 
    method: req.method, 
    path: req.path 
  });
  
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.path
  });
});

// =====================
// MANEJO DE ERRORES GLOBALES
// =====================

app.use((error, req, res, next) => {
  Logger.error('Error global capturado:', error);
  
  res.status(error.status || 500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Ha ocurrido un error'
  });
});

module.exports = app;