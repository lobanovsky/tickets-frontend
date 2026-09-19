# tickets-frontend

Веб-приложение для администрирования подписчиков Telegram-ботов театральных уведомлений.

Работает в паре с [tickets-backend](https://github.com/lobanovsky/tickets-backend).

## Функционал

- Список подписчиков с фильтрацией: все / с подписками / без подписок
- Страница пользователя: информация и подписки, сгруппированные по театрам

## Локальный запуск

Бэкенд должен быть запущен на `http://localhost:8080`.

```bash
caddy run --config dev/Caddyfile
```

Открыть: http://localhost:3000

Вход — по логину и паролю, настроенным на бэкенде. Для локального запуска задайте
`ADMIN_ORIGIN=http://localhost:3000` и `ADMIN_COOKIE_SECURE=false` на бэкенде.
В production cookie требует HTTPS. Сессия действует 12 часов; кнопка «Выйти» удаляет её.

## Структура

```
tickets-frontend/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── api.js      # HTTP-клиент с cookie-сессией
│   └── app.js      # Роутер, страницы, рендеринг
├── docker/
│   ├── nginx.conf
│   └── entrypoint.sh
└── Dockerfile
```

## Docker

Образ собирается на базе `nginx:alpine`. Браузер обращается к API на текущем домене; Nginx проксирует запросы в Docker-сети:

```bash
docker build -t tickets-frontend .
docker run --network tickets-network -p 3000:80 tickets-frontend
```

### docker-compose

```bash
# Создать .env
echo "TAG=latest" > .env
echo "DOCKER_USERNAME=your_username" >> .env

docker compose up -d
```

Продакшен-адрес: https://tix.lobanovsky.ru. Compose подключает фронтенд к существующим
внешним сетям `housekpr-network` (Traefik) и `tickets-network` (бэкенд).
Traefik выпускает сертификат через resolver `letsEncrypt` и перенаправляет HTTP на HTTPS.
Порт 8093 на хосте не публикуется. Cloudflare настроен в режиме DNS only.

Nginx проксирует `/api/` на `tickets-backend:8080` с сохранением пути и cookie.
Секретов в образе и JavaScript нет. До проверки сессии данные не загружаются;
при выходе или истечении сессии кеш и административный интерфейс очищаются.

## Проверки

```bash
node --test tests/*.test.cjs
```

## CI/CD

При пуше в `master` GitHub Actions автоматически:
1. Собирает Docker-образ с тегом из короткого SHA коммита
2. Пушит в DockerHub
3. Разворачивает на сервере через SSH

### Секреты GitHub Actions

| Секрет | Описание |
|---|---|
| `DOCKER_USERNAME` | Логин DockerHub |
| `DOCKER_PASSWORD` | Пароль DockerHub |
| `DOCKER_TOKEN` | Токен DockerHub (для pull на сервере) |
| `DEPLOY_HOST` | IP-адрес сервера |
| `DEPLOY_USER` | SSH-пользователь |
| `DEPLOY_SSH_KEY` | Приватный SSH-ключ |
| `DEPLOY_DIR` | Путь на сервере для docker-compose |
