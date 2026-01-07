const { pool, createCompany } = require('./src/database.service');

async function recreateCompanies() {
  const client = await pool.connect();
  try {
    // Получаем все документы без company_id
    const result = await client.query(
      'SELECT id, extracted_json FROM company_document WHERE company_id IS NULL ORDER BY created_at'
    );

    console.log(`Найдено ${result.rows.length} документов без company_id\n`);

    const processed = new Set(); // Чтобы не создавать дубликаты по ИНН+КПП

    for (const doc of result.rows) {
      const data = doc.extracted_json;
      const key = `${data.inn}_${data.kpp || 'null'}`;

      if (processed.has(key)) {
        console.log(`⚠ Пропускаем дубликат: ${data.name_short} (ИНН: ${data.inn})`);
        continue;
      }

      try {
        // Создаём компанию
        const company = await createCompany(data);
        processed.add(key);

        // Обновляем все документы этой компании
        const updateQuery = `
          UPDATE company_document
          SET company_id = $1
          WHERE extracted_json->>'inn' = $2
            AND (
              extracted_json->>'kpp' = $3
              OR (extracted_json->>'kpp' IS NULL AND $3 IS NULL)
            )
        `;

        await client.query(updateQuery, [company.id, data.inn, data.kpp || null]);

        console.log(`✓ Создана компания: ${company.name_short} (ИНН: ${company.inn})`);
      } catch (error) {
        console.error(`✗ Ошибка создания компании ${data.name_short}:`, error.message);
      }
    }

    console.log(`\n✓ Создано компаний: ${processed.size}`);

    // Проверяем результат
    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM company) as companies,
        (SELECT COUNT(*) FROM company_document WHERE company_id IS NOT NULL) as linked_docs,
        (SELECT COUNT(*) FROM company_document WHERE company_id IS NULL) as unlinked_docs
    `);

    console.log('\n=== СТАТИСТИКА ===');
    console.log(`Компаний в БД: ${stats.rows[0].companies}`);
    console.log(`Документов со связью: ${stats.rows[0].linked_docs}`);
    console.log(`Документов без связи: ${stats.rows[0].unlinked_docs}`);

  } finally {
    client.release();
    await pool.end();
  }
}

recreateCompanies().catch(console.error);
