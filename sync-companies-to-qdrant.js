/**
 * Скрипт для синхронизации существующих компаний из PostgreSQL в Qdrant
 */

const { pool } = require('./src/database.service');
const { addCompanyToQdrant, getFirmsCollectionStats } = require('./src/vector.search.service');

async function syncCompaniesToQdrant() {
  console.log('\n' + '='.repeat(70));
  console.log('СИНХРОНИЗАЦИЯ: Добавление существующих компаний в Qdrant');
  console.log('='.repeat(70) + '\n');

  const client = await pool.connect();
  try {
    // Получаем статистику до синхронизации
    console.log('[1/3] Проверка текущего состояния...\n');

    const dbStats = await client.query('SELECT COUNT(*) as count FROM company');
    const companiesInDB = parseInt(dbStats.rows[0].count);
    console.log(`Компаний в PostgreSQL: ${companiesInDB}`);

    const qdrantStats = await getFirmsCollectionStats();
    if (qdrantStats) {
      console.log(`Точек в Qdrant коллекции: ${qdrantStats.points_count}\n`);
    }

    // Получаем все компании из БД
    console.log('[2/3] Получение компаний из PostgreSQL...\n');
    const result = await client.query('SELECT * FROM company ORDER BY created_at');
    const companies = result.rows;

    console.log(`Найдено компаний: ${companies.length}\n`);

    if (companies.length === 0) {
      console.log('⚠ В базе данных нет компаний для синхронизации');
      return;
    }

    // Синхронизируем каждую компанию
    console.log('[3/3] Добавление компаний в Qdrant...\n');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      console.log(`[${i + 1}/${companies.length}] ${company.name_short || company.name_full}`);
      console.log(`  ИНН: ${company.inn}`);

      try {
        await addCompanyToQdrant(company);
        successCount++;
        console.log(`  ✓ Успешно добавлено\n`);
      } catch (error) {
        failCount++;
        console.error(`  ✗ Ошибка: ${error.message}\n`);
      }

      // Небольшая задержка между запросами к OpenAI
      if (i < companies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Финальная статистика
    console.log('='.repeat(70));
    console.log('РЕЗУЛЬТАТЫ СИНХРОНИЗАЦИИ');
    console.log('='.repeat(70));
    console.log(`Обработано компаний: ${companies.length}`);
    console.log(`Успешно добавлено: ${successCount}`);
    console.log(`Ошибок: ${failCount}`);

    const qdrantStatsFinal = await getFirmsCollectionStats();
    if (qdrantStatsFinal) {
      console.log(`\nТочек в Qdrant после синхронизации: ${qdrantStatsFinal.points_count}`);
    }

    console.log('='.repeat(70) + '\n');

    if (failCount === 0) {
      console.log('✓ Синхронизация завершена успешно!\n');
    } else {
      console.log('⚠ Синхронизация завершена с ошибками\n');
    }

  } catch (error) {
    console.error('\n✗ КРИТИЧЕСКАЯ ОШИБКА:', error);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

syncCompaniesToQdrant();
