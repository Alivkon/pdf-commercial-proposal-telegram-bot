const { Pool } = require('pg');
const crypto = require('crypto');
const { addCompanyToQdrant, updateCompanyInQdrant } = require('./vector.search.service');
require('dotenv').config();

// Создаем пул подключений к PostgreSQL
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'elter',
  password: String(process.env.POSTGRES_PASSWORD || 'elterpass'),
  host: 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
  database: process.env.POSTGRES_DB || 'elter_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Вычисляет SHA256 хеш для содержимого файла
 * @param {Buffer} buffer - Буфер с содержимым файла
 * @returns {string} Хеш в hex формате
 */
function calculateSHA256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Поиск компании по ИНН и КПП
 * @param {string} inn - ИНН компании
 * @param {string} kpp - КПП компании (опционально)
 * @returns {Promise<object|null>} Найденная компания или null
 */
async function findCompanyByInnKpp(inn, kpp = null) {
  if (!inn) return null;

  const client = await pool.connect();
  try {
    let query, params;

    if (kpp) {
      query = 'SELECT * FROM company WHERE inn = $1 AND kpp = $2';
      params = [inn, kpp];
    } else {
      query = 'SELECT * FROM company WHERE inn = $1 AND kpp IS NULL';
      params = [inn];
    }

    const result = await client.query(query, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

/**
 * Создание новой компании в базе данных
 * @param {object} companyData - Данные компании
 * @returns {Promise<object>} Созданная компания
 */
async function createCompany(companyData) {
  const client = await pool.connect();
  try {
    const {
      name_full,
      name_short,
      inn,
      kpp,
      ogrn,
      okpo,
      oktmo,
      legal_address,
      actual_address,
      email,
      phone,
      ceo_name
    } = companyData;

    const query = `
      INSERT INTO company (
        name_full, name_short, inn, kpp, ogrn, okpo, oktmo,
        legal_address, actual_address, email, phone, ceo_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const params = [
      name_full || null,
      name_short || null,
      inn,
      kpp || null,
      ogrn || null,
      okpo || null,
      oktmo || null,
      legal_address || null,
      actual_address || null,
      email || null,
      phone || null,
      ceo_name || null
    ];

    const result = await client.query(query, params);
    const company = result.rows[0];
    console.log(`✓ Создана новая компания: ${name_short || name_full} (ИНН: ${inn})`);

    // Добавляем компанию в Qdrant
    try {
      await addCompanyToQdrant(company);
    } catch (error) {
      console.warn(`⚠ Не удалось добавить компанию в Qdrant: ${error.message}`);
      // Не бросаем ошибку, чтобы не блокировать создание компании в БД
    }

    return company;
  } finally {
    client.release();
  }
}

/**
 * Обновление данных компании
 * @param {string} companyId - ID компании
 * @param {object} updates - Объект с обновляемыми полями
 * @returns {Promise<object>} Обновленная компания
 */
async function updateCompany(companyId, updates) {
  const client = await pool.connect();
  try {
    const allowedFields = [
      'name_full', 'name_short', 'inn', 'kpp', 'ogrn', 'okpo', 'oktmo',
      'legal_address', 'actual_address', 'email', 'phone', 'ceo_name'
    ];

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('Нет полей для обновления');
    }

    values.push(companyId);
    const query = `
      UPDATE company
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await client.query(query, values);
    const company = result.rows[0];
    console.log(`✓ Обновлены данные компании ID: ${companyId}`);

    // Обновляем компанию в Qdrant
    try {
      await updateCompanyInQdrant(company);
    } catch (error) {
      console.warn(`⚠ Не удалось обновить компанию в Qdrant: ${error.message}`);
      // Не бросаем ошибку, чтобы не блокировать обновление компании в БД
    }

    return company;
  } finally {
    client.release();
  }
}

/**
 * Сохранение документа компании
 * @param {object} documentData - Данные документа
 * @returns {Promise<object>} Созданный документ
 */
async function saveCompanyDocument(documentData) {
  const client = await pool.connect();
  try {
    const {
      company_id,
      file_name,
      file_sha256,
      storage_url,
      raw_text,
      extracted_json,
      confidence,
      model_version,
      prompt_version
    } = documentData;

    const query = `
      INSERT INTO company_document (
        company_id, file_name, file_sha256, storage_url,
        raw_text, extracted_json, confidence, model_version, prompt_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const params = [
      company_id || null,
      file_name,
      file_sha256,
      storage_url || null,
      raw_text || null,
      extracted_json || null,
      confidence || null,
      model_version || null,
      prompt_version || null
    ];

    const result = await client.query(query, params);
    console.log(`✓ Сохранен документ: ${file_name}`);
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Поиск документа по SHA256 хешу
 * @param {string} sha256 - SHA256 хеш файла
 * @returns {Promise<object|null>} Найденный документ или null
 */
async function findDocumentByHash(sha256) {
  const client = await pool.connect();
  try {
    const query = 'SELECT * FROM company_document WHERE file_sha256 = $1';
    const result = await client.query(query, [sha256]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

/**
 * Получение всех документов компании
 * @param {string} companyId - ID компании
 * @returns {Promise<Array>} Массив документов
 */
async function getCompanyDocuments(companyId) {
  const client = await pool.connect();
  try {
    const query = 'SELECT * FROM company_document WHERE company_id = $1 ORDER BY created_at DESC';
    const result = await client.query(query, [companyId]);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Закрытие пула подключений
 */
async function closePool() {
  await pool.end();
  console.log('✓ Пул подключений к БД закрыт');
}

module.exports = {
  pool,
  calculateSHA256,
  findCompanyByInnKpp,
  createCompany,
  updateCompany,
  saveCompanyDocument,
  findDocumentByHash,
  getCompanyDocuments,
  closePool
};
