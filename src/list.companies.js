const { pool } = require('./database.service');

/**
 * Получение списка всех компаний из базы данных
 */
async function listCompanies() {
  const client = await pool.connect();
  try {
    const query = `
      SELECT
        id,
        name_short,
        name_full,
        inn,
        kpp,
        phone,
        email,
        created_at
      FROM company
      ORDER BY created_at DESC
    `;

    const result = await client.query(query);

    if (result.rows.length === 0) {
      console.log('📋 В базе данных нет организаций');
      return [];
    }

    console.log(`\n📋 Найдено организаций: ${result.rows.length}\n`);
    console.log('═'.repeat(100));

    result.rows.forEach((company, index) => {
      console.log(`\n${index + 1}. ${company.name_short || company.name_full || 'Без названия'}`);
      console.log(`   ID: ${company.id}`);
      if (company.name_full && company.name_full !== company.name_short) {
        console.log(`   Полное название: ${company.name_full}`);
      }
      console.log(`   ИНН: ${company.inn || 'не указан'}`);
      if (company.kpp) {
        console.log(`   КПП: ${company.kpp}`);
      }
      if (company.phone) {
        console.log(`   Телефон: ${company.phone}`);
      }
      if (company.email) {
        console.log(`   Email: ${company.email}`);
      }
      console.log(`   Добавлено: ${new Date(company.created_at).toLocaleString('ru-RU')}`);
      console.log('─'.repeat(100));
    });

    return result.rows;
  } catch (error) {
    console.error('❌ Ошибка при получении списка компаний:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Получение статистики по компаниям
 */
async function getCompaniesStats() {
  const client = await pool.connect();
  try {
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT inn) as unique_inn,
        COUNT(email) as with_email,
        COUNT(phone) as with_phone
      FROM company
    `;

    const result = await client.query(statsQuery);
    const stats = result.rows[0];

    console.log('\n📊 Статистика:');
    console.log(`   Всего организаций: ${stats.total}`);
    console.log(`   Уникальных ИНН: ${stats.unique_inn}`);
    console.log(`   С указанным email: ${stats.with_email}`);
    console.log(`   С указанным телефоном: ${stats.with_phone}`);
    console.log('');

    return stats;
  } finally {
    client.release();
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    try {
      await listCompanies();
      await getCompaniesStats();
    } catch (error) {
      console.error('Ошибка:', error);
      process.exit(1);
    } finally {
      const { closePool } = require('./database.service');
      await closePool();
      process.exit(0);
    }
  })();
}

module.exports = {
  listCompanies,
  getCompaniesStats
};
