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
   * Clasifica el mensaje del usuario para SR Academy
   * - intent: APRENDER_CERO, MEJORAR, PREGUNTA_TECNICA, PREGUNTA_PSICOLOGIA, 
   *           INFO_PRODUCTOS, CURSO_COMPLETADO, QUEJA, LEAD_CALIENTE, 
   *           SITUACION_DELICADA, ESCALAMIENTO, CONVERSACION_GENERAL
   * - emotion: CALM, CURIOUS, FRUSTRATED, DESPERATE, EXCITED, SKEPTICAL, ANGRY, CONFUSED
   * - nivel: cero, intermedio, avanzado, null
   * - urgencia: baja, media, alta
   */
  async classify(message, language = 'es') {
    try {
      Logger.info('🔍 Clasificando mensaje SR Academy...', { length: message.length, language });

      const prompt = this.getClassifierPrompt(language);

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL_CLASSIFIER,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        max_tokens: 150
      });

      const raw = completion.choices[0].message.content.trim();
      
      // Valores por defecto
      let intent = 'CONVERSACION_GENERAL';
      let emotion = 'NEUTRAL';
      let nivel = null;
      let urgencia = 'baja';

      try {
        const parsed = JSON.parse(raw);

        const validIntents = [
          'APRENDER_CERO', 'MEJORAR', 'PREGUNTA_TECNICA', 'PREGUNTA_PSICOLOGIA',
          'INFO_PRODUCTOS', 'CURSO_COMPLETADO', 'QUEJA', 'LEAD_CALIENTE',
          'SITUACION_DELICADA', 'ESCALAMIENTO', 'CONVERSACION_GENERAL'
        ];
        
        const validEmotions = [
          'CALM', 'CURIOUS', 'FRUSTRATED', 'DESPERATE', 
          'EXCITED', 'SKEPTICAL', 'ANGRY', 'CONFUSED', 'NEUTRAL'
        ];

        const validNiveles = ['cero', 'intermedio', 'avanzado'];
        const validUrgencias = ['baja', 'media', 'alta'];

        if (parsed.intent && typeof parsed.intent === 'string') {
          const upperIntent = parsed.intent.trim().toUpperCase();
          if (validIntents.includes(upperIntent)) {
            intent = upperIntent;
          }
        }

        if (parsed.emotion && typeof parsed.emotion === 'string') {
          const upperEmotion = parsed.emotion.trim().toUpperCase();
          if (validEmotions.includes(upperEmotion)) {
            emotion = upperEmotion;
          }
        }

        if (parsed.nivel && typeof parsed.nivel === 'string') {
          const lowerNivel = parsed.nivel.trim().toLowerCase();
          if (validNiveles.includes(lowerNivel)) {
            nivel = lowerNivel;
          }
        }

        if (parsed.urgencia && typeof parsed.urgencia === 'string') {
          const lowerUrgencia = parsed.urgencia.trim().toLowerCase();
          if (validUrgencias.includes(lowerUrgencia)) {
            urgencia = lowerUrgencia;
          }
        }

      } catch (parseError) {
        Logger.warn('⚠️ Respuesta de clasificador no es JSON, usando fallback', { raw });
      }

      Logger.info(`✅ Mensaje clasificado SR Academy`, { intent, emotion, nivel, urgencia });

      return { intent, emotion, nivel, urgencia };

    } catch (error) {
      Logger.error('Error clasificando mensaje:', error);
      return {
        intent: 'CONVERSACION_GENERAL',
        emotion: 'NEUTRAL',
        nivel: null,
        urgencia: 'baja'
      };
    }
  }

  /**
   * Prompt del clasificador para SR Academy
   */
  getClassifierPrompt(language = 'es') {
    return `Eres un clasificador para SR Academy, la academia de trading de Steven Rios FX.

Analiza el mensaje y devuelve SIEMPRE un JSON con esta forma EXACTA:

{
  "intent": "...",
  "emotion": "...",
  "nivel": "...",
  "urgencia": "..."
}

SIN texto extra, SIN explicaciones. Solo el JSON.

═══════════════════════════════════════
INTENCIONES POSIBLES (intent):
═══════════════════════════════════════

APRENDER_CERO:
- Quiere empezar en trading desde cero
- No sabe nada, es principiante total
- Frases: "quiero aprender", "soy nuevo", "cómo empiezo", "no sé nada de trading"

MEJORAR:
- Ya opera pero pierde dinero o no es consistente
- Tiene experiencia pero no resultados
- Frases: "llevo tiempo operando pero pierdo", "no soy rentable", "qué hago mal"

PREGUNTA_TECNICA:
- Pregunta sobre indicadores, patrones, análisis técnico
- Estrategias, velas, soportes, resistencias, fibonacci
- Frases: "qué es un martillo", "cómo uso RSI", "cuándo entrar"

PREGUNTA_PSICOLOGIA:
- Pregunta sobre emociones, miedo, disciplina, mentalidad
- Control emocional, FOMO, ego, paciencia
- Frases: "cómo controlo el miedo", "me cuesta la disciplina", "opero por impulso"

INFO_PRODUCTOS:
- Pregunta por precios, membresías, cursos pagados, academia
- Quiere saber costos, qué incluye, cómo pagar
- Menciona membresías específicas: Academy, Professional, Master, Elite
- Frases: "cuánto cuesta", "qué incluye Academy", "diferencia entre Professional y Master"
- ⚠️ IMPORTANTE: Si pregunta por Academy, Professional, Master o Elite específicamente → INFO_PRODUCTOS

CURSO_COMPLETADO:
- Indica que terminó el curso gratuito de 12 horas
- Escribe "LISTO" o similar
- Frases: "listo", "ya terminé el curso", "vi todo el curso"

QUEJA:
- Frustración con el servicio o contenido
- Reclamo, insatisfacción
- Frases: "esto no sirve", "me siento estafado", "no me ayudó"

LEAD_CALIENTE:
- Quiere comprar o pagar YA
- Listo para adquirir membresía o curso
- Frases: "quiero pagar", "cómo compro", "dónde pago", "quiero comprar Academy/Professional/Master/Elite"
- ⚠️ Si dice "quiero comprar [membresía]" → LEAD_CALIENTE con urgencia alta

SITUACION_DELICADA:
- Menciona pérdida grande de dinero
- Desesperación, crisis emocional relacionada con trading
- Frases: "perdí todo", "quemé mi cuenta", "no sé qué hacer", "estoy desesperado"
- ⚠️ MUY IMPORTANTE DETECTAR ESTO

ESCALAMIENTO:
- Pide hablar con Steven directamente
- Quiere atención humana específica
- Frases: "quiero hablar con Steven", "necesito hablar con alguien", "ponme con un humano"

CONVERSACION_GENERAL:
- Saludos, agradecimientos, conversación casual
- Frases: "hola", "gracias", "cómo estás", "buenos días"

═══════════════════════════════════════
EMOCIONES POSIBLES (emotion):
═══════════════════════════════════════

CALM: Tranquilo, educado, sin urgencia
CURIOUS: Curioso, quiere aprender, hace preguntas genuinas
FRUSTRATED: Molestia moderada, cansancio, "esto no funciona"
DESPERATE: Desesperado, en crisis, "perdí todo" ⚠️ IMPORTANTE
EXCITED: Emocionado, motivado, entusiasmado
SKEPTICAL: Escéptico, desconfiado, "esto es real?"
ANGRY: Muy molesto, exige, tono fuerte
CONFUSED: No entiende, perdido, pide aclaración
NEUTRAL: Sin carga emocional clara

═══════════════════════════════════════
NIVEL DE EXPERIENCIA (nivel):
═══════════════════════════════════════

cero: No sabe nada, nunca ha operado
intermedio: Ya opera pero no es rentable/consistente
avanzado: Es rentable, busca mejorar
null: No se puede determinar

═══════════════════════════════════════
URGENCIA (urgencia):
═══════════════════════════════════════

baja: Consulta normal, sin prisa
media: Tiene interés activo, quiere respuesta pronto
alta: Quiere comprar YA o está en crisis emocional

═══════════════════════════════════════
REGLAS CRÍTICAS - SR ACADEMY 2026:
═══════════════════════════════════════

🔴 MEMBRESÍAS ACTUALES 2026 (detectar específicamente):
- Academy ($297, 12 meses)
- Professional ($597, 18 meses)
- Master ($997, 24 meses)
- Elite ($1,797, 36 meses)

Si el usuario menciona cualquiera de estas membresías → INFO_PRODUCTOS

🔴 MEMBRESÍAS Y PRODUCTOS OBSOLETOS (ya NO existen):
- Platino / Platinum
- Gold / Silver / Diamond
- Universidad 0-6 Cifras (producto viejo)
- Paquete Master (nombre viejo, ahora es Master 2026)
- Financial Master (ya no existe como producto separado)
- Centro de Meditación (ahora incluido en base)
- Crypto Futuros (eliminado)
- Futuros de criptomonedas (eliminado)

Si menciona estas, igual clasifica como INFO_PRODUCTOS pero el agente corregirá.

═══════════════════════════════════════
REGLAS DE CLASIFICACIÓN:
═══════════════════════════════════════

1. Si menciona "perdí todo", "quemé la cuenta", "estoy desesperado" → SITUACION_DELICADA + DESPERATE + urgencia alta

2. Si dice "LISTO" o "terminé el curso" → CURSO_COMPLETADO

3. Si pregunta "cuánto cuesta", "precio", "membresía", "cómo pago" → INFO_PRODUCTOS

4. Si pregunta por membresía específica (Academy, Professional, Master, Elite) → INFO_PRODUCTOS

5. Si pregunta diferencia entre membresías → INFO_PRODUCTOS

6. Si dice "quiero hablar con Steven" o "con un humano" → ESCALAMIENTO

7. Si dice "quiero pagar", "dónde pago", "lo compro", "quiero comprar [membresía]" → LEAD_CALIENTE + urgencia alta

8. "hola", "buenos días", "gracias" sin más contexto → CONVERSACION_GENERAL

9. Preguntas sobre indicadores, velas, entradas → PREGUNTA_TECNICA

10. Preguntas sobre miedo, disciplina, emociones → PREGUNTA_PSICOLOGIA

═══════════════════════════════════════
EJEMPLOS ACTUALIZADOS 2026:
═══════════════════════════════════════

"Hola, quiero aprender trading desde cero" →
{"intent": "APRENDER_CERO", "emotion": "CURIOUS", "nivel": "cero", "urgencia": "baja"}

"Llevo 6 meses operando pero sigo perdiendo" →
{"intent": "MEJORAR", "emotion": "FRUSTRATED", "nivel": "intermedio", "urgencia": "media"}

"Cómo identifico un patrón de hombro cabeza hombro?" →
{"intent": "PREGUNTA_TECNICA", "emotion": "CURIOUS", "nivel": null, "urgencia": "baja"}

"No puedo controlar mis emociones cuando opero" →
{"intent": "PREGUNTA_PSICOLOGIA", "emotion": "FRUSTRATED", "nivel": "intermedio", "urgencia": "media"}

"Cuánto cuesta la membresía?" →
{"intent": "INFO_PRODUCTOS", "emotion": "CURIOUS", "nivel": null, "urgencia": "media"}

"Cuáles son los precios de las membresías 2026?" →
{"intent": "INFO_PRODUCTOS", "emotion": "CURIOUS", "nivel": null, "urgencia": "media"}

"¿Qué incluye Academy?" →
{"intent": "INFO_PRODUCTOS", "emotion": "CURIOUS", "nivel": "cero", "urgencia": "media"}

"¿Cuál es la diferencia entre Professional y Master?" →
{"intent": "INFO_PRODUCTOS", "emotion": "CURIOUS", "nivel": "intermedio", "urgencia": "media"}

"¿Qué incluye la membresía Elite?" →
{"intent": "INFO_PRODUCTOS", "emotion": "CURIOUS", "nivel": null, "urgencia": "media"}

"¿Master incluye sesiones 1-1?" →
{"intent": "INFO_PRODUCTOS", "emotion": "CURIOUS", "nivel": null, "urgencia": "media"}

"LISTO, ya vi todo el curso" →
{"intent": "CURSO_COMPLETADO", "emotion": "EXCITED", "nivel": null, "urgencia": "media"}

"Perdí $5000, no sé qué hacer, estoy desesperado" →
{"intent": "SITUACION_DELICADA", "emotion": "DESPERATE", "nivel": "intermedio", "urgencia": "alta"}

"Quiero pagar la membresía, cómo hago?" →
{"intent": "LEAD_CALIENTE", "emotion": "EXCITED", "nivel": null, "urgencia": "alta"}

"Quiero comprar Academy, ¿cómo lo hago?" →
{"intent": "LEAD_CALIENTE", "emotion": "EXCITED", "nivel": "cero", "urgencia": "alta"}

"Quiero comprar Elite para Prop Firms" →
{"intent": "LEAD_CALIENTE", "emotion": "EXCITED", "nivel": "avanzado", "urgencia": "alta"}

"Quiero hablar con Steven directamente" →
{"intent": "ESCALAMIENTO", "emotion": "NEUTRAL", "nivel": null, "urgencia": "media"}

"Hola, buenos días" →
{"intent": "CONVERSACION_GENERAL", "emotion": "CALM", "nivel": null, "urgencia": "baja"}

"¿Tienen contenido sobre Prop Firms?" →
{"intent": "INFO_PRODUCTOS", "emotion": "CURIOUS", "nivel": "avanzado", "urgencia": "media"}

═══════════════════════════════════════
RECORDATORIO FINAL:
═══════════════════════════════════════
- Responde SOLO con JSON válido
- Las claves deben ser exactamente: intent, emotion, nivel, urgencia
- Los valores de intent y emotion en MAYÚSCULAS
- Los valores de nivel y urgencia en minúsculas
- Si no puedes determinar nivel, usa null
- Si menciona Academy, Professional, Master o Elite → INFO_PRODUCTOS
- Si quiere comprar cualquier membresía → LEAD_CALIENTE
- Precios 2026: $297, $597, $997, $1,797`;
  }
}

module.exports = new ClassifierService();
