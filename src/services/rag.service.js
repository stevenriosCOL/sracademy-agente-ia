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
   * Busca contexto relevante en la base de conocimiento
   * Replica el comportamiento del RAG de n8n (topK=6)
   */
  async searchKnowledge(query, topK = 6) {
    try {
      Logger.debug('🔍 Buscando en knowledge base:', { query, topK });

      // 1. Generar embedding del query
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // 2. Buscar documentos similares en Supabase usando similarity search
      const supabase = supabaseService.getClient();
      
      const { data, error } = await supabase.rpc('match_documents', {
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
      return 'IMPORTANTE: No se encontró información específica en la base de conocimiento. Responde con tu conocimiento general de VuelaSim, pero indica que para información técnica detallada recomiendas contactar a hola@vuelasim.com';
    }

    return `BASE DE CONOCIMIENTO OFICIAL DE VUELASIM:
    
${context}

IMPORTANTE: Esta es la información OFICIAL y VERIFICADA. Úsala como tu fuente principal de verdad. Si el cliente pregunta algo que está aquí, responde basándote en esta información.`;
  }
}

module.exports = new RAGService();