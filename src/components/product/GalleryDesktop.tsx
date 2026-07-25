"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProductLabel } from "@/components/ui/ProductLabel";
import { DimensionLine } from "@/components/ui/DimensionLine";

/* Desktop gallery — preview column (left) + main viewport (right).
   Product photography is not yet wired, so placeholders stand in per the design. */

export interface GalleryDesktopProps {
  views: string[];
  dimLabel: string;
  saleLabel: string;
}

export function GalleryDesktop({ views, dimLabel, saleLabel }: GalleryDesktopProps) {
  const [active, setActive] = useState(0);

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: "none" }}>
        {views.map((label, i) => (
          <button
            key={i}
            type="button"
            aria-label={label}
            aria-pressed={i === active}
            onClick={() => setActive(i)}
            style={{
              width: 76,
              height: 76,
              padding: 0,
              background: "var(--glaze)",
              border: i === active ? "1px solid var(--ink)" : "0.5px solid var(--line)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#AEB9B6" }}>
              0{i + 1}
            </span>
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          position: "relative",
          background: "var(--glaze)",
          border: "0.5px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          aspectRatio: "4 / 5",
        }}
      >
        <div style={{ position: "absolute", top: 16, left: 16, zIndex: 2 }}>
          <ProductLabel kind="sale">{saleLabel}</ProductLabel>
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            background: "var(--porcelain)",
            color: "#C6D0CD",
          }}
        >
          <Icon name="package" size={96} strokeWidth={1} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.04em", color: "#9FADAA" }}>
            {views[active]}
          </span>
        </div>
        <div style={{ position: "absolute", left: "16%", right: "16%", bottom: 30, zIndex: 2 }}>
          <DimensionLine label={dimLabel} labelBg="var(--porcelain)" />
        </div>
      </div>
    </div>
  );
}
