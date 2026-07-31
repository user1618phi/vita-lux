"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { THEME_ATTRIBUTE, THEME_COLOR, THEME_STORAGE_KEY, type Theme } from "@vita/ui/theme";

/* Theme toggle.

   Which icon and label show is decided in CSS from html[data-theme] (see the
   .vl-when-* rules in globals.css), not from React state. The theme is already
   on <html> before the first paint, so the control is correct in that first
   frame — a useState version would have to render one arbitrary side and swap
   it on mount, which reads as a flicker on every page load. */

export interface ThemeToggleProps {
  /** `icon`: 44×44 button for the header. `row`: full-width labelled row for the mobile drawer. */
  variant?: "icon" | "row";
}

function apply(theme: Theme) {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  /* Адресную строку на мобильном красит <meta name="theme-color">, а он статичен
     в разметке. Без этой строки после переключения браузерная панель осталась бы
     от прежней темы. */
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Private mode: the theme still applies, it just won't survive a reload. */
  }
}

export function ThemeToggle({ variant = "icon" }: ThemeToggleProps) {
  const t = useTranslations("Theme");

  const onClick = () => {
    apply(document.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark" ? "light" : "dark");
  };

  const icons = (
    <>
      <span className="vl-when-light">
        <Icon name="moon" size={variant === "row" ? 18 : 22} />
      </span>
      <span className="vl-when-dark">
        <Icon name="sun" size={variant === "row" ? 18 : 22} />
      </span>
    </>
  );

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-3 w-full px-4"
        style={{
          minHeight: 52,
          background: "transparent",
          border: "none",
          borderBottom: "0.5px solid var(--line)",
          color: "var(--ink)",
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          textAlign: "start",
          cursor: "pointer",
        }}
      >
        {icons}
        <span className="vl-when-light">{t("toDark")}</span>
        <span className="vl-when-dark">{t("toLight")}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("switch")}
      title={t("switch")}
      style={{
        width: 44,
        height: 44,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        color: "var(--ink)",
      }}
    >
      {icons}
    </button>
  );
}
