"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

/* FilterSheet — mobile bottom sheet holding the full filter set. Backdrop +
   Esc close, body scroll lock, focus moved into the panel on open. Filter taps
   inside navigate (soft nav) and the sheet stays open until «Показать N».
   Motion respects prefers-reduced-motion via the global CSS override. */

export interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  applyLabel: string;
  resetLabel: string;
  resetHref: string;
  children: ReactNode;
}

export function FilterSheet({
  open,
  onClose,
  title,
  closeLabel,
  applyLabel,
  resetLabel,
  resetHref,
  children,
}: FilterSheetProps) {
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setVisible(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      setVisible(false);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          padding: 0,
          background: "var(--scrim)",
          opacity: visible ? 1 : 0,
          transition: "opacity var(--transition)",
          cursor: "pointer",
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: "relative",
          background: "var(--surface-card)",
          borderTopLeftRadius: "var(--radius-lg)",
          borderTopRightRadius: "var(--radius-lg)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform var(--transition)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "0.5px solid var(--border)",
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title)", color: "var(--text-primary)" }}>
            {title}
          </span>
          <button
            ref={closeRef}
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            style={{
              width: 44,
              height: 44,
              margin: "-10px -10px -10px 0",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ink)",
            }}
          >
            <Icon name="x" size={24} color="var(--ink)" />
          </button>
        </div>

        <div className="vl-noscroll" style={{ overflowY: "auto", padding: "4px 16px 8px", flex: 1 }}>
          {children}
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "12px 16px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            borderTop: "0.5px solid var(--border)",
          }}
        >
          <Link href={resetHref} style={{ flex: "none", textDecoration: "none" }}>
            <Button variant="secondary" size="lg">
              {resetLabel}
            </Button>
          </Link>
          <div style={{ flex: 1 }}>
            <Button variant="primary" size="lg" fullWidth onClick={onClose}>
              {applyLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
