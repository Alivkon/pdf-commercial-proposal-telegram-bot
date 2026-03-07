const { searchCompaniesInQdrant } = require('./src/vector.search.service');

async function test() {
  console.log('\n=== ТЕСТ ПОИСКА КОМПАНИЙ В QDRANT ===\n');

  const queries = [
    'Энерком',
    'Альберт Ренатович',
    'Калуга',
    'ИНН 4028058015',
    'lamer2007@list.ru',
    'эволюция заряда',
    'Крапивной',
    'info@theedison'
  ];

  for (const query of queries) {
    console.log(`Поиск: "${query}"`);
    const results = await searchCompaniesInQdrant(query, 2);

    if (results.length > 0) {
      results.forEach((r, i) => {
        console.log(`  ${i+1}. ${r.company.name_short} (релевантность: ${(r.score*100).toFixed(1)}%)`);
        console.log(`     ИНН: ${r.company.inn}, Email: ${r.company.email?.join(', ') || 'нет'}`);
      });
    } else {
      console.log('  Ничего не найдено');
    }
    console.log('');
  }
}

test().catch(console.error);
