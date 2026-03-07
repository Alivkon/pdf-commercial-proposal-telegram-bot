/**
 * Тест: проверка порога релевантности 50%
 * Если релевантность < 50%, должно считаться физическим лицом
 */

const { searchCompaniesInQdrant } = require('./src/vector.search.service');

async function testLowRelevance() {
  console.log('\n' + '='.repeat(70));
  console.log('ТЕСТ: Проверка порога релевантности 50%');
  console.log('='.repeat(70) + '\n');

  try {
    // Тест 1: Запрос с низкой релевантностью (общие слова)
    console.log('[Тест 1] Запрос: "КП на зарядную станцию"');
    console.log('Ожидание: релевантность < 50% (нет упоминания компании)\n');

    const results1 = await searchCompaniesInQdrant('КП на зарядную станцию', 3);

    if (results1.length > 0) {
      const bestMatch1 = results1[0];
      const relevance1 = bestMatch1.score * 100;

      console.log(`Найдено компаний: ${results1.length}`);
      console.log(`Лучшее совпадение: ${bestMatch1.company.name_short}`);
      console.log(`Релевантность: ${relevance1.toFixed(1)}%`);

      if (relevance1 < 50) {
        console.log(`✓ Релевантность < 50% - будет считаться физическим лицом\n`);
      } else {
        console.log(`⚠ Релевантность >= 50% - будет считаться организацией\n`);
      }
    } else {
      console.log('✓ Компаний не найдено - будет считаться физическим лицом\n');
    }

    // Тест 2: Запрос с высокой релевантностью (упоминание компании)
    console.log('─'.repeat(70) + '\n');
    console.log('[Тест 2] Запрос: "КП для компании Энерком Альянс"');
    console.log('Ожидание: релевантность >= 50% (есть название компании)\n');

    const results2 = await searchCompaniesInQdrant('КП для компании Энерком Альянс', 3);

    if (results2.length > 0) {
      const bestMatch2 = results2[0];
      const relevance2 = bestMatch2.score * 100;

      console.log(`Найдено компаний: ${results2.length}`);
      console.log(`Лучшее совпадение: ${bestMatch2.company.name_short}`);
      console.log(`Релевантность: ${relevance2.toFixed(1)}%`);

      if (relevance2 >= 50) {
        console.log(`✓ Релевантность >= 50% - будет считаться организацией\n`);
      } else {
        console.log(`⚠ Релевантность < 50% - будет считаться физическим лицом\n`);
      }
    } else {
      console.log('⚠ Компаний не найдено\n');
    }

    // Тест 3: Граничный случай - неполное название
    console.log('─'.repeat(70) + '\n');
    console.log('[Тест 3] Запрос: "КП для Энерком"');
    console.log('Ожидание: релевантность ~40-60% (частичное совпадение)\n');

    const results3 = await searchCompaniesInQdrant('КП для Энерком', 3);

    if (results3.length > 0) {
      const bestMatch3 = results3[0];
      const relevance3 = bestMatch3.score * 100;

      console.log(`Найдено компаний: ${results3.length}`);
      console.log(`Лучшее совпадение: ${bestMatch3.company.name_short}`);
      console.log(`Релевантность: ${relevance3.toFixed(1)}%`);

      if (relevance3 >= 50) {
        console.log(`✓ Релевантность >= 50% - будет считаться организацией`);
      } else {
        console.log(`✓ Релевантность < 50% - будет считаться физическим лицом`);
      }
    } else {
      console.log('Компаний не найдено');
    }

    console.log('\n' + '='.repeat(70));
    console.log('ТЕСТ ЗАВЕРШЁН');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('✗ ОШИБКА В ТЕСТЕ');
    console.error('='.repeat(70));
    console.error(error);
    console.error('\n' + '='.repeat(70) + '\n');
  }
}

testLowRelevance();
