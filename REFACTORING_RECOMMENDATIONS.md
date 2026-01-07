# Рекомендации по рефакторингу структуры проекта

## 📊 Текущая структура файлов

```
src/
├── index.js                          (468 строк) - Telegram бот + orchestration
├── companyDocumentProcessor.js       (273 строки) - Обработка документов компаний
├── companyExtractorAI.js            (222 строки) - AI извлечение данных компаний
├── dbService.js                     (273 строки) - PostgreSQL операции
├── documentExtractor.js             (194 строки) - Извлечение текста из PDF/DOC
├── qdrantService.js                 (263 строки) - Qdrant векторная БД
├── pdfService.js                    (216 строк) - Генерация PDF (общая)
├── offerPdfService.js               (91 строка) - Обработка потока КП
├── offerSheet.js                    (405 строк) - Рендеринг листа КП
└── offerUtils.js                    (148 строк) - Утилиты для КП
```

## ❌ Проблемы текущей структуры

### 1. **Неясное назначение файлов**
- `pdfService.js` vs `offerPdfService.js` vs `offerSheet.js` - какая разница?
- `companyDocumentProcessor.js` vs `companyExtractorAI.js` - непонятное разделение
- `index.js` - слишком общее название для бота

### 2. **Смешение ответственности**
- `index.js` содержит и Telegram бот, и бизнес-логику (468 строк!)
- Нет четкого разделения слоев (API, Business Logic, Data Access)

### 3. **Запутанные зависимости**
```
index.js
  ├── pdfService.js
  │   ├── offerSheet.js
  │   └── offerUtils.js
  ├── offerPdfService.js
  │   └── pdfService.js (циклическая зависимость?)
  ├── companyDocumentProcessor.js
  │   ├── documentExtractor.js
  │   ├── companyExtractorAI.js
  │   └── dbService.js
  ├── qdrantService.js
  └── dbService.js
```

---

## ✅ Рекомендуемая структура (Вариант 1: По слоям)

```
src/
├── bot/
│   ├── telegramBot.js                # Telegram Bot API (вместо index.js)
│   ├── messageHandlers.js            # Обработчики сообщений
│   └── commandHandlers.js            # Обработчики команд
│
├── services/                         # Бизнес-логика
│   ├── documentProcessing.js         # Обработка документов (вместо companyDocumentProcessor.js)
│   ├── aiExtractor.js                # AI извлечение (вместо companyExtractorAI.js)
│   └── offerGenerator.js             # Генерация КП (объединение pdfService + offerPdfService)
│
├── repositories/                     # Доступ к данным
│   ├── companyRepository.js          # Операции с компаниями (из dbService.js)
│   ├── documentRepository.js         # Операции с документами (из dbService.js)
│   └── vectorRepository.js           # Qdrant (вместо qdrantService.js)
│
├── utils/                            # Утилиты
│   ├── textExtractor.js              # Извлечение текста (вместо documentExtractor.js)
│   ├── pdfRenderer.js                # Рендеринг PDF (вместо offerSheet.js)
│   └── offerHelpers.js               # Утилиты КП (вместо offerUtils.js)
│
├── config/
│   ├── database.js                   # Конфигурация PostgreSQL
│   ├── qdrant.js                     # Конфигурация Qdrant
│   └── telegram.js                   # Конфигурация Telegram бота
│
└── index.js                          # Точка входа (минимальный!)
```

### Преимущества:
- ✅ Четкое разделение ответственности (SRP)
- ✅ Понятная структура по слоям
- ✅ Легко тестировать каждый слой отдельно
- ✅ Масштабируемость

### Недостатки:
- ❌ Больше файлов для навигации
- ❌ Длинные пути импорта

---

## ✅ Рекомендуемая структура (Вариант 2: По доменам) 🏆 **РЕКОМЕНДУЮ**

```
src/
├── telegram/
│   ├── bot.js                        # Telegram Bot (вместо index.js)
│   ├── handlers/
│   │   ├── messageHandler.js
│   │   └── documentHandler.js
│   └── commands/
│       └── index.js
│
├── companies/
│   ├── companyService.js             # Бизнес-логика компаний
│   ├── companyRepository.js          # PostgreSQL операции (из dbService.js)
│   ├── companySearchService.js       # Qdrant поиск (из qdrantService.js)
│   └── extractors/
│       ├── aiExtractor.js            # AI извлечение (companyExtractorAI.js)
│       └── documentExtractor.js      # Текст из PDF/DOC
│
├── documents/
│   ├── documentService.js            # Обработка документов
│   ├── documentRepository.js         # PostgreSQL операции
│   └── processors/
│       └── companyDocProcessor.js    # companyDocumentProcessor.js
│
├── offers/
│   ├── offerService.js               # Генерация КП (pdfService.js + offerPdfService.js)
│   ├── offerFlowHandler.js           # Telegram поток (offerPdfService.js)
│   ├── renderers/
│   │   └── offerSheetRenderer.js     # Рендеринг (offerSheet.js)
│   └── utils/
│       └── offerHelpers.js           # Утилиты (offerUtils.js)
│
├── shared/
│   ├── config/
│   │   ├── database.js
│   │   ├── qdrant.js
│   │   └── openai.js
│   └── utils/
│       ├── logger.js
│       └── errors.js
│
└── index.js                          # Точка входа
```

### Преимущества:
- ✅ **Интуитивно понятно** - каждая папка = бизнес-домен
- ✅ Легко найти код по функционалу
- ✅ Можно выделить в микросервис позже
- ✅ Новый разработчик быстро разберется
- ✅ Независимые модули (Domain-Driven Design)

### Недостатки:
- ❌ Может быть дублирование кода (решается shared/)

---

## 🎯 Минимальный рефакторинг (быстро внедрить)

Если полный рефакторинг пока не нужен, можно сделать **быстрое улучшение**:

### Шаг 1: Переименование файлов (без изменения структуры)

```bash
mv index.js telegram.bot.js
mv companyDocumentProcessor.js company.document.processor.js
mv companyExtractorAI.js company.ai.extractor.js
mv documentExtractor.js document.text.extractor.js
mv dbService.js database.service.js
mv qdrantService.js vector.search.service.js
mv pdfService.js offer.pdf.generator.js
mv offerPdfService.js offer.flow.handler.js
mv offerSheet.js offer.sheet.renderer.js
mv offerUtils.js offer.utils.js
```

### Результат:
```
src/
├── telegram.bot.js                   ✅ Понятно: Telegram бот
├── company.document.processor.js     ✅ Понятно: Обработка документов компаний
├── company.ai.extractor.js           ✅ Понятно: AI извлечение данных
├── document.text.extractor.js        ✅ Понятно: Извлечение текста из файлов
├── database.service.js               ✅ Понятно: Работа с PostgreSQL
├── vector.search.service.js          ✅ Понятно: Векторный поиск в Qdrant
├── offer.pdf.generator.js            ✅ Понятно: Генерация PDF КП
├── offer.flow.handler.js             ✅ Понятно: Обработка потока КП
├── offer.sheet.renderer.js           ✅ Понятно: Рендеринг листа КП
└── offer.utils.js                    ✅ Понятно: Утилиты для КП
```

**Плюсы:**
- ✅ Быстро (1 час работы)
- ✅ Не ломает архитектуру
- ✅ Сразу понятно назначение файлов
- ✅ Группировка по префиксам (company.*, offer.*, etc.)

**Минусы:**
- ❌ Не решает проблему смешанной ответственности
- ❌ Все еще 10 файлов в одной папке

---

## 📋 План внедрения

### Этап 1: Быстрое улучшение (1-2 часа)
1. Переименовать файлы по схеме выше
2. Обновить все `require()` импорты
3. Обновить `package.json` (main: telegram.bot.js)
4. Протестировать все функции

### Этап 2: Структурирование (1 день)
1. Создать папки по доменам (Вариант 2)
2. Переместить файлы в соответствующие папки
3. Обновить импорты
4. Создать barrel exports (index.js в каждой папке)

### Этап 3: Разделение ответственности (2-3 дня)
1. Разбить `telegram.bot.js` (468 строк) на модули
2. Разделить `database.service.js` на repositories
3. Объединить offer.* файлы в cohesive модуль
4. Добавить слой конфигурации

---

## 💡 Мои рекомендации

**Для вашего проекта предлагаю:**

1. **Сейчас (перед Docker):** Этап 1 - Быстрое переименование
   - Это улучшит читаемость без риска
   - Займет 1-2 часа
   - Поможет в документации для Docker

2. **После успешного деплоя:** Этап 2 - Структура по доменам
   - Когда проект стабильно работает на сервере
   - Будет легче масштабировать
   - Можно делать постепенно

3. **В будущем (при росте):** Этап 3 - Полный рефакторинг
   - Когда появятся новые фичи
   - Когда команда расширится
   - Когда потребуется высокая производительность

---

## ❓ Что делать?

Выберите один из вариантов:

**A) Минимальный рефакторинг** (рекомендую перед Docker)
- Я переименую файлы и обновлю импорты
- Займет ~1 час
- Низкий риск

**B) Полная реструктуризация** (Вариант 2 - по доменам)
- Создам новую структуру папок
- Перенесу и реорганизую код
- Займет ~1 день
- Средний риск

**C) Оставить как есть**
- Продолжим с текущей структурой
- Быстрее перейдем к Docker
- Технический долг останется

**Что выбираете?**
