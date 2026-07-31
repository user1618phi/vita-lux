"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { useCart } from "@/context/CartContext";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";

function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span
      className="vl-mono"
      style={{
        position: "absolute",
        top: 4,
        right: 4,
        minWidth: 18,
        height: 18,
        padding: "0 4px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: "var(--text-on-brass)",
        background: "var(--brass)",
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}

/* SiteHeader — desktop utility bar (delivery / installment + warranty / phone),
   logo, category nav, language, favorites + cart. Mobile: a left slide-in
   drawer. Near-white surface, sticky, hairline bottom border. Monobrand copy. */

const NAV = ["faucets", "sinks", "toilets", "bath", "furniture"] as const;

const iconBtn = {
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
} as const;

export function SiteHeader() {
  const t = useTranslations("Header");
  const tn = useTranslations("Nav");
  const { count, favCount, hydrated } = useCart();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const phoneHref = `tel:+${t("phone").replace(/\D/g, "")}`;

  return (
    <header className="sticky top-0 z-40" style={{ background: "var(--white)", borderBottom: "1px solid var(--line)" }}>
      {/* Utility bar — desktop */}
      <div className="hidden md:block" style={{ borderBottom: "0.5px solid var(--line)" }}>
        <div
          className="mx-auto max-w-[1280px] px-6 flex items-center justify-between h-9"
          style={{ fontSize: "12px", color: "var(--slate)" }}
        >
          <span className="flex items-center gap-1.5">
            <Icon name="map-pin" size={14} color="var(--brass)" />
            {t("deliveryBar")}
          </span>
          <div className="flex items-center gap-5">
            <span>{t("installmentBar")}</span>
            <a href={phoneHref} className="flex items-center gap-1.5" style={{ color: "var(--ink)", textDecoration: "none" }}>
              <Icon name="phone" size={14} color="var(--brass)" />
              {t("phone")}
            </a>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="mx-auto max-w-[1280px] px-4 md:px-6 flex items-center gap-4 h-16 lg:h-[72px]">
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center"
          aria-label={t("menu")}
          onClick={() => setOpen(true)}
          style={{ width: 40, height: 40, marginLeft: -8, background: "transparent", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer" }}
        >
          <Icon name="menu" size={24} color="var(--ink)" />
        </button>

        <Link href="/" aria-label="Vita Lux" style={{ textDecoration: "none", flex: "none" }}>
          <Logo />
        </Link>

        <nav className="hidden lg:flex flex-1 items-center justify-center gap-7">
          {NAV.map((k) => (
            <Link key={k} href={`/catalog/${k}`} style={{ fontSize: "15px", fontWeight: 500, color: "var(--ink)", textDecoration: "none", whiteSpace: "nowrap" }}>
              {tn(k)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 ml-auto">
          <LanguageSwitcher />
          {/* Theme, favorites and cart live in the mobile drawer / bottom tab bar —
              show them here only from md up. */}
          <div className="hidden md:flex items-center gap-1">
            <ThemeToggle />
            <Link href="/favorites" aria-label={t("favorites")} style={{ ...iconBtn, position: "relative" }}>
              <Icon name="heart" size={22} color="var(--ink)" />
              {hydrated && favCount > 0 ? <CountBadge>{favCount}</CountBadge> : null}
            </Link>
            <Link href="/cart" aria-label={t("cart")} style={{ ...iconBtn, position: "relative" }}>
              <Icon name="shopping-bag" size={22} color="var(--ink)" />
              {hydrated && count > 0 ? <CountBadge>{count}</CountBadge> : null}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="md:hidden" role="dialog" aria-modal="true" aria-label={t("menu")} style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <button type="button" aria-label={t("close")} onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, border: "none", padding: 0, background: "var(--scrim)", cursor: "pointer" }} />
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "86%", maxWidth: 360, background: "var(--white)", display: "flex", flexDirection: "column" }}>
            <div className="flex items-center justify-between px-4" style={{ height: 64, borderBottom: "0.5px solid var(--line)" }}>
              <Logo />
              <button type="button" aria-label={t("close")} onClick={() => setOpen(false)} style={{ ...iconBtn }}>
                <Icon name="x" size={24} color="var(--ink)" />
              </button>
            </div>
            <nav style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              <div className="px-4 py-2" style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate)" }}>
                {t("catalogHeading")}
              </div>
              {NAV.map((k) => (
                <Link
                  key={k}
                  href={`/catalog/${k}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4"
                  style={{ minHeight: 52, borderBottom: "0.5px solid var(--line)", color: "var(--ink)", textDecoration: "none", fontSize: "15px" }}
                >
                  {tn(k)}
                  <Icon name="chevron-right" size={18} color="var(--slate)" />
                </Link>
              ))}
              {/* Тема переключается прямо здесь и меню не закрывает: результат
                  виден сразу, за ним не нужно уходить со страницы. */}
              <ThemeToggle variant="row" />
            </nav>
            <a href={phoneHref} className="flex items-center gap-2 px-4" style={{ height: 56, borderTop: "0.5px solid var(--line)", color: "var(--brass-text)", textDecoration: "none", fontSize: "15px" }}>
              <Icon name="phone" size={18} color="var(--brass)" />
              {t("phone")}
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
