/**
 * Тест генерации КП для физического лица
 */

const { createCommercialOffer } = require('./src/offer.pdf.generator');

async function testOfferForIndividual() {
  console.log('\n' + '='.repeat(70));
  console.log('ТЕСТ: Генерация КП для физического лица');
  console.log('='.repeat(70) + '\n');

  try {
    // Имитируем сообщение с упоминанием физического лица
    const userMessage = 'Подготовьте коммерческое предложение для физика на зарядную станцию EDISON DC 60кВт';

    console.log(`Сообщение пользователя: "${userMessage}"\n`);

    // Формируем данные для КП
    console.log('[1/2] Формирование данных для КП...');

    const offerData = {
      userText: userMessage,
      // Нет данных clientCompany - физическое лицо
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

    // Создание PDF
    console.log('\n[2/2] Создание PDF...');
    const pdfPath = await createCommercialOffer(offerData, 'test_offer_individual.pdf');

    console.log('\n' + '='.repeat(70));
    console.log('✓ ТЕСТ ЗАВЕРШЁН УСПЕШНО');
    console.log('='.repeat(70));
    console.log(`PDF создан: ${pdfPath}`);
    console.log('');
    console.log('В правом столбце должно быть только: "г. Москва"');
    console.log('В левом столбце только дата (без "г. Москва")');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('✗ ОШИБКА В ТЕСТЕ');
    console.error('='.repeat(70));
    console.error(error);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('='.repeat(70) + '\n');
  }
}

testOfferForIndividual();
