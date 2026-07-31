"use client";

import { useState } from "react";

/* PhotoGallery — main photo + thumbnail strip with active state. Real photos
   (falls back to a porcelain frame if a src is missing). */

export interface PhotoGalleryProps {
  images: string[];
  alt: string;
}

export function PhotoGallery({ images, alt }: PhotoGalleryProps) {
  const list = images.filter(Boolean);
  const [active, setActive] = useState(0);
  const current = list[active];

  return (
    <div>
      <div
        style={{
          position: "relative",
          aspectRatio: "1 / 1",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          background: "var(--surface-media)",
        }}
      >
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt={alt} className="vl-photo" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}
      </div>

      {list.length > 1 ? (
        <div className="vl-noscroll" style={{ display: "flex", gap: 10, marginTop: 12, overflowX: "auto" }}>
          {list.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${alt} — ${i + 1}`}
              aria-pressed={i === active}
              style={{
                flex: "none",
                width: 72,
                height: 72,
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                border: i === active ? "2px solid var(--brass)" : "1px solid var(--border)",
                background: "var(--surface-media)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="vl-photo" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
