/**
 * Тест полного потока обработки документа как в Telegram боте
 */

const fs = require('fs').promises;
const { processCompanyDocument } = require('./src/company.document.processor');
const { pool } = require('./src/database.service');

async function testTelegramFlow() {
  console.log('\n' + '='.repeat(70));
  console.log('ТЕСТ: Полный поток обработки документа (как в Telegram)');
  console.log('='.repeat(70) + '\n');

  try {
    // Симулируем получение файла из Telegram
    const testFile = 'Карточка_компании_ЭВОЛЮЦИЯ_ЗАРЯДА.pdf';
    console.log(`📥 Получен файл: ${testFile}`);

    // Читаем файл в буфер (как это делает Telegram bot)
    const buffer = await fs.readFile(testFile);
    console.log(`✓ Файл загружен в буфер (${buffer.length} байт)\n`);

    // Обрабатываем документ
    const result = await processCompanyDocument(
      buffer,
      testFile,
      {
        saveRawText: true,
        updateExisting: true,
        skipDuplicates: false, // Обработаем даже если был обработан
        forceReprocess: true   // Форсируем повторную обработку
      }
    );

    // Формируем ответ пользователю (как в боте)
    console.log('\n' + '='.repeat(70));
    console.log('ОТВЕТ ПОЛЬЗОВАТЕЛЮ:');
    console.log('='.repeat(70));

    if (result.status === 'success') {
      const company = result.company;
      const message = `
✓ Документ успешно обработан!

Компания: ${company.name_short || company.name_full}
ИНН: ${company.inn}
КПП: ${company.kpp || 'не указан'}
ОГРН: ${company.ogrn || 'не указан'}

Email: ${company.email && company.email.length > 0 ? company.email.join(', ') : 'не указан'}
Телефон: ${company.phone && company.phone.length > 0 ? company.phone.join(', ') : 'не указан'}
Руководителю: ${company.ceo_name || 'не указан'}
      `.trim();

      console.log(message);
      console.log('\n' + '='.repeat(70));

      // Проверяем данные в БД
      const client = await pool.connect();
      try {
        const dbResult = await client.query(
          'SELECT * FROM company WHERE id = $1',
          [company.id]
        );
        const docResult = await client.query(
          'SELECT * FROM company_document WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1',
          [company.id]
        );

        console.log('\n✓ ПРОВЕРКА ДАННЫХ В БД:');
        console.log(`  Компания найдена: ${dbResult.rows.length > 0 ? 'Да' : 'Нет'}`);
        console.log(`  Документов связано: ${docResult.rows.length}`);

        if (dbResult.rows.length > 0) {
          const dbCompany = dbResult.rows[0];
          console.log(`  Email в БД: ${dbCompany.email || 'нет'}`);
          console.log(`  Телефон в БД: ${dbCompany.phone || 'нет'}`);
          console.log(`  CEO в БД: ${dbCompany.ceo_name || 'нет'}`);
          console.log(`  CEO (дат.падеж) в БД: ${dbCompany.ceo_name_dative || 'нет'}`);
        }

        if (docResult.rows.length > 0) {
          const doc = docResult.rows[0];
          console.log(`  Модель: ${doc.model_version}`);
          console.log(`  Версия промпта: ${doc.prompt_version}`);
          console.log(`  Уверенность: ${doc.confidence?.overall || 'н/д'}`);
        }

      } finally {
        client.release();
      }

    } else if (result.status === 'skipped') {
      console.log('⚠ Этот документ уже был обработан ранее');
    } else {
      const errorMessage = result.error || 'Неизвестная ошибка при обработке документа';
      console.log(`✗ Ошибка при обработке документа: ${errorMessage}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✓ ТЕСТ ЗАВЕРШЁН УСПЕШНО');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n✗ ОШИБКА В ТЕСТЕ:', error);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testTelegramFlow();
