/**
 * Script para generar embeddings faltantes en sracademy_knowledge
 * Ejecutar: node scripts/backfill-knowledge-embeddings.js
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

async function backfillEmbeddings() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔄 BACKFILL DE EMBEDDINGS - sracademy_knowledge');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // 1. Consultar filas sin embeddings
  console.log('📊 Consultando filas sin embeddings...');
  const { data: rowsWithoutEmbeddings, error: fetchError } = await supabase
    .from('sracademy_knowledge')
    .select('id, content, categoria, source')
    .is('embedding', null);

  if (fetchError) {
    console.error('❌ Error consultando filas:', fetchError.message);
    process.exit(1);
  }

  if (!rowsWithoutEmbeddings || rowsWithoutEmbeddings.length === 0) {
    console.log('✅ No hay filas sin embeddings. Todo está actualizado!');
    process.exit(0);
  }

  console.log(`   ✓ Encontradas ${rowsWithoutEmbeddings.length} filas sin embeddings`);
  console.log('');

  // 2. Procesar cada fila
  console.log('🔄 Generando embeddings...');
  let exitosos = 0;
  let fallidos = 0;

  for (let i = 0; i < rowsWithoutEmbeddings.length; i++) {
    const row = rowsWithoutEmbeddings[i];
    const progreso = `[${i + 1}/${rowsWithoutEmbeddings.length}]`;
    
    process.stdout.write(`   ${progreso} ${row.id.substring(0, 8)}... `);

    try {
      // Generar embedding
      const embedding = await generateEmbedding(row.content);
      
      if (!embedding) {
        console.log('❌ Error generando embedding');
        fallidos++;
        continue;
      }

      // Actualizar en Supabase
      const { error: updateError } = await supabase
        .from('sracademy_knowledge')
        .update({ 
          embedding: embedding,
          updated_at: new Date().toISOString()
        })
        .eq('id', row.id);

      if (updateError) {
        console.log(`❌ Error: ${updateError.message}`);
        fallidos++;
      } else {
        console.log('✓');
        exitosos++;
      }

      // Pequeña pausa para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      fallidos++;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ PROCESO COMPLETADO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   ✓ Exitosos: ${exitosos}`);
  console.log(`   ✗ Errores: ${fallidos}`);
  console.log(`   📊 Total: ${rowsWithoutEmbeddings.length}`);
  console.log('');

  // 3. Verificación final
  console.log('🔍 Verificando estado final...');
  const { data: remainingNull, error: checkError } = await supabase
    .from('sracademy_knowledge')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null);

  if (checkError) {
    console.log('⚠️  No se pudo verificar estado final');
  } else {
    const remaining = remainingNull || 0;
    if (remaining === 0) {
      console.log('   ✅ Todas las filas tienen embeddings!');
    } else {
      console.log(`   ⚠️  Quedan ${remaining} filas sin embeddings`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');
}

// Ejecutar
backfillEmbeddings()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });