# Vita Lux — vita-web

Сторфронт Vita Lux (Next.js 15 App Router · TypeScript strict · Tailwind CSS v4 · next-intl).
Первая реализованная поверхность — **карточка товара Aura 540**, импортированная из
Claude Design («Product Page - Aura 540»).

## Запуск

```bash
pnpm install
pnpm dev            # http://localhost:8000  → редирект на /ru/products/aura-540
```

Другие команды: `pnpm build`, `pnpm start`, `pnpm typecheck`, `pnpm lint`.

## Что реализовано

- **Карточка товара** `/[locale]/products/[handle]` — единая адаптивная страница
  (desktop-артборд 1440 на ≥1024px, mobile-артборд 390 ниже), собранная из
  16 блоков дизайна: галерея, Kaspi-рассрочка, доверие, характеристики, комплектация,
  набор «с этим берут», схема монтажа, отзывы, доставка/оплата, товары коллекции,
  липкая панель покупки на мобильном.
- **Дизайн-токены** из Vita Lux Design System портированы в `src/styles/globals.css`
  (Tailwind v4 `@theme` + семантические CSS-переменные). Компоненты используют
  только семантические токены; латунь-заливка не применяется как цвет текста.
- **Компоненты ДС** (`src/components/ui`) воссозданы из бандла: Icon, Button,
  KaspiButton, WhatsAppButton, PriceTag, InstallmentLine, StockStatus, ProductLabel,
  DimensionLine (сигнатурный элемент), Badge, SpecRow, EmptyState, ProductCard,
  Breadcrumbs, Header.
- **Двуязычность ru/kk** — весь текст в `messages/*.json`, ключи через `next-intl`,
  переключатель РУС/ҚАЗ. Казахские глифы (ә ө ұ ү қ ң ғ һ і) проверены.

## Что осталось за рамками (моки → Medusa)

Цены, характеристики и связанные товары лежат в `src/data/products.ts` как моки —
точка будущей интеграции с Medusa. Kaspi/WhatsApp-кнопки открывают click-to-chat;
серверная генерация реф-кода и запись в БД (учёт продаж по каналу) — следующий шаг.
Бренд везде только `Vita Lux`; полей `brand`/`rating` в модели нет.
