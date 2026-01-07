# 🌐 Веб-интерфейс базы компаний

Веб-страница для просмотра компаний из PostgreSQL базы данных.

## 📋 Возможности

- ✅ Просмотр всех компаний в виде таблицы
- ✅ Поиск в реальном времени по всем полям
- ✅ Сортировка по любой колонке
- ✅ Статистика (количество компаний и документов)
- ✅ Адаптивный дизайн (работает на мобильных)
- ✅ Автоматическое обновление данных

## 🚀 Запуск

### Вариант 1: Простой запуск

```bash
node web/server.js
```

Сервер запустится на http://localhost:3000

### Вариант 2: С настройкой порта

```bash
WEB_PORT=8080 node web/server.js
```

### Вариант 3: С PM2 (для продакшна)

```bash
pm2 start web/server.js --name elter-web
pm2 save
```

## 🔧 Настройка

Переменные окружения (необязательно):

```bash
WEB_PORT=3000        # Порт сервера (по умолчанию 3000)
WEB_HOST=0.0.0.0     # Хост (по умолчанию 0.0.0.0)
```

## 📂 Структура

```
web/
├── index.html       # Главная страница (фронтенд)
├── server.js        # HTTP сервер + API
└── README.md        # Документация
```

## 🔌 API Endpoints

### GET /api/companies

Возвращает список всех компаний из БД.

**Пример ответа:**

```json
{
  "companies": [
    {
      "id": "uuid",
      "name_short": "«Энерком Альянс»",
      "name_full": "ООО «Энерком Альянс»",
      "inn": "4028058015",
      "kpp": "402901001",
      "ogrn": "1234567890123",
      "ceo_name": "Ахметшину Альберту Ренатовичу",
      "email": ["info@company.ru"],
      "phone": ["+7 999 123-45-67"],
      "created_at": "2025-12-24T10:00:00Z"
    }
  ],
  "total": 2,
  "totalDocuments": 5
}
```

## 🎨 Функции интерфейса

### Поиск

Введите текст в поле поиска для фильтрации по:
- Названию компании
- ИНН
- КПП
- ОГРН
- Имени руководителя

### Сортировка

Кликните на заголовок колонки для сортировки:
- Первый клик - сортировка по возрастанию ↑
- Второй клик - сортировка по убыванию ↓

### Обновление данных

Нажмите кнопку "🔄 Обновить" для перезагрузки данных из БД.

## 🌍 Деплой на сервер

### Nginx (рекомендуется)

1. Запустите сервер на порту 3000:
   ```bash
   pm2 start web/server.js --name elter-web
   ```

2. Настройте Nginx как reverse proxy:

```nginx
server {
    listen 80;
    server_name companies.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

3. Перезагрузите Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Apache

```apache
<VirtualHost *:80>
    ServerName companies.your-domain.com

    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
</VirtualHost>
```

### Только Node.js (без reverse proxy)

```bash
# Запуск на порту 80 (требует sudo)
sudo WEB_PORT=80 node web/server.js
```

## 🔒 Безопасность

**⚠️ ВАЖНО:** Текущая версия не имеет аутентификации!

Для продакшна добавьте:

1. **Basic Auth через Nginx:**

```nginx
location / {
    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:3000;
}
```

2. **Создайте пользователя:**

```bash
sudo htpasswd -c /etc/nginx/.htpasswd admin
```

## 📊 Мониторинг

### Просмотр логов

```bash
pm2 logs elter-web
```

### Статус сервера

```bash
pm2 status
```

### Перезапуск

```bash
pm2 restart elter-web
```

## 🐛 Устранение проблем

### Ошибка "Error fetching companies"

- Проверьте подключение к PostgreSQL
- Убедитесь, что `DATABASE_URL` правильно настроен
- Проверьте логи: `pm2 logs elter-web`

### Порт уже занят

```bash
# Найдите процесс на порту 3000
lsof -i :3000

# Убейте процесс
kill -9 <PID>
```

### База данных не отвечает

```bash
# Проверьте статус PostgreSQL
systemctl status postgresql

# Перезапустите при необходимости
systemctl restart postgresql
```

## 📝 TODO (будущие улучшения)

- [ ] Аутентификация пользователей
- [ ] Экспорт в Excel/CSV
- [ ] Детальная страница компании
- [ ] История изменений
- [ ] Графики и статистика
- [ ] Редактирование компаний через веб
- [ ] Загрузка документов через веб

---

**Версия:** 1.0.0
**Автор:** Elter Team
**Лицензия:** MIT
