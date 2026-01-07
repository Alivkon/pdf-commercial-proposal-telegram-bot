# Интеграция с Qdrant для поиска компаний

## Описание

Система автоматически добавляет эмбеддинги компаний в векторную базу данных Qdrant при создании или обновлении компании в PostgreSQL. Это позволяет выполнять семантический поиск компаний по названию, ИНН, имени руководителя, email и другим параметрам.

## Архитектура

```
┌─────────────────┐
│  Telegram Bot   │
│   (Document)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Document        │
│ Processor       │
└────────┬────────┘
         │
         ├──────────────────┐
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │     Qdrant      │
│   (Компании)    │  │  (Эмбеддинги)   │
└─────────────────┘  └─────────────────┘
         │                  │
         └──────┬───────────┘
                ▼
         Поиск компаний
```

## Что сохраняется в Qdrant

При добавлении компании в Qdrant сохраняются:

### Эмбеддинг генерируется из:
```javascript
{
  text: "name_short | name_full | ИНН inn | Руководитель ceo_name | email"
}
```

**Пример:**
```
"ООО «ЭВОЛЮЦИЯ ЗАРЯДА» | Общество с ограниченной ответственностью «ЭВОЛЮЦИЯ ЗАРЯДА» | ИНН 9725105960 | Руководитель Крапивной Михаил Михайлович | info@theedison.io"
```

### Payload (метаданные):
```javascript
{
  id: "uuid",                    // ID компании из PostgreSQL
  name_short: "string",          // Краткое название
  name_full: "string",           // Полное название
  inn: "string",                 // ИНН
  kpp: "string",                 // КПП
  ceo_name: "string",            // ФИО руководителя
  ceo_name_dative: "string",     // ФИО в дательном падеже
  email: ["string"],             // Массив email
  phone: ["string"],             // Массив телефонов
  legal_address: "string",       // Юридический адрес
  actual_address: "string",      // Фактический адрес
  created_at: "ISO string",      // Дата создания
  display_text: "string"         // Текст для отображения
}
```

## Конфигурация

### Переменные окружения (.env)

```env
# Qdrant configuration
QDRANT_URL=https://your-qdrant-endpoint:6333
QDRANT_API_KEY=your_api_key_here
QDRANT_COLLECTION_PRICE_FIRMS_LIST=elter_organisation_list

# OpenAI для эмбеддингов
OPENAI_API_KEY=sk-your-openai-api-key
```

### Параметры коллекции Qdrant

- **Коллекция:** `elter_organisation_list`
- **Размер вектора:** 1536 (text-embedding-3-small)
- **Метрика расстояния:** Cosine
- **ID точек:** UUID компании из PostgreSQL

## Автоматическая интеграция

### При создании компании

```javascript
// src/dbService.js - функция createCompany()
const company = await createCompany(companyData);
// Автоматически вызывается:
await addCompanyToQdrant(company);
```

### При обновлении компании

```javascript
// src/dbService.js - функция updateCompany()
const company = await updateCompany(companyId, updates);
// Автоматически вызывается:
await updateCompanyInQdrant(company);
```

### Поток данных

```
PDF/DOC файл
    ↓
Извлечение текста
    ↓
ChatGPT (структурирование)
    ↓
PostgreSQL (сохранение компании)
    ↓
OpenAI API (получение эмбеддинга)
    ↓
Qdrant (сохранение векторов)
```

## API функции

### Добавление компании

```javascript
const { addCompanyToQdrant } = require('./src/qdrantService');

await addCompanyToQdrant(company);
```

### Обновление компании

```javascript
const { updateCompanyInQdrant } = require('./src/qdrantService');

await updateCompanyInQdrant(company);
```

### Поиск компаний

```javascript
const { searchCompaniesInQdrant } = require('./src/qdrantService');

const results = await searchCompaniesInQdrant('Энерком', 5);
// Возвращает:
[
  {
    id: "uuid",
    score: 0.499,  // Релевантность (0-1)
    company: {
      id: "uuid",
      name_short: "«Энерком Альянс»",
      inn: "4028058015",
      email: ["lamer2007@list.ru"],
      // ... остальные поля
    }
  }
]
```

### Получение статистики

```javascript
const { getFirmsCollectionStats } = require('./src/qdrantService');

const stats = await getFirmsCollectionStats();
// Возвращает:
{
  name: "elter_organisation_list",
  points_count: 2,
  vectors_count: 2,
  status: "green"
}
```

## Примеры поиска

### Поиск по названию компании

```javascript
const results = await searchCompaniesInQdrant('ЭВОЛЮЦИЯ ЗАРЯДА', 5);
// Релевантность: ~54.7%
```

### Поиск по ИНН

```javascript
const results = await searchCompaniesInQdrant('ИНН 9725105960', 1);
// Релевантность: ~40.0%
```

### Поиск по имени руководителя

```javascript
const results = await searchCompaniesInQdrant('Крапивной Михаил', 3);
// Релевантность: ~40.6%
```

### Поиск по email

```javascript
const results = await searchCompaniesInQdrant('info@theedison.io', 1);
// Релевантность: ~58.7%
```

### Семантический поиск

```javascript
const results = await searchCompaniesInQdrant('зарядные станции москва', 5);
// Найдет компании, связанные с зарядными станциями
// Релевантность: ~28.6%
```

## Утилиты и скрипты

### Синхронизация существующих компаний

Если компании уже были в PostgreSQL до внедрения Qdrant интеграции:

```bash
node sync-companies-to-qdrant.js
```

Скрипт:
- Получает все компании из PostgreSQL
- Генерирует эмбеддинги для каждой
- Добавляет в Qdrant
- Выводит статистику

### Тестирование интеграции

```bash
# Полный тест интеграции
node test-qdrant-integration.js

# Тест поиска
node test-search-qdrant.js
```

## Производительность

### Время обработки

- Генерация эмбеддинга (OpenAI): ~500-1000мс
- Сохранение в Qdrant: ~100-200мс
- **Общее время добавления:** ~600-1200мс

### Стоимость

**OpenAI text-embedding-3-small:**
- $0.02 / 1M токенов
- Средний текст компании: ~100 токенов
- **Стоимость на компанию:** ~$0.000002 (менее цента за 1000 компаний)

### Точность поиска

Тестовые результаты релевантности:

| Тип запроса | Релевантность |
|-------------|---------------|
| Email (точный) | 54-58% |
| Название компании | 33-55% |
| ИНН | 40-42% |
| Имя руководителя | 25-42% |
| Семантический поиск | 18-29% |

## Обработка ошибок

### Ошибки при добавлении в Qdrant

Система **не блокирует** сохранение компании в PostgreSQL при ошибке добавления в Qdrant:

```javascript
try {
  await addCompanyToQdrant(company);
} catch (error) {
  console.warn(`⚠ Не удалось добавить компанию в Qdrant: ${error.message}`);
  // Компания остается в PostgreSQL
}
```

### Проверка доступности Qdrant

```javascript
const { ensureFirmsCollectionExists } = require('./src/qdrantService');

try {
  await ensureFirmsCollectionExists();
  console.log('✓ Qdrant доступен');
} catch (error) {
  console.error('✗ Qdrant недоступен:', error.message);
}
```

## Мониторинг

### Проверка количества компаний

```bash
# PostgreSQL
psql $DATABASE_URL -c "SELECT COUNT(*) FROM company;"

# Qdrant
node -e "require('./src/qdrantService').getFirmsCollectionStats().then(console.log)"
```

### Проверка синхронизации

Количество точек в Qdrant должно совпадать с количеством компаний в PostgreSQL.

## Использование в Telegram боте

### Автоматическое добавление

При загрузке документа в Telegram бот:

1. Пользователь отправляет PDF/DOC
2. Документ обрабатывается → компания создается в PostgreSQL
3. **Автоматически** компания добавляется в Qdrant
4. Пользователь получает подтверждение

### Поиск компаний через бота (опционально)

Можно добавить команду для поиска:

```javascript
bot.onText(/\/search (.+)/, async (msg, match) => {
  const query = match[1];
  const results = await searchCompaniesInQdrant(query, 5);

  let response = `Найдено компаний: ${results.length}\n\n`;
  results.forEach((r, i) => {
    response += `${i+1}. ${r.company.name_short}\n`;
    response += `   ИНН: ${r.company.inn}\n`;
    response += `   Релевантность: ${(r.score*100).toFixed(1)}%\n\n`;
  });

  bot.sendMessage(msg.chat.id, response);
});
```

## Troubleshooting

### Компания не найдена в Qdrant

1. Проверьте, что компания есть в PostgreSQL
2. Запустите синхронизацию: `node sync-companies-to-qdrant.js`
3. Проверьте статистику коллекции

### Низкая релевантность поиска

- Релевантность зависит от качества текста эмбеддинга
- Для точного поиска по ИНН используйте префикс "ИНН"
- Для поиска по email указывайте полный адрес

### Ошибка "Collection not found"

Коллекция создается автоматически при первом добавлении. Если ошибка:

```javascript
const { ensureFirmsCollectionExists } = require('./src/qdrantService');
await ensureFirmsCollectionExists();
```

## Лицензия

MIT

---

**Дата:** 2025-12-24
**Версия:** 1.0.0
