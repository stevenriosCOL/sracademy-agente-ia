const OpenAI = require('openai');
const config = require('../config/env.config');
const supabaseService = require('./supabase.service');
const Logger = require('../utils/logger.util');

class RAGService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  /**
   * Busca contexto relevante en la base de conocimiento de Sensora AI
   */
  async searchKnowledge(query, topK = 6) {
    try {
      Logger.debug('🔍 Buscando en knowledge base Sensora AI:', { query, topK });

      // 1. Generar embedding del query
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-3-small', // Modelo actualizado
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // 2. Buscar documentos similares en Supabase
      const supabase = supabaseService.getClient();
      
      const { data, error } = await supabase.rpc('match_sensora_knowledge', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: topK
      });

      if (error) {
        Logger.error('Error en búsqueda RAG:', error);
        return null;
      }

      if (!data || data.length === 0) {
        Logger.warn('No se encontraron documentos relevantes en RAG');
        return null;
      }

      // 3. Formatear contexto encontrado
      const context = data
        .map((doc, index) => `[Fuente ${index + 1}]\n${doc.content}`)
        .join('\n\n---\n\n');

      Logger.info(`✅ RAG encontró ${data.length} documentos relevantes`);
      
      return context;
    } catch (error) {
      Logger.error('Error en RAG search:', error);
      return null;
    }
  }

  /**
   * Formatea el contexto RAG para incluirlo en el prompt del agente
   */
  formatContextForAgent(context) {
    if (!context) {
      return 'IMPORTANTE: No se encontró información específica en la base de conocimiento. Responde con conocimiento general de Sensora AI, pero para detalles técnicos específicos recomienda contactar a steven@getsensora.com';
    }

    return `BASE DE CONOCIMIENTO OFICIAL DE SENSORA AI:
    
${context}

IMPORTANTE: Esta es la información OFICIAL y VERIFICADA. Úsala como tu fuente principal. Si el cliente pregunta algo que está aquí, responde basándote en esta información.`;
  }
}

module.exports = new RAGService();