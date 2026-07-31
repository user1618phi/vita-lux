"use client";

import type { CSSProperties } from "react";
import { KaspiButton } from "@/components/ui/KaspiButton";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { WhatsAppGlyph } from "@/components/ui/WhatsAppGlyph";
import { whatsAppLink } from "@vita/data/content/products";

/* Channel CTAs — Kaspi and WhatsApp both open the WhatsApp click-to-chat, which
   is how store staff take the order / installment (per the design's openWA). */

function openWhatsApp(phone: string, message: string) {
  window.open(whatsAppLink(phone, message), "_blank", "noopener,noreferrer");
}

export interface KaspiActionProps {
  label: string;
  phone: string;
  message: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  style?: CSSProperties;
}

export function KaspiAction({ label, phone, message, size = "lg", fullWidth = true, style }: KaspiActionProps) {
  return (
    <KaspiButton size={size} fullWidth={fullWidth} style={style} onClick={() => openWhatsApp(phone, message)}>
      {label}
    </KaspiButton>
  );
}

export interface WhatsAppActionProps {
  label?: string;
  ariaLabel?: string;
  phone: string;
  message: string;
  variant?: "solid" | "outline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  iconOnly?: boolean;
  style?: CSSProperties;
}

export function WhatsAppAction({
  label,
  ariaLabel,
  phone,
  message,
  variant = "outline",
  size = "lg",
  fullWidth = false,
  iconOnly = false,
  style,
}: WhatsAppActionProps) {
  if (iconOnly) {
    return (
      <button
        type="button"
        aria-label={ariaLabel ?? label}
        onClick={() => openWhatsApp(phone, message)}
        style={{
          width: 56,
          height: 56,
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--white)",
          border: "1px solid var(--border-control)",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
          ...style,
        }}
      >
        <WhatsAppGlyph size={32} />
      </button>
    );
  }
  return (
    <WhatsAppButton
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      aria-label={ariaLabel}
      style={style}
      onClick={() => openWhatsApp(phone, message)}
    >
      {label}
    </WhatsAppButton>
  );
}
