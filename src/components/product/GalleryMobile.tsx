"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProductLabel } from "@/components/ui/ProductLabel";
import { DimensionLine } from "@/components/ui/DimensionLine";

/* Mobile gallery — full-bleed swipe rail with scroll-snap + dot indicator. */

export interface GalleryMobileProps {
  views: string[];
  dimLabel: string;
  saleLabel: string;
}

export function GalleryMobile({ views, dimLabel, saleLabel }: GalleryMobileProps) {
  const [slide, setSlide] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = railRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / (el.clientWidth || 1));
    if (i !== slide) setSlide(i);
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={railRef}
        className="vl-noscroll"
        onScroll={onScroll}
        style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory" }}
      >
        {views.map((label, i) => (
          <div key={i} style={{ flex: "none", width: "100%", scrollSnapAlign: "start", padding: "0 16px" }}>
            <div
              style={{
                position: "relative",
                aspectRatio: "4 / 5",
                background: "var(--porcelain)",
                border: "0.5px solid var(--line)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                color: "var(--border-strong)",
              }}
            >
              {i === 0 ? (
                <div style={{ position: "absolute", top: 12, left: 12, zIndex: 2 }}>
                  <ProductLabel kind="sale">{saleLabel}</ProductLabel>
                </div>
              ) : null}
              <Icon name="package" size={80} strokeWidth={1} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--slate)" }}>{label}</span>
              <div style={{ position: "absolute", left: "14%", right: "14%", bottom: 24 }}>
                <DimensionLine label={dimLabel} labelBg="var(--porcelain)" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 12 }}>
        {views.map((_, i) => (
          <span
            key={i}
            style={{ width: 7, height: 7, borderRadius: 999, background: i === slide ? "var(--ink)" : "var(--border-strong)" }}
          />
        ))}
      </div>
    </div>
  );
}
