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
   * Ejecuta el agente correspondiente según:
   * - intent (CONSULTA, DIAGNOSTICO, TECNICO, ESCALAMIENTO)
   * - emotion (CALM, NEUTRAL, FRUSTRATED, ANGRY, SAD, CONFUSED)
   */
  async executeAgent(intent, emotion, subscriberId, nombre, mensaje, idioma) {
    Logger.info('🤖 Ejecutando agente', { intent, emotion, subscriberId });

    // ESCALAMIENTO no usa IA, retorna mensaje estático
    if (intent === 'ESCALAMIENTO') {
      return this.getEscalationMessage(idioma, emotion);
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
      const systemPrompt = this.getAgentSystemPrompt(intent, {
        idioma,
        nombre,
        saludo,
        subscriberId,
        ragContext,
        emotion
      });

      // 5. Construir mensajes para OpenAI
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: mensaje }
      ];

      // 6. Llamar a GPT-4o con configuración específica del agente
      const temperature = this.getAgentTemperature(intent);

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL_AGENT,
        messages,
        temperature,
        max_tokens: 500
      });

      const response = completion.choices[0].message.content.trim();

      // 7. Guardar en memoria
      memoryService.addMessage(subscriberId, 'user', mensaje);
      memoryService.addMessage(subscriberId, 'assistant', response);

      Logger.info('✅ Agente respondió', {
        intent,
        emotion,
        subscriberId,
        responseLength: response.length
      });

      return response;

    } catch (error) {
      Logger.error(`Error ejecutando agente ${intent}:`, error);
      return this.getFallbackMessage(idioma);
    }
  }

  /**
   * Retorna el prompt del sistema según el agente
   */
  getAgentSystemPrompt(intent, context) {
    const { idioma, nombre, saludo, subscriberId, ragContext, emotion } = context;

    const emotionLine = `ESTADO EMOCIONAL DEL CLIENTE (estimado): ${emotion}. Ajusta el tono con empatía si es FRUSTRATED, ANGRY, SAD o CONFUSED.`;

    const prompts = {
      CONSULTA: `IDIOMA: ${idioma}
${emotionLine}
Si idioma='en' responde en INGLÉS. Si idioma='pt' responde en PORTUGUÉS. Si idioma='es' responde en ESPAÑOL.

Soy el Agente de Consultas de Sensora AI, empresa especializada en automatización empresarial con IA para América Latina.

CLIENTE: ${nombre}
CONTEXTO: ${saludo}

INFORMACIÓN CLAVE DE SENSORA AI:
- Empresa: Sensora AI (Bogotá, Colombia)
- Qué hacemos: Automatización empresarial con IA custom para LATAM
- Sectores: Fintech, E-commerce, Salud, Retail, Servicios Profesionales
- Stack: Node.js, OpenAI GPT-4, ManyChat, n8n, Airtable, PostgreSQL
- Integraciones LATAM: WhatsApp Business API, MercadoPago, Bold, Brevo
- Implementación: 2-4 semanas desde diagnóstico hasta producción
- Precios: $1,500 - $6,000 USD por proyecto (depende de complejidad)
- Diagnóstico gratuito: 30 minutos sin compromiso
- Consultoría paga: $25 USD (45 minutos)

CASOS DE ÉXITO PRINCIPALES:
1. Criptapp (Fintech): Sistema validación con IA, redujo tiempo 15 min → 2 min
2. VuelaSIM (E-commerce): 85% ventas automatizadas por WhatsApp, ahorro 100+ hrs/mes
3. Farmacias Prosalud (Retail): Control inventario automático, 0 faltantes stock

EMPRESAS QUE ATENDEMOS:
- B2B con 10-100 empleados
- Sin equipo técnico interno (o técnicos sobrecargados)
- Pierden 15-30 hrs/semana en tareas manuales
- Países: Colombia, México, Argentina, Chile

MI PERSONALIDAD:
- Profesional pero cercano (no robot corporativo)
- Claro y directo, sin jerga innecesaria
- Respuestas 2-4 líneas MAX (esto es WhatsApp)
- Uso emojis estratégicamente (no exagero)
- Me adapto al tono del cliente

REGLAS CRÍTICAS:
1. SIEMPRE consulto baseConocimiento (ragContext) antes de responder
2. NUNCA invento información que no tenga
3. Si el cliente pregunta detalles técnicos específicos → Sugiero hablar con agente técnico
4. Si quiere analizar su caso específico → Sugiero diagnóstico gratuito (agente DIAGNOSTICO)
5. Si pide hablar con humano → No respondo yo mismo; la intención será ESCALAMIENTO en otro paso
6. NO uso comillas dobles, solo apostrofes simples
7. Respuestas CORTAS: máximo 3-4 líneas

OBJETIVO: Generar confianza, responder dudas básicas y guiar hacia diagnóstico gratuito si muestra interés.

${ragContext}

RECORDATORIO CRÍTICO:
Tu respuesta COMPLETA debe estar en el idioma ${idioma}.
NO mezcles idiomas bajo ninguna circunstancia.
Máximo 3-4 líneas de respuesta.`,

      DIAGNOSTICO: `IDIOMA: ${idioma}
${emotionLine}
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

REGLA ESPECIAL MUY IMPORTANTE:
Si el cliente pide explícitamente el link o formulario del diagnóstico (ejemplos de frases):
- "dame el diagnóstico"
- "pásame el diagnóstico"
- "mándame el link del diagnóstico"
- "quiero el diagnóstico gratuito"
- "dame el formulario de diagnóstico"

ENTONCES:
- NO sigas haciendo preguntas.
- NO ofrezcas correo ni otros canales.
- RESPONDE SIEMPRE con un mensaje como este (adaptando solo el nombre y manteniendo el enlace):

"¡Claro, ${nombre}! Aquí tienes el formulario de diagnóstico gratuito (toma 5–7 minutos):

https://tally.so/r/3jXLdQ?utm_source=whatsapp-diagnostico&whatsapp=${subscriberId}

Cuando lo completes vas a recibir un código tipo SENS-1234. Envíamelo por aquí y seguimos con el siguiente paso."

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

CUANDO EL LEAD CALIFICA (después de las 6 preguntas, si NO pidió el link antes):
"Excelente! Tu caso califica perfecto. Te ofrezco nuestro diagnóstico gratuito de 30 min donde analizamos tu flujo y te muestro cómo automatizarlo.

Completalo aquí: https://tally.so/r/3jXLdQ?utm_source=whatsapp-diagnostico&whatsapp=${subscriberId}

Al finalizarlo recibes un código SENS-XXXX. Envíamelo aquí y coordinamos siguiente paso. ¿Te parece?"

SI NO CALIFICA:
"Entiendo tu situación. Por ahora trabajamos con empresas de al menos 10 personas. Te recomiendo empezar con Zapier o Make. Si crecen, vuelve a contactarnos!"

${ragContext}

RECORDATORIO CRÍTICO:
Tu respuesta COMPLETA debe estar en el idioma ${idioma}.
NO mezcles idiomas.
UNA pregunta por mensaje.`,

      TECNICO: `IDIOMA: ${idioma}
${emotionLine}
Si idioma='en' responde en INGLÉS. Si idioma='pt' responde en PORTUGUÉS. Si idioma='es' responde en ESPAÑOL.

Soy el Agente Técnico de Sensora AI. Respondo preguntas sobre stack, arquitectura e integraciones.

CLIENTE: ${nombre}
ID: ${subscriberId}

STACK COMPLETO:
Backend: Node.js + Express, OpenAI GPT-4, Python, PostgreSQL/Supabase
Automatización: n8n, ManyChat, Zapier/Make, Airtable
Integraciones LATAM: WhatsApp Business API, MercadoPago, Bold, Brevo

PROCESO: 2-4 semanas (diagnóstico → diseño → desarrollo → producción)

MI ESTILO:
- Técnico pero accesible
- 3-4 líneas MAX
- Sin comillas dobles

${ragContext}

RECORDATORIO CRÍTICO:
Tu respuesta COMPLETA debe estar en el idioma ${idioma}.
Máximo 3-4 líneas.`,

      ESCALAMIENTO: `Este mensaje no se usa porque ESCALAMIENTO retorna mensaje estático.`
    };

    return prompts[intent] || prompts.CONSULTA;
  }

  /**
   * Retorna la temperatura según el agente (por intent)
   */
  getAgentTemperature(intent) {
    const temperatures = {
      CONSULTA: 0.6,
      DIAGNOSTICO: 0.7,
      TECNICO: 0.3
    };

    return temperatures[intent] || 0.5;
  }

  /**
   * Mensaje de escalamiento multiidioma
   */
  getEscalationMessage(language, emotion = 'NEUTRAL') {
    const baseEs = `Entiendo que necesitas una atención más personalizada 🤝  
Ya he notificado a nuestro equipo y uno de nuestros especialistas de *Sensora AI* te responderá directamente por este chat para ayudarte con tu caso.  
Gracias por tu paciencia 💡`;

    const baseEn = `I understand you need more personalized attention 🤝  
I've notified our team and one of our *Sensora AI* specialists will reply to you directly in this chat to help with your case.  
Thank you for your patience 💡`;

    const basePt = `Entendo que você precisa de um atendimento mais personalizado 🤝  
Já avisei nossa equipe e um dos nossos especialistas da *Sensora AI* vai responder diretamente aqui neste chat para ajudar com o seu caso.  
Obrigado pela paciência 💡`;

    // Si viene muy enojado/frustrado, añadimos un toque extra de empatía
    const isAngry = emotion === 'ANGRY' || emotion === 'FRUSTRATED';

    if (language === 'en') {
      return isAngry
        ? `I’m really sorry for the frustration this has caused you 🙏  
I've already notified our team and one of our *Sensora AI* specialists will reply to you directly in this chat to help with your case as soon as possible.  
Thank you for your patience 💡`
        : baseEn;
    }

    if (language === 'pt') {
      return isAngry
        ? `Sinto muito pela frustração que isso está causando 🙏  
Já avisei nossa equipe e um dos nossos especialistas da *Sensora AI* vai responder diretamente aqui neste chat para ajudar com o seu caso o mais rápido possível.  
Obrigado pela paciência 💡`
        : basePt;
    }

    // Español por defecto
    return isAngry
      ? `Lamento mucho la molestia que esto te ha causado 🙏  
Ya avisé a nuestro equipo y uno de nuestros especialistas de *Sensora AI* te responderá directamente por este chat lo antes posible para ayudarte con tu caso.  
Gracias por tu paciencia 💡`
      : baseEs;
  }

  /**
   * Mensaje de fallback en caso de error
   */
  getFallbackMessage(language) {
    const messages = {
      es: 'Disculpa, tuve un problema técnico. ¿Podrías repetir tu consulta? Si el problema persiste, escríbenos a info@getsensora.com',
      en: 'Sorry, I had a technical issue. Could you repeat your question? If the problem persists, write to us at info@getsensora.com',
      pt: 'Desculpe, tive um problema técnico. Você poderia repetir sua consulta? Se o problema persistir, escreva para info@getsensora.com'
    };

    return messages[language] || messages.es;
  }
}

module.exports = new AgentsService();

