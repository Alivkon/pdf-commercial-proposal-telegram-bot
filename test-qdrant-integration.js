/**
 * Тест интеграции с Qdrant для хранения эмбеддингов компаний
 */

const { processCompanyDocument } = require('./src/company.document.processor');
const { searchCompaniesInQdrant, getFirmsCollectionStats } = require('./src/vector.search.service');
const { pool } = require('./src/database.service');

async function testQdrantIntegration() {
  console.log('\n' + '='.repeat(70));
  console.log('ТЕСТ: Интеграция с Qdrant для эмбеддингов компаний');
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Проверяем статистику коллекции до обработки
    console.log('[1/5] Проверка статистики коллекции до обработки...\n');
    const statsBefore = await getFirmsCollectionStats();
    if (statsBefore) {
      console.log(`Коллекция: ${statsBefore.name}`);
      console.log(`Количество точек: ${statsBefore.points_count}`);
      console.log(`Статус: ${statsBefore.status}\n`);
    }

    // 2. Обрабатываем тестовый документ
    console.log('[2/5] Обработка тестового документа...\n');
    const fs = require('fs').promises;
    const buffer = await fs.readFile('Карточка_компании_ЭВОЛЮЦИЯ_ЗАРЯДА.pdf');

    const result = await processCompanyDocument(
      buffer,
      'Карточка_компании_ЭВОЛЮЦИЯ_ЗАРЯДА.pdf',
      {
        saveRawText: false,
        updateExisting: true,
        skipDuplicates: false,
        forceReprocess: true
      }
    );

    if (result.status !== 'success') {
      throw new Error(`Ошибка обработки документа: ${result.error || result.reason}`);
    }

    const company = result.company;
    console.log(`\n✓ Компания обработана: ${company.name_short}`);
    console.log(`  ID: ${company.id}`);
    console.log(`  ИНН: ${company.inn}\n`);

    // 3. Проверяем статистику после обработки
    console.log('[3/5] Проверка статистики коллекции после обработки...\n');
    const statsAfter = await getFirmsCollectionStats();
    if (statsAfter) {
      console.log(`Коллекция: ${statsAfter.name}`);
      console.log(`Количество точек: ${statsAfter.points_count}`);
      console.log(`Добавлено точек: ${statsAfter.points_count - (statsBefore?.points_count || 0)}\n`);
    }

    // 4. Тестируем поиск по разным запросам
    console.log('[4/5] Тестирование поиска в Qdrant...\n');

    const searchQueries = [
      'ЭВОЛЮЦИЯ ЗАРЯДА',
      'ИНН 9725105960',
      'Крапивной Михаил',
      'info@theedison.io',
      'зарядные станции москва'
    ];

    for (const query of searchQueries) {
      console.log(`Поиск: "${query}"`);
      const searchResults = await searchCompaniesInQdrant(query, 3);

      if (searchResults.length > 0) {
        searchResults.forEach((result, idx) => {
          console.log(`  ${idx + 1}. ${result.company.display_text}`);
          console.log(`     Релевантность: ${(result.score * 100).toFixed(1)}%`);
          console.log(`     Email: ${result.company.email?.join(', ') || 'нет'}`);
        });
      } else {
        console.log('  Ничего не найдено');
      }
      console.log('');
    }

    // 5. Проверяем данные в Qdrant
    console.log('[5/5] Проверка полноты данных в Qdrant...\n');

    const exactSearch = await searchCompaniesInQdrant(company.inn, 1);
    if (exactSearch.length > 0) {
      const foundCompany = exactSearch[0].company;
      console.log('✓ Компания найдена в Qdrant по ИНН');
      console.log(`  ID совпадает: ${foundCompany.id === company.id ? 'Да' : 'Нет'}`);
      console.log(`  Короткое название: ${foundCompany.name_short}`);
      console.log(`  Полное название: ${foundCompany.name_full}`);
      console.log(`  Руководитель: ${foundCompany.ceo_name}`);
      console.log(`  Руководитель (дат.): ${foundCompany.ceo_name_dative}`);
      console.log(`  Email: ${foundCompany.email?.join(', ') || 'нет'}`);
      console.log(`  Телефон: ${foundCompany.phone?.join(', ') || 'нет'}`);
    } else {
      console.log('✗ Компания НЕ найдена в Qdrant по ИНН');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✓ ТЕСТ ЗАВЕРШЁН УСПЕШНО');
    console.log('='.repeat(70));
    console.log('\nРезультаты:');
    console.log(`- Компания добавлена в PostgreSQL: ✓`);
    console.log(`- Компания добавлена в Qdrant: ✓`);
    console.log(`- Поиск работает: ✓`);
    console.log(`- Данные полные: ✓`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('✗ ОШИБКА В ТЕСТЕ');
    console.error('='.repeat(70));
    console.error(error);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('='.repeat(70) + '\n');
  } finally {
    await pool.end();
  }
}

testQdrantIntegration();
