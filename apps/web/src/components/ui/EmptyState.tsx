import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/* EmptyState — icon, title, calm explanatory text, optional action.
   Tone: explain what's here and what to do, no exclamation. */

export interface EmptyStateProps {
  icon?: IconName;
  title?: string;
  description?: string;
  action?: ReactNode;
  style?: CSSProperties;
}

export function EmptyState({ icon = "search", title, description, action, style }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
        padding: "64px 24px",
        maxWidth: 420,
        margin: "0 auto",
        ...style,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          color: "var(--slate)",
        }}
      >
        <Icon name={icon} size={28} />
      </span>
      {title ? (
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title)", color: "var(--text-primary)", lineHeight: 1.2 }}>
          {title}
        </div>
      ) : null}
      {description ? (
        <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body-s)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {description}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}
