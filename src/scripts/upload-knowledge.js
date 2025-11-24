/**
 * Script para subir base de conocimiento a sracademy_knowledge
 * Ejecutar: node scripts/upload-knowledge.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Configuración
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ═══════════════════════════════════════════════════════════════════════════════
// BASE DE CONOCIMIENTO SR ACADEMY
// ═══════════════════════════════════════════════════════════════════════════════

const KNOWLEDGE_BASE = [
  // ═══════════════════════════════════════
  // FILOSOFÍA Y VALORES
  // ═══════════════════════════════════════
  {
    content: "Steven Rios FX es un trader con más de 7 años de experiencia en Forex, CFDs y Criptomonedas. Es analista financiero desde 2017, educador en más de 29 países con más de 1000 alumnos. Su especialidad es en estructuras avanzadas del mercado y análisis de emociones en los movimientos del mercado. Es gestor de fondos privados a nivel internacional y nacional. Es colombiano, auténtico, directo y honesto.",
    source: "filosofia",
    categoria: "valores"
  },
  {
    content: "La filosofía de Steven Rios se basa en la transparencia total: siempre hace explícitos los riesgos del trading. El trading NO es dinero fácil, muchos pierden. La diferencia está en la preparación. Steven muestra operaciones reales, pruebas de fondeo pasadas, cuentas auditadas y retiros de brokers. Da la cara ante cualquier circunstancia y nunca desaparece.",
    source: "filosofia",
    categoria: "valores"
  },
  {
    content: "Steven Rios cree que el valor debe darse primero antes de vender. Por eso creó productos desde $4.99 USD para que cualquier persona pueda empezar sin importar su situación económica. Su objetivo es proteger al estudiante de pérdidas innecesarias, siendo explícito sobre los riesgos y apoyándolos con precaución.",
    source: "filosofia",
    categoria: "valores"
  },
  {
    content: "La diferencia de Steven con otros educadores de trading es que entrega valor real sin promesas falsas. Tiene más de 9,000 minutos de contenido grabado, grupos de apoyo donde los estudiantes pueden hablar y compartir, y Steven personalmente los ayuda. Ha trabajado en cuidar el dinero de los clientes haciendo explícitos los riesgos.",
    source: "filosofia",
    categoria: "diferenciadores"
  },

  // ═══════════════════════════════════════
  // PRODUCTOS
  // ═══════════════════════════════════════
  {
    content: "Curso Gratuito de 12 Horas: Disponible en YouTube, es el mejor punto de partida para principiantes. Cubre qué es trading, tipos de traders (Day Trader y Position Trader), órdenes al mercado, órdenes límite, análisis técnico básico, velas japonesas, psicología del mercado y plan de trading. Link: https://www.youtube.com/playlist?list=PLtik6WwJuNioT_cIRjR9kEfpjA62wNntK",
    source: "productos",
    categoria: "gratuito"
  },
  {
    content: "Membresía Platino por $6.99 USD: Incluye 4 meses de acceso a más de 79 lecciones, lives semanales con Steven Rios, acceso a 2 eventos virtuales exclusivos, Ebook de Fibonacci Perfecto gratis, webinars mensuales con expertos, foro de networking con más de 500 inversores y emprendedores, descuentos en productos futuros. Link: https://stevenriosfx.com/ofertadelaño",
    source: "productos",
    categoria: "membresia"
  },
  {
    content: "Escuela de Trading por $320 USD: Membresía Gold con acceso por 1 año y medio. Incluye acceso al grupo privado, secciones de trading básico hasta avanzado, módulos de finanzas personales, módulos de meditación y enseñanzas de control emocional.",
    source: "productos",
    categoria: "cursos"
  },
  {
    content: "Universidad 0-6 Cifras por $1,250 USD: Maestría de Trading Top Secrets Gold. Incluye manipulación de grandes volúmenes de capital, precisión avanzada para entradas y salidas limpias, herramientas de trading optimizadas, horas y días específicos de liquidez bancaria, precios de reacción en cadena y stophunts correctos.",
    source: "productos",
    categoria: "premium"
  },
  {
    content: "Paquete Master por $2,000 USD: El programa de formación más completo. Incluye Escuela de Trading, Intensivo Virtual de Trading, Maestría 0-6 Cifras, todo el conocimiento de Steven Rios FX, beneficios en futuros programas y chat directo con Steven.",
    source: "productos",
    categoria: "premium"
  },
  {
    content: "Crypto Mastery por $399 USD: Especialización en criptomonedas para mercados principales y derivados. Incluye módulos básicos hasta avanzados, todo sobre Bitcoin y monedas centralizadas y descentralizadas, acceso por un año a la plataforma y chat directo para preguntas.",
    source: "productos",
    categoria: "cripto"
  },
  {
    content: "Financial Master por $39 USD: Membresía de 6 meses con acceso a 27 grabaciones enfocadas en pasar evaluaciones para cuentas fondeadas. Incluye videos del proceso para obtener cuentas fondeadas, tips profesionales y material educativo con resultados y explicaciones puntuales.",
    source: "productos",
    categoria: "fondeo"
  },
  {
    content: "Centro de Meditación por $59 USD: Ejercicios para transformar la mente, reducir estrés y aumentar bienestar físico y emocional. Incluye distintas técnicas de meditación como mantras, observación, respiración, visualización y calma mental. Ayuda a fortalecer el ser espiritual y crear confianza.",
    source: "productos",
    categoria: "meditacion"
  },

  // ═══════════════════════════════════════
  // TRADING BÁSICO
  // ═══════════════════════════════════════
  {
    content: "El trading es la acción de comprar y vender activos financieros como divisas, materias primas, criptomonedas y acciones para aprovechar las fluctuaciones del mercado, ya sean alcistas o bajistas. Es una actividad emocionante y lucrativa, pero conlleva riesgos muy grandes. No es dinero fácil.",
    source: "curso_12h",
    categoria: "trading"
  },
  {
    content: "Tipos de Traders: Day Trader entra y sale del mercado el mismo día buscando ganancias a corto o mediano plazo en horas, analizando en temporalidades de 1 o 4 horas. Position Trader tiene visión a largo plazo, manteniendo posiciones durante meses o años, como comprar Bitcoin y esperar.",
    source: "curso_12h",
    categoria: "trading"
  },
  {
    content: "Órdenes al Mercado son de ejecución inmediata, comprar o vender ya sin un precio específico. Órdenes Límite como Buy Limit y Sell Limit se colocan pensando que el mercado llegará a un mejor precio antes de continuar en la dirección deseada.",
    source: "curso_12h",
    categoria: "trading"
  },
  {
    content: "Gestión de Riesgo es la administración financiera para cuidar el dinero y tener proyección a largo plazo. La riqueza se genera comprendiendo que hay que ganar dinero poco a poco, escalón por escalón. Se debe buscar que el beneficio potencial sea igual o mayor que el riesgo asumido.",
    source: "curso_12h",
    categoria: "gestion_riesgo"
  },
  {
    content: "Asignación de Capital: La recomendación es arriesgar entre 0.1% a 0.5% del capital por operación como máximo. Establecer límites de pérdida diarios y semanales para proteger el capital. Un ejemplo es máximo 0.8% diario y 2% semanal.",
    source: "curso_12h",
    categoria: "gestion_riesgo"
  },
  {
    content: "Las empresas de fondeo o Proprietary Trading Firms fondean a traders con $50,000 o $100,000 después de pasar pruebas. Esto permite operar con capital grande y repartir beneficios con la empresa. Es una opción para traders que no tienen capital propio.",
    source: "curso_12h",
    categoria: "fondeo"
  },

  // ═══════════════════════════════════════
  // PSICOLOGÍA DEL TRADING
  // ═══════════════════════════════════════
  {
    content: "Tu mayor pérdida no fue una vela. Fue tu ego. Cuando el precio va en tu contra, no duele el número. Duele admitir que estabas equivocado. Y en lugar de aceptarlo, mantienes la operación abierta. Mueves el stop o lo quitas. Porque cerrar es aceptar que fallaste. Pero el trader que sobrevive es el que aprende a decir me equivoqué sin que eso lo destruya.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "Hay 4 emociones que destruyen cuentas de trading: miedo, avaricia, euforia y esperanza. Miedo te paraliza y hace cerrar trades ganadores muy pronto. Avaricia te hace sobreapalancar y no tomar ganancias. Euforia después de ganar te hace operar de más. Esperanza mantiene trades perdedores esperando que vuelva el precio.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "El diario de trading no es para registrar entradas y salidas. Es un espejo mental. Te muestra qué sentías cuando entraste. Por qué ignoraste tu regla. Qué te dijo tu cuerpo antes de hacer clic. El trader que no se conoce a sí mismo repite los mismos errores sin saberlo.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "La motivación no sirve en el trading. Se acaba. Lo que necesitas es disciplina. La disciplina no depende de cómo te sientes. La disciplina es hacer lo correcto aunque no tengas ganas. Y eso solo se entrena con repetición, no con frases bonitas.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "Muchos confunden suerte con habilidad en trading. Ganan 3 operaciones seguidas y creen que ya dominan el mercado. Pero la suerte no escala. La habilidad sí. La diferencia se ve en los próximos 100 trades, no en los primeros 3.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "El overtrading no es un error técnico. Es un grito emocional. No operas porque hay oportunidad. Operas porque hay vacío. Aburrimiento. Ansiedad. Necesidad de sentir algo. Cuando entiendas esto, vas a dejar de quemar cuentas.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "Antes de buscar la estrategia perfecta de trading, hazte una pregunta: ¿Dormiste bien anoche? La falta de sueño destruye tu capacidad de decidir. Te hace impulsivo. Emocional. Vulnerable. El mejor indicador antes de operar no está en la pantalla. Está en tu almohada.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "Ese clic impulsivo que haces sin pensarlo tiene nombre. Se llama secuestro amigdalar. Tu cerebro primitivo toma el control. Y cuando eso pasa, no importa cuánto sepas de análisis técnico. No estás pensando. Estás reaccionando. Y el mercado castiga a los que reaccionan sin pensar.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "Tu cerebro está programado para ver patrones donde no los hay. Se llama apofenia. Y en trading, eso te mata. Ves un martillo y crees que el precio va a subir. Pero el contexto dice otra cosa. No operes patrones. Opera contexto.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "No le tienes miedo a perder dinero. Le tienes miedo a descubrir que no eres tan bueno como creías. Ese miedo es más profundo. Y es el que te paraliza. El trader que acepta sus límites, los supera. El que los niega, los repite.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "Regla de las 48 horas: después de una pérdida grande, no operes durante 48 horas. Déjale tiempo a tu mente para procesar. El peor momento para tomar una decisión financiera es justo después de haber perdido dinero. La venganza en trading siempre termina mal.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "El mejor indicador antes de operar no está en la pantalla. Está en tu respiración. Si estás agitado, ansioso, con el corazón acelerado, no es momento de operar. El trading requiere calma. Y la calma se entrena, no aparece sola.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "La paciencia en trading no es solo esperar. Es capital. Cada vez que esperas el setup correcto en lugar de forzar una entrada, estás ahorrando dinero. La paciencia protege tu cuenta más que cualquier stop loss.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "FOMO significa Fear Of Missing Out, el miedo a quedarte fuera. Te hace entrar tarde, perseguir el precio, operar sin plan. JOMO es Joy Of Missing Out, la alegría de quedarte fuera. Es lo que siente un trader maduro cuando ve una oportunidad pasar y dice: no era para mí. Esa paz vale más que cualquier ganancia.",
    source: "guiones",
    categoria: "psicologia"
  },
  {
    content: "Tu rutina matutina antes de operar es tu edge más ignorado. Cómo te levantas, qué comes, si meditas o no, si revisas el celular primero. Todo eso afecta tus decisiones. El trader profesional cuida su mañana como cuida su capital.",
    source: "guiones",
    categoria: "psicologia"
  },

  // ═══════════════════════════════════════
  // FINANZAS PERSONALES
  // ═══════════════════════════════════════
  {
    content: "El 80% de las personas tienen gastos silenciosos que ni siquiera saben que existen. Suscripciones olvidadas. Café diario. Uber innecesario. Esos pequeños gastos no duelen en el momento. Pero al final del mes, son los que te impiden ahorrar para invertir.",
    source: "guiones",
    categoria: "finanzas"
  },
  {
    content: "Hay deuda buena y deuda mala. Deuda buena te genera ingresos, como un préstamo para un negocio que produce. Deuda mala te quita dinero sin retorno, como una tarjeta de crédito para vacaciones. Antes de endeudarte, pregunta: esto me va a generar dinero o me lo va a quitar.",
    source: "guiones",
    categoria: "finanzas"
  },
  {
    content: "La inflación te roba mientras duermes. Sin ruido. Sin dolor. Sin pedir permiso. Tu dinero en el banco pierde valor cada día. Por eso guardar no es suficiente. Tienes que aprender a invertir o tu poder adquisitivo desaparece lentamente.",
    source: "guiones",
    categoria: "finanzas"
  },
  {
    content: "El interés compuesto trabaja a tu favor o en tu contra. Si inviertes, tu dinero crece exponencialmente con el tiempo. Si tienes deudas, crecen igual de rápido. La diferencia es de qué lado estás. Einstein dijo que el interés compuesto es la octava maravilla del mundo.",
    source: "guiones",
    categoria: "finanzas"
  },
  {
    content: "5 dólares diarios de café. 150 al mes. 1,800 al año. En diez años con interés compuesto son más de 25,000 dólares que nunca vas a ver. El gasto pequeño mata silencioso. No es que no puedas darte gustos. Es que debes saber cuánto te cuestan realmente.",
    source: "guiones",
    categoria: "finanzas"
  },
  {
    content: "Nunca mezcles el dinero de trading con tu dinero personal. Ten cuentas separadas. El dinero que usas para operar es dinero que puedes perder. El dinero para tus gastos básicos es sagrado. Si mezclas los dos, cuando pierdas en trading, vas a afectar tu vida real.",
    source: "guiones",
    categoria: "finanzas"
  },

  // ═══════════════════════════════════════
  // CRIPTOMONEDAS
  // ═══════════════════════════════════════
  {
    content: "2025 será el año en que el mercado cripto filtre a los sobrevivientes. Los proyectos sin utilidad real van a desaparecer. Los que queden serán los que resuelven problemas reales. No es momento de apostar. Es momento de estudiar qué proyectos tienen fundamentos sólidos.",
    source: "guiones",
    categoria: "cripto"
  },
  {
    content: "DeFi no es renta mágica. Es riesgo descentralizado. Cuando pones tus criptos en un protocolo, estás confiando en código que puede tener fallas. Los APY del 100% no existen sin riesgo del 100%. Si suena demasiado bueno para ser verdad, probablemente lo es.",
    source: "guiones",
    categoria: "cripto"
  },
  {
    content: "Copy trading tiene un problema oculto: estás copiando las emociones de otra persona. Su miedo. Su avaricia. Su impulso. Y cuando el mercado se mueve en tu contra, no tienes idea de por qué estás en esa operación. Copiar trades no es aprender a operar.",
    source: "guiones",
    categoria: "cripto"
  },
  {
    content: "La tokenización va a cambiar cómo funciona la propiedad. Propiedades fraccionadas. Obras de arte divididas. Contratos en blockchain. Cuando eso se masifique, los bancos pierden exclusividad. Es una revolución silenciosa que ya está pasando.",
    source: "guiones",
    categoria: "cripto"
  },
  {
    content: "Tu wallet puede ser vaciada en 30 segundos si no la proteges. Nunca compartas tu frase semilla. Usa hardware wallet para montos grandes. Activa autenticación de dos factores. El 99% de los robos de cripto son por error humano, no por hackeo sofisticado.",
    source: "guiones",
    categoria: "cripto"
  },
  {
    content: "Las CBDCs, monedas digitales de bancos centrales, van a cambiar cómo funciona el dinero. Pero a diferencia de Bitcoin, son controladas por gobiernos. Más vigilancia. Más control. Menos privacidad. Entiende la diferencia antes de celebrar la digitalización del dinero.",
    source: "guiones",
    categoria: "cripto"
  },

  // ═══════════════════════════════════════
  // PREGUNTAS FRECUENTES
  // ═══════════════════════════════════════
  {
    content: "Pregunta frecuente: ¿Cuánto puedo ganar con trading? Respuesta: No podemos prometer porcentajes ni ganancias. El trading es un negocio real donde algunos ganan y muchos pierden. La diferencia está en la preparación, disciplina y gestión de riesgo. Lo que sí podemos prometerte es educación de calidad para que tomes mejores decisiones.",
    source: "faq",
    categoria: "preguntas"
  },
  {
    content: "Pregunta frecuente: ¿Dan señales de trading? Respuesta: No damos señales. La filosofía de Steven Rios es enseñarte a pescar, no darte el pescado. Depender de señales te hace dependiente de otros. El objetivo es que tú entiendas el mercado y generes tus propias decisiones.",
    source: "faq",
    categoria: "preguntas"
  },
  {
    content: "Pregunta frecuente: ¿Cuánto tiempo toma ser rentable? Respuesta: Depende 100% de ti. Algunos tardan meses, otros años, y muchos nunca lo logran. No hay atajos. Lo que sí puedo decirte es que el curso gratuito de 12 horas te da una base sólida para empezar bien y evitar los errores más comunes.",
    source: "faq",
    categoria: "preguntas"
  },
  {
    content: "Pregunta frecuente: ¿El bot o robot de trading funciona? Respuesta: Un robot de trading es una herramienta, no magia. Funciona para quien entiende qué hace el bot y por qué. Si no entiendes trading, el bot no te va a salvar. Primero aprende, luego automatiza.",
    source: "faq",
    categoria: "preguntas"
  },
  {
    content: "Pregunta frecuente: ¿Necesito mucho dinero para empezar? Respuesta: No. Puedes empezar a aprender con el curso gratuito de 12 horas. La membresía cuesta solo $6.99 USD. Y para practicar trading, puedes usar cuentas demo gratuitas antes de arriesgar dinero real.",
    source: "faq",
    categoria: "preguntas"
  },
  {
    content: "Pregunta frecuente: ¿El trading es una estafa? Respuesta: El trading en sí no es estafa. Es un negocio legítimo donde se compran y venden activos financieros. Lo que es estafa son las promesas de dinero fácil y ganancias garantizadas. Por eso Steven siempre hace explícitos los riesgos: muchos pierden, pocos ganan.",
    source: "faq",
    categoria: "preguntas"
  },
  {
    content: "Pregunta frecuente: ¿Qué broker recomiendan? Respuesta: No recomendamos un broker específico porque depende de tu país, capital y necesidades. Lo importante es elegir un broker regulado, con buena reputación y spreads competitivos. Investiga antes de depositar dinero.",
    source: "faq",
    categoria: "preguntas"
  },
  {
    content: "Pregunta frecuente: ¿Por qué el curso gratuito si es tan bueno? Respuesta: Steven cree en dar valor primero. El curso gratuito te permite conocer su estilo de enseñanza y decidir si te funciona antes de invertir dinero. Si el contenido gratuito no te convence, no vas a comprar nada y eso está bien.",
    source: "faq",
    categoria: "preguntas"
  },
  {
    content: "Pregunta frecuente: ¿Cómo contacto a Steven directamente? Respuesta: Puedes escribir al WhatsApp de la academia: +573142735697. El horario de atención es de 8am a 5pm hora Colombia. Para temas urgentes, indica que quieres hablar con Steven y te contactará cuando esté disponible.",
    source: "faq",
    categoria: "preguntas"
  },

  // ═══════════════════════════════════════
  // ACADEMIA
  // ═══════════════════════════════════════
  {
    content: "SR Academy tiene más de 9,000 minutos de contenido educativo distribuido en 9 módulos: Escuela de Trading con 652 minutos, Finanzas Personales con 92 minutos, Trucos Bancarios con 89 minutos, Criptomonedas Básico con 89 minutos, Control Emocional con 227 minutos, Índices Sintéticos con 56 minutos, Universidad Avanzados con 6,045 minutos, Crypto Mastery con 1,373 minutos, y Lives Grabaciones con 300 minutos.",
    source: "academia",
    categoria: "contenido"
  },
  {
    content: "La comunidad de SR Academy tiene más de 1000 alumnos en más de 29 países de América, Europa y otros continentes. Hay un grupo privado donde los estudiantes pueden hacer preguntas, compartir experiencias y recibir ayuda directa de Steven y otros traders de la comunidad.",
    source: "academia",
    categoria: "comunidad"
  },
  {
    content: "Los lives semanales con Steven Rios son sesiones en vivo donde se analizan los mercados, se responden preguntas de los estudiantes y se comparten análisis en tiempo real. Es una oportunidad de aprender viendo cómo piensa y opera un trader profesional.",
    source: "academia",
    categoria: "lives"
  },
  {
    content: "El Ebook de Fibonacci Perfecto es un libro digital creado por Steven Rios que enseña el uso correcto de la herramienta de Fibonacci para trading. Está incluido gratis en la Membresía Platino y como bonus en varios programas de formación.",
    source: "academia",
    categoria: "recursos"
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES
// ═══════════════════════════════════════════════════════════════════════════════

async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generando embedding:', error.message);
    return null;
  }
}

async function uploadKnowledge() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📚 SUBIENDO BASE DE CONOCIMIENTO SR ACADEMY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total de registros: ${KNOWLEDGE_BASE.length}`);
  console.log('');

  let exitosos = 0;
  let fallidos = 0;

  for (let i = 0; i < KNOWLEDGE_BASE.length; i++) {
    const item = KNOWLEDGE_BASE[i];
    console.log(`[${i + 1}/${KNOWLEDGE_BASE.length}] Procesando: ${item.source} - ${item.categoria}`);

    // Generar embedding
    const embedding = await generateEmbedding(item.content);
    
    if (!embedding) {
      console.log(`   ❌ Error generando embedding`);
      fallidos++;
      continue;
    }

    // Insertar en Supabase
    const { error } = await supabase
      .from('sracademy_knowledge')
      .insert({
        content: item.content,
        source: item.source,
        categoria: item.categoria,
        embedding: embedding,
        metadata: {
          uploaded_at: new Date().toISOString(),
          content_length: item.content.length
        }
      });

    if (error) {
      console.log(`   ❌ Error insertando: ${error.message}`);
      fallidos++;
    } else {
      console.log(`   ✅ Insertado correctamente`);
      exitosos++;
    }

    // Pequeña pausa para no saturar la API
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 RESUMEN');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Exitosos: ${exitosos}`);
  console.log(`❌ Fallidos: ${fallidos}`);
  console.log(`📝 Total: ${KNOWLEDGE_BASE.length}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

// Ejecutar
uploadKnowledge().catch(console.error);