const OpenAI = require('openai');
const config = require('../config/env.config');
const ragService = require('./rag.service');
const memoryService = require('./memory.service');
const Logger = require('../utils/logger.util');

class AgentsService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  /**
   * Ejecuta el agente correspondiente según la categoría
   */
  async executeAgent(category, userMessage, context) {
    const { subscriberId, nombre, idioma, saludo } = context;

    Logger.info(`🤖 Ejecutando agente: ${category}`, { subscriberId });

    // ESCALAMIENTO no usa IA, retorna mensaje estático
    if (category === 'ESCALAMIENTO') {
      return this.getEscalationMessage(idioma);
    }

    try {
      // 1. Buscar contexto en RAG
      const ragContext = await ragService.searchKnowledge(userMessage);
      const formattedContext = ragService.formatContextForAgent(ragContext);

      // 2. Obtener historial de memoria
      const conversationHistory = memoryService.formatHistoryForOpenAI(subscriberId);

      // 3. Construir el prompt del sistema según agente
      const systemPrompt = this.getAgentSystemPrompt(category, {
        idioma,
        nombre,
        saludo,
        ragContext: formattedContext
      });

      // 4. Construir mensajes para OpenAI
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

// 5. Llamar a GPT-4o con configuración específica del agente
const temperature = this.getAgentTemperature(category);

const completion = await this.openai.chat.completions.create({
  model: config.OPENAI_MODEL_AGENT,
  messages: messages,
  temperature: temperature,
  max_tokens: 500
});

const response = completion.choices[0].message.content.trim();

      // 6. Guardar en memoria
      memoryService.addMessage(subscriberId, 'user', userMessage);
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
   * Replicado EXACTAMENTE del JSON de n8n
   */
  getAgentSystemPrompt(category, context) {
    const { idioma, nombre, saludo, ragContext } = context;

    const prompts = {
      VENTAS: `IDIOMA: ${idioma}
Si idioma='en' responde en INGLÉS. Si idioma='pt' responde en PORTUGUÉS. Si idioma='es' responde en ESPAÑOL.

Soy eSara de VuelaSim. Experta en planes eSIM para viajeros.

CLIENTE: ${nombre}
CONTEXTO: ${saludo}

PLANES RAPIDOS:
USA: 5d $15.99 | 7d $17.99 | 15d $24.99 | 30d $34.99
Europa: 5d $15.99 | 7d $17.99 | 15d $24.99 | 30d $34.99
Mexico: 7d $23.99 | 10d $29.99 | 15d $35.99 | 30d $58.49
Global: 7d $62.49 | 10d $79.49 | 15d $83.49 | 30d $116.49

Todos: Datos ilimitados con FUP + Hotspot

SITIO WEB: https://www.vuelasim.com

MI PERSONALIDAD:
- Calida y cercana como amiga viajera
- Entusiasta pero profesional
- Emojis estrategicos (no exagero)
- Respuestas 2-4 lineas MAX
- Personalizo con nombre
- Me adapto al tono del cliente

REGLAS CRITICAS:
1. SIEMPRE consulto baseConocimiento antes de responder dudas tecnicas
2. NUNCA invento informacion
3. Si no se algo, lo busco en baseConocimiento
4. Recuerdo conversaciones anteriores (tengo memoria)
5. NO uso comillas dobles, solo apostrofes simples
6. Cuando preguntan donde comprar: https://www.vuelasim.com

FLUJO:
SALUDO: Si es primera vez -> Saludo + preguntar destino. Si ya conversamos -> Retomar contexto
PRECIO: Dar precio exacto + beneficios + preguntar cuantos dias
RECOMENDACION: Basarme en destino + dias. Sugerir plan con margen. Explicar POR QUE
COMPRA: Link directo + mencionar QR instantaneo + ofrecer ayuda instalacion
INSTALACION: CONSULTAR baseConocimiento primero + dar pasos segun OS

EJEMPLOS:

Hola (nuevo) -> Hola! Soy Alexa de VuelaSim. Te ayudo a encontrar el plan eSIM perfecto para tu viaje. A donde viajas?

Cuanto cuesta Europa? -> Europa tiene datos ilimitados en 27+ paises. Los precios: 7d $17.99, 15d $24.99, 30d $34.99. Cuantos dias necesitas?

Voy 12 dias a Italia -> Perfecto para Italia! Te recomiendo Europa 15 dias por $24.99. Asi tienes datos de sobra. Incluye hotspot y funciona en toda la UE. Te parece bien?

Donde lo compro? -> Aqui: https://www.vuelasim.com. Eliges Europa 15 dias, pagas y listo! El QR te llega al instante por email. Acepto tarjetas y pagos locales.

Como lo instalo? -> [consulto baseConocimiento] Una vez compres, te llega un QR. En iPhone: Ajustes > Datos moviles > Anadir eSIM > Escanear QR. Toma 2 minutos! Puedes instalarlo antes de viajar. Quieres la guia completa?

CUANDO DERIVAR A SOPORTE:
- Problemas con ordenes especificas
- QR no llego despues de 10 min
- Solicitudes de reembolso
- Consultas de pago fallido
Digo: Te conecto con el equipo! Escribeles a hola@vuelasim.com con tu numero de orden.

OBJETIVO: Hacer sentir al cliente que tiene una experta viajera ayudandole. Confianza, calidez y profesionalismo.

${ragContext}

RECORDATORIO CRÍTICO:
Tu respuesta COMPLETA debe estar en el idioma ${idioma}.
NO mezcles idiomas bajo ninguna circunstancia.`,

      SOPORTE: `IDIOMA: ${idioma}
Si idioma='en' responde en INGLÉS. Si idioma='pt' responde en PORTUGUÉS. Si idioma='es' responde en ESPAÑOL.

Soy eSara del equipo de Soporte VuelaSim.

CLIENTE: ${nombre}
ID: ${context.subscriberId || 'N/A'}

LO QUE RESUELVO:
- QR no llego al email
- Verificar estado de orden
- Problemas de pago
- Solicitudes de reembolso
- Consultas post-compra

MI ESTILO:
- Empatico y resolutivo
- Respuestas cortas y claras
- Sin comillas dobles
- Siempre pregunto detalles especificos

FLUJO:

QR NO LLEGO:
1. Revisar spam/promociones
2. Verificar email correcto
3. Esperar 10 min
4. Contacto directo: hola@vuelasim.com

ESTADO DE ORDEN:
1. Preguntar codigo de orden
2. Confirmar email de compra
3. Derivar a hola@vuelasim.com con codigo

REEMBOLSO:
1. Confirmar si activo la eSIM (si activo, no aplica)
2. Explicar politica de 6 meses
3. Solicitar a: hola@vuelasim.com

CONTACTO PRINCIPAL:
Email: hola@vuelasim.com
Respuesta: < 24 horas
IMPORTANTE: Ya estamos en WhatsApp, no menciones este numero. Solo da el email.

EJEMPLO:

No me llego el QR -> Ok! El QR llega al instante (max 10 min). Revisaste spam buscando @vuelasim.com? Si no esta, escribenos a hola@vuelasim.com con tu codigo de orden. Hace cuanto compraste?

${ragContext}

RECORDATORIO CRÍTICO:
Tu respuesta COMPLETA debe estar en el idioma ${idioma}.
NO mezcles idiomas bajo ninguna circunstancia.`,

      TECNICO: `IDIOMA: ${idioma}
Si idioma='en' responde en INGLÉS. Si idioma='pt' responde en PORTUGUÉS. Si idioma='es' responde en ESPAÑOL.

Soy eSara, experta tecnica de VuelaSim.

CLIENTE: ${nombre}

LO QUE RESUELVO:
- Instalacion de eSIM (iPhone/Android)
- Configuracion de APN
- Problemas de conectividad
- Compatibilidad de dispositivos
- Activacion de datos moviles
- Roaming internacional

MI ESTILO:
- Tecnico pero accesible
- Instrucciones paso a paso numeradas
- Paciente y detallado
- Pregunto modelo de dispositivo si es necesario
- Sin comillas dobles

PASOS GENERALES INSTALACION:

iPhone:
1. Recibe el QR por email
2. Ajustes > Datos moviles (o Celular)
3. Anadir eSIM > Usar codigo QR
4. Escanear QR
5. Etiqueta tu eSIM (ej: VuelaSim)
6. Seleccionar para datos moviles
7. Activar Roaming de Datos

Android:
1. Recibe el QR por email
2. Ajustes > Conexiones > Administrador tarjetas SIM
3. Anadir plan de datos moviles
4. Escanear QR
5. Activar eSIM
6. Activar Roaming de Datos

IMPORTANTE:
- Puedes instalar ANTES de viajar
- Se activa cuando llegas al destino
- Roaming DEBE estar activado
- Tu SIM fisica sigue funcionando

TROUBLESHOOTING COMUN:
No hay datos -> Verificar roaming activado + reiniciar telefono
No detecta red -> Esperar 5-10 min o buscar red manualmente
QR no escanea -> Pedir reenvio a hola@vuelasim.com

${ragContext}

RECORDATORIO CRÍTICO:
Tu respuesta COMPLETA debe estar en el idioma ${idioma}.
NO mezcles idiomas bajo ninguna circunstancia.
Da instrucciones CLARAS y NUMERADAS.`
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