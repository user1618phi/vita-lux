import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/* MediaFrame — a photo-ready image slot. Renders the image when a real `src`
   is provided; until brand photography exists it shows a calm branded fallback
   (porcelain fill + faint outline icon). Overlay content (labels, scrim) goes in
   `children`.
   - `fill`: drop the aspect-ratio and fill the parent (parent sets the height).
   - `hoverZoom`: image scales up on hover of a `.group` ancestor (like the macket). */

export interface MediaFrameProps {
  src?: string;
  alt: string;
  ratio?: string; // CSS aspect-ratio, e.g. "4 / 5"
  fill?: boolean; // fill parent height instead of using aspect-ratio
  radius?: "md" | "lg" | "none";
  fallbackIcon?: IconName;
  scrim?: boolean; // solid dark scrim for text-over-image (never a gradient)
  hoverZoom?: boolean;
  eager?: boolean; // load immediately — use for above-the-fold LCP images (hero)
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const RADII = { md: "var(--radius-md)", lg: "var(--radius-lg)", none: "0" } as const;

export function MediaFrame({
  src,
  alt,
  ratio = "4 / 5",
  fill = false,
  radius = "lg",
  fallbackIcon = "package",
  scrim = false,
  hoverZoom = false,
  eager = false,
  className,
  style,
  children,
}: MediaFrameProps) {
  const imgClass = hoverZoom ? "transition-transform duration-500 group-hover:scale-105" : undefined;
  return (
    <div
      className={className}
      style={{
        position: fill ? "absolute" : "relative",
        inset: fill ? 0 : undefined,
        aspectRatio: fill ? undefined : ratio,
        width: fill ? "100%" : undefined,
        height: fill ? "100%" : undefined,
        overflow: "hidden",
        borderRadius: RADII[radius],
        background: "var(--porcelain)",
        ...style,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          className={imgClass}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--border-strong)",
          }}
        >
          <Icon name={fallbackIcon} size={48} strokeWidth={1} />
        </div>
      )}
      {scrim ? <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim)" }} /> : null}
      {children}
    </div>
  );
}
