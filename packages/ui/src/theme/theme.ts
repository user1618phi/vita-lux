/* Theme plumbing shared by the inline boot script and the toggle.
   One storage key, one attribute, one place that knows how they map. */

export const THEME_STORAGE_KEY = "vl-theme";
export const THEME_ATTRIBUTE = "data-theme";

export type Theme = "light" | "dark";

/* Тёмная — оформление по умолчанию, а не подстройка под систему: сайт должен
   выглядеть одинаково у всех, кто пришёл впервые. Системная тема сознательно
   НЕ учитывается — иначе половина посетителей увидела бы светлую версию.
   Выбор из переключателя лежит в localStorage и всегда сильнее умолчания. */
export const DEFAULT_THEME: Theme = "dark";

/* Runs before first paint, from <head>, so the page never flashes the wrong
   ground. Kept as a hand-written string on purpose: it must not depend on the
   React bundle, and it must stay small enough to inline. */
export const themeBootScript = `try{var k=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},k==="dark"||k==="light"?k:${JSON.stringify(DEFAULT_THEME)})}catch(e){}`;

/* Page background per theme — mirrors --color-porcelain in globals.css.
   Used for <meta name="theme-color">, which paints the mobile browser chrome:
   without it Safari and Chrome keep a white bar above a dark page. */
export const THEME_COLOR: Record<Theme, string> = {
  light: "#fbfaf7",
  dark: "#16130e",
};
