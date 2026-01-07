# Справочник файлов проекта

## Быстрый поиск файла по функции

| Что нужно сделать | Какой файл открыть |
|-------------------|-------------------|
| **Telegram бот** |
| Изменить логику бота | `src/telegram.bot.js` |
| Добавить новую команду | `src/telegram.bot.js` |
| Изменить обработку сообщений | `src/telegram.bot.js` |
| **Компании** |
| Обработка документов компаний | `src/company.document.processor.js` |
| AI извлечение данных | `src/company.ai.extractor.js` |
| **Документы** |
| Извлечение текста из PDF/DOC | `src/document.text.extractor.js` |
| **База данных** |
| Операции с PostgreSQL | `src/database.service.js` |
| Векторный поиск в Qdrant | `src/vector.search.service.js` |
| **Коммерческие предложения** |
| Генерация PDF | `src/offer.pdf.generator.js` |
| Обработка потока в Telegram | `src/offer.flow.handler.js` |
| Рендеринг листа КП | `src/offer.sheet.renderer.js` |
| Утилиты для КП | `src/offer.utils.js` |

## Группировка файлов

### 🤖 Telegram
- `telegram.bot.js` - главный файл бота

### 🏢 Компании
- `company.document.processor.js` - обработка документов
- `company.ai.extractor.js` - AI извлечение данных

### 📄 Документы
- `document.text.extractor.js` - извлечение текста

### 💾 Данные
- `database.service.js` - PostgreSQL
- `vector.search.service.js` - Qdrant

### 📋 Коммерческие предложения
- `offer.pdf.generator.js` - генерация PDF
- `offer.flow.handler.js` - обработка потока
- `offer.sheet.renderer.js` - рендеринг
- `offer.utils.js` - утилиты

## Карта импортов

```javascript
// Telegram бот
require('./telegram.bot')

// Компании
require('./company.document.processor')
require('./company.ai.extractor')

// Документы
require('./document.text.extractor')

// База данных
require('./database.service')
require('./vector.search.service')

// Коммерческие предложения
require('./offer.pdf.generator')
require('./offer.flow.handler')
require('./offer.sheet.renderer')
require('./offer.utils')
```
