# SR Academy – Agente IA (v1.0)

Backend del asistente conversacional de **SR Academy / Steven Rios FX** conectado a **ManyChat (WhatsApp)**.  
Clasifica intención y emoción con OpenAI, responde con agentes especializados usando **RAG + memoria**, y registra analíticas/feedback en **Supabase**.

---

## 📌 Descripción rápida

| Pregunta | Respuesta |
| --- | --- |
| **¿Qué es?** | Un servidor Node/Express que recibe mensajes desde ManyChat, clasifica intención/emoción con OpenAI y responde usando agentes con RAG. |
| **¿Para qué sirve?** | Automatiza atención 24/7 a estudiantes y prospectos: resuelve dudas, recomienda productos/cursos, detecta urgencias y deriva casos sensibles. |
| **¿Cómo funciona?** | 1) Webhook recibe texto. 2) Reglas rápidas. 3) Rate limit. 4) Clasificación IA. 5) Agente responde con memoria + RAG. 6) Guarda analytics/feedback en Supabase. |
| **Tecnologías** | Node.js + Express, OpenAI (chat + embeddings), Supabase (Postgres + RPC para RAG), ManyChat, Redis opcional, Pino logs. |
| **Problema que resuelve** | Respuestas consistentes basadas en conocimiento de SR Academy y un sistema medible con analíticas y feedback. |

---

## 🏗️ Arquitectura (alto nivel)

```mermaid
graph TD
  MC[ManyChat Webhook] -->|POST /webhook| API[Express API]
  API --> Rules[Reglas rápidas]
  Rules --> Classifier[Classifier IA (OpenAI)]
  Classifier --> Agents[Agentes SR Academy]
  Agents --> RAG[RAG Service]
  RAG --> Supa[(Supabase)]
  Agents --> Memory[Memoria conversacional]
  Agents --> MC
  API --> Supa
  API --> Admin[Notificaciones Admin ManyChat]
🧠 Módulos principales
src/services/
rag.service.js

Genera embedding del mensaje con OpenAI.

Consulta coincidencias vectoriales en Supabase (RPC match_sracademy_knowledge).

Devuelve contexto relevante para el agente.

classifier.service.js

Clasifica el mensaje en JSON:
intent, emotion, nivel, urgencia

Usa un modelo OpenAI configurado en .env.

agents.service.js

Orquesta la respuesta final según el intent.

Combina: saludo contextual + memoria + contexto RAG + prompt del agente.

Maneja respuestas especiales: escalamiento, mensajes delicados, leads calientes.

supabase.service.js

Cliente único para guardar:
analytics, leads, memoria, feedback, seguimientos.

Ejecuta búsqueda RAG vía RPC.

src/routes/
webhook.routes.js
Endpoint principal que recibe mensajes desde ManyChat, ejecuta el flujo completo y devuelve la respuesta.

feedback.routes.js
Guarda calificación / comentarios del usuario en Supabase.

src/server.js
Arranque del servidor, validación de .env, healthcheck y manejo global de errores.

🔧 Requisitos del entorno
Node.js >= 20

npm >= 9

Proyecto en Supabase con:

tabla sracademy_knowledge (vector embeddings)

RPC match_sracademy_knowledge

tablas de analytics/memoria/feedback según tu esquema

Credenciales OpenAI activas

ManyChat configurado con webhooks

Redis opcional si activas rate limiting por Redis

🔐 Variables de entorno (.env)
Crea un .env en la raíz con:

env
Copiar código
OPENAI_API_KEY=
OPENAI_MODEL_CLASSIFIER=
OPENAI_MODEL_AGENT=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

MANYCHAT_API_KEY=
ADMIN_SUBSCRIBER_ID=

PORT=3000

USE_REDIS=false
REDIS_URL=
RATE_LIMIT_MAX=30
RATE_LIMIT_WINDOW=86400
▶️ Correr localmente
Clona el repo:

bash
Copiar código
git clone https://github.com/stevenriosCOL/sracademy-agente-ia.git
cd sracademy-agente-ia
Instala dependencias:

bash
Copiar código
npm install
Configura .env

Ejecuta en dev:

bash
Copiar código
npm run dev
🌐 Endpoints principales
Método	Ruta	Descripción
POST	/webhook/sracademy-bot	Recibe mensajes desde ManyChat, ejecuta agente y devuelve respuesta.
POST	/webhook/feedback-sracademy	Recibe rating/comentario y lo guarda en Supabase.
GET	/health	Revisa que el servidor esté vivo.

📚 Subir base de conocimiento (embeddings)
Script
Ruta: scripts/upload-knowledge.js
(si lo dejaste dentro de src/scripts/, ajusta la ruta en el comando)

Qué hace
Recorre el arreglo KNOWLEDGE_BASE

Genera embeddings con OpenAI

Inserta {content, source, categoria, embedding, metadata} en sracademy_knowledge

Ejecutar
Opción 1

bash
Copiar código
node scripts/upload-knowledge.js
Opción 2 (recomendado: agrega esto a package.json)

json
Copiar código
{
  "scripts": {
    "upload-knowledge": "node scripts/upload-knowledge.js"
  }
}
Y ejecutas:

bash
Copiar código
npm run upload-knowledge
🗂️ Estructura del proyecto
txt
Copiar código
sracademy-agente-ia/
├── src/
│   ├── services/
│   ├── routes/
│   ├── config/
│   ├── app.js
│   └── server.js
├── scripts/
│   └── upload-knowledge.js
├── package.json
├── package-lock.json
├── README.md
└── .env.example
🛣️ Roadmap v1.1
Multi-agente por intents avanzados.

Modo “trader experto” con respuestas más profundas.

Caché de embeddings y optimización de umbral RAG.

Logs correlacionados por subscriber_id y dashboard de métricas.

Soporte multi-idioma.