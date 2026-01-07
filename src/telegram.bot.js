require('dotenv').config();
process.env.NTBA_FIX_350 = '1';
const TelegramBot = require('node-telegram-bot-api');
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const { File } = require('buffer');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { createCommercialOffer, saveDialogToPDF } = require('./offer.pdf.generator');
const offerUtils = require('./offer.utils');
const { handleOfferPdfFlow } = require('./offer.flow.handler');
const { searchCompaniesInQdrant } = require('./vector.search.service');
const { pool } = require('./database.service');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
  filepath: true
});

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
});
const QDRANT_COLLECTION_PRICE = process.env.QDRANT_COLLECTION_PRICE || 'elter_KP_price';
let priceCollectionChecked = false;

// Load system prompts
let systemPrompt = '';
let voiceHandlingPrompt = '';

Promise.all([
  fs.readFile('./src/prompts/system.txt', 'utf8').catch(err => {
    console.error('Error loading system prompt:', err);
    return "You are a helpful AI assistant running as a Telegram bot.";
  }),
 ]).then(([systemContent, voiceContent]) => {
  systemPrompt = systemContent;
  voiceHandlingPrompt = voiceContent;
  console.log('Prompts loaded successfully');
});

// Store conversation history for each user
const userHistories = new Map();

// Function to get embedding for a text query
async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error getting embedding:', error);
    throw error;
  }
}

// Test collection access at startup

console.log('Bot is starting...');

// --- Offer parsing and helpers moved to offerUtils ---

function needsOfferJSON(text) {
  if (!text) return false;
  const re = /(\bкп\b|коммерческ[а-я]*\s+предлож|сч[её]т|смета|офер|предложение|прайс|каталог|цена|стоимост|подбор|расч[её]т|offer|price|quotation|quote)/i;
  return re.test(text);
}

function getOfferSchemaInstruction() {
  return `At the very end of your reply, append a single JSON code block with the exact schema:\n\n\n\`\`\`json
{
  "products": [
    {
      "name": "string",
      "connector": "string",
      "price_one": 0,
      "nds": 0,
      "quantity": 1,
      "price_with_nds": 0
    }
  ],
  "deliveryTime": "string",
  "paymentTerms": "string",
  "warranty": "string"
}
\`\`\`
Rules:
- Use numbers only for numeric fields (no currency signs, no thousand separators).
- price_with_nds = price_one + nds. quantity is an integer.
- If you propose multiple variants, choose the best one and output only that in the JSON.
- Output exactly one JSON code block and do not add any text after it.`;
}

// Temporary: deterministic test reply to trigger KP generation
function getTestLLMReply(userText) {
  return [
    'Ниже представлено коммерческое предложение по вашему запросу.',
    '```json',
    JSON.stringify({
      products: [
        {
          name: 'EDISON DC 60 кВт',
          connector: 'GB/T (DC)',
          price_one: 1750000,
          nds: 350000,
          quantity: 1,
          price_with_nds: 2100000,
        },
      ],
      deliveryTime: '2-3 недели',
      paymentTerms: '100% предоплата',
      warranty: '2 года',
    }, null, 2),
    '```'
  ].join('\n');
}

// --- Unified pipeline helpers ---
function ensureHistory(userId) {
  if (!userHistories.has(userId)) {
    userHistories.set(userId, []);
  }
  return userHistories.get(userId);
}

async function retrieveVectorContextIfAvailable(queryText) {
  if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY || !queryText) {
    console.log('Vector database not configured or empty query');
    return null;
  }
  try {
    console.log(`Checking access to collection '${QDRANT_COLLECTION_PRICE}' before search...`);
    await qdrant.getCollection(QDRANT_COLLECTION_PRICE);
    console.log(`✓ Collection '${QDRANT_COLLECTION_PRICE}' access confirmed`);

    console.log(`Getting embedding for query: ${queryText}`);
    const queryVector = await getEmbedding(queryText);

    console.log('Searching in vector database...');
    const searchRes = await qdrant.search(QDRANT_COLLECTION_PRICE, {
      vector: queryVector,
      limit: 5,
      with_payload: true,
    });

    console.log(`Found ${searchRes?.length || 0} results in vector database`);
    const items = (searchRes || []).map((p, idx) => {
      const text = p.payload?.text || p.payload?.content || JSON.stringify(p.payload);
      return `#${idx + 1} (score ${p.score?.toFixed?.(3) ?? p.score}): ${text}`;
    });
    if (items.length) {
      return `Use the following catalog context if relevant. If it conflicts with general knowledge, prefer the catalog.\nRelevant catalog snippets:\n${items.join('\n')}`;
    }
    return null;
  } catch (err) {
    console.warn(`⚠ Error accessing or searching collection '${QDRANT_COLLECTION_PRICE}':`, err.message);
    return null;
  }
}

async function ensurePriceCollectionAvailable() {
  if (priceCollectionChecked) return true;
  if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) return false;
  try {
    await qdrant.getCollection(QDRANT_COLLECTION_PRICE);
    priceCollectionChecked = true;
    return true;
  } catch (err) {
    console.warn(`⚠ Error accessing collection '${QDRANT_COLLECTION_PRICE}':`, err.message);
    return false;
  }
}

function extractProductFromPayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'string') {
    return { name: payload };
  }
  const name =
    payload.name ||
    payload.title ||
    payload.product ||
    payload.item ||
    payload.model ||
    payload.display_name ||
    payload.display_text;
  const connector =
    payload.connector ||
    payload.socket ||
    payload.port ||
    payload['разъем'] ||
    payload['разъём'];
  if (name || connector) {
    return { name, connector };
  }
  const text = payload.text || payload.content || payload.description;
  if (!text) return {};
  const parts = String(text)
    .split(/[|;]/)
    .map(p => p.trim())
    .filter(Boolean);
  return {
    name: parts[0],
    connector: parts[1],
  };
}

async function searchProductInQdrant(queryText, limit = 3) {
  if (!queryText) return [];
  const ready = await ensurePriceCollectionAvailable();
  if (!ready) return [];
  try {
    const queryVector = await getEmbedding(queryText);
    const searchRes = await qdrant.search(QDRANT_COLLECTION_PRICE, {
      vector: queryVector,
      limit,
      with_payload: true,
    });
    return searchRes || [];
  } catch (err) {
    console.warn('⚠ Ошибка при поиске товара в Qdrant:', err.message);
    return [];
  }
}

async function getPriceAllRow(client, name, connector) {
  if (!name) return null;
  const normalizedName = String(name).trim();
  const normalizedConnector = connector ? String(connector).trim() : null;
  const exactQuery = `
    SELECT name, connector, price_per_unit, vat, total_with_vat, warranty
    FROM "PriceAll"
    WHERE lower(trim(name)) = lower(trim($1))
      AND ($2::text IS NULL OR lower(trim(connector)) = lower(trim($2)))
    LIMIT 1
  `;
  const exactResult = await client.query(exactQuery, [normalizedName, normalizedConnector]);
  if (exactResult.rows.length) return exactResult.rows[0];

  const nameOnlyQuery = `
    SELECT name, connector, price_per_unit, vat, total_with_vat, warranty
    FROM "PriceAll"
    WHERE lower(trim(name)) = lower(trim($1))
    LIMIT 1
  `;
  const nameResult = await client.query(nameOnlyQuery, [normalizedName]);
  if (nameResult.rows.length) return nameResult.rows[0];

  const fuzzyQuery = `
    SELECT name, connector, price_per_unit, vat, total_with_vat, warranty
    FROM "PriceAll"
    WHERE name ILIKE '%' || $1 || '%'
    LIMIT 1
  `;
  const fuzzyResult = await client.query(fuzzyQuery, [normalizedName]);
  return fuzzyResult.rows[0] || null;
}

async function hydrateOfferProductsFromPriceAll(offerData) {
  if (!offerData?.products?.length) return offerData;
  const client = await pool.connect();
  try {
    for (const product of offerData.products) {
      const queryText = [product.name, product.connector].filter(Boolean).join(' | ');
      const vectorResults = await searchProductInQdrant(queryText, 3);
      if (!vectorResults.length) continue;

      const best = vectorResults[0];
      const extracted = extractProductFromPayload(best.payload);
      const lookupName = extracted.name || product.name;
      const lookupConnector = extracted.connector || product.connector;
      const row = await getPriceAllRow(client, lookupName, lookupConnector);
      if (!row) continue;

      product.name = row.name || product.name;
      product.connector = row.connector || product.connector;
      product.price_one = Number(row.price_per_unit);
      product.nds = Number(row.vat);
      product.price_with_nds = Number(row.total_with_vat);
      if (row.warranty) {
        product.warranty = row.warranty;
      }
    }
  } finally {
    client.release();
  }
  return offerData;
}

function buildMessages(history, userText, opts) {
  const messages = [];
  // Base system prompt
  let baseSystem = systemPrompt || '';
  // If needed, you can inject voiceHandlingPrompt for voice origin without changing the rest of the flow
  if (opts?.source === 'voice' && voiceHandlingPrompt) {
    baseSystem = baseSystem + "\n" + voiceHandlingPrompt;
  }
  messages.push({ role: 'system', content: baseSystem });
  // Optionally prepend vector context (added by caller)
  // Then history
  messages.push(...history);
  if (needsOfferJSON(userText)) {
    messages.push({ role: 'system', content: getOfferSchemaInstruction() });
  }
  return messages;
}

async function generateAndRespond({ chatId, userId, userText, replyToMessageId, sourceLabel }) {
  // Send typing action
  await bot.sendChatAction(chatId, 'typing');

  // History handling
  const history = ensureHistory(userId);
  const contentForHistory = sourceLabel ? `[${sourceLabel}] ${userText}` : userText;
  history.push({ role: 'user', content: contentForHistory });
  if (history.length > 10) history.shift();

  // Optional vector context
  let vectorSystemContext = null;
  try {
    vectorSystemContext = await retrieveVectorContextIfAvailable(userText);
  } catch (e) {
    console.warn('Vector retrieval failed:', e?.message || e);
  }

  let messages = buildMessages(history, userText, { source: sourceLabel === 'Voice' ? 'voice' : 'text' });
  if (vectorSystemContext) {
    messages.unshift({ role: 'system', content: vectorSystemContext });
  }

  // Generate via OpenAI (unified) or use deterministic test reply
  let responseText;
  if (String(process.env.USE_TEST_LLM_REPLY).toLowerCase() === 'true') {
    console.log('USE_TEST_LLM_REPLY enabled: using deterministic test response');
    responseText = getTestLLMReply(userText);
  } else {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 500,
    });
    responseText = completion.choices[0].message.content;
  }

  // Persist to PDF (offer or dialog) via dedicated service
  try {
    const offerDataRaw = offerUtils.parseOfferData(responseText);
    if (offerDataRaw?.products?.length) {
      console.log('LLM JSON block:', JSON.stringify(offerDataRaw, null, 2));
    }
    let offerData = offerDataRaw;
    if (offerData?.products?.length) {
      offerData = await hydrateOfferProductsFromPriceAll(offerData);
      offerData = offerUtils.enrichOfferData(offerData);
    }

    // Поиск компании клиента в векторной БД и PostgreSQL
    if (offerData?.products?.length) {
      // Сохраняем исходный текст для анализа типа получателя (физлицо/юрлицо)
      offerData.userText = userText;

      // Проверяем, является ли получатель физическим лицом
      const isIndividual = /(физику|для\s+физика)/i.test(userText);

      if (isIndividual) {
        console.log('\n[Тип получателя] Физическое лицо - поиск компании не требуется');
      } else {
        try {
          console.log('\n[Поиск компании клиента] Анализ сообщения...');

          // Ищем компанию в Qdrant по тексту сообщения
          const searchResults = await searchCompaniesInQdrant(userText, 3);

          if (searchResults.length > 0) {
            console.log(`Найдено компаний в Qdrant: ${searchResults.length}`);

            // Берем наиболее релевантную компанию
            const bestMatch = searchResults[0];
            const relevancePercent = bestMatch.score * 100;
            console.log(`Лучшее совпадение: ${bestMatch.company.name_short} (релевантность: ${relevancePercent.toFixed(1)}%)`);

            // Проверяем релевантность: если меньше 30%, считаем физическим лицом
            if (relevancePercent < 30) {
              console.log(`⚠ Релевантность ${relevancePercent.toFixed(1)}% < 30% - считаем физическим лицом`);
            } else {
              // Получаем полные данные из PostgreSQL
              const client = await pool.connect();
              try {
                const result = await client.query('SELECT * FROM company WHERE id = $1', [bestMatch.company.id]);
                if (result.rows.length > 0) {
                  const clientCompany = result.rows[0];
                  console.log(`✓ Данные компании клиента получены из PostgreSQL`);

                  // Добавляем данные компании клиента в offerData
                  offerData.clientCompany = {
                    name_short: clientCompany.name_short,
                    name_full: clientCompany.name_full,
                    inn: clientCompany.inn,
                    kpp: clientCompany.kpp,
                    ceo_name: clientCompany.ceo_name,
                    ceo_name_dative: clientCompany.ceo_name_dative
                  };

                  console.log(`Компания клиента: ${clientCompany.name_short}`);
                  console.log(`Руководитель: ${clientCompany.ceo_name_dative || clientCompany.ceo_name}`);
                }
              } finally {
                client.release();
              }
            }
          } else {
            console.log('⚠ Компания клиента не найдена в векторной БД');
          }
        } catch (searchError) {
          console.warn('⚠ Ошибка при поиске компании клиента:', searchError.message);
        }
      }
    }

    await handleOfferPdfFlow({ bot, chatId, userId, userText, responseText, offerData, sourceLabel });
  } catch (pdfError) {
    console.warn('⚠ Не удалось сохранить PDF:', pdfError.message);
  }

  // Save assistant response to history and reply
  history.push({ role: 'assistant', content: responseText });
  await bot.sendMessage(chatId, responseText, { reply_to_message_id: replyToMessageId });
  
  // Отправляем копию сообщения с JSON пользователю с id 5808424974
  try {
    const offerDataRaw = offerUtils.parseOfferData(responseText);
    if (offerDataRaw?.products?.length) {
      const jsonText = '```json\n' + JSON.stringify(offerDataRaw, null, 2) + '\n```';
      await bot.sendMessage(5808424974, jsonText);
    }
  } catch (error) {
    console.warn('⚠ Не удалось отправить JSON копии:', error.message);
  }
  
  // Отправляем копию сообщения второму адресату (если это не он сам)
  if (chatId !== 5808424974) {
    await bot.sendMessage(5808424974, responseText);
  }
}

// --- Event handlers using the unified pipeline ---
// Handle /list_firms command
bot.onText(/\/list_firms/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  console.log(`Received /list_firms command from ${userId}`);

  try {
    await bot.sendChatAction(chatId, 'typing');

    const client = await pool.connect();
    try {
      const query = `
        SELECT
          id,
          name_short,
          name_full,
          inn,
          kpp,
          ogrn,
          phone,
          email,
          ceo_name,
          legal_address,
          actual_address,
          created_at
        FROM company
        ORDER BY name_short, name_full, created_at DESC
      `;

      const result = await client.query(query);

      if (result.rows.length === 0) {
        await bot.sendMessage(chatId, '📋 В базе данных пока нет организаций');
        return;
      }

      // Формируем сообщение со списком компаний
      let message = `📋 *Список организаций* (всего: ${result.rows.length}):\n\n`;

      result.rows.forEach((company, index) => {
        const companyName = company.name_short || company.name_full || 'Без названия';
        message += `*${index + 1}. ${companyName}*\n`;

        if (company.name_full && company.name_full !== company.name_short) {
          message += `   Полное название: ${company.name_full}\n`;
        }

        message += `   ИНН: \`${company.inn || 'не указан'}\`\n`;

        if (company.kpp) {
          message += `   КПП: \`${company.kpp}\`\n`;
        }

        if (company.ogrn) {
          message += `   ОГРН: \`${company.ogrn}\`\n`;
        }

        if (company.ceo_name) {
          message += `   Руководитель: ${company.ceo_name}\n`;
        }

        if (company.phone && company.phone.length > 0) {
          message += `   📞 ${company.phone.join(', ')}\n`;
        }

        if (company.email && company.email.length > 0) {
          message += `   📧 ${company.email.join(', ')}\n`;
        }

        if (company.legal_address) {
          message += `   📍 Юр. адрес: ${company.legal_address}\n`;
        }

        if (company.actual_address && company.actual_address !== company.legal_address) {
          message += `   📍 Факт. адрес: ${company.actual_address}\n`;
        }

        message += '\n';

        // Telegram имеет лимит на длину сообщения (4096 символов)
        // Если сообщение становится слишком длинным, отправляем его и начинаем новое
        if (message.length > 3500) {
          bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          message = '';
        }
      });

      // Отправляем оставшуюся часть сообщения
      if (message.length > 0) {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error processing /list_firms command:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка при получении списка организаций');
  }
});

// Handle text messages
bot.on('text', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const messageText = msg.text;

  // Игнорируем команды, чтобы не обрабатывать их дважды
  if (messageText.startsWith('/')) {
    return;
  }

  console.log(`Received text message from ${userId}: ${messageText}`);

  // Отправляем копию сообщения в чат 5808424974
  try {
    await bot.sendMessage(5808424974, `Пользователь ${userId} отправил текстовое сообщение: ${messageText}`);
  } catch (error) {
    console.warn('⚠ Не удалось отправить копию текстового сообщения в чат 5808424974:', error.message);
  }

  try {
    await generateAndRespond({
      chatId,
      userId,
      userText: messageText,
      replyToMessageId: msg.message_id,
      sourceLabel: 'Text',
    });
  } catch (error) {
    console.error('Error processing text message:', error);
    await bot.sendMessage(chatId, 'Sorry, I encountered an error processing your request.');
  }
});

// Handle voice messages
bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const fileId = msg.voice.file_id;
  console.log(`Received voice message from ${userId}`);
  
  // Отправляем копию голосового сообщения в чат 5808424974
  try {
    await bot.sendVoice(5808424974, fileId);
    await bot.sendMessage(5808424974, `Пользователь ${userId} отправил голосовое сообщение`);
  } catch (error) {
    console.warn('⚠ Не удалось отправить копию голосового сообщения в чат 5808424974:', error.message);
  }
  
  try {
    // Send typing action early
    await bot.sendChatAction(chatId, 'typing');
    
    // Get file link and download
    const fileLink = await bot.getFileLink(fileId);
    const response = await fetch(fileLink);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Transcribe voice message using OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: new File([buffer], 'voice-message.ogg', { type: 'audio/ogg' }),
      model: 'whisper-1',
    });
    
    const transcribedText = transcription.text || '';
    console.log(`Transcribed text: ${transcribedText}`);
    
    await generateAndRespond({
      chatId,
      userId,
      userText: transcribedText,
      replyToMessageId: msg.message_id,
      sourceLabel: 'Voice',
    });
  } catch (error) {
    console.error('Error processing voice message:', error);
    await bot.sendMessage(chatId, 'Sorry, I encountered an error processing your voice message.');
  }
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.on('webhook_error', (error) => {
  console.error('Webhook error:', error);
});

// Handle document messages
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const document = msg.document;
  
  // Проверяем тип файла
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowedTypes.includes(document.mime_type)) {
    await bot.sendMessage(chatId, 'Бот поддерживает только PDF и Word документы (.doc, .docx)');
    return;
  }
  
  try {
    // Отправляем статус "печатает"
    await bot.sendChatAction(chatId, 'typing');

    // Получаем ссылку на файл
    const fileLink = await bot.getFileLink(document.file_id);

    // Скачиваем файл
    const response = await fetch(fileLink);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Сохраняем файл на диск
    const fs = require('fs').promises;
    const path = require('path');
    const crypto = require('crypto');

    // Создаем уникальное имя файла на основе хеша
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const fileExt = path.extname(document.file_name);
    const savedFileName = `${fileHash}${fileExt}`;
    const uploadsDir = path.join(__dirname, '../uploads/documents');
    const filePath = path.join(uploadsDir, savedFileName);

    // Сохраняем файл
    await fs.writeFile(filePath, buffer);
    console.log(`📁 Файл сохранен: ${filePath}`);

    // Импортируем функцию обработки документов
    const { processCompanyDocument } = require('./company.document.processor');

    // Обрабатываем документ
    const result = await processCompanyDocument(
      buffer,
      document.file_name,
      {
        saveRawText: true,
        updateExisting: true,
        skipDuplicates: false,
        forceReprocess: false,
        storageUrl: filePath  // Передаем путь к сохраненному файлу
      }
    );
    
    // Отправляем результат пользователю
    if (result.status === 'success') {
      const company = result.company;
      const message = `
✓ Документ успешно обработан!

Компания: ${company.name_short || company.name_full}
ИНН: ${company.inn}
КПП: ${company.kpp || 'не указан'}
ОГРН: ${company.ogrn || 'не указан'}
Руководителю: ${company.ceo_name || 'не указан'}

Email: ${company.email && company.email.length > 0 ? company.email.join(', ') : 'не указан'}
Телефон: ${company.phone && company.phone.length > 0 ? company.phone.join(', ') : 'не указан'}
      `.trim();
      
      await bot.sendMessage(chatId, message);
    } else if (result.status === 'skipped') {
      await bot.sendMessage(chatId, '⚠ Этот документ уже был обработан ранее');
    } else {
      const errorMessage = result.error || 'Неизвестная ошибка при обработке документа';
      await bot.sendMessage(chatId, `✗ Ошибка при обработке документа: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Error processing document:', error);
    await bot.sendMessage(chatId, '✗ Произошла ошибка при обработке документа. Пожалуйста, попробуйте позже.');
  }
});

console.log('Bot is running and listening for messages...');
