const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

// Directorio temporal para audios
const TEMP_DIR = path.join(__dirname, '../../temp');

// Crear directorio si no existe
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Descargar audio de URL
 */
async function downloadAudio(audioUrl) {
  try {
    const audioId = uuidv4();
    const extension = getAudioExtension(audioUrl);
    const filePath = path.join(TEMP_DIR, `audio_${audioId}.${extension}`);

    Logger.info('📥 Descargando audio...', { url: audioUrl.substring(0, 50) + '...' });

    const response = await axios({
      method: 'GET',
      url: audioUrl,
      responseType: 'stream',
      timeout: 30000
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        Logger.info('✅ Audio descargado', { path: filePath });
        resolve(filePath);
      });
      writer.on('error', reject);
    });

  } catch (error) {
    Logger.error('❌ Error descargando audio:', error);
    throw error;
  }
}

/**
 * Obtener extensión de audio
 */
function getAudioExtension(url) {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('.mp3')) return 'mp3';
  if (urlLower.includes('.wav')) return 'wav';
  if (urlLower.includes('.m4a')) return 'm4a';
  if (urlLower.includes('.ogg')) return 'ogg';
  if (urlLower.includes('.oga')) return 'oga';
  
  return 'ogg'; // Default para WhatsApp
}

/**
 * Transcribir audio con Whisper
 */
async function transcribeAudio(audioUrl, options = {}) {
  let audioPath = null;

  try {
    // 1. Descargar audio
    audioPath = await downloadAudio(audioUrl);

    // 2. Verificar que existe
    if (!fs.existsSync(audioPath)) {
      throw new Error('Archivo de audio no encontrado');
    }

    // 3. Obtener tamaño
    const stats = fs.statSync(audioPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    Logger.info('🎤 Transcribiendo con Whisper...', { 
      path: audioPath,
      sizeMB: fileSizeMB.toFixed(2)
    });

    // 4. Transcribir
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      language: options.language || 'es',
      response_format: 'json',
      temperature: 0.2
    });

    Logger.info('✅ Audio transcrito', { 
      length: transcription.text.length,
      preview: transcription.text.substring(0, 100) + '...'
    });

    return {
      text: transcription.text,
      duration: transcription.duration || null,
      language: transcription.language || 'es'
    };

  } catch (error) {
    Logger.error('❌ Error transcribiendo audio:', error);
    throw error;

  } finally {
    // 5. Limpiar archivo temporal
    if (audioPath && fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
        Logger.info('🗑️  Archivo temporal eliminado');
      } catch (cleanupError) {
        Logger.warn('⚠️ No se pudo eliminar archivo temporal:', cleanupError);
      }
    }
  }
}

/**
 * Limpiar audios antiguos (ejecutar periódicamente)
 */
function cleanupOldAudios() {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;
    
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    let deleted = 0;

    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > ONE_HOUR) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    });

    if (deleted > 0) {
      Logger.info(`🗑️  ${deleted} archivos temporales eliminados`);
    }

  } catch (error) {
    Logger.error('Error limpiando audios:', error);
  }
}

// Limpiar cada hora
setInterval(cleanupOldAudios, 60 * 60 * 1000);

module.exports = {
  transcribeAudio,
  cleanupOldAudios
};