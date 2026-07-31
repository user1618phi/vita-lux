# @vita/worker — синхронизация с X2pos

Долгоживущий Node-процесс на Railway. Забирает из X2pos остатки, цены и фото и
отдаёт обратно продажи с сайта.

## Почему не на Vercel

Тариф Hobby: Cron там запускается раз в сутки (остатки нужны каждые пять
минут), а serverless-функция ограничена десятью секундами — полный импорт
каталога с картинками в них не укладывается.

## Расписание

| Задание   | Период  | Что делает                                        |
|-----------|---------|---------------------------------------------------|
| `stock`   | 5 мин   | остатки → `inventory`, сброс кэша изменившихся    |
| `outbox`  | 5 мин   | продажи и возвраты, не ушедшие в X2pos сразу      |
| `catalog` | 15 мин  | товары и цены (сначала спрашивает `what_is_new`)  |
| `media`   | 60 мин  | фото из X2pos в наше хранилище, пачками по 25     |

Одновременно выполняется только одно задание.

## HTTP

- `GET /health` — открыт, для healthcheck Railway
- `POST /run/<job>` — ручной запуск, заголовок `x-vita-cron: $CRON_SECRET`.
  `?force=1` для `catalog` игнорирует курсор «наверху ничего не менялось».

## Переменные окружения

`DATABASE_URL`, `X2POS_ENABLED=1`, `X2POS_USER`, `X2POS_PASSWORD`,
`X2POS_BRANCH_ID`, `X2POS_KASSA_ID`, `X2POS_USER_ID`, `X2POS_EMPLOYEE_ID`,
`X2POS_CASH_ACCOUNT_ID`, `CRON_SECRET`, `SITE_REVALIDATE_URL`,
`REVALIDATE_SECRET`, и для фото — `STORAGE_DRIVER=supabase`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`.

Без `X2POS_ENABLED=1` процесс поднимается, отвечает на `/health`, но
расписание не запускает — это защита от случайного прогона на чужой базе.
