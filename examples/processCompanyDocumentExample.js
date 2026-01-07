/**
 * Пример использования модуля обработки документов компаний
 *
 * Этот скрипт демонстрирует различные способы использования системы обработки
 * документов для извлечения информации о компаниях и сохранения в БД.
 */

const path = require('path');
const { processCompanyDocument, processMultipleDocuments } = require('../src/company.document.processor');
const { closePool } = require('../src/database.service');

/**
 * Пример 1: Обработка одного документа
 */
async function example1_processSingleDocument() {
  console.log('\n' + '='.repeat(70));
  console.log('ПРИМЕР 1: Обработка одного документа');
  console.log('='.repeat(70) + '\n');

  const filePath = path.join(__dirname, '..', 'Карточка_компании_ЭВОЛЮЦИЯ_ЗАРЯДА.pdf');

  const result = await processCompanyDocument(filePath, null, {
    saveRawText: true,        // Сохранить сырой текст в БД
    updateExisting: true,     // Обновить существующую компанию
    skipDuplicates: false,    // Не пропускать дубликаты
    forceReprocess: false     // Не форсировать повторную обработку
  });

  if (result.status === 'success') {
    console.log('\n✓ Документ успешно обработан!');
    console.log(`Компания: ${result.company.name_short || result.company.name_full}`);
    console.log(`ИНН: ${result.company.inn}`);
    console.log(`Email: ${result.company.email ? result.company.email.join(', ') : 'не указан'}`);
    console.log(`Телефон: ${result.company.phone ? result.company.phone.join(', ') : 'не указан'}`);
    console.log(`Руководитель: ${result.company.ceo_name || 'не указан'}`);

  } else {
    console.error('\n✗ Ошибка при обработке документа');
    console.error(result.error || result.reason);
  }

  return result;
}

/**
 * Пример 2: Пакетная обработка нескольких документов
 */
async function example2_processMultipleDocuments() {
  console.log('\n' + '='.repeat(70));
  console.log('ПРИМЕР 2: Пакетная обработка документов');
  console.log('='.repeat(70) + '\n');

  const files = [
    path.join(__dirname, '..', 'Карточка_компании_ЭВОЛЮЦИЯ_ЗАРЯДА.pdf'),
    path.join(__dirname, '..', 'Учетная_карточка_клиента_Альфа_банк.doc')
  ];

  const results = await processMultipleDocuments(files, {
    saveRawText: false,         // Не сохранять сырой текст (экономия места)
    updateExisting: true,       // Обновлять существующие записи
    skipDuplicates: true,       // Пропускать уже обработанные файлы
    delayBetweenRequests: 1000  // Пауза 1 секунда между запросами к ChatGPT
  });

  console.log('\n✓ Пакетная обработка завершена!');
  console.log(`Успешно: ${results.successful}`);
  console.log(`Пропущено: ${results.skipped}`);
  console.log(`Ошибок: ${results.failed}`);

  return results;
}

/**
 * Пример 3: Обработка с кастомными настройками ChatGPT
 */
async function example3_customChatGPTSettings() {
  console.log('\n' + '='.repeat(70));
  console.log('ПРИМЕР 3: Обработка с кастомными настройками ChatGPT');
  console.log('='.repeat(70) + '\n');

  const filePath = path.join(__dirname, '..', 'Карточка_компании_ЭВОЛЮЦИЯ_ЗАРЯДА.pdf');

  const result = await processCompanyDocument(filePath, null, {
    model: 'gpt-4o',          // Использовать более мощную модель
    temperature: 0.0,          // Минимальная креативность (максимальная точность)
    saveRawText: true,
    updateExisting: true
  });

  if (result.status === 'success') {
    console.log('\n✓ Обработка завершена!');
    console.log(`Модель: ${result.metadata.model}`);
    console.log(`Использовано токенов: ${result.metadata.tokens_used}`);
    if (result.extractedData.confidence) {
      console.log(`Уверенность: ${(result.extractedData.confidence.overall * 100).toFixed(1)}%`);
    }
  }

  return result;
}

/**
 * Пример 4: Обработка буфера (без файла на диске)
 */
async function example4_processBuffer() {
  console.log('\n' + '='.repeat(70));
  console.log('ПРИМЕР 4: Обработка буфера');
  console.log('='.repeat(70) + '\n');

  const fs = require('fs').promises;
  const filePath = path.join(__dirname, '..', 'Карточка_компании_ЭВОЛЮЦИЯ_ЗАРЯДА.pdf');

  // Читаем файл в буфер (например, получен из Telegram или HTTP запроса)
  const buffer = await fs.readFile(filePath);

  const result = await processCompanyDocument(
    buffer,
    'Карточка_компании_ЭВОЛЮЦИЯ_ЗАРЯДА.pdf',
    {
      saveRawText: false,
      updateExisting: true
    }
  );

  if (result.status === 'success') {
    console.log('\n✓ Буфер успешно обработан!');
  }

  return result;
}

/**
 * Основная функция запуска примеров
 */
async function main() {
  try {
    // Раскомментируйте нужный пример:

    // await example1_processSingleDocument();
    // await example2_processMultipleDocuments();
    // await example3_customChatGPTSettings();
    await example4_processBuffer();

    console.log('\n✓ Все примеры выполнены успешно!');
  } catch (error) {
    console.error('\n✗ Ошибка при выполнении примеров:', error);
  } finally {
    // Закрываем подключение к БД
    await closePool();
    console.log('\n✓ Подключение к БД закрыто');
  }
}

// Запуск, если файл запущен напрямую
if (require.main === module) {
  main();
}

module.exports = {
  example1_processSingleDocument,
  example2_processMultipleDocuments,
  example3_customChatGPTSettings,
  example4_processBuffer
};
