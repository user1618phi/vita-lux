import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";

/* SectionHead — section title + optional subtitle and a right-aligned link. */

export interface SectionHeadProps {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
}

export function SectionHead({ title, subtitle, href, linkLabel }: SectionHeadProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5 lg:mb-7">
      <div>
        <h2 className="m-0 font-display text-ink" style={{ fontSize: "clamp(1.4rem, 3.5vw, 2rem)", lineHeight: 1.15 }}>{title}</h2>
        {subtitle ? <p className="mt-1.5 mb-0 font-sans text-slate leading-[1.5]" style={{ fontSize: "0.88rem" }}>{subtitle}</p> : null}
      </div>
      {href && linkLabel ? (
        <Link
          href={href}
          className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 font-sans text-[14px] text-brass-text"
        >
          {linkLabel}
          <Icon name="arrow-right" size={16} color="var(--brass)" />
        </Link>
      ) : null}
    </div>
  );
}
