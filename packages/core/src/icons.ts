/* Словарь имён иконок.

   Домен владеет именами, UI владеет формой. Данные каталога (`trustIcons`,
   иконки преимуществ) называют иконку строкой, и эта строка должна быть
   проверяемой без импорта React-компонента — иначе `@vita/core` тянет за собой
   `@vita/ui`, и каталог нельзя вынести в API-сервис.

   ВАЖНО: раньше `IconName` объявлялся как `keyof typeof PATHS`, где
   `PATHS: Record<string, ReactNode>`. `keyof` от `Record<string, …>` — это
   `string`, поэтому тип не проверял ровно ничего: `<Icon name="опечатка" />`
   компилировался и молча не рисовался. Теперь это настоящий union, а
   `Icon.tsx` обязан покрыть его целиком через `satisfies` — разъехаться они
   больше не могут.

   Порядок — как в `PATHS`, по алфавиту. Добавляя иконку, правь оба места:
   TypeScript не даст забыть второе. */
export const ICON_NAMES = [
  "alert-circle",
  "arrow-right",
  "check",
  "chevron-down",
  "chevron-left",
  "chevron-right",
  "credit-card",
  "eye",
  "grid",
  "heart",
  "home",
  "info",
  "mail",
  "map-pin",
  "menu",
  "minus",
  "moon",
  "package",
  "phone",
  "plus",
  "search",
  "shield-check",
  "shopping-bag",
  "star",
  "sun",
  "trash",
  "truck",
  "user",
  "whatsapp",
  "x",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** Сужает строку из данных до имени иконки. Возвращает undefined, если такой
    иконки нет — вызывающий сам решает, показать заглушку или ничего. */
export function asIconName(value: string): IconName | undefined {
  return (ICON_NAMES as readonly string[]).includes(value) ? (value as IconName) : undefined;
}
