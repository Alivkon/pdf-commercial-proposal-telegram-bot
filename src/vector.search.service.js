const { QdrantClient } = require('@qdrant/js-client-rest');
const { OpenAI } = require('openai');
require('dotenv').config();

// Инициализация клиентов
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const COLLECTION_FIRMS = process.env.QDRANT_COLLECTION_PRICE_FIRMS_LIST || 'elter_organisation_list';

/**
 * Получение эмбеддинга для текста через OpenAI
 * @param {string} text - Текст для получения эмбеддинга
 * @returns {Promise<Array<number>>} Вектор эмбеддинга
 */
async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Ошибка при получении эмбеддинга:', error.message);
    throw error;
  }
}

/**
 * Создание коллекции для организаций в Qdrant, если её нет
 */
async function ensureFirmsCollectionExists() {
  try {
    // Проверяем существование коллекции
    try {
      await qdrant.getCollection(COLLECTION_FIRMS);
      console.log(`✓ Коллекция '${COLLECTION_FIRMS}' уже существует`);
      return true;
    } catch (error) {
      // Коллекция не существует, создаём
      console.log(`Создание коллекции '${COLLECTION_FIRMS}'...`);

      await qdrant.createCollection(COLLECTION_FIRMS, {
        vectors: {
          size: 1536, // Размер вектора для text-embedding-3-small
          distance: 'Cosine',
        },
      });

      console.log(`✓ Коллекция '${COLLECTION_FIRMS}' создана успешно`);
      return true;
    }
  } catch (error) {
    console.error(`✗ Ошибка при работе с коллекцией '${COLLECTION_FIRMS}':`, error.message);
    throw error;
  }
}

/**
 * Формирование текста для эмбеддинга из данных компании
 * @param {object} company - Данные компании
 * @returns {string} Текст для эмбеддинга
 */
function buildCompanyEmbeddingText(company) {
  const parts = [];

  // Название компании (короткое и полное)
  if (company.name_short) {
    parts.push(company.name_short);
  }
  if (company.name_full && company.name_full !== company.name_short) {
    parts.push(company.name_full);
  }

  // ИНН для точного поиска
  if (company.inn) {
    parts.push(`ИНН ${company.inn}`);
  }

  // Руководитель
  if (company.ceo_name) {
    parts.push(`Руководитель ${company.ceo_name}`);
  }

  // Email для поиска
  if (company.email && company.email.length > 0) {
    parts.push(company.email.join(' '));
  }

  return parts.join(' | ');
}

/**
 * Добавление компании в Qdrant коллекцию
 * @param {object} company - Данные компании из БД
 * @returns {Promise<boolean>} Успешность операции
 */
async function addCompanyToQdrant(company) {
  try {
    console.log(`\n[Qdrant] Добавление компании в векторную БД...`);

    // Проверяем существование коллекции
    await ensureFirmsCollectionExists();

    // Формируем текст для эмбеддинга
    const embeddingText = buildCompanyEmbeddingText(company);
    console.log(`Текст для эмбеддинга: ${embeddingText}`);

    // Получаем эмбеддинг
    const vector = await getEmbedding(embeddingText);
    console.log(`✓ Получен эмбеддинг (размер: ${vector.length})`);

    // Формируем payload с данными компании
    const payload = {
      id: company.id,
      name_short: company.name_short || null,
      name_full: company.name_full || null,
      inn: company.inn,
      kpp: company.kpp || null,
      ceo_name: company.ceo_name || null,
      ceo_name_dative: company.ceo_name_dative || null,
      email: company.email || [],
      phone: company.phone || [],
      legal_address: company.legal_address || null,
      actual_address: company.actual_address || null,
      created_at: company.created_at?.toISOString() || new Date().toISOString(),
      // Текст для отображения в результатах поиска
      display_text: `${company.name_short || company.name_full} (ИНН: ${company.inn})`
    };

    // Добавляем точку в Qdrant
    await qdrant.upsert(COLLECTION_FIRMS, {
      wait: true,
      points: [
        {
          id: company.id, // Используем UUID компании как ID точки
          vector: vector,
          payload: payload,
        },
      ],
    });

    console.log(`✓ Компания '${company.name_short}' добавлена в Qdrant`);
    console.log(`  ID: ${company.id}`);
    console.log(`  Коллекция: ${COLLECTION_FIRMS}`);

    return true;
  } catch (error) {
    console.error(`✗ Ошибка при добавлении компании в Qdrant:`, error.message);
    throw error;
  }
}

/**
 * Обновление данных компании в Qdrant
 * @param {object} company - Обновленные данные компании
 * @returns {Promise<boolean>} Успешность операции
 */
async function updateCompanyInQdrant(company) {
  try {
    console.log(`\n[Qdrant] Обновление компании в векторной БД...`);

    // Обновление = удаление + добавление с новым эмбеддингом
    await addCompanyToQdrant(company);

    console.log(`✓ Компания '${company.name_short}' обновлена в Qdrant`);
    return true;
  } catch (error) {
    console.error(`✗ Ошибка при обновлении компании в Qdrant:`, error.message);
    // Не бросаем ошибку, чтобы не блокировать основной процесс
    return false;
  }
}

/**
 * Удаление компании из Qdrant
 * @param {string} companyId - UUID компании
 * @returns {Promise<boolean>} Успешность операции
 */
async function deleteCompanyFromQdrant(companyId) {
  try {
    console.log(`\n[Qdrant] Удаление компании из векторной БД...`);

    await qdrant.delete(COLLECTION_FIRMS, {
      wait: true,
      points: [companyId],
    });

    console.log(`✓ Компания удалена из Qdrant (ID: ${companyId})`);
    return true;
  } catch (error) {
    console.error(`✗ Ошибка при удалении компании из Qdrant:`, error.message);
    return false;
  }
}

/**
 * Поиск компаний в Qdrant по тексту
 * @param {string} queryText - Текст запроса
 * @param {number} limit - Количество результатов
 * @returns {Promise<Array>} Найденные компании
 */
async function searchCompaniesInQdrant(queryText, limit = 3) {
  try {
    console.log(`\n[Qdrant] Поиск компаний: "${queryText}"`);

    // Получаем эмбеддинг запроса
    const queryVector = await getEmbedding(queryText);

    // Поиск в Qdrant
    const searchResults = await qdrant.search(COLLECTION_FIRMS, {
      vector: queryVector,
      limit: limit,
      with_payload: true,
    });

    console.log(`✓ Найдено компаний: ${searchResults.length}`);

    return searchResults.map(result => ({
      id: result.id,
      score: result.score,
      company: result.payload,
    }));
  } catch (error) {
    console.error(`✗ Ошибка при поиске компаний в Qdrant:`, error.message);
    return [];
  }
}

/**
 * Получение статистики коллекции
 * @returns {Promise<object>} Статистика коллекции
 */
async function getFirmsCollectionStats() {
  try {
    const collection = await qdrant.getCollection(COLLECTION_FIRMS);
    return {
      name: COLLECTION_FIRMS,
      points_count: collection.points_count,
      vectors_count: collection.vectors_count,
      status: collection.status,
    };
  } catch (error) {
    console.error(`✗ Ошибка при получении статистики коллекции:`, error.message);
    return null;
  }
}

module.exports = {
  addCompanyToQdrant,
  updateCompanyInQdrant,
  deleteCompanyFromQdrant,
  searchCompaniesInQdrant,
  getFirmsCollectionStats,
  ensureFirmsCollectionExists,
  getEmbedding,
};
