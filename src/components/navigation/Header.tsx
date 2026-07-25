import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";

/* Header — brand wordmark, search, language, favorites, cart, category nav.
   No logo asset was provided, so the brand name is set in the display serif.
   Glaze surface, single hairline bottom border, no shadow. */

const NAV_KEYS = ["faucets", "sinks", "toilets", "bath", "furniture", "wholesale"] as const;

export async function Header() {
  const t = await getTranslations("Header");
  const tn = await getTranslations("Nav");
  const nav = NAV_KEYS.map((k) => tn(k));

  return (
    <header style={{ width: "100%", background: "var(--surface-card)", borderBottom: "1px solid var(--border)" }}>
      <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "0 var(--gutter)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, height: 72 }}>
          <Link href="/" style={{ textDecoration: "none", flex: "none" }} aria-label="Vita Lux">
            <Logo />
          </Link>

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 560 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                height: 44,
                padding: "0 14px",
                background: "var(--surface-control)",
                border: "1px solid var(--border-control)",
                borderRadius: "var(--radius-md)",
                color: "var(--slate)",
              }}
            >
              <Icon name="search" size={20} color="var(--slate)" />
              <input
                type="search"
                placeholder={t("searchPlaceholder")}
                aria-label={t("search")}
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: 16,
                  color: "var(--ink)",
                }}
              />
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <LanguageSwitcher />
            <button type="button" aria-label={t("favorites")} style={iconBtn}>
              <Icon name="heart" size={22} color="var(--ink)" />
            </button>
            <button type="button" aria-label={t("cart")} style={iconBtn}>
              <Icon name="shopping-bag" size={22} color="var(--ink)" />
            </button>
          </div>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 28, height: 48, borderTop: "0.5px solid var(--border)" }}>
          {nav.map((label, i) => (
            <Link
              key={i}
              href="/"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body-s)",
                color: i === nav.length - 1 ? "var(--text-accent)" : "var(--text-primary)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

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
} as const;
