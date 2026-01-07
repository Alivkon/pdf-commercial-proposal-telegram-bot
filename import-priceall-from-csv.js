#!/usr/bin/env node
/**
 * Импортирует данные из PriceAll_war.csv в таблицу "PriceAll" (PostgreSQL).
 * Запуск из корня проекта: `node import-priceall-from-csv.js`
 */

const fs = require('fs').promises;
const path = require('path');
const { TextDecoder } = require('util');
const isUtf8 = require('is-utf8');
const { Pool } = require('pg');
require('dotenv').config();

const CSV_FILE = path.join(__dirname, 'PriceAll_war.csv');

// Простенький CSV-парсер для файлов с разделителем `;` и поддержкой кавычек/переносов строк внутри поля.
function parseSemicolonCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++; // пропускаем экранированную кавычку
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ';' && !inQuotes) {
      row.push(field.trim());
      field = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      // конец строки
      if (ch === '\r' && next === '\n') {
        i++; // пропускаем \n после \r
      }
      row.push(field.trim());
      if (row.some((v) => v !== '')) {
        rows.push(row);
      }
      row = [];
      field = '';
      continue;
    }

    field += ch;
  }

  // последний ряд, если остался
  if (field.length || row.length) {
    row.push(field.trim());
    if (row.some((v) => v !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function toNumber(str) {
  if (!str) return null;
  const normalized = String(str).replace(/\s+/g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

async function loadCsvRows() {
  // Читаем как бинарь и сами выбираем кодировку, чтобы кириллица не ломалась
  const buf = await fs.readFile(CSV_FILE);
  const decoded = isUtf8(buf)
    ? buf.toString('utf8')
    : new TextDecoder('windows-1251').decode(buf);

  const rows = parseSemicolonCsv(decoded);
  // пропускаем заголовок
  const dataRows = rows.filter((r) => r.length >= 6 && r[0] && !/наимен/i.test(r[0]));
  return dataRows.map((cols) => {
    const [name, connector, priceStr, vatStr, totalStr, warranty] = cols;
    return {
      name: name?.trim() || null,
      connector: connector?.trim() || null,
      price_per_unit: toNumber(priceStr),
      vat: toNumber(vatStr),
      total_with_vat: toNumber(totalStr),
      warranty: warranty?.trim() || null
    };
  });
}

async function importPriceAll() {
  const pool = new Pool({
    user: process.env.POSTGRES_USER || 'elter',
    password: String(process.env.POSTGRES_PASSWORD || 'elterpass'),
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
    database: process.env.POSTGRES_DB || 'elter_db',
    max: 5,
  });

  const client = await pool.connect();
  try {
    const items = await loadCsvRows();
    if (!items.length) {
      throw new Error('В CSV нет данных для импорта');
    }

    console.log(`Найдено строк для импорта: ${items.length}`);

    await client.query('BEGIN');
    // Очистка таблицы перед импортом; при необходимости закомментируйте.
    await client.query('TRUNCATE TABLE "PriceAll"');

    const insertText = `
      INSERT INTO "PriceAll" (name, connector, price_per_unit, vat, total_with_vat, warranty)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    for (const item of items) {
      await client.query(insertText, [
        item.name,
        item.connector,
        item.price_per_unit,
        item.vat,
        item.total_with_vat,
        item.warranty,
      ]);
    }

    await client.query('COMMIT');
    console.log('Импорт завершён успешно');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка импорта:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  importPriceAll().catch(() => process.exit(1));
}
