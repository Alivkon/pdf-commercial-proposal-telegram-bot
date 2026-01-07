/**
 * Веб-сервер для отображения компаний из PostgreSQL
 * Запуск: node web/server.js
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { pool } = require('./database');

const PORT = process.env.WEB_PORT || 3000;
const HOST = process.env.WEB_HOST || '0.0.0.0';

// MIME типы для файлов
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

/**
 * Получение всех компаний из БД
 */
async function getCompanies() {
  const client = await pool.connect();
  try {
    const companiesResult = await client.query(`
      SELECT
        id,
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
        ceo_name,
        ceo_name_dative,
        created_at,
        updated_at
      FROM company
      ORDER BY created_at DESC
    `);

    const documentsResult = await client.query(`
      SELECT COUNT(*) as count FROM company_document
    `);

    // Подсчет коммерческих предложений (PDF файлов в папке pdfs)
    const pdfsDir = path.join(__dirname, '../src/pdfs');
    let totalOffers = 0;
    try {
      const files = await fs.readdir(pdfsDir);
      totalOffers = files.filter(f =>
        f.startsWith('commercial_offer_') && f.endsWith('.pdf')
      ).length;
    } catch (err) {
      console.warn('Не удалось подсчитать КП:', err.message);
    }

    return {
      companies: companiesResult.rows,
      total: companiesResult.rows.length,
      totalDocuments: parseInt(documentsResult.rows[0].count),
      totalOffers: totalOffers
    };
  } finally {
    client.release();
  }
}

/**
 * Получение документов компании
 */
async function getCompanyDocuments(companyId) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        id,
        file_name,
        storage_url,
        file_sha256,
        created_at
      FROM company_document
      WHERE company_id = $1
      ORDER BY created_at DESC
    `, [companyId]);

    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Получение всех документов для статистики
 */
async function getAllDocuments() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        cd.id,
        cd.file_name,
        cd.storage_url,
        cd.file_sha256,
        cd.created_at,
        c.name_short,
        c.name_full,
        c.inn
      FROM company_document cd
      LEFT JOIN company c ON cd.company_id = c.id
      ORDER BY cd.created_at DESC
    `);

    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Удаление документа
 */
async function deleteDocument(documentId) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      DELETE FROM company_document
      WHERE id = $1
      RETURNING storage_url
    `, [documentId]);

    if (result.rows.length === 0) {
      return { deleted: false };
    }

    const storageUrl = result.rows[0].storage_url;
    if (storageUrl) {
      const resolvedPath = path.resolve(storageUrl);
      const baseDir = path.resolve(__dirname, '..');
      if (resolvedPath.startsWith(baseDir)) {
        try {
          await fs.unlink(resolvedPath);
        } catch (err) {
          console.warn('Не удалось удалить файл документа:', err.message);
        }
      }
    }

    return { deleted: true };
  } finally {
    client.release();
  }
}

/**
 * Получение списка коммерческих предложений
 */
async function getAllOffers() {
  const pdfsDir = path.join(__dirname, '../src/pdfs');

  try {
    const files = await fs.readdir(pdfsDir);
    const offerFiles = files.filter(f =>
      f.startsWith('commercial_offer_') && f.endsWith('.pdf')
    );

    // Получаем информацию о каждом файле
    const offers = await Promise.all(offerFiles.map(async (fileName) => {
      const filePath = path.join(pdfsDir, fileName);
      const stats = await fs.stat(filePath);

      // Извлекаем дату из имени файла (commercial_offer_2025-12-25T13-07-21-836Z.pdf)
      const dateMatch = fileName.match(/commercial_offer_(.+)\.pdf$/);
      const dateStr = dateMatch ? dateMatch[1].replace(/-/g, ':').replace('T', ' ').slice(0, -5) : null;

      return {
        fileName,
        filePath,
        fileSize: stats.size,
        createdAt: stats.birthtime,
        displayDate: dateStr || stats.birthtime.toISOString()
      };
    }));

    // Сортируем по дате создания (новые первыми)
    offers.sort((a, b) => b.createdAt - a.createdAt);

    return offers;
  } catch (err) {
    console.error('Ошибка получения списка КП:', err);
    return [];
  }
}

/**
 * Получение списка товаров из PriceAll
 */
async function getPriceAll() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        name,
        connector,
        price_per_unit,
        vat,
        total_with_vat,
        warranty
      FROM "PriceAll"
      ORDER BY name, connector
    `);

    return result.rows;
  } finally {
    client.release();
  }
}

async function updatePriceAllItem(payload) {
  const client = await pool.connect();
  try {
    const {
      name,
      connector,
      price_per_unit,
      vat,
      total_with_vat,
      warranty
    } = payload;

    const result = await client.query(`
      UPDATE "PriceAll"
      SET price_per_unit = $1,
          vat = $2,
          total_with_vat = $3,
          warranty = $4
      WHERE name = $5
        AND connector IS NOT DISTINCT FROM $6
      RETURNING name, connector, price_per_unit, vat, total_with_vat, warranty
    `, [
      price_per_unit,
      vat,
      total_with_vat,
      warranty,
      name,
      connector ?? null
    ]);

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Удаление коммерческого предложения
 */
async function deleteOffer(fileName) {
  const pdfsDir = path.join(__dirname, '../src/pdfs');
  const filePath = path.join(pdfsDir, fileName);

  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(pdfsDir);

  if (!resolvedPath.startsWith(resolvedDir)) {
    return { deleted: false, error: 'Access denied' };
  }

  try {
    await fs.unlink(resolvedPath);
    return { deleted: true };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { deleted: false, error: 'Offer not found' };
    }
    throw err;
  }
}

/**
 * Обработка HTTP запросов
 */
async function handleRequest(req, res) {
  const url = req.url;
  const pathname = url.split('?')[0];

  console.log(`${new Date().toISOString()} - ${req.method} ${url}`);

  // API endpoint для получения компаний
  if (pathname === '/api/companies') {
    try {
      const data = await getCompanies();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(data));
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }));
    }
    return;
  }

  // API endpoint для получения документов компании
  if (pathname.startsWith('/api/documents/company/')) {
    const companyId = pathname.split('/').pop();
    try {
      const documents = await getCompanyDocuments(companyId);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(documents));
    } catch (error) {
      console.error('Error fetching company documents:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }));
    }
    return;
  }

  // API endpoint для получения всех документов
  if (pathname === '/api/documents') {
    try {
      const documents = await getAllDocuments();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(documents));
    } catch (error) {
      console.error('Error fetching all documents:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }));
    }
    return;
  }

  // API endpoint для удаления документа
  if (req.method === 'DELETE' &&
      pathname.startsWith('/api/documents/') &&
      !pathname.startsWith('/api/documents/company/')) {
    const documentId = pathname.split('/').pop();
    if (!documentId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Document id is required' }));
      return;
    }
    try {
      const result = await deleteDocument(documentId);

      if (!result.deleted) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Document not found' }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      console.error('Error deleting document:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Error deleting document',
        message: error.message
      }));
    }
    return;
  }

  // API endpoint для получения всех КП
  if (pathname === '/api/offers') {
    try {
      const offers = await getAllOffers();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(offers));
    } catch (error) {
      console.error('Error fetching offers:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }));
    }
    return;
  }

  // API endpoint для получения списка товаров
  if (pathname === '/api/priceall' && req.method === 'GET') {
    try {
      const items = await getPriceAll();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(items));
    } catch (error) {
      console.error('Error fetching PriceAll items:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }));
    }
    return;
  }

  if (pathname === '/api/priceall' && req.method === 'PUT') {
    try {
      const body = await readJsonBody(req);
      if (!body || !body.name) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Name is required' }));
        return;
      }

      const updated = await updatePriceAllItem(body);
      if (!updated) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Item not found' }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating PriceAll item:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Error updating item',
        message: error.message
      }));
    }
    return;
  }

  // API endpoint для удаления КП
  if (req.method === 'DELETE' && pathname.startsWith('/api/offers/')) {
    const fileName = decodeURIComponent(pathname.split('/').pop());
    if (!fileName) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File name is required' }));
      return;
    }

    try {
      const result = await deleteOffer(fileName);
      if (!result.deleted) {
        const status = result.error === 'Access denied' ? 403 : 404;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      console.error('Error deleting offer:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Error deleting offer',
        message: error.message
      }));
    }
    return;
  }

  // API endpoint для скачивания коммерческого предложения
  if (pathname.startsWith('/api/download/offer/')) {
    const fileName = decodeURIComponent(pathname.split('/api/download/offer/')[1]);
    const pdfsDir = path.join(__dirname, '../src/pdfs');
    const filePath = path.join(pdfsDir, fileName);

    try {
      // Проверка безопасности: файл должен быть в директории pdfs
      const resolvedPath = path.resolve(filePath);
      const resolvedDir = path.resolve(pdfsDir);

      if (!resolvedPath.startsWith(resolvedDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Access denied' }));
        return;
      }

      const content = await fs.readFile(filePath);
      const extname = path.extname(filePath);
      const contentType = MIME_TYPES[extname] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': content.length
      });
      res.end(content);
    } catch (error) {
      console.error('Error downloading offer:', error);
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Offer not found' }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Error downloading file',
          message: error.message
        }));
      }
    }
    return;
  }

  // API endpoint для скачивания документа
  if (pathname.startsWith('/api/download/')) {
    const documentId = pathname.split('/').pop();
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT storage_url, file_name
        FROM company_document
        WHERE id = $1
      `, [documentId]);

      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Document not found' }));
        return;
      }

      const doc = result.rows[0];
      const filePath = path.resolve(doc.storage_url);

      const content = await fs.readFile(filePath);
      const extname = path.extname(filePath);
      const contentType = MIME_TYPES[extname] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.file_name)}"`,
        'Content-Length': content.length
      });
      res.end(content);
    } catch (error) {
      console.error('Error downloading document:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Error downloading file',
        message: error.message
      }));
    } finally {
      client.release();
    }
    return;
  }

  // Статические файлы
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'text/plain';

  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - Страница не найдена</h1>');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>500 - Ошибка сервера</h1>');
    }
  }
}

// Создаем HTTP сервер
const server = http.createServer(handleRequest);

// Запускаем сервер
server.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(70));
  console.log('🌐 ВЕБ-СЕРВЕР БАЗЫ КОМПАНИЙ ЗАПУЩЕН');
  console.log('='.repeat(70));
  console.log(`📍 Локальный адрес:  http://localhost:${PORT}`);
  console.log(`📍 Сетевой адрес:    http://${HOST}:${PORT}`);
  console.log('='.repeat(70));
  console.log('\nДля остановки нажмите Ctrl+C\n');
});

// Обработка завершения
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Остановка сервера...');
  server.close();
  await pool.end();
  console.log('✓ Сервер остановлен\n');
  process.exit(0);
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
  console.error('❌ Критическая ошибка:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необработанное отклонение промиса:', reason);
});
