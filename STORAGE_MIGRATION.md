# Миграция хранения файлов

## Изменения (2025-12-29)

**До:** Файлы обрабатывались в памяти, на диск НЕ сохранялись
**После:** Файлы сохраняются в `uploads/documents/` и доступны для скачивания

## Что изменилось

### Telegram бот ([src/telegram.bot.js:537-551](src/telegram.bot.js#L537-L551))

```javascript
// Теперь сохраняем файл на диск
const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
const savedFileName = `${fileHash}${fileExt}`;
const filePath = path.join(__dirname, '../uploads/documents', savedFileName);

await fs.writeFile(filePath, buffer);

// Передаем путь в processCompanyDocument
const result = await processCompanyDocument(buffer, document.file_name, {
  storageUrl: filePath  // ← Новый параметр
});
```

### Веб-интерфейс

Автоматически определяет доступность файла:
- Если `storage_url` != NULL → показывает кнопку "⬇ Скачать"
- Если `storage_url` == NULL → показывает "📝 Только данные"

## Старые документы

Документы, загруженные до 2025-12-29, имеют `storage_url = NULL`.

### Вариант 1: Оставить как есть

Старые документы будут помечены как "Только данные" в веб-интерфейсе.
Скачивание недоступно, но данные извлечены и сохранены в БД.

### Вариант 2: Переотправить через бота

Если нужен физический файл:
1. Найдите оригинал документа
2. Отправьте его заново через Telegram бота
3. Система автоматически обновит запись компании
4. Файл будет сохранен, `storage_url` обновится

## Новые документы

Все документы, отправленные после обновления:
- ✅ Автоматически сохраняются на диск
- ✅ Доступны для скачивания через веб-интерфейс
- ✅ Имеют валидный `storage_url`

## Проверка

Проверить, сколько документов без файлов:

```sql
SELECT
  COUNT(*) FILTER (WHERE storage_url IS NULL) as without_file,
  COUNT(*) FILTER (WHERE storage_url IS NOT NULL) as with_file,
  COUNT(*) as total
FROM company_document;
```

Список компаний без файлов:

```sql
SELECT
  c.name_short,
  cd.file_name,
  cd.created_at
FROM company_document cd
JOIN company c ON cd.company_id = c.id
WHERE cd.storage_url IS NULL
ORDER BY cd.created_at DESC;
```

## Резервное копирование

⚠️ **Важно:** Настройте регулярный бэкап папки `uploads/`

```bash
# Пример ежедневного бэкапа
tar -czf backup-$(date +%Y%m%d).tar.gz uploads/
```

---

**Дата миграции:** 2025-12-29
**Обратная совместимость:** Полная (старые документы продолжают работать)
