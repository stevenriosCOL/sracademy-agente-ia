/**
 * Script COMPLETO - Extrae TODO el contenido del SQL automáticamente
 * Ejecutar: node src/scripts/migrate-full.js stevenr2_academy.sql
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER DE SQL
// ═══════════════════════════════════════════════════════════════════════════════

function extractInserts(sqlContent, tableName) {
  const regex = new RegExp(`INSERT INTO \`${tableName}\`[^V]*VALUES\\s*([\\s\\S]*?);`, 'gi');
  const matches = [...sqlContent.matchAll(regex)];
  
  const allRows = [];
  
  for (const match of matches) {
    let valuesStr = match[1];
    
    // Parsear cada fila de valores
    const rowRegex = /\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g;
    const rows = [...valuesStr.matchAll(rowRegex)];
    
    for (const row of rows) {
      const values = parseValues(row[1]);
      allRows.push(values);
    }
  }
  
  return allRows;
}

function parseValues(valueStr) {
  const values = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = null;
  
  for (let i = 0; i < valueStr.length; i++) {
    const char = valueStr[i];
    
    if ((char === "'" || char === '"') && valueStr[i-1] !== '\\') {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = null;
      } else {
        current += char;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(cleanValue(current));
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current) {
    values.push(cleanValue(current));
  }
  
  return values;
}

function cleanValue(value) {
  value = value.trim();
  
  if (value === 'NULL') return null;
  
  // Remover comillas
  if ((value.startsWith("'") && value.endsWith("'")) || 
      (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1);
  }
  
  // Decodificar escapes
  value = value.replace(/\\'/g, "'");
  value = value.replace(/\\"/g, '"');
  value = value.replace(/\\n/g, '\n');
  value = value.replace(/\\\\/g, '\\');
  
  return value;
}

function detectCategoria(titulo, texto) {
  const t = `${titulo || ''} ${texto || ''}`.toLowerCase();
  
  if (t.includes('psicolog') || t.includes('emoc') || t.includes('ment') || t.includes('miedo') || t.includes('disciplina')) {
    return 'psicologia';
  }
  if (t.includes('cripto') || t.includes('bitcoin') || t.includes('blockchain')) {
    return 'cripto';
  }
  if (t.includes('fondeo') || t.includes('prop') || t.includes('cuenta fondeada')) {
    return 'fondeo';
  }
  if (t.includes('medita') || t.includes('respira') || t.includes('calma')) {
    return 'meditacion';
  }
  if (t.includes('finanza') || t.includes('deuda') || t.includes('ahorro') || t.includes('inflación')) {
    return 'finanzas';
  }
  if (t.includes('riesgo') || t.includes('gestión') || t.includes('capital')) {
    return 'gestion_riesgo';
  }
  
  return 'trading';
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE MIGRACIÓN
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

async function migrateContenidoCursos(sqlContent) {
  console.log('\n📚 Migrando contenido_cursos...\n');
  
  const rows = extractInserts(sqlContent, 'contenido_cursos');
  
  let exitosos = 0;
  let fallidos = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Estructura: id, id_curso, id_grupo, titulo, ruta_video, ruta_audio, ruta_imagen, texto, duracion, ...
    const titulo = row[3] || '';
    const texto = row[7] || '';
    
    // Solo migrar si tiene texto
    if (!texto || texto.length < 20) {
      continue;
    }
    
    const contenido = `${titulo}\n\n${texto}`;
    
    console.log(`[${exitosos + 1}] ${titulo.substring(0, 60)}...`);
    
    const embedding = await generateEmbedding(contenido);
    
    if (!embedding) {
      fallidos++;
      continue;
    }
    
    const { error } = await supabase
      .from('sracademy_knowledge')
      .insert({
        content: contenido,
        source: 'contenido_cursos',
        categoria: detectCategoria(titulo, texto),
        embedding: embedding,
        metadata: {
          tipo: 'leccion',
          id_curso: row[1],
          duracion: row[8],
          titulo: titulo
        }
      });
    
    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      fallidos++;
    } else {
      console.log(`   ✅ Subido`);
      exitosos++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\n📊 Contenido cursos: ${exitosos} exitosos, ${fallidos} fallidos`);
}

async function migratePreguntasFrecuentes(sqlContent) {
  console.log('\n❓ Migrando preguntas_frecuentes...\n');
  
  const rows = extractInserts(sqlContent, 'preguntas_frecuentes');
  
  let exitosos = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    const pregunta = row[1] || '';
    const respuesta = row[2] || '';
    
    if (!pregunta || !respuesta) continue;
    
    const contenido = `Pregunta: ${pregunta}\n\nRespuesta: ${respuesta}`;
    
    console.log(`[${exitosos + 1}] ${pregunta.substring(0, 60)}...`);
    
    const embedding = await generateEmbedding(contenido);
    
    if (!embedding) continue;
    
    await supabase.from('sracademy_knowledge').insert({
      content: contenido,
      source: 'faq',
      categoria: 'preguntas',
      embedding: embedding,
      metadata: {
        tipo: 'faq',
        pregunta: pregunta
      }
    });
    
    console.log(`   ✅ Subido`);
    exitosos++;
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\n📊 FAQs: ${exitosos} exitosos`);
}

async function migrateTips(sqlContent) {
  console.log('\n💡 Migrando tips...\n');
  
  const rows = extractInserts(sqlContent, 'tips');
  
  let exitosos = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    const titulo = row[1] || '';
    const contenido_tip = row[2] || '';
    
    if (!contenido_tip) continue;
    
    const contenido = `${titulo}\n\n${contenido_tip}`;
    
    console.log(`[${exitosos + 1}] ${titulo.substring(0, 60)}...`);
    
    const embedding = await generateEmbedding(contenido);
    
    if (!embedding) continue;
    
    await supabase.from('sracademy_knowledge').insert({
      content: contenido,
      source: 'tips',
      categoria: 'consejos',
      embedding: embedding,
      metadata: {
        tipo: 'tip',
        titulo: titulo
      }
    });
    
    console.log(`   ✅ Subido`);
    exitosos++;
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\n📊 Tips: ${exitosos} exitosos`);
}

async function migrateTestimonios(sqlContent) {
  console.log('\n⭐ Migrando testimonios...\n');
  
  const rows = extractInserts(sqlContent, 'testimonios');
  
  let exitosos = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    const nombre = row[1] || 'Estudiante';
    const testimonio = row[2] || '';
    const nota = row[3] || '5';
    
    if (!testimonio) continue;
    
    const contenido = `Testimonio de ${nombre} (${nota}/5):\n\n${testimonio}`;
    
    console.log(`[${exitosos + 1}] ${nombre}`);
    
    const embedding = await generateEmbedding(contenido);
    
    if (!embedding) continue;
    
    await supabase.from('sracademy_knowledge').insert({
      content: contenido,
      source: 'testimonios',
      categoria: 'testimonios',
      embedding: embedding,
      metadata: {
        tipo: 'testimonio',
        nombre: nombre,
        nota: nota
      }
    });
    
    console.log(`   ✅ Subido`);
    exitosos++;
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\n📊 Testimonios: ${exitosos} exitosos`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function migrate() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 MIGRACIÓN COMPLETA: SQL → SUPABASE');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Leer archivo SQL
  const sqlPath = process.argv[2] || 'stevenr2_academy.sql';
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`\n❌ Archivo no encontrado: ${sqlPath}`);
    console.log('\nUso: node src/scripts/migrate-full.js ruta/al/archivo.sql\n');
    process.exit(1);
  }
  
  console.log(`\n📄 Leyendo: ${sqlPath}\n`);
  
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
  
  console.log('✅ Archivo SQL cargado\n');
  
  // Migrar todas las tablas
  await migrateContenidoCursos(sqlContent);
  await migratePreguntasFrecuentes(sqlContent);
  await migrateTips(sqlContent);
  await migrateTestimonios(sqlContent);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ MIGRACIÓN COMPLETADA');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

migrate().catch(console.error);