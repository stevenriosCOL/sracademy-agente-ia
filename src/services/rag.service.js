const OpenAI = require('openai');
const config = require('../config/env.config');
const supabaseService = require('./supabase.service');
const Logger = require('../utils/logger.util');

class RagService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  /**
   * Genera embedding para un texto usando OpenAI
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      Logger.error('Error generando embedding:', error);
      return null;
    }
  }

  /**
   * Busca conocimiento relevante en la base de SR Academy
   */
  async searchKnowledge(query, threshold = 0.7, count = 5) {
    try {
      // 1. Generar embedding del query
      const queryEmbedding = await this.generateEmbedding(query);
      
      if (!queryEmbedding) {
        Logger.warn('No se pudo generar embedding, RAG deshabilitado para esta consulta');
        return [];
      }

      // 2. Buscar en Supabase
      const results = await supabaseService.searchKnowledge(queryEmbedding, threshold, count);

      Logger.info(`📚 RAG: ${results.length} resultados encontrados`);
      
      return results;
    } catch (error) {
      Logger.error('Error en searchKnowledge:', error);
      return [];
    }
  }

  /**
   * Formatea el contexto RAG para incluir en el prompt del agente
   */
  formatContextForAgent(results) {
    if (!results || results.length === 0) {
      return '';
    }

    let context = `
═══════════════════════════════════════
CONTEXTO DE BASE DE CONOCIMIENTO SR ACADEMY
(Usa esta información para responder con precisión)
═══════════════════════════════════════

`;

    results.forEach((result, index) => {
      const source = result.source || 'general';
      const categoria = result.categoria || '';
      const similarity = Math.round((result.similarity || 0) * 100);
      
      context += `[Fuente ${index + 1}] (${source}${categoria ? ` - ${categoria}` : ''}) [Relevancia: ${similarity}%]
${result.content}

`;
    });

    context += `═══════════════════════════════════════
INSTRUCCIÓN: Usa SOLO la información de arriba si es relevante.
Si la pregunta NO está en el contexto, usa tu conocimiento general de trading.
NUNCA inventes información que no tengas.
═══════════════════════════════════════`;

    return context;
  }

  /**
   * Método para agregar conocimiento a la base (uso administrativo)
   */
  async addKnowledge(content, source, categoria, metadata = {}) {
    try {
      // Generar embedding
      const embedding = await this.generateEmbedding(content);
      
      if (!embedding) {
        Logger.error('No se pudo generar embedding para nuevo conocimiento');
        return false;
      }

      // Insertar en Supabase (requiere método en supabaseService)
      // Por ahora solo logueamos
      Logger.info('📝 Conocimiento listo para insertar', { 
        source, 
        categoria, 
        contentLength: content.length 
      });

      return {
        content,
        source,
        categoria,
        metadata,
        embedding
      };
    } catch (error) {
      Logger.error('Error agregando conocimiento:', error);
      return false;
    }
  }
}

module.exports = new RagService();