"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

/* PhotoGallery — main photo + thumbnail strip with active state. */

export interface PhotoGalleryProps {
  images: string[];
  alt: string;
  /** «Фото скоро появится» — локализованная строка для товара без снимков. */
  pendingLabel?: string;
}

export function PhotoGallery({ images, alt, pendingLabel }: PhotoGalleryProps) {
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
        ) : (
          /* Пустой серый квадрат читался как поломка сайта: покупатель не знает,
             не загрузилось ли изображение у него. Подпись превращает пробел в
             сообщение — товар настоящий, снимка пока нет. */
          <div
            className="flex flex-col items-center justify-center gap-2.5"
            style={{ position: "absolute", inset: 0, color: "var(--border-strong)" }}
          >
            <Icon name="package" size={48} strokeWidth={1} />
            {pendingLabel ? (
              <span className="font-sans text-[13px] lg:text-[14px]" style={{ color: "var(--text-secondary)" }}>
                {pendingLabel}
              </span>
            ) : null}
          </div>
        )}
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
