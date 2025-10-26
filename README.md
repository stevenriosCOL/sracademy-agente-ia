# 🤖 VuelaSim Super Agente - Backend Node.js

Backend Node.js/Express para el Super Agente de IA de WhatsApp de VuelaSim. Migrado desde n8n a código propio con todas las funcionalidades originales.

## 📋 Características

- ✅ **Rate Limiting**: 30 mensajes por día por usuario (Redis/Memoria)
- ✅ **Detección de Idioma**: Español, Inglés, Portugués
- ✅ **Clasificador IA**: GPT-4o-mini categoriza en VENTAS/SOPORTE/TECNICO/ESCALAMIENTO
- ✅ **4 Agentes Especializados**: Cada uno con prompts optimados y GPT-4o
- ✅ **RAG**: Búsqueda semántica en base de conocimiento (topK=6)
- ✅ **Memoria Conversacional**: Contexto por subscriber_id
- ✅ **Notificaciones Admin**: Escalamientos automáticos
- ✅ **Analytics**: Guardado en Supabase
- ✅ **Feedback**: Sistema de calificaciones

## 🏗️ Arquitectura
```
ManyChat → Webhook → Rate Limit → Clasificador GPT-4o-mini 
→ Agente Específico (GPT-4o + RAG) → ManyChat 
→ Analytics Supabase
→ Si ESCALAMIENTO: Notificar Admin
```

## 📁 Estructura del Proyecto
```
agente-ia-vuelasim/
├── src/
│   ├── config/
│   │   └── env.config.js          # Configuración de variables de entorno
│   ├── routes/
│   │   ├── webhook.routes.js      # Ruta principal del webhook
│   │   └── feedback.routes.js     # Ruta de feedback
│   ├── services/
│   │   ├── classifier.service.js  # Clasificador GPT-4o-mini
│   │   ├── agents.service.js      # 4 Agentes IA
│   │   ├── rag.service.js         # Búsqueda semántica
│   │   ├── supabase.service.js    # Cliente Supabase
│   │   ├── manychat.service.js    # Cliente ManyChat API
│   │   ├── ratelimit.service.js   # Rate limiting
│   │   └── memory.service.js      # Memoria conversacional
│   ├── utils/
│   │   ├── sanitize.util.js       # Sanitización de inputs
│   │   ├── language.util.js       # Detección de idioma
│   │   └── logger.util.js         # Logger personalizado
│   ├── app.js                     # Configuración Express
│   └── server.js                  # Punto de entrada
├── package.json
├── .env.example
├── .gitignore
└── README.md