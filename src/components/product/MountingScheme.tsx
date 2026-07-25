/* Mounting scheme — technical line drawing of the wall-hung install with brass
   dimension callouts. Numeric dims come from data; the descriptive label is
   localized. Pure SVG (no client JS). */

export interface MountingSchemeProps {
  widthLabel: string; // "540 мм"
  heightLabel: string; // "355 мм"
  frontLabel: string; // "360 мм"
  frontDescription: string; // "Ширина по фронту" / "Ені"
}

export function MountingScheme({ widthLabel, heightLabel, frontLabel, frontDescription }: MountingSchemeProps) {
  return (
    <svg
      viewBox="0 0 660 380"
      style={{ width: "100%", maxWidth: 660, height: "auto", display: "block", margin: "0 auto", fontFamily: "var(--font-mono)" }}
      role="img"
      aria-label={`${frontDescription}: ${frontLabel}`}
    >
      <line x1="70" y1="24" x2="70" y2="338" stroke="var(--slate)" strokeWidth="2" />
      <path
        d="M40 40 L70 62 M40 80 L70 102 M40 120 L70 142 M40 160 L70 182 M40 200 L70 222 M40 240 L70 262 M40 280 L70 302"
        stroke="var(--line)"
        strokeWidth="1"
      />
      <rect x="70" y="96" width="26" height="150" fill="none" stroke="var(--slate)" strokeWidth="1.5" />
      <path
        d="M96 120 L250 118 C332 116 378 160 366 208 C356 250 300 270 240 264 C168 256 118 258 96 244 Z"
        fill="var(--porcelain)"
        stroke="var(--slate)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse cx="212" cy="150" rx="112" ry="22" fill="none" stroke="var(--slate)" strokeWidth="1.2" />
      <g stroke="var(--brass)" strokeWidth="1">
        <line x1="70" y1="322" x2="366" y2="322" />
        <line x1="70" y1="314" x2="70" y2="330" />
        <line x1="366" y1="314" x2="366" y2="330" />
        <line x1="452" y1="118" x2="452" y2="264" />
        <line x1="444" y1="118" x2="460" y2="118" />
        <line x1="444" y1="264" x2="460" y2="264" />
      </g>
      <rect x="188" y="313" width="60" height="18" fill="var(--glaze)" />
      <text x="218" y="326" textAnchor="middle" fill="var(--brass)" fontSize="13">
        {widthLabel}
      </text>
      <rect x="424" y="182" width="56" height="18" fill="var(--glaze)" />
      <text x="452" y="195" textAnchor="middle" fill="var(--brass)" fontSize="13">
        {heightLabel}
      </text>
      <text x="536" y="150" fill="var(--slate)" fontSize="12" fontFamily="var(--font-sans)">
        {frontDescription}
      </text>
      <text x="536" y="170" fill="var(--brass)" fontSize="13">
        {frontLabel}
      </text>
    </svg>
  );
}
