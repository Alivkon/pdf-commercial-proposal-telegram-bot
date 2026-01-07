/**
 * Модуль работы с PostgreSQL для веб-интерфейса
 * Изолирован от зависимостей бота (OpenAI, Qdrant и т.д.)
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Создаем пул подключений к PostgreSQL
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433'),
  database: process.env.POSTGRES_DB || 'elter_db',
  user: process.env.POSTGRES_USER || 'elter',
  password: process.env.POSTGRES_PASSWORD || 'elterpass',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Обработка ошибок пула
pool.on('error', (err) => {
  console.error('❌ Неожиданная ошибка PostgreSQL:', err);
});

// Проверка подключения
pool.on('connect', () => {
  console.log('✓ PostgreSQL подключен (веб-интерфейс)');
});

module.exports = { pool };
