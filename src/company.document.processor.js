const fs = require('fs').promises;
const path = require('path');
const { extractText, cleanText } = require('./document.text.extractor');
const { extractAndValidateCompanyData } = require('./company.ai.extractor');
const {
  calculateSHA256,
  findCompanyByInnKpp,
  createCompany,
  updateCompany,
  saveCompanyDocument,
  findDocumentByHash
} = require('./database.service');

/**
 * Обработка одного документа о компании
 * @param {string|Buffer} filePathOrBuffer - Путь к файлу или буфер
 * @param {string} fileName - Имя файла (обязательно при передаче буфера)
 * @param {object} options - Опции обработки
 * @returns {Promise<object>} Результат обработки
 */
async function processCompanyDocument(filePathOrBuffer, fileName = null, options = {}) {
  const startTime = Date.now();
  let fileBuffer;
  let actualFileName;

  try {
    // Получаем буфер файла и имя
    if (Buffer.isBuffer(filePathOrBuffer)) {
      fileBuffer = filePathOrBuffer;
      actualFileName = fileName;
      if (!actualFileName) {
        throw new Error('При передаче буфера необходимо указать имя файла');
      }
    } else {
      fileBuffer = await fs.readFile(filePathOrBuffer);
      actualFileName = path.basename(filePathOrBuffer);
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Обработка документа: ${actualFileName}`);
    console.log('='.repeat(70));

    // Шаг 1: Вычисляем хеш файла
    const fileHash = calculateSHA256(fileBuffer);
    console.log(`SHA256: ${fileHash}`);

    // Проверяем, не обрабатывали ли мы уже этот файл
    const existingDocument = await findDocumentByHash(fileHash);
    if (existingDocument && !options.forceReprocess) {
      console.log('⚠ Документ уже был обработан ранее');
      console.log(`  ID документа: ${existingDocument.id}`);
      console.log(`  Дата обработки: ${existingDocument.created_at}`);

      if (options.skipDuplicates) {
        return {
          status: 'skipped',
          reason: 'duplicate',
          document: existingDocument,
          processingTime: Date.now() - startTime
        };
      }
    }

    // Шаг 2: Извлекаем текст из документа
    console.log('\n[1/4] Извлечение текста из документа...');
    const rawText = await extractText(fileBuffer, actualFileName);
    const cleanedText = cleanText(rawText);
    console.log(`Извлечено символов: ${rawText.length} (очищено: ${cleanedText.length})`);

    // Шаг 3: Извлекаем данные о компании с помощью ChatGPT
    console.log('\n[2/4] Анализ текста с помощью ChatGPT...');
    const extractionResult = await extractAndValidateCompanyData(cleanedText, {
      model: options.model,
      temperature: options.temperature
    });

    const { data: companyData, metadata, validation } = extractionResult;


    // Проверяем валидность данных
    if (!validation.isValid) {
      console.error('✗ Данные не прошли валидацию:');
      validation.errors.forEach(e => console.error(`  - ${e}`));

      return {
        status: 'error',
        reason: 'validation_failed',
        errors: validation.errors,
        warnings: validation.warnings,
        rawText: options.includeRawText ? rawText : undefined,
        extractedData: companyData,
        processingTime: Date.now() - startTime
      };
    }

    // Шаг 4: Поиск или создание компании в БД
    console.log('\n[3/4] Поиск компании в базе данных...');
    let company = await findCompanyByInnKpp(companyData.inn, companyData.kpp);

    if (company) {
      console.log(`✓ Компания найдена в БД: ${company.name_short || company.name_full}`);
      console.log(`  ID: ${company.id}`);

      // Если нужно обновить данные компании
      if (options.updateExisting) {
        console.log('Обновление данных компании...');

        // Готовим данные для обновления (только непустые поля)
        const updates = {};
        for (const [key, value] of Object.entries(companyData)) {
          if (value !== null && value !== undefined && key !== 'confidence') {
            // Не перезаписываем поля пустыми значениями
            if (Array.isArray(value) && value.length === 0) continue;
            if (typeof value === 'string' && value.trim() === '') continue;
            updates[key] = value;
          }
        }


        if (Object.keys(updates).length > 0) {
          company = await updateCompany(company.id, updates);
          console.log(`✓ Обновлено полей: ${Object.keys(updates).length}`);
        }
      }
    } else {
      console.log('Компания не найдена, создаем новую...');
      company = await createCompany(companyData);
      console.log(`✓ Создана новая компания с ID: ${company.id}`);
    }

    // Шаг 5: Сохраняем документ в БД
    console.log('\n[4/4] Сохранение документа в базе данных...');
    const document = await saveCompanyDocument({
      company_id: company.id,
      file_name: actualFileName,
      file_sha256: fileHash,
      storage_url: options.storageUrl || null,
      raw_text: options.saveRawText ? rawText : null,
      extracted_json: companyData,
      confidence: companyData.confidence || null,
      model_version: metadata.model,
      prompt_version: metadata.prompt_version
    });

    const processingTime = Date.now() - startTime;
    console.log('\n' + '='.repeat(70));
    console.log(`✓ Обработка завершена успешно за ${processingTime}мс`);
    console.log('='.repeat(70));
    console.log(`Компания: ${company.name_short || company.name_full}`);
    console.log(`ИНН: ${company.inn}`);
    console.log(`ID компании: ${company.id}`);
    console.log(`ID документа: ${document.id}`);
    console.log(`руководителю: ${company.ceo_name || 'не указан'}`);
    if (validation.warnings.length > 0) {
      console.log(`Предупреждений: ${validation.warnings.length}`);
    }
    console.log('='.repeat(70) + '\n');

    return {
      status: 'success',
      company,
      document,
      extractedData: companyData,
      validation,
      metadata,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('\n' + '='.repeat(70));
    console.error(`✗ Ошибка при обработке документа: ${actualFileName || 'unknown'}`);
    console.error(`Ошибка: ${error.message}`);
    console.error('='.repeat(70) + '\n');

    return {
      status: 'error',
      reason: 'processing_error',
      error: error.message,
      fileName: actualFileName,
      processingTime
    };
  }
}

/**
 * Пакетная обработка нескольких документов
 * @param {Array<string>} filePaths - Массив путей к файлам
 * @param {object} options - Опции обработки
 * @returns {Promise<object>} Результаты обработки всех файлов
 */
async function processMultipleDocuments(filePaths, options = {}) {
  const results = {
    total: filePaths.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    items: []
  };

  console.log(`\nНачало пакетной обработки: ${filePaths.length} файлов`);
  console.log('='.repeat(70) + '\n');

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    console.log(`\n[${i + 1}/${filePaths.length}] Обработка: ${path.basename(filePath)}`);

    const result = await processCompanyDocument(filePath, null, options);
    results.items.push(result);

    if (result.status === 'success') {
      results.successful++;
    } else if (result.status === 'skipped') {
      results.skipped++;
    } else {
      results.failed++;
    }

    // Пауза между запросами, если указана
    if (options.delayBetweenRequests && i < filePaths.length - 1) {
      await new Promise(resolve => setTimeout(resolve, options.delayBetweenRequests));
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('ИТОГИ ПАКЕТНОЙ ОБРАБОТКИ');
  console.log('='.repeat(70));
  console.log(`Всего файлов: ${results.total}`);
  console.log(`Успешно обработано: ${results.successful}`);
  console.log(`Пропущено (дубликаты): ${results.skipped}`);
  console.log(`Ошибок: ${results.failed}`);
  console.log('='.repeat(70) + '\n');

  return results;
}

/**
 * Экспорт данных компании в JSON
 * @param {string} companyId - ID компании
 * @returns {Promise<object>} Данные компании со всеми документами
 */
async function exportCompanyData(companyId) {
  const { getCompanyDocuments } = require('./database.service');
  const { pool } = require('./database.service');

  const client = await pool.connect();
  try {
    // Получаем данные компании
    const companyResult = await client.query('SELECT * FROM company WHERE id = $1', [companyId]);
    if (companyResult.rows.length === 0) {
      throw new Error(`Компания с ID ${companyId} не найдена`);
    }

    const company = companyResult.rows[0];

    // Получаем все документы компании
    const documents = await getCompanyDocuments(companyId);

    return {
      company,
      documents,
      exportDate: new Date().toISOString()
    };
  } finally {
    client.release();
  }
}

module.exports = {
  processCompanyDocument,
  processMultipleDocuments,
  exportCompanyData
};
