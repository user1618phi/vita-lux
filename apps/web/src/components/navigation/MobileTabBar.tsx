"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useCart } from "@/context/CartContext";

/* MobileTabBar — bottom navigation on mobile (as in the macket): Главная /
   Каталог / Избранное / Корзина, with bronze active state and count badges.
   Height 56px — the product sticky buy bar sits above it. */

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

  const isActive = (tab: Tab) => (tab.match === "/" ? pathname === "/" : pathname.startsWith(tab.match));
  const badgeFor = (tab: Tab) => (tab.badge === "fav" ? favCount : tab.badge === "cart" ? count : 0);

  return (
    <nav
      className="md:hidden"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: "var(--white)",
        borderTop: "0.5px solid var(--line)",
        paddingBottom: "env(safe-area-inset-bottom)",
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
