"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useCart } from "@/context/CartContext";
import { useHideOnScrollDown } from "./useHideOnScrollDown";

/* MobileTabBar — bottom navigation on mobile (as in the macket): Главная /
   Каталог / Избранное / Корзина, with bronze active state and count badges.
   Height 56px — the product sticky buy bar sits above it.

   Уезжает вниз при скролле вниз и возвращается от малейшего движения вверх:
   на 390px панель съедала 56px и без того короткого экрана, а нужна она только
   в момент, когда человек ищет, куда перейти.

   Состояние публикуется атрибутом `data-tabbar` на <html>, потому что от высоты
   панели отсчитывается липкая кнопка «В корзину» на карточке товара (см.
   --tabbar-h в tokens.css). Через контекст это не передать: кнопка живёт в
   другом поддереве. */

type Tab = { key: string; icon: IconName; href: string; match: string; badge?: "fav" | "cart" };

const TABS: Tab[] = [
  { key: "home", icon: "home", href: "/", match: "/" },
  { key: "catalog", icon: "grid", href: "/catalog/toilets", match: "/catalog" },
  { key: "favorites", icon: "heart", href: "/favorites", match: "/favorites", badge: "fav" },
  { key: "cart", icon: "shopping-bag", href: "/cart", match: "/cart", badge: "cart" },
];

export function MobileTabBar() {
  const t = useTranslations("Tabs");
  const pathname = usePathname();
  const { count, favCount, hydrated } = useCart();

  const hidden = useHideOnScrollDown();

  useEffect(() => {
    const root = document.documentElement;
    if (hidden) root.setAttribute("data-tabbar", "hidden");
    else root.removeAttribute("data-tabbar");
    return () => root.removeAttribute("data-tabbar");
  }, [hidden]);

  const isActive = (tab: Tab) => (tab.match === "/" ? pathname === "/" : pathname.startsWith(tab.match));
  const badgeFor = (tab: Tab) => (tab.badge === "fav" ? favCount : tab.badge === "cart" ? count : 0);

  return (
    <nav
      className="md:hidden"
      /* Спрятанная панель уезжает за экран, но остаётся в потоке фокуса —
         `inert` убирает её и от клавиатуры, и от скринридера. */
      inert={hidden}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: "var(--white)",
        borderTop: "0.5px solid var(--line)",
        paddingBottom: "env(safe-area-inset-bottom)",
        // 101% — чтобы вместе с панелью ушла и её волосяная граница сверху.
        transform: hidden ? "translateY(101%)" : "translateY(0)",
        transition: "transform 220ms ease-out",
        willChange: "transform",
      }}
    >
      <div className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = isActive(tab);
          const badge = hydrated ? badgeFor(tab) : 0;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="relative flex flex-col items-center justify-center gap-1"
              style={{ height: 56, textDecoration: "none" }}
            >
              <span style={{ position: "relative", display: "inline-flex" }}>
                <Icon name={tab.icon} size={22} color={active ? "var(--brass)" : "var(--slate)"} />
                {badge > 0 ? (
                  <span
                    className="vl-mono"
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -10,
                      minWidth: 16,
                      height: 16,
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
                    {badge}
                  </span>
                ) : null}
              </span>
              <span style={{ fontSize: "11px", color: active ? "var(--ink)" : "var(--slate)" }}>{t(tab.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
