"use client";

import type { CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/* РУС / ҚАЗ switch — present on all pages (см. CLAUDE.md). Swaps the locale
   while keeping the current path. */

export function LanguageSwitcher({ style }: { style?: CSSProperties }) {
  const t = useTranslations("Lang");
  const active = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div
      role="group"
      aria-label={t("switch")}
      style={{ display: "inline-flex", alignItems: "center", gap: 2, ...style }}
    >
      {routing.locales.map((loc, i) => {
        const isActive = loc === active;
        return (
          <span key={loc} style={{ display: "inline-flex", alignItems: "center" }}>
            {/* Разделитель — чистая графика: скринридеру он читался как «слэш». */}
            {i > 0 ? <span aria-hidden="true" style={{ color: "var(--border-strong)", margin: "0 2px" }}>/</span> : null}
            <button
              type="button"
              aria-current={isActive ? "true" : undefined}
              onClick={() => router.replace(pathname, { locale: loc })}
              style={{
                background: "transparent",
                border: "none",
                padding: "4px 4px",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-caption)",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {t(loc)}
            </button>
          </span>
        );
      })}
    </div>
  );
}
