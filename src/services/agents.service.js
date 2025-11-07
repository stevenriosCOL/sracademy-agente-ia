const OpenAI = require('openai');
const config = require('../config/env.config');
const ragService = require('./rag.service');
const memoryService = require('./memory.service');
const Logger = require('../utils/logger.util');
const { getContextualGreeting } = require('../utils/language.util');

class AgentsService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  /**
   * Ejecuta el agente correspondiente según la categoría
   */
  async executeAgent(category, subscriberId, nombre, mensaje, idioma) {
    Logger.info(`🤖 Ejecutando agente: ${category}`, { subscriberId });

    // ESCALAMIENTO no usa IA, retorna mensaje estático
    if (category === 'ESCALAMIENTO') {
      return this.getEscalationMessage(idioma);
    }

    try {
      // 1. Buscar contexto en RAG
      const ragResults = await ragService.searchKnowledge(mensaje);
      const ragContext = ragService.formatContextForAgent(ragResults);

      // 2. Obtener historial de memoria
      const conversationHistory = memoryService.formatHistoryForOpenAI(subscriberId);

      // 3. Obtener saludo contextual
      const saludo = getContextualGreeting(idioma);

      // 4. Construir el prompt del sistema según agente
      const systemPrompt = this.getAgentSystemPrompt(category, {
        idioma,
        nombre,
        saludo,
        subscriberId,
        ragContext
      });

      // 5. Construir mensajes para OpenAI
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: mensaje }
      ];

      // 6. Llamar a GPT-4o con configuración específica del agente
      const temperature = this.getAgentTemperature(category);

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL_AGENT,
        messages: messages,
        temperature: temperature,
        max_tokens: 500
      });

      const response = completion.choices[0].message.content.trim();

      // 7. Guardar en memoria
      memoryService.addMessage(subscriberId, 'user', mensaje);
      memoryService.addMessage(subscriberId, 'assistant', response);

      Logger.info(`✅ Agente ${category} respondió`, { 
        subscriberId, 
        responseLength: response.length 
      });

      return response;

    } catch (error) {
      Logger.error(`Error ejecutando agente ${category}:`, error);
      return this.getFallbackMessage(idioma);
    }
  }

  /**
   * Retorna el prompt del sistema según el agente
   * EXACTAMENTE como en el JSON de n8n
   */
  getAgentSystemPrompt(category, context) {
    const { idioma, nombre, saludo, subscriberId, ragContext } = context;

    const prompts = {
DIAGNOSTICO: `IDIOMA: ${idioma}
Si idioma='en' responde en INGLÉS. Si idioma='pt' responde en PORTUGUÉS. Si idioma='es' responde en ESPAÑOL.

Soy el Agente de Diagnóstico de Sensora AI. Califico leads y entiendo problemas empresariales.

CLIENTE: ${nombre}
ID: ${subscriberId}

MI MISIÓN:
1. Hacer preguntas estratégicas para calificar el lead
2. Ofrecer diagnóstico gratuito (Tally) si califican
3. Mencionar sesión pagada ($25) cuando sea relevante

PROCESO (UNA pregunta a la vez):

PASO 1: "¿A qué se dedica tu empresa? ¿Fintech, e-commerce, salud, retail, servicios...?"

PASO 2: "¿Cuántas personas trabajan en la empresa?"

PASO 3: "¿Qué tarea manual consume más tiempo de tu equipo? Ej: reportes, validaciones, coordinación..."

PASO 4: "¿Cuántas horas a la semana pierden en eso aproximadamente?"

PASO 5: "¿Qué herramientas digitales usan hoy? WhatsApp, CRM, hojas de cálculo..."

PASO 6: "¿En qué país operan?"

LEAD CALIFICADO ✅:
- Empresa 10-100 personas
- 15+ hrs/semana en tareas manuales
- Herramientas digitales actuales
- Sectores: Fintech, E-commerce, Salud, Retail, Servicios
- LATAM (Colombia, México, Argentina, Chile)

LEAD NO CALIFICADO ❌:
- <5 personas o muy bajo presupuesto

MI ESTILO:
- Conversacional, empático
- Una pregunta a la vez
- 2-3 líneas máximo
- Sin comillas dobles

FLUJO DE CONVERSACIÓN:

**CUANDO EL LEAD CALIFICA (después de las 6 preguntas):**

OPCIÓN A - Ofrecer diagnóstico gratuito PRIMERO:
"Excelente! Tu caso califica perfecto ([detalles del caso]). 

Te ofrezco 2 opciones:

1️⃣ *Diagnóstico gratuito (30 min):* Completa un formulario y analizamos tu caso. Link:
https://tally.so/r/3jXLdQ?utm_source=whatsapp-diagnostico&whatsapp=${subscriberId}

Al terminarlo recibes un código SENS-XXXX para coordinar siguiente paso.

2️⃣ *Sesión estratégica pagada ($25 USD, 45 min):* Análisis más profundo + cotización exacta + roadmap. Ese monto se descuenta si trabajamos juntos.

¿Cuál prefieres?"

**SI EL CLIENTE PIDE ALGO MÁS DIRECTO/RÁPIDO:**
User: "No tengo tiempo para formularios" / "Quiero algo más directo" / "Cuándo podemos hablar?"
Bot: "Perfecto! Entonces te conviene la sesión estratégica de $25 USD (45 min). Es más profunda que el diagnóstico y recibes cotización exacta. ¿Te interesa?"

**SI EL CLIENTE ELIGE SESIÓN PAGADA:**
User: "Sí, quiero la sesión pagada" / "Me interesa la de $25"
Bot: "Excelente! Para generar tu link de pago necesito confirmar:
- Nombre completo
- WhatsApp (para enviarte el código)

¿Me confirmas esos datos?"

[Después de recibir datos, el webhook llamará al backend de pagos]

**SI EL CLIENTE ELIGE DIAGNÓSTICO GRATUITO:**
User: "Prefiero el gratuito" / "Ok, el diagnóstico"
Bot: "Perfecto! Completa el diagnóstico aquí:
https://tally.so/r/3jXLdQ?utm_source=whatsapp-diagnostico&whatsapp=${subscriberId}

Al terminarlo recibes un código SENS-XXXX. Envíamelo aquí y te explico los siguientes pasos. ¿Te parece?"

**SI NO CALIFICA:**
"Entiendo tu situación. Por ahora trabajamos con empresas de al menos 10 personas con procesos digitales. Te recomiendo empezar con Zapier o Make. Si crecen, vuelve a contactarnos!"

**IMPORTANTE:**
- Ofrecer AMBAS opciones cuando califican
- Ser flexible según urgencia del cliente
- Si piden "hablar directo" → sesión pagada
- Si prefieren "evaluar primero" → diagnóstico gratuito
- NO inventar precios o condiciones

${ragContext}

RECORDATORIO CRÍTICO:
Tu respuesta COMPLETA debe estar en el idioma ${idioma}.
NO mezcles idiomas.
UNA pregunta por mensaje.
Siempre incluir subscriber_id en links de Tally.`,
    };

    return prompts[category] || prompts.VENTAS;
  }

  /**
   * Retorna la temperatura según el agente
   * Replicado de n8n: Ventas 0.7, Soporte 0.5, Tecnico 0.4
   */
  getAgentTemperature(category) {
    const temperatures = {
      VENTAS: 0.7,
      SOPORTE: 0.5,
      TECNICO: 0.4
    };

    return temperatures[category] || 0.5;
  }

  /**
   * Mensaje de escalamiento multiidioma
   * Exacto del JSON de n8n
   */
  getEscalationMessage(language) {
    const messages = {
      es: 'Entiendo que necesitas ayuda más específica. Te he conectado con nuestro equipo de soporte. Escribeles a hola@vuelasim.com con tu consulta detallada y te responderán lo antes posible. También he notificado a nuestro equipo sobre tu caso.',
      
      en: 'I understand you need more specific help. I have connected you with our support team. Write to hola@vuelasim.com with your detailed inquiry and they will respond as soon as possible. I have also notified our team about your case.',
      
      pt: 'Entendo que você precisa de ajuda mais específica. Conectei você com nossa equipe de suporte. Escreva para hola@vuelasim.com com sua consulta detalhada e eles responderão o mais rápido possível. Também notifiquei nossa equipe sobre seu caso.'
    };

    return messages[language] || messages.es;
  }

  /**
   * Mensaje de fallback en caso de error
   */
  getFallbackMessage(language) {
    const messages = {
      es: 'Disculpa, tuve un problema técnico. ¿Podrías repetir tu consulta? Si el problema persiste, escríbenos a hola@vuelasim.com',
      en: 'Sorry, I had a technical issue. Could you repeat your question? If the problem persists, write to us at hola@vuelasim.com',
      pt: 'Desculpe, tive um problema técnico. Você poderia repetir sua consulta? Se o problema persistir, escreva para hola@vuelasim.com'
    };

    return messages[language] || messages.es;
  }
}

module.exports = new AgentsService();