# Vita Lux — интернет-магазин

[![CI](https://github.com/user1618phi/vita-lux/actions/workflows/ci.yml/badge.svg)](https://github.com/user1618phi/vita-lux/actions/workflows/ci.yml)

Магазин сантехники собственного производства (Казахстан). Next.js 15 App
Router, TypeScript strict, Tailwind v4, next-intl (ru/kk), PostgreSQL + Drizzle.

## Быстрый старт

```bash
pnpm install
cp .env.example .env.local     # для витрины на моках достаточно значений по умолчанию
pnpm dev                       # http://localhost:8000
```

Без базы данных сайт работает на моковом каталоге (`CATALOG_SOURCE=mock`) —
это же используется в CI.

## С базой данных

```bash
# 1. Секреты
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # APP_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))" # APP_HASH_SALT

# 2. Схема и данные
pnpm db:migrate
pnpm db:seed        # заливает демонстрационный моковый каталог
pnpm db:backfill    # контент настоящего каталога: названия, разделы, характеристики
                    # (--dry-run покажет изменения, ничего не записывая)

# 3. Переключить витрину
#    CATALOG_SOURCE=db в .env.local

# 4. Аккаунт для админки
pnpm db:admin -- --user brother --role owner
```

Админка: `/admin` (вне `[locale]`, только русский).

## Что уже работает

- **Каталог** — фильтры целиком на сервере через URL-параметры, чистые функции
  в `src/lib/catalog.ts`, подсчёт фасетов без запроса на опцию.
- **Слой репозитория** (`src/lib/repo`) — единственный шов между страницами и
  источником данных. Переключение мок ↔ БД не трогает ни одной страницы.
- **Корзина и избранное** — снапшоты в localStorage + серверная перепроверка
  цен и наличия при монтировании.
- **Заказы** — серверный экшен: пересчёт цен на сервере, валидация казахстанских
  номеров, реф-код, идемпотентность, шифрование ПД, уведомление в Telegram,
  страница заказа `/order/[ref]`.
- **Админка** — товары, массовая правка цен и наличия, загрузка фото с телефона
  (HEIC → WebP через sharp), настройки.
- **Атрибуция** — first-touch UTM и referrer в middleware, запись рядом с
  заказом. На этом держится учёт продаж по каналу.

## Чего ещё нет

- Онлайн-оплата (Halyk ePay, Kaspi Pay) — сейчас оплата обсуждается в WhatsApp.
- Экран заказов в админке — заказы приходят в Telegram полным составом.
- Реальный ассортимент: в каталоге 19 моковых позиций и фото с Unsplash.
  Настоящие товары заводятся вручную через админку.
- Хостинг в Казахстане — см. раздел про персональные данные в `CLAUDE.md`.

## Если сайт вдруг «сломался»

`Cannot find module './vendor-chunks/...'` — это не поломка кода. `pnpm build`
и `pnpm dev` пишут в один и тот же каталог `.next`, поэтому продакшен-сборка,
запущенная поверх работающего dev-сервера, затирает его чанки. Лечится так:

```bash
lsof -ti:8000 | xargs kill -9
rm -rf .next
pnpm dev
```

Не запускайте `pnpm build`, пока работает `pnpm dev`.

## Проверки

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
node scripts/check-kk-glyphs.mjs
```
