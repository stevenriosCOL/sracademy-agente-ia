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

      const prompt = this.getClassifierPrompt(language);

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
      const finalCategory = validCategories.includes(category) ? category : 'ESCALAMIENTO';

      Logger.info(`✅ Mensaje clasificado: ${finalCategory}`);

      return finalCategory;
    } catch (error) {
      Logger.error('Error clasificando mensaje:', error);
      // En caso de error, escalar a humano
      return 'ESCALAMIENTO';
    }
  }

  /**
   * Obtiene el prompt del clasificador según idioma
   */
  getClassifierPrompt(language) {
    const prompts = {
      es: `Eres un clasificador experto. Analiza el siguiente mensaje y clasifícalo en UNA de estas categorías: VENTAS, SOPORTE, TECNICO, ESCALAMIENTO.

VENTAS: Consultas sobre planes, precios, destinos, compras, información de productos
SOPORTE: Problemas con órdenes existentes, reembolsos, activación de eSIM, consultas post-compra
TECNICO: Instalación de eSIM, configuración, problemas de conectividad, compatibilidad de dispositivos
ESCALAMIENTO: Mensajes confusos, fuera de contexto, solicitudes de hablar con humano, quejas, reclamos

Responde SOLO con la categoría en mayúsculas, nada más.`,

      en: `You are an expert classifier. Analyze the following message and classify it into ONE of these categories: VENTAS, SOPORTE, TECNICO, ESCALAMIENTO.

VENTAS: Questions about plans, prices, destinations, purchases, product information
SOPORTE: Problems with existing orders, refunds, eSIM activation, post-purchase queries
TECNICO: eSIM installation, configuration, connectivity problems, device compatibility
ESCALAMIENTO: Confusing messages, out of context, requests to speak with human, complaints

Respond ONLY with the category in uppercase, nothing else.`,

      pt: `Você é um classificador especialista. Analise a seguinte mensagem e classifique-a em UMA destas categorias: VENTAS, SOPORTE, TECNICO, ESCALAMIENTO.

VENTAS: Consultas sobre planos, preços, destinos, compras, informações de produtos
SOPORTE: Problemas com pedidos existentes, reembolsos, ativação de eSIM, consultas pós-compra
TECNICO: Instalação de eSIM, configuração, problemas de conectividade, compatibilidade de dispositivos
ESCALAMIENTO: Mensagens confusas, fora de contexto, solicitações para falar com humano, reclamações

Responda APENAS com a categoria em maiúsculas, nada mais.`
    };

    return prompts[language] || prompts.es;
  }
}

module.exports = new ClassifierService();