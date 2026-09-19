# tickets-frontend

Веб-приложение для администрирования подписчиков Telegram-ботов театральных уведомлений.

Работает в паре с [tickets-backend](https://github.com/lobanovsky/tickets-backend).

## Функционал

- Список подписчиков с фильтрацией: все / с подписками / без подписок
- Страница пользователя: информация и подписки, сгруппированные по театрам

## Локальный запуск

Бэкенд должен быть запущен на `http://localhost:8080`.

```bash
python3 -m http.server 3000
```

Открыть: http://localhost:3000

По умолчанию используется API-ключ `admin-secret`. Чтобы изменить — отредактировать `js/api.js`.

## Структура

```
tickets-frontend/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── api.js      # HTTP-клиент, API_URL, API_KEY
│   └── app.js      # Роутер, страницы, рендеринг
├── docker/
│   ├── nginx.conf
│   └── entrypoint.sh
└── Dockerfile
```

## Docker

Образ собирается на базе `nginx:alpine`. При старте контейнера `entrypoint.sh` подставляет адрес и ключ API через переменные окружения:

```bash
docker build -t tickets-frontend .
docker run -p 8092:80 \
  -e TICKETS_API_URL=http://api-host:8080 \
  -e ADMIN_API_KEY=admin-secret \
  tickets-frontend
```

### docker-compose

```bash
# Создать .env
echo "TAG=latest" > .env
echo "DOCKER_USERNAME=your_username" >> .env
echo "ADMIN_API_KEY=admin-secret" >> .env

docker compose up -d
```

Продакшен-адрес: https://tix.lobanovsky.ru. Compose подключает фронтенд к существующим
внешним сетям `housekpr-network` (Traefik) и `tickets-network` (бэкенд).
Traefik выпускает сертификат через resolver `letsEncrypt` и перенаправляет HTTP на HTTPS.
Порт 8093 на хосте не публикуется. Cloudflare настроен в режиме DNS only.

В Compose `TICKETS_API_URL` задан пустой строкой: браузер обращается к API на текущем
домене, а Nginx проксирует `/api/` на `tickets-backend:8080` с сохранением пути и
Authorization. Отдельный публичный адрес API для фронтенда не требуется.
Если переменная не задана при запуске образа напрямую, используется `http://localhost:8080`.
Для запуска образа необходим доступ к `tickets-backend` в Docker-сети;
в примере `docker run` выше добавьте `--network tickets-network`.

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
| `ADMIN_API_KEY` | Ключ администратора |
