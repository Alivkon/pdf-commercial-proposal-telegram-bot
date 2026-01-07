# Система обработки документов компаний

Автоматическая система для извлечения информации о компаниях из PDF и DOC файлов с использованием ChatGPT и сохранением в PostgreSQL базу данных.

## Возможности

- 📄 **Извлечение текста** из PDF и DOC/DOCX файлов
- 🤖 **Анализ с помощью ChatGPT** для структурированного извлечения данных
- 🗄️ **Автоматическое сохранение** в PostgreSQL базу данных
- 🔍 **Дедупликация** по хешу файла (SHA256)
- ✅ **Валидация** извлеченных данных (ИНН, КПП, ОГРН и т.д.)
- 🔄 **Обновление** существующих записей компаний
- 📦 **Пакетная обработка** множества файлов
- 📊 **Метрики уверенности** для каждого извлеченного поля

## Структура проекта

```
src/
├── dbService.js                    # Работа с PostgreSQL БД
├── documentExtractor.js            # Извлечение текста из PDF/DOC
├── companyExtractorAI.js           # Анализ текста через ChatGPT
└── companyDocumentProcessor.js     # Основной обработчик (главный файл)

examples/
└── processCompanyDocumentExample.js # Примеры использования

db/
└── schema.sql                      # Схема базы данных
```

## Установка

### 1. Установка зависимостей

```bash
yarn install
```

Основные пакеты:
- `pg` - PostgreSQL клиент
- `pdf-parse` - парсинг PDF
- `mammoth` - парсинг DOC/DOCX
- `openai` - ChatGPT API

### 2. Настройка базы данных

Создайте PostgreSQL базу данных и выполните схему:

```bash
psql -U postgres -d your_database -f db/schema.sql
```

Или если используете Docker:

```bash
docker-compose up -d
yarn run db:init
```

### 3. Настройка переменных окружения

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Заполните необходимые переменные:

```env
# OpenAI API Key (обязательно)
OPENAI_API_KEY=sk-your-api-key-here

# PostgreSQL (обязательно)
DATABASE_URL=postgresql://user:password@localhost:5432/database_name

# Или отдельные параметры
POSTGRES_USER=elter
POSTGRES_PASSWORD=elterpass
POSTGRES_DB=elter_db
POSTGRES_PORT=5432
```

## Использование

### Быстрый старт

```javascript
const { processCompanyDocument } = require('./src/companyDocumentProcessor');
const { closePool } = require('./src/dbService');

async function main() {
  // Обработать один файл
  const result = await processCompanyDocument('Карточка_компании.pdf');

  if (result.status === 'success') {
    console.log('Компания:', result.company.name_short);
    console.log('ИНН:', result.company.inn);
  }

  await closePool();
}

main();
```

### Пример 1: Обработка одного документа

```javascript
const result = await processCompanyDocument(
  'Карточка_компании_ЭВОЛЮЦИЯ_ЗАРЯДА.pdf',
  null,
  {
    saveRawText: true,        // Сохранить исходный текст
    updateExisting: true,     // Обновить существующую компанию
    skipDuplicates: false,    // Не пропускать дубликаты
    forceReprocess: false     // Не форсировать повторную обработку
  }
);
```

### Пример 2: Пакетная обработка

```javascript
const { processMultipleDocuments } = require('./src/companyDocumentProcessor');

const files = [
  'doc1.pdf',
  'doc2.doc',
  'doc3.pdf'
];

const results = await processMultipleDocuments(files, {
  saveRawText: false,
  updateExisting: true,
  skipDuplicates: true,
  delayBetweenRequests: 1000  // Пауза между запросами к ChatGPT
});

console.log(`Успешно: ${results.successful}`);
console.log(`Ошибок: ${results.failed}`);
```

### Пример 3: Обработка буфера (из Telegram или HTTP)

```javascript
// Получен буфер файла (например, из Telegram бота)
const buffer = await downloadFileFromTelegram(fileId);

const result = await processCompanyDocument(
  buffer,
  'company_card.pdf',  // Имя файла обязательно при передаче буфера
  {
    saveRawText: false,
    updateExisting: true
  }
);
```

### Пример 4: Использование разных моделей ChatGPT

```javascript
const result = await processCompanyDocument('document.pdf', null, {
  model: 'gpt-4o',           // Более точная модель (дороже)
  temperature: 0.0,           // Минимальная креативность
  saveRawText: true
});

console.log('Использовано токенов:', result.metadata.tokens_used);
console.log('Уверенность:', result.extractedData.confidence.overall);
```

## Извлекаемые данные

Система извлекает следующие поля о компании:

| Поле | Описание | Обязательное |
|------|----------|--------------|
| `name_full` | Полное наименование организации | Нет |
| `name_short` | Краткое наименование | Нет |
| `inn` | ИНН (10 или 12 цифр) | **Да** |
| `kpp` | КПП (9 цифр) | Нет |
| `ogrn` | ОГРН (13 или 15 цифр) | Нет |
| `okpo` | ОКПО | Нет |
| `oktmo` | ОКТМО | Нет |
| `legal_address` | Юридический адрес | Нет |
| `actual_address` | Фактический адрес | Нет |
| `email` | Массив email адресов | Нет |
| `phone` | Массив телефонов | Нет |
| `ceo_name` | ФИО руководителя | Нет |

## Структура результата

```javascript
{
  status: 'success',              // 'success' | 'error' | 'skipped'
  company: {                      // Запись из таблицы company
    id: 'uuid',
    name_full: '...',
    name_short: '...',
    inn: '...',
    // ... остальные поля
  },
  document: {                     // Запись из таблицы company_document
    id: 'uuid',
    company_id: 'uuid',
    file_name: '...',
    file_sha256: '...',
    // ... остальные поля
  },
  extractedData: {                // Извлеченные данные
    name_full: '...',
    inn: '...',
    confidence: {
      inn: 0.95,
      name: 0.90,
      address: 0.85,
      overall: 0.90
    }
  },
  validation: {                   // Результат валидации
    isValid: true,
    errors: [],
    warnings: ['...']
  },
  metadata: {                     // Метаданные обработки
    model: 'gpt-4o-mini',
    prompt_version: '1.0.0',
    tokens_used: 1523
  },
  processingTime: 3421           // Время обработки в мс
}
```

## Опции обработки

| Опция | Тип | По умолчанию | Описание |
|-------|-----|--------------|----------|
| `saveRawText` | boolean | false | Сохранять исходный текст документа в БД |
| `updateExisting` | boolean | false | Обновлять данные существующей компании |
| `skipDuplicates` | boolean | false | Пропускать уже обработанные файлы (по SHA256) |
| `forceReprocess` | boolean | false | Принудительно переобработать даже если файл уже был обработан |
| `model` | string | 'gpt-4o-mini' | Модель ChatGPT для использования |
| `temperature` | number | 0.1 | Креативность модели (0-1) |
| `includeRawText` | boolean | false | Включить сырой текст в результат |
| `storageUrl` | string | null | URL хранилища файла (если загружен в S3 и т.д.) |
| `delayBetweenRequests` | number | 0 | Задержка между запросами в мс (для пакетной обработки) |

## Схема базы данных

### Таблица `company`

Хранит информацию о компаниях.

**Особенности:**
- Уникальность по паре `(inn, kpp)`
- Если КПП = NULL, то уникальность только по ИНН
- Автоматическое обновление поля `updated_at` при изменении записи

### Таблица `company_document`

Хранит обработанные документы.

**Особенности:**
- Связь с компанией через `company_id` (nullable)
- Хранение SHA256 хеша для дедупликации
- JSONB поля для хранения извлеченных данных и метрик уверенности
- Версионирование модели и промпта

## Валидация данных

Система автоматически валидирует извлеченные данные:

✅ **Проверки:**
- ИНН: 10 или 12 цифр
- КПП: 9 цифр
- ОГРН: 13 или 15 цифр
- Email: корректный формат
- Наличие обязательного ИНН

⚠️ **Предупреждения** выводятся в консоль, но не блокируют обработку

❌ **Ошибки** блокируют сохранение в БД

## Примеры запуска

```bash
# Запустить пример обработки одного файла
node examples/processCompanyDocumentExample.js

# Или через yarn
yarn run process:example
```

## API Reference

### `processCompanyDocument(filePathOrBuffer, fileName, options)`

Обработка одного документа о компании.

**Параметры:**
- `filePathOrBuffer` (string|Buffer) - путь к файлу или буфер
- `fileName` (string, optional) - имя файла (обязательно при передаче буфера)
- `options` (object, optional) - опции обработки

**Возвращает:** Promise<object> - результат обработки

### `processMultipleDocuments(filePaths, options)`

Пакетная обработка нескольких документов.

**Параметры:**
- `filePaths` (Array<string>) - массив путей к файлам
- `options` (object, optional) - опции обработки

**Возвращает:** Promise<object> - сводные результаты

### `exportCompanyData(companyId)`

Экспорт всех данных компании со всеми документами.

**Параметры:**
- `companyId` (string) - UUID компании

**Возвращает:** Promise<object> - данные компании и документов

## Интеграция с Telegram ботом

```javascript
// В обработчике документов Telegram бота
bot.on('document', async (msg) => {
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;

  // Скачиваем файл
  const file = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const response = await fetch(fileUrl);
  const buffer = await response.buffer();

  // Обрабатываем
  const result = await processCompanyDocument(buffer, fileName, {
    updateExisting: true,
    skipDuplicates: true
  });

  if (result.status === 'success') {
    await bot.sendMessage(
      msg.chat.id,
      `✓ Компания "${result.company.name_short}" добавлена в базу`
    );
  }
});
```

## Обработка ошибок

```javascript
try {
  const result = await processCompanyDocument('file.pdf');

  if (result.status === 'error') {
    console.error('Ошибка:', result.error);
    console.error('Причина:', result.reason);
  } else if (result.status === 'skipped') {
    console.log('Файл пропущен:', result.reason);
  }
} catch (error) {
  console.error('Критическая ошибка:', error);
} finally {
  await closePool();
}
```

## Стоимость использования

При использовании `gpt-4o-mini` (по умолчанию):
- Входящие токены: ~$0.15 / 1M токенов
- Исходящие токены: ~$0.60 / 1M токенов
- Средний документ: ~1000-2000 токенов
- **Стоимость обработки одного документа: ~$0.001-0.003** (меньше цента)

При использовании `gpt-4o`:
- Входящие токены: ~$2.50 / 1M токенов
- Исходящие токены: ~$10.00 / 1M токенов
- **Стоимость обработки одного документа: ~$0.01-0.02**

## Производительность

- Извлечение текста из PDF: ~100-500мс
- Запрос к ChatGPT: ~1000-3000мс
- Сохранение в БД: ~50-200мс
- **Общее время обработки: ~1-4 секунды на документ**

## Troubleshooting

### Ошибка подключения к БД

Убедитесь, что PostgreSQL запущен и `DATABASE_URL` правильно настроен:

```bash
psql $DATABASE_URL -c "SELECT 1"
```

### Ошибка OpenAI API

Проверьте наличие и корректность API ключа:

```bash
echo $OPENAI_API_KEY
```

### Низкая уверенность в результатах

Попробуйте использовать более мощную модель:

```javascript
const result = await processCompanyDocument('file.pdf', null, {
  model: 'gpt-4o',
  temperature: 0.0
});
```

## Лицензия

MIT
