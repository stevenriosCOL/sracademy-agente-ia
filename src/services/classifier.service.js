const OpenAI = require('openai');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class ClassifierService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  /**
   * Clasifica el mensaje del usuario en una categoría
   * Usa GPT-4o-mini con temperatura 0.1
   * CATEGORÍAS PARA SENSORA AI: CONSULTA, DIAGNOSTICO, TECNICO, ESCALAMIENTO
   */
  async classify(message, language = 'es') {
    try {
      Logger.info('🔍 Clasificando mensaje...', { length: message.length, language });

      const prompt = this.getClassifierPrompt();

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL_CLASSIFIER,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        max_tokens: 50
      });

      const category = completion.choices[0].message.content.trim().toUpperCase();

      // Validar categoría
      const validCategories = ['CONSULTA', 'DIAGNOSTICO', 'TECNICO', 'ESCALAMIENTO'];
      const finalCategory = validCategories.includes(category) ? category : 'CONSULTA';

      Logger.info(`✅ Mensaje clasificado: ${finalCategory}`);

      return finalCategory;
    } catch (error) {
      Logger.error('Error clasificando mensaje:', error);
      return 'CONSULTA'; // Fallback seguro
    }
  }

  /**
   * Prompt del clasificador para Sensora AI
   */
  getClassifierPrompt() {
    return `Clasifica el mensaje del cliente en UNA de estas 4 categorías para Sensora AI (empresa de automatización con IA):

CONSULTA: saludos, preguntas generales sobre qué hace Sensora AI, cómo funciona, precios, sectores que atiende, preguntas sobre automatización en general, dudas comerciales básicas

DIAGNOSTICO: el cliente describe un problema específico de su empresa, menciona tareas manuales que consume tiempo, pide analizar su caso, quiere saber si Sensora puede ayudarle con su situación particular, solicita diagnóstico gratuito

TECNICO: preguntas sobre stack tecnológico (qué lenguajes, qué herramientas), integraciones específicas (MercadoPago, WhatsApp API, Airtable), cómo funciona técnicamente la implementación, tiempos de desarrollo, arquitectura de sistemas

ESCALAMIENTO: SOLO si el cliente pide EXPLÍCITAMENTE hablar con un humano/persona real, está muy frustrado, o solicita agendar llamada directa

REGLAS CRÍTICAS:
- "ayudar", "ayuda", "necesito ayuda" → NO es escalamiento (es CONSULTA o DIAGNOSTICO según contexto)
- "hola", "buenos días", "cómo estás" → CONSULTA (saludo general)
- "tengo un problema con X" → DIAGNOSTICO (describe su caso)
- "usan Node.js?" → TECNICO (pregunta técnica)
- "quiero hablar con alguien" → ESCALAMIENTO (pide humano)

EJEMPLOS:

"Hola, qué es Sensora AI?" → CONSULTA
"Cuánto cuesta automatizar mi CRM?" → CONSULTA
"Mi equipo pierde 20 horas semanales en reportes manuales, pueden ayudar?" → DIAGNOSTICO
"Tenemos un e-commerce y queremos automatizar WhatsApp" → DIAGNOSTICO
"Quiero el diagnóstico gratuito" → DIAGNOSTICO
"Qué tecnologías usan para automatizar?" → TECNICO
"Se integran con MercadoPago?" → TECNICO
"Necesito hablar con una persona" → ESCALAMIENTO
"Quiero agendar una llamada" → ESCALAMIENTO
"Hola buenos días" → CONSULTA

Responde ÚNICAMENTE con una palabra en MAYÚSCULAS: CONSULTA, DIAGNOSTICO, TECNICO o ESCALAMIENTO

Importante: La mayoría de mensajes son CONSULTA o DIAGNOSTICO. ESCALAMIENTO es muy raro.`;
  }
}

module.exports = new ClassifierService();