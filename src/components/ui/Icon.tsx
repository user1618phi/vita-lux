import type { CSSProperties, ReactNode } from "react";

/* Vita Lux icon set — a single outline set at 24px, 1.5px stroke.
   Paths mirror the Lucide outline family (the brand's chosen icon style).
   No emoji, no unicode glyphs, no filled icons (except the WhatsApp channel mark). */

const PATHS: Record<string, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  heart: <path d="M19 5.5a4.2 4.2 0 0 0-6 0l-1 1-1-1a4.2 4.2 0 1 0-6 6l7 7 7-7a4.2 4.2 0 0 0 0-6Z" />,
  "shopping-bag": (
    <>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  check: <path d="m5 12 4.5 4.5L19 7" />,
  phone: <path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 5 5.6 1.5 1.5 0 0 1 6.5 4Z" />,
  truck: (
    <>
      <path d="M3 6h11v9H3z" />
      <path d="M14 9h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17.5" cy="18" r="1.8" />
    </>
  ),
  "shield-check": (
    <>
      <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
      <path d="m9 11.5 2 2 4-4" />
    </>
  ),
  "credit-card": (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  star: <path d="M12 4.5 14.3 9l5 .7-3.6 3.5.9 5-4.6-2.4L7.4 18l.9-5L4.7 9.7l5-.7z" />,
  home: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v9h12v-9" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 12h8l1-12" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </>
  ),
  package: (
    <>
      <path d="M12 3 4 7v10l8 4 8-4V7z" />
      <path d="M4 7l8 4 8-4" />
      <path d="M12 11v10" />
    </>
  ),
  whatsapp: (
    <path
      d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Zm0 1.5a6.5 6.5 0 0 1 5.5 9.9l-.2.3.6 2.2-2.3-.6-.3.2A6.5 6.5 0 1 1 12 5.5Zm-2.4 3c-.2 0-.5 0-.7.4-.2.4-.8.9-.8 2.1s.9 2.5 1 2.6c.1.2 1.7 2.7 4.3 3.7 2.1.8 2.6.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1 0-.1-.2-.2-.5-.3l-1.4-.7c-.2-.1-.4-.1-.5.1l-.6.8c-.1.1-.2.2-.5.1-.3-.1-1.1-.4-2-1.2-.7-.6-1.2-1.4-1.3-1.7-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3.2-.5 0-.2 0-.3 0-.4l-.7-1.6c-.2-.4-.3-.4-.5-.4h-.5Z"
      strokeWidth="0.5"
      fill="currentColor"
    />
  ),
};

export type IconName = keyof typeof PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}

export function Icon({
  name,
  size = 24,
  strokeWidth = 1.5,
  color = "currentColor",
  style,
  className,
}: IconProps) {
  const p = PATHS[name];
  if (!p) return null;
  const filled = name === "whatsapp";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      style={{ display: "block", flex: "none", ...style }}
    >
      {p}
    </svg>
  );
}
