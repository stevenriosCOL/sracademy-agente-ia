/**
 * Detección de idioma mejorada con prioridad en patrones específicos
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') {
    return 'es'; // Default
  }

  const textoLower = text.toLowerCase();
  
  // PATRONES FUERTES DE ESPAÑOL (alta confianza)
  const patronesEspanol = [
    'cómo', 'como', 'cuánto', 'cuanto', 'dónde', 'donde', 'qué', 'que',
    'quiero', 'necesito', 'tengo', 'puedo', 'hola', 'buenos', 'buenas',
    'gracias', 'por favor', 'ayuda', 'instalo', 'comprar', 'días', 'dias',
    'cuándo', 'cuando', 'está', 'esta', 'estoy', 'soy', 'muy', 'pero',
    'también', 'tambien', 'información', 'informacion', 'problema'
  ];
  
  // PATRONES FUERTES DE INGLÉS (alta confianza)
  const patronesIngles = [
    'hello', 'hi there', 'how much', 'how to', 'i want', 'i need',
    'please help', 'thank you', 'thanks', 'where can', 'when will',
    'what is', 'can you', 'would like', 'good morning', 'good afternoon'
  ];
  
  // PATRONES FUERTES DE PORTUGUÉS (alta confianza)
  const patronesPortugues = [
    'olá', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'obrigado', 'obrigada',
    'por favor', 'preciso', 'quero', 'tenho', 'posso', 'quanto custa',
    'onde fica', 'quando', 'está', 'estou', 'sou', 'também', 'não', 'sim'
  ];
  
  // PALABRAS INDIVIDUALES ESPAÑOL
  const palabrasEspanol = [
    'cómo', 'como', 'cuánto', 'cuanto', 'dónde', 'qué', 'quiero', 'necesito',
    'hola', 'gracias', 'ayuda', 'comprar', 'días', 'información', 'problema',
    'tengo', 'puedo', 'instalo', 'activo', 'funciona', 'llega', 'enviar'
  ];
  
  // PALABRAS INDIVIDUALES INGLÉS
  const palabrasIngles = [
    'hello', 'please', 'thank', 'thanks', 'need', 'want', 'help',
    'install', 'activate', 'works', 'send', 'receive'
  ];
  
  // PALABRAS INDIVIDUALES PORTUGUÉS
  const palabrasPortugues = [
    'olá', 'oi', 'obrigado', 'obrigada', 'preciso', 'ajuda',
    'quanto', 'onde', 'preço', 'comprar'
  ];
  
  // 1. Buscar patrones fuertes (frases completas)
  let puntosEspanol = 0;
  let puntosIngles = 0;
  let puntosPortugues = 0;
  
  patronesEspanol.forEach(patron => {
    if (textoLower.includes(patron)) puntosEspanol += 3; // Mayor peso
  });
  
  patronesIngles.forEach(patron => {
    if (textoLower.includes(patron)) puntosIngles += 3;
  });
  
  patronesPortugues.forEach(patron => {
    if (textoLower.includes(patron)) puntosPortugues += 3;
  });
  
  // 2. Buscar palabras individuales
  palabrasEspanol.forEach(palabra => {
    if (textoLower.includes(palabra)) puntosEspanol += 1;
  });
  
  palabrasIngles.forEach(palabra => {
    if (textoLower.includes(palabra)) puntosIngles += 1;
  });
  
  palabrasPortugues.forEach(palabra => {
    if (textoLower.includes(palabra)) puntosPortugues += 1;
  });
  
  // 3. Determinar idioma según puntos
  if (puntosEspanol > puntosIngles && puntosEspanol > puntosPortugues) {
    return 'es';
  }
  if (puntosIngles > puntosEspanol && puntosIngles > puntosPortugues) {
    return 'en';
  }
  if (puntosPortugues > puntosEspanol && puntosPortugues > puntosIngles) {
    return 'pt';
  }
  
  // 4. Default español (la mayoría de usuarios)
  return 'es';
}

/**
 * Obtener saludo contextual según hora del día
 */
function getContextualGreeting(language = 'es') {
  const hour = new Date().getHours();
  
  const greetings = {
    es: {
      morning: 'Buenos días',
      afternoon: 'Buenas tardes',
      evening: 'Buenas noches'
    },
    en: {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening'
    },
    pt: {
      morning: 'Bom dia',
      afternoon: 'Boa tarde',
      evening: 'Boa noite'
    }
  };

  const lang = greetings[language] || greetings.es;
  
  if (hour < 12) return lang.morning;
  if (hour < 19) return lang.afternoon;
  return lang.evening;
}

module.exports = {
  detectLanguage,
  getContextualGreeting
};