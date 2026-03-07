/**
 * Тест генерации КП с автоматическим заполнением данных компании клиента
 */

const { createCommercialOffer } = require('./src/offer.pdf.generator');
const { searchCompaniesInQdrant } = require('./src/vector.search.service');
const { pool } = require('./src/database.service');

async function testOfferWithClientData() {
  console.log('\n' + '='.repeat(70));
  console.log('ТЕСТ: Генерация КП с данными компании клиента из Qdrant');
  console.log('='.repeat(70) + '\n');

  try {
    // Имитируем сообщение пользователя с упоминанием компании
    const userMessage = 'Подготовьте коммерческое предложение для компании Энерком Альянс на зарядную станцию EDISON DC 60кВт';

    console.log(`Сообщение пользователя: "${userMessage}"\n`);

    // Шаг 1: Поиск компании в Qdrant
    console.log('[1/4] Поиск компании в Qdrant...');
    const searchResults = await searchCompaniesInQdrant(userMessage, 3);

    if (searchResults.length === 0) {
      console.error('✗ Компания не найдена в Qdrant');
      return;
    }

    console.log(`Найдено компаний: ${searchResults.length}`);
    searchResults.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.company.name_short} (релевантность: ${(r.score * 100).toFixed(1)}%)`);
    });

    const bestMatch = searchResults[0];
    console.log(`\n✓ Выбрана: ${bestMatch.company.name_short}`);

    // Шаг 2: Получение полных данных из PostgreSQL
    console.log('\n[2/4] Получение данных из PostgreSQL...');
    const client = await pool.connect();
    let clientCompany;

    try {
      const result = await client.query('SELECT * FROM company WHERE id = $1', [bestMatch.company.id]);
      if (result.rows.length === 0) {
        console.error('✗ Компания не найдена в PostgreSQL');
        return;
      }

      clientCompany = result.rows[0];
      console.log('✓ Данные компании получены:');
      console.log(`  Название: ${clientCompany.name_short}`);
      console.log(`  ИНН: ${clientCompany.inn}`);
      console.log(`  КПП: ${clientCompany.kpp}`);
      console.log(`  Руководитель: ${clientCompany.ceo_name}`);
      console.log(`  Руководитель (дат.): ${clientCompany.ceo_name_dative}`);
    } finally {
      client.release();
    }

    // Шаг 3: Формирование данных для КП
    console.log('\n[3/4] Формирование данных для КП...');

    const offerData = {
      userText: userMessage,
      clientCompany: {
        name_short: clientCompany.name_short,
        name_full: clientCompany.name_full,
        inn: clientCompany.inn,
        kpp: clientCompany.kpp,
        ceo_name: clientCompany.ceo_name,
        ceo_name_dative: clientCompany.ceo_name_dative
      },
      products: [
        {
          name: 'Зарядная станция EDISON DC 60кВт',
          connector: 'CCS2/CHAdeMO',
          price_one: 1500000,
          nds: 300000,
          quantity: 1,
          price_with_nds: 1800000,
          specifications_file: 'EDISON_DC_60.pdf'
        }
      ],
      deliveryTime: '4-6 недель',
      paymentTerms: '50% предоплата, 50% по факту поставки',
      warranty: '2 года гарантии'
    };

    console.log('✓ Данные КП сформированы');

    // Шаг 4: Создание PDF
    console.log('\n[4/4] Создание PDF...');
    const pdfPath = await createCommercialOffer(offerData, `test_offer_${clientCompany.inn}.pdf`);

    console.log('\n' + '='.repeat(70));
    console.log('✓ ТЕСТ ЗАВЕРШЁН УСПЕШНО');
    console.log('='.repeat(70));
    console.log(`PDF создан: ${pdfPath}`);
    console.log('');
    console.log('Данные в шапке КП:');
    console.log(`  Компания: ${offerData.clientCompany.name_short}`);
    console.log(`  ИНН: ${offerData.clientCompany.inn}`);
    console.log(`  КПП: ${offerData.clientCompany.kpp}`);
    console.log(`  Генеральному директору: ${offerData.clientCompany.ceo_name_dative || offerData.clientCompany.ceo_name}`);
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

testOfferWithClientData();
