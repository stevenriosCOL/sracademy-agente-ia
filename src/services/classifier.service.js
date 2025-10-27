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
   * Usa GPT-4o-mini con temperatura 0.1 (como "LLM Policia" en n8n)
   */
  async classify(message, language = 'es') {
    try {
      Logger.info('🔍 Clasificando mensaje...', { length: message.length, language });

      // Prompt ACTUALIZADO con reglas más estrictas para ESCALAMIENTO
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

      // Validar que la categoría sea válida
      const validCategories = ['VENTAS', 'SOPORTE', 'TECNICO', 'ESCALAMIENTO'];
      const finalCategory = validCategories.includes(category) ? category : 'VENTAS'; // Default a VENTAS, no ESCALAMIENTO

      Logger.info(`✅ Mensaje clasificado: ${finalCategory}`);

      return finalCategory;
    } catch (error) {
      Logger.error('Error clasificando mensaje:', error);
      // En caso de error, ir a VENTAS (no ESCALAMIENTO)
      return 'VENTAS';
    }
  }

  /**
   * Prompt del clasificador ACTUALIZADO con reglas MÁS ESTRICTAS para ESCALAMIENTO
   */
  getClassifierPrompt() {
    return `Clasifica el mensaje del cliente en UNA de estas 4 categorías:

VENTAS: saludos, planes, precios, destinos, compras, recomendaciones, preguntas generales
SOPORTE: QR no llegó, pagos, reembolsos, órdenes, problemas con compra
TECNICO: instalación, QR no escanea, sin internet, activación, configuración
ESCALAMIENTO: SOLO si el cliente pide EXPLÍCITAMENTE hablar con un humano o está MUY frustrado

REGLAS CRÍTICAS PARA ESCALAMIENTO:
- "ayudar", "ayuda", "necesito ayuda" → NO es escalamiento (es VENTAS o SOPORTE según contexto)
- "hola", "buenos días" → NO es escalamiento (es VENTAS)
- SOLO clasifica como ESCALAMIENTO si menciona:
  * "hablar con una persona" / "necesito un humano" / "quiero un agente"
  * "esto no sirve" / "no funciona nada" / "estoy muy frustrado"
  * "quiero cancelar" / "dame mi dinero" / "esto es pésimo"

EJEMPLOS DE CLASIFICACIÓN:

"Hola, me pueden ayudar" → VENTAS (saludo general)
"Necesito ayuda con mi compra" → SOPORTE (ayuda específica)
"No me funciona el internet" → TECNICO (problema técnico)
"Quiero hablar con una persona real" → ESCALAMIENTO (pide humano explícitamente)
"Esto no sirve, dame un agente" → ESCALAMIENTO (frustración + pide agente)
"¿Cuánto cuesta?" → VENTAS (pregunta de ventas)
"Mi QR no llegó" → SOPORTE (problema post-compra)
"No puedo instalar la eSIM" → TECNICO (problema técnico)
"Hola buenos días" → VENTAS (saludo)
"Tengo una duda" → VENTAS (pregunta general)

Responde ÚNICAMENTE con una palabra en MAYÚSCULAS: VENTAS, SOPORTE, TECNICO o ESCALAMIENTO

Recuerda: ESCALAMIENTO es MUY RARO. La mayoría de mensajes son VENTAS, SOPORTE o TECNICO.`;
  }
}

module.exports = new ClassifierService();