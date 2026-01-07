# Счётчик и просмотр коммерческих предложений

**Дата добавления:** 2025-12-29
**Обновлено:** 2025-12-29 (добавлен функционал просмотра и скачивания)

## Описание

К статистике веб-интерфейса добавлен счётчик сгенерированных коммерческих предложений с возможностью просмотра списка и скачивания файлов.

## Как работает

### Подсчёт файлов

Счётчик подсчитывает PDF файлы в папке `src/pdfs/`:
- Фильтр: файлы начинающиеся с `commercial_offer_`
- Формат: `commercial_offer_2025-12-25T13-07-21-836Z.pdf`

### Отображение

Статистика теперь показывает 4 показателя:
1. **Всего компаний** - количество компаний в БД
2. **Документов** - количество карточек компаний (кликабельно - открывает список)
3. **Коммерческих предложений** - количество сгенерированных КП (кликабельно - открывает список)
4. **Последнее обновление** - время последней загрузки данных

### Просмотр списка КП

При клике на блок "Коммерческих предложений":
- Открывается всплывающее окно с полным списком КП
- Для каждого КП показывается:
  - Название файла
  - Размер файла
  - Дата и время создания
  - Кнопка "⬇ Скачать"
- Список отсортирован по дате (новые первыми)

## Технические детали

### Изменения в server.js

```javascript
// Подсчет коммерческих предложений
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
  totalOffers: totalOffers  // ← Новое поле
};
```

### Изменения в index.html

**HTML блок:**
```html
<div class="stat-item">
    <span class="stat-value" id="totalOffers">-</span>
    <span class="stat-label">Коммерческих предложений</span>
</div>
```

**JavaScript обновление:**
```javascript
document.getElementById('totalOffers').textContent = data.totalOffers || 0;
```

## API Endpoints

### GET /api/companies

Получение компаний с общей статистикой:

```json
{
  "companies": [...],
  "total": 2,
  "totalDocuments": 13,
  "totalOffers": 4  // ← Новое поле
}
```

### GET /api/offers

Получение списка всех коммерческих предложений:

```json
[
  {
    "fileName": "commercial_offer_2025-12-25T13-07-21-836Z.pdf",
    "filePath": "/path/to/file.pdf",
    "fileSize": 1252060,
    "createdAt": "2025-12-25T13:07:21.963Z",
    "displayDate": "2025:12:25 13:07:21"
  },
  ...
]
```

### GET /api/download/offer/:fileName

Скачивание коммерческого предложения по имени файла:
- Параметр: `fileName` - имя файла (URL-encoded)
- Ответ: PDF файл с заголовком `Content-Disposition: attachment`
- Безопасность: проверка на выход за пределы директории `src/pdfs/`

## Пример текущих данных

```bash
$ curl -s http://localhost:3000/api/companies | jq '{total, totalDocuments, totalOffers}'
{
  "total": 2,
  "totalDocuments": 13,
  "totalOffers": 4
}
```

## Обработка ошибок

Если папка `src/pdfs/` недоступна:
- В консоль выводится предупреждение
- `totalOffers` = 0
- Веб-интерфейс показывает "0"

## Использование

1. **Посмотреть список КП:**
   - Откройте http://localhost:3000
   - Кликните на блок "Коммерческих предложений" в статистике

2. **Скачать КП:**
   - В открывшемся окне нажмите "⬇ Скачать" у нужного файла
   - Файл загрузится с оригинальным именем

## Файлы изменены

- ✅ [web/server.js](server.js#L60-L70) - добавлен подсчёт КП
- ✅ [web/server.js](server.js#L137-L172) - добавлена функция getAllOffers()
- ✅ [web/server.js](server.js#L246-L265) - добавлен endpoint /api/offers
- ✅ [web/server.js](server.js#L267-L308) - добавлен endpoint /api/download/offer/:fileName
- ✅ [web/index.html](index.html#L25-L28) - добавлен HTML блок, сделан кликабельным
- ✅ [web/index.html](index.html#L109-L112) - добавлен обработчик клика
- ✅ [web/index.html](index.html#L405-L476) - добавлены функции showAllOffers(), renderOffers(), downloadOffer()

---

**Статус:** ✅ Полностью работает
**Версия:** 1.3.0
