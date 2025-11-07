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
      CONSULTA: `IDIOMA: ${idioma}
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
5. Si pide hablar con humano → Conecto con ESCALAMIENTO
6. NO uso comillas dobles, solo apostrofes simples
7. Respuestas CORTAS: máximo 3-4 líneas

FLUJO DE CONVERSACIÓN:

SALUDO INICIAL:
Si es primera vez → "Hola ${nombre}! Soy el asistente de Sensora AI. Te ayudo a entender cómo automatizar tu empresa con IA. ¿Qué te gustaría saber?"
Si ya conversamos → Retomar contexto de memoria

PREGUNTAS SOBRE QUÉ HACEMOS:
"Automatizamos operaciones empresariales con IA: desde WhatsApp bots hasta integraciones entre CRM, hojas de cálculo y sistemas de pago. Trabajamos con fintech, e-commerce, salud y retail en LATAM."

PREGUNTAS SOBRE PRECIOS:
"Los proyectos van desde $1,500 para automatizaciones simples hasta $6,000 para sistemas complejos. Ofrecemos diagnóstico gratuito de 30 min donde analizamos tu caso y te damos cotización exacta. ¿Te gustaría agendarlo?"

PREGUNTAS SOBRE CASOS:
Mencionar 1-2 casos relevantes según su industria. Ejemplo:
"En e-commerce automatizamos VuelaSIM: 85% de ventas por WhatsApp sin humanos, ahorro de 100+ hrs/mes. ¿Tu negocio es similar?"

CUÁNDO DERIVAR:
- Preguntas técnicas detalladas → "Te conecto con mi compañero técnico que te explica el stack a fondo"
- Quiere analizar su caso → "Te paso con el agente de diagnóstico para analizar tu operación específica"
- Pide hablar con humano → "Te conecto con el equipo para agendar una llamada"

OBJETIVO: Generar confianza, responder dudas básicas y guiar hacia diagnóstico gratuito si muestra interés.

${ragContext}

RECORDATORIO CRÍTICO:
Tu respuesta COMPLETA debe estar en el idioma ${idioma}.
NO mezcles idiomas bajo ninguna circunstancia.
Máximo 3-4 líneas de respuesta.`,

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

CUANDO EL LEAD CALIFICA (después de las 6 preguntas):
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

    return prompts[category] || prompts.CONSULTA;
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
    es: `Entiendo que necesitas una atención más personalizada 🤝  
Ya he notificado a nuestro equipo y uno de nuestros especialistas de *Sensora AI* te contactará directamente en este chat para ayudarte con tu caso.  
Gracias por tu paciencia 💡`,

    en: `I understand you need more personalized attention 🤝  
I've notified our team and one of our *Sensora AI* specialists will contact you directly here to assist with your case.  
Thank you for your patience 💡`,

    pt: `Entendo que você precisa de um atendimento mais personalizado 🤝  
Já avisei nossa equipe e um dos nossos especialistas da *Sensora AI* entrará em contato com você aqui mesmo para ajudar no seu caso.  
Obrigado pela paciência 💡`
  };

  return messages[language] || messages.es;
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