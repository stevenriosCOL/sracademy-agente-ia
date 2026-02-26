const Logger = require('../utils/logger.util');

const ACTIVE_FLOW_STATES = new Set([
  'LIBRO_COUNTRY',
  'LIBRO_METHOD',
  'LIBRO_DATA',
  'LIBRO_PROOF',
  'LIBRO_POSTSALE'
]);

const COUNTRY_MAP = {
  colombia: 'Colombia',
  mexico: 'Mexico',
  méxico: 'Mexico',
  argentina: 'Argentina',
  chile: 'Chile',
  peru: 'Peru',
  perú: 'Peru',
  espana: 'Espana',
  españa: 'Espana',
  spain: 'Espana',
  venezuela: 'Venezuela',
  ecuador: 'Ecuador'
};

function normalize(text = '') {
  return String(text).trim().toLowerCase();
}

function isActiveState(state) {
  return ACTIVE_FLOW_STATES.has(state);
}

function shouldStartLibroFlow(message = '') {
  const m = normalize(message);
  return ['libro', '30 dias', '30 días', 'peor enemigo', 'combo', 'audiolibro', 'mp3'].some(k => m.includes(k));
}

function detectProduct(message = '') {
  const m = normalize(message);
  if (m.includes('combo') || m.includes('audiolibro') || m.includes('mp3') || m.includes('29.99')) return 'combo';
  if (m.includes('pdf') || m.includes('19.99') || m.includes('libro')) return 'pdf';
  return null;
}

function detectCountry(message = '') {
  const m = normalize(message);
  const n = m.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [k, v] of Object.entries(COUNTRY_MAP)) {
    const kk = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (n.includes(kk)) return v;
  }
  return null;
}

function detectMethod(message = '') {
  const m = normalize(message);
  if (m === '1') return 'mercado_pago';
  if (m === '2') return 'llave_breb';
  if (m === '3') return 'bancolombia';
  if (m === '4') return 'criptomonedas';
  if (m.includes('mercado pago') || m.includes('mercadopago') || m.includes('pse') || m.includes('tarjeta')) return 'mercado_pago';
  if (m.includes('llave') || m.includes('bre b') || m.includes('breb')) return 'llave_breb';
  if (m.includes('bancolombia')) return 'bancolombia';
  if (m.includes('cripto') || m.includes('usdt') || m.includes('bitcoin')) return 'criptomonedas';
  return null;
}

function detectBuyerData(message = '') {
  const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const phoneRegex = /[\+]?[0-9]{10,15}/;
  const emailMatch = message.match(emailRegex);
  const phoneMatch = message.match(phoneRegex);
  if (!emailMatch || !phoneMatch) return null;

  const lines = message.split('\n').map(l => l.trim()).filter(Boolean);
  let nombre = '';
  for (const line of lines) {
    if (!line.includes('@') && !phoneRegex.test(line)) { nombre = line; break; }
  }
  if (!nombre) nombre = message.split(emailMatch[0])[0].replace(phoneRegex, '').trim() || 'Cliente';

  return { nombre, email: emailMatch[0], celular: phoneMatch[0] };
}

function isProofImage(message = '') {
  const m = String(message || '');
  return /\.(jpg|jpeg|png|webp|gif|bmp)/i.test(m) ||
    m.toLowerCase().includes('/image') ||
    m.toLowerCase().includes('/media') ||
    m.toLowerCase().includes('/photo') ||
    m.toLowerCase().includes('imgur.com') ||
    m.toLowerCase().includes('cdn') ||
    (m.startsWith('http') && /(image|photo|img|pic)/i.test(m));
}

function amountByProduct(product) {
  return product === 'combo' ? 29.99 : 19.99;
}

function productLabel(product) {
  return product === 'combo' ? 'COMBO (PDF + MP3)' : 'LIBRO PDF';
}

function paymentInstructions({ nombre, method, product }) {
  const amount = amountByProduct(product);
  const label = productLabel(product);

  if (method === 'bancolombia') {
    return `¡Perfecto ${nombre}! Aquí tienes los datos para la transferencia Bancolombia:

🏦 Cuenta: 91266825477
💰 Monto: $${amount} USD en COP aprox
📝 Concepto: Libro 30D (${label})

Después de transferir, envíame:
📸 Captura del comprobante
📝 Nombre completo
📧 Email
📱 Número de celular`;
  }

  if (method === 'llave_breb') {
    return `¡Perfecto ${nombre}! Datos para Llave BRE B:

🔑 Llave: Laurac056
💰 Monto: $${amount} USD en COP aprox
📝 Concepto: Libro 30D (${label})

Después de transferir, envíame:
📸 Captura del comprobante
📝 Nombre completo
📧 Email
📱 Número de celular`;
  }

  if (method === 'mercado_pago') {
    return `¡Perfecto ${nombre}! Para pagar con Mercado Pago, usa este enlace:
https://mpago.li/1r7x9WN

✅ Producto: ${label}
💰 Monto: $${amount} USD

Después de pagar, envíame:
📸 Captura del comprobante
📝 Nombre completo
📧 Email
📱 Número de celular`;
  }

  return `Perfecto ${nombre}. Para cripto USDT te paso los datos por este chat.`;
}

async function closeLibroFlow(supabaseService, subscriberId) {
  return supabaseService.clearFlowState(subscriberId);
}

function isDeliveryConfirmedMessage(message = '') {
  const m = normalize(message);
  return m.includes('ya me llego') || m.includes('ya me llegó') || m.includes('recibi') || m.includes('recibí') || m.includes('todo bien');
}

function isShortThanksMessage(message = '') {
  const m = normalize(message);
  return m === 'ok' || m === 'ok gracias' || m === 'gracias' || m === 'dale' || m === 'listo' || m === 'perfecto';
}

async function handleActiveLibroFlow({ flow, message, subscriberId, nombre, supabaseService, notifyAdmin }) {
  const state = flow?.flow_state || 'IDLE';

  if (!isActiveState(state)) return { handled: false };

  if (state === 'LIBRO_COUNTRY') {
    const country = detectCountry(message);
    if (!country) return { handled: true, response: '¿Desde qué país nos escribes para darte opciones de pago correctas?' };

    await supabaseService.updateFlowState(subscriberId, { flow_state: 'LIBRO_METHOD', selected_country: country });

    return {
      handled: true,
      response: `¡Perfecto! En ${country} puedes pagar con:
1️⃣ Mercado Pago
2️⃣ Llave BRE B
3️⃣ Bancolombia
4️⃣ Criptomonedas USDT

¿Cuál prefieres?`
    };
  }

  if (state === 'LIBRO_METHOD') {
    const method = detectMethod(message);
    if (!method) return { handled: true, response: 'Responde con método: 1, 2, 3 o 4.' };

    const product = flow.selected_product;
    if (!product) return { handled: true, response: 'Confirma producto: 1) PDF $19.99  2) COMBO $29.99' };

    await supabaseService.updateFlowState(subscriberId, { flow_state: 'LIBRO_DATA', selected_method: method });

    return { handled: true, response: paymentInstructions({ nombre, method, product }) };
  }

  if (state === 'LIBRO_DATA') {
    const data = detectBuyerData(message);
    if (!data) return { handled: true, response: 'Envíame en un solo mensaje: nombre completo, email y celular.' };

    const product = flow.selected_product;
    const method = flow.selected_method;
    const country = flow.selected_country || 'Colombia';

    if (!product || !method) return { handled: true, response: 'Reiniciemos método: 1,2,3,4' };

    const pending = await supabaseService.getCompraPendiente(subscriberId);
    if (!pending) {
      await supabaseService.createCompraLibro({
        subscriber_id: subscriberId,
        nombre_completo: data.nombre,
        email: data.email,
        celular: data.celular,
        pais: country,
        metodo_pago: method,
        monto_usd: amountByProduct(product),
        producto: product
      });
    }

    await supabaseService.updateFlowState(subscriberId, { flow_state: 'LIBRO_PROOF' });
    return { handled: true, response: `Perfecto ${nombre}. Ya tengo tus datos ✓ Ahora envíame la captura del comprobante 📸` };
  }

  if (state === 'LIBRO_PROOF') {
    if (!isProofImage(message)) return { handled: true, response: 'Quedo atento a la captura del comprobante 📸.' };

    const compraPendiente = await supabaseService.getCompraPendiente(subscriberId);
    if (!compraPendiente) return { handled: true, response: 'Necesito primero tus datos: nombre, email, celular.' };

    const ok = await supabaseService.updateCompraComprobante(compraPendiente.id, message);
    if (!ok) return { handled: true, response: 'No pude guardar comprobante. Reintenta o escribe "hablar con Steven".' };

    await supabaseService.updateFlowState(subscriberId, { flow_state: 'LIBRO_POSTSALE', proof_received_at: new Date().toISOString() });

    await notifyAdmin(
      subscriberId,
      nombre,
      `📸 COMPROBANTE LIBRO RECIBIDO
Compra ID: ${compraPendiente.id}
Producto: ${compraPendiente.producto || flow.selected_product}
Metodo: ${compraPendiente.metodo_pago}
Monto: $${compraPendiente.monto_usd} USD`,
      'COMPROBANTE_LIBRO'
    );

    return { handled: true, response: `Perfecto ${nombre}! Recibí tu comprobante 📸 Te confirmo y envío el acceso en máximo 2 horas.` };
  }

  if (state === 'LIBRO_POSTSALE') {
    const latestCompra = await supabaseService.getLatestCompraBySubscriber(subscriberId);
    const compraEntregada = Boolean(
      latestCompra &&
      (
        latestCompra.estado === 'aprobado' ||
        latestCompra.accesos_enviados === true ||
        latestCompra.pdf_enviado === true
      )
    );

    if (compraEntregada) {
      await closeLibroFlow(supabaseService, subscriberId);
      return {
        handled: true,
        response: 'Tu acceso ya fue entregado ✓ Si no lo ves, revisa Spam/Promociones. Si necesitas ayuda, escribe "soporte acceso".'
      };
    }

    const m = normalize(message);
    const wantsTopicSwitch = /(hablar con steven|asesor|ayuda|soporte|membres|membresia|membres[ií]as|plan|academy|professional|master|elite|se bloqueo|bloque[oó])/.test(m);

    // Si el usuario cambia de tema, liberamos el flujo para que el agente responda normal.
    if (wantsTopicSwitch) {
      await closeLibroFlow(supabaseService, subscriberId);
      return { handled: false };
    }

    if (isShortThanksMessage(message)) {
      return {
        handled: true,
        response: '¡Con gusto! Tu pago sigue en verificación. Si pasan 2 horas, escribe "hablar con Steven" y te ayudamos de inmediato.'
      };
    }

    return { handled: true, response: 'Tu pago está en verificación. Si ya pasaron 2 horas, escribe "hablar con Steven".' };
  }

  Logger.warn('Estado de flujo no manejado', { state, subscriberId });
  return { handled: false };
}

module.exports = {
  ACTIVE_FLOW_STATES,
  isActiveState,
  shouldStartLibroFlow,
  detectProduct,
  handleActiveLibroFlow,
  closeLibroFlow,
  isDeliveryConfirmedMessage
};
