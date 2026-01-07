/**
 * Тестовый скрипт для обработки обоих примеров файлов
 */

const path = require('path');
const { processMultipleDocuments } = require('./src/company.document.processor');
const { closePool } = require('./src/database.service');

async function main() {
  const files = [
    path.join(__dirname, 'Карточка_компании_ЭВОЛЮЦИЯ_ЗАРЯДА.pdf'),
    path.join(__dirname, 'Учетная_карточка_клиента_Альфа_банк.doc')
  ];

  console.log('Начало обработки обоих файлов...\n');

  const results = await processMultipleDocuments(files, {
    saveRawText: false,
    updateExisting: true,
    skipDuplicates: true,  // Пропустить уже обработанный PDF
    delayBetweenRequests: 1000
  });

  console.log('\n=== ИТОГИ ===');
  console.log(`Успешно обработано: ${results.successful}`);
  console.log(`Пропущено (дубликаты): ${results.skipped}`);
  console.log(`Ошибок: ${results.failed}`);

  // Показываем детали каждого файла
  console.log('\n=== ДЕТАЛИ ===');
  results.items.forEach((item, idx) => {
    console.log(`\n[${idx + 1}] ${item.fileName || files[idx]}`);
    console.log(`Статус: ${item.status}`);
    if (item.status === 'success') {
      console.log(`  Компания: ${item.company.name_short || item.company.name_full}`);
      console.log(`  ИНН: ${item.company.inn}`);
      console.log(`  Email: ${item.company.email?.join(', ') || 'нет'}`);
      console.log(`  Телефон: ${item.company.phone?.join(', ') || 'нет'}`);
    } else if (item.status === 'skipped') {
      console.log(`  Причина: ${item.reason}`);
    } else {
      console.log(`  Ошибка: ${item.error}`);
    }
  });

  await closePool();
}

main().catch(console.error);
