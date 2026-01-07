# ✅ Обновление: Сохранение файлов на диск

**Дата:** 2025-12-29
**Версия:** 1.2.0

## Что изменилось

### 1. Файлы теперь сохраняются физически

**Раньше:**
- Файлы обрабатывались только в памяти
- После обработки удалялись
- Скачать карточку компании было невозможно

**Теперь:**
- Все файлы сохраняются в папку `uploads/documents/`
- Доступны для скачивания через веб-интерфейс
- Имя файла = SHA256 хеш (защита от дубликатов)

### 2. Веб-интерфейс различает доступность файлов

**Новые документы** (с файлом):
```
📄 Карточка_компании_Пример.pdf
   Компания: ООО «Пример»
   Дата: 29.12.2025
   [⬇ Скачать]  ← Кликабельная кнопка
```

**Старые документы** (без файла):
```
📄 Карточка_компании_Старая.pdf
   Компания: ООО «Старая»
   Дата: 24.12.2025
   [📝 Только данные]  ← Некликабельная метка
```

## Технические детали

### Изменения в коде

#### 1. Telegram бот - сохранение файлов
[src/telegram.bot.js](src/telegram.bot.js#L537-L566)

```javascript
// Сохраняем файл на диск
const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
const savedFileName = `${fileHash}${fileExt}`;
const filePath = path.join(__dirname, '../uploads/documents', savedFileName);

await fs.writeFile(filePath, buffer);
console.log(`📁 Файл сохранен: ${filePath}`);

// Передаем путь в обработчик
const result = await processCompanyDocument(buffer, document.file_name, {
  saveRawText: true,
  updateExisting: true,
  skipDuplicates: false,
  forceReprocess: false,
  storageUrl: filePath  // ← Новый параметр
});
```

#### 2. Веб-интерфейс - условное отображение
[web/index.html](web/index.html#L362-L369)

```javascript
// Кнопка скачивания доступна только если файл сохранен
const downloadButton = doc.storage_url ?
    `<button class="document-download" onclick="downloadDocument('${doc.id}')">
        ⬇ Скачать
    </button>` :
    `<span class="document-unavailable" title="Файл не сохранен на сервере">
        📝 Только данные
    </span>`;
```

#### 3. Новые стили
[web/styles.css](web/styles.css#L370-L379)

```css
.document-unavailable {
    background: #e9ecef;
    color: #6c757d;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: help;
}
```

### Структура хранения

```
uploads/
└── documents/
    ├── da9e69aaf24f437f3cdb97192649cb9134b275b434cd7c0cbb49e336432c1fe4.pdf
    ├── 8f3b2c1a9d7e6f5c4b3a2d1e0f9c8b7a6d5e4f3c2b1a0d9e8f7c6b5a4d3e2f1c0.doc
    └── ...
```

**Преимущества такого подхода:**
- Автоматическое избежание дубликатов (одинаковые файлы → один хеш)
- Безопасные имена файлов (только hex символы)
- Легко найти файл по `file_sha256` из БД

## Использование

### Загрузка нового документа

1. Отправьте PDF или DOC файл боту в Telegram
2. Бот обработает и сохранит файл автоматически
3. В веб-интерфейсе появится кнопка "⬇ Скачать"

### Просмотр в веб-интерфейсе

1. Откройте http://localhost:3000
2. Кликните на компанию или "Документов"
3. Увидите список с кнопками скачивания

### Скачивание файла

Просто кликните "⬇ Скачать" → файл загрузится с оригинальным именем

## Обратная совместимость

✅ **Полная совместимость**

Старые документы (до 2025-12-29):
- Продолжают работать
- Данные извлечены и сохранены в БД
- Просто нет физического файла для скачивания
- Отображаются с меткой "📝 Только данные"

Если нужен файл старого документа:
- Отправьте его заново через бота
- Система обновит запись
- Файл станет доступен для скачивания

## Статистика

Проверить количество документов:

```bash
curl -s http://localhost:3000/api/documents | \
  jq '[.[] | select(.storage_url != null)] | length' \
  && echo "документов с файлами"

curl -s http://localhost:3000/api/documents | \
  jq '[.[] | select(.storage_url == null)] | length' \
  && echo "документов без файлов"
```

## Резервное копирование

⚠️ **Важно:** Регулярно делайте бэкап папки `uploads/`

```bash
# Ручной бэкап
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# Или автоматически (cron)
0 3 * * * cd /path/to/project && tar -czf backups/uploads-$(date +\%Y\%m\%d).tar.gz uploads/
```

## Файлы изменены

- ✅ [src/telegram.bot.js](src/telegram.bot.js) - добавлено сохранение файлов
- ✅ [web/index.html](web/index.html) - условное отображение кнопки
- ✅ [web/styles.css](web/styles.css) - стили для "недоступных" файлов
- ✅ [web/DOCUMENTS_FEATURE.md](web/DOCUMENTS_FEATURE.md) - обновлена документация
- ✅ [uploads/README.md](uploads/README.md) - создано
- ✅ [STORAGE_MIGRATION.md](STORAGE_MIGRATION.md) - руководство по миграции
- ✅ [.gitignore](.gitignore) - добавлено `uploads/`

---

**Статус:** ✅ Готово к использованию
**Тестирование:** Отправьте новый документ боту для проверки
