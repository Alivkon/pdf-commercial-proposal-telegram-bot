const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');

/**
 * Извлечение текста из PDF файла
 * @param {string|Buffer} filePath - Путь к файлу или буфер
 * @returns {Promise<string>} Извлеченный текст
 */
async function extractTextFromPDF(filePath) {
  try {
    let dataBuffer;

    if (Buffer.isBuffer(filePath)) {
      dataBuffer = filePath;
    } else {
      dataBuffer = await fs.readFile(filePath);
    }

    const data = await pdfParse(dataBuffer);

    console.log(`✓ Извлечен текст из PDF (${data.numpages} страниц, ${data.text.length} символов)`);
    return data.text;
  } catch (error) {
    console.error(`✗ Ошибка при извлечении текста из PDF: ${error.message}`);
    throw error;
  }
}

/**
 * Извлечение текста из старого формата DOC (через word-extractor)
 * @param {string|Buffer} filePath - Путь к файлу или буфер
 * @returns {Promise<string>} Извлеченный текст
 */
async function extractTextFromOldDOC(filePath) {
  try {
    const extractor = new WordExtractor();
    let buffer;

    if (Buffer.isBuffer(filePath)) {
      buffer = filePath;
    } else {
      buffer = await fs.readFile(filePath);
    }

    const extracted = await extractor.extract(buffer);
    const text = extracted.getBody();

    console.log(`✓ Извлечен текст из старого DOC (${text.length} символов)`);
    return text;
  } catch (error) {
    throw new Error(`Ошибка извлечения из старого DOC: ${error.message}`);
  }
}

/**
 * Извлечение текста из DOCX файла (через mammoth)
 * @param {string|Buffer} filePath - Путь к файлу или буфер
 * @returns {Promise<string>} Извлеченный текст
 */
async function extractTextFromDOCX(filePath) {
  try {
    let buffer;

    if (Buffer.isBuffer(filePath)) {
      buffer = filePath;
    } else {
      buffer = await fs.readFile(filePath);
    }

    const result = await mammoth.extractRawText({ buffer });

    if (result.messages && result.messages.length > 0) {
      console.warn('Предупреждения при извлечении текста из DOCX:', result.messages);
    }

    console.log(`✓ Извлечен текст из DOCX (${result.value.length} символов)`);
    return result.value;
  } catch (error) {
    console.error(`✗ Ошибка при извлечении текста из DOCX: ${error.message}`);
    throw error;
  }
}

/**
 * Извлечение текста из DOC/DOCX файла (автоопределение формата)
 * @param {string|Buffer} filePath - Путь к файлу или буфер
 * @returns {Promise<string>} Извлеченный текст
 */
async function extractTextFromDOC(filePath) {
  try {
    // Сначала пробуем mammoth (для DOCX)
    return await extractTextFromDOCX(filePath);
  } catch (error) {
    // Если не получилось, пробуем word-extractor для старого DOC
    console.log('Попытка извлечения из старого формата DOC через word-extractor...');
    try {
      return await extractTextFromOldDOC(filePath);
    } catch (wordExtractorError) {
      throw new Error(`Не удалось извлечь текст ни через mammoth, ни через word-extractor: ${wordExtractorError.message}`);
    }
  }
}

/**
 * Автоматическое определение типа файла и извлечение текста
 * @param {string|Buffer} filePathOrBuffer - Путь к файлу или буфер
 * @param {string} fileName - Имя файла (для определения расширения, если передан буфер)
 * @returns {Promise<string>} Извлеченный текст
 */
async function extractText(filePathOrBuffer, fileName = null) {
  try {
    let ext;

    if (Buffer.isBuffer(filePathOrBuffer)) {
      if (!fileName) {
        throw new Error('При передаче буфера необходимо указать имя файла');
      }
      ext = path.extname(fileName).toLowerCase();
    } else {
      ext = path.extname(filePathOrBuffer).toLowerCase();
      fileName = path.basename(filePathOrBuffer);
    }

    console.log(`Извлечение текста из файла: ${fileName}`);

    switch (ext) {
      case '.pdf':
        return await extractTextFromPDF(filePathOrBuffer);

      case '.doc':
      case '.docx':
        return await extractTextFromDOC(filePathOrBuffer);

      default:
        throw new Error(`Неподдерживаемый тип файла: ${ext}. Поддерживаются: .pdf, .doc, .docx`);
    }
  } catch (error) {
    console.error(`✗ Ошибка при извлечении текста: ${error.message}`);
    throw error;
  }
}

/**
 * Извлечение текста из нескольких файлов
 * @param {Array<string>} filePaths - Массив путей к файлам
 * @returns {Promise<Array<{file: string, text: string, error: string|null}>>} Массив результатов
 */
async function extractTextFromMultipleFiles(filePaths) {
  const results = [];

  for (const filePath of filePaths) {
    try {
      const text = await extractText(filePath);
      results.push({
        file: path.basename(filePath),
        path: filePath,
        text,
        error: null
      });
    } catch (error) {
      results.push({
        file: path.basename(filePath),
        path: filePath,
        text: null,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Очистка текста от лишних пробелов и переносов строк
 * @param {string} text - Исходный текст
 * @returns {string} Очищенный текст
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ') // Замена множественных пробелов на один
    .replace(/\n\s*\n/g, '\n') // Удаление пустых строк
    .trim();
}

module.exports = {
  extractTextFromPDF,
  extractTextFromDOC,
  extractText,
  extractTextFromMultipleFiles,
  cleanText
};
