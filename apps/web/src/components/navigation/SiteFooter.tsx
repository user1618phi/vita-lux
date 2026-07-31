import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { MAP_URL } from "@vita/data/content/home";

/* SiteFooter — graphite footer matching the macket: trust row, four columns
   (about / catalog / buyers / contacts), payment bar. Monobrand copy. */

const NAV = ["faucets", "sinks", "toilets", "bath", "furniture"] as const;
const TRUST_ICONS: IconName[] = ["truck", "shield-check", "credit-card", "home"];
const HAIRLINE = "0.5px solid rgba(237, 241, 240, 0.14)";

const heading = "m-0 mb-3 font-sans font-medium text-[14px] text-on-dark";
const linkStyle = { fontSize: "14px", color: "var(--text-on-dark-muted)", textDecoration: "none" } as const;

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const tn = await getTranslations("Nav");
  const trust = t.raw("trust") as string[];
  const buyers = t.raw("buyers") as string[];
  const phoneDigits = `+${t("phone").replace(/\D/g, "")}`;

  return (
    <footer className="bg-basalt text-on-dark mt-14 lg:mt-20">
      {/* Trust row */}
      <div
        className="mx-auto max-w-[1280px] px-4 lg:px-8 py-4 grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-4"
        style={{ borderBottom: HAIRLINE }}
      >
        {trust.map((label, i) => (
          <div key={i} className="flex items-center gap-2.5" style={{ fontSize: "14px" }}>
            <Icon name={TRUST_ICONS[i]} size={20} color="var(--brass-text-dark)" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Columns */}
      <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-10 grid gap-8 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <Logo variant="light" showTagline={false} />
          <p className="mt-4 mb-0 font-sans text-[14px] leading-[1.6]" style={{ color: "var(--text-on-dark-muted)" }}>
            {t("about")}
          </p>
        </div>

        <div>
          <h4 className={heading}>{t("catalogHeading")}</h4>
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {NAV.map((k) => (
              <li key={k}>
                <Link href={`/catalog/${k}`} style={linkStyle}>
                  {tn(k)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className={heading}>{t("buyersHeading")}</h4>
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {buyers.map((b, i) => (
              <li key={i} className="font-sans" style={{ fontSize: "14px", color: "var(--text-on-dark-muted)" }}>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className={heading}>{t("contactsHeading")}</h4>
          <ul className="m-0 p-0 list-none flex flex-col gap-2.5" style={{ fontSize: "14px", color: "var(--text-on-dark-muted)" }}>
            <li className="flex items-center gap-2">
              <Icon name="phone" size={16} color="var(--brass-text-dark)" />
              <a href={`tel:${phoneDigits}`} style={{ color: "var(--text-on-dark-muted)", textDecoration: "none" }}>
                {t("phone")}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Icon name="mail" size={16} color="var(--brass-text-dark)" />
              {/* Почта была единственной строкой в списке без действия — рядом
                  с кликабельными телефоном и адресом это читалось как опечатка. */}
              <a href={`mailto:${t("email")}`} style={linkStyle}>
                {t("email")}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ marginTop: 2 }}>
                <Icon name="map-pin" size={16} color="var(--brass-text-dark)" />
              </span>
              <a href={MAP_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                {t("address")}
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Payment bar */}
      <div style={{ borderTop: HAIRLINE }}>
        <div
          className="mx-auto max-w-[1280px] px-4 lg:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-2"
          style={{ fontSize: "12px", color: "var(--text-on-dark-muted)" }}
        >
          <span className="vl-mono">{t("copyright")}</span>
          <span>{t("payment")}</span>
        </div>
      </div>
    </footer>
  );
}
