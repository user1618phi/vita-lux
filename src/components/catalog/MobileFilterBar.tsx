"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { FilterSheet } from "./FilterSheet";
import { SortSelect, type SortSelectProps } from "./SortSelect";

/* MobileFilterBar — mobile toolbar: «Фильтры (N)» opens the bottom sheet, sort
   sits alongside. The full filter set is passed in as children (server-rendered
   FilterControls) so the sheet needs no filter logic of its own. */

export interface MobileFilterBarProps {
  filtersLabel: string;
  activeCount: number;
  sort: SortSelectProps;
  sheet: {
    title: string;
    closeLabel: string;
    applyLabel: string;
    resetLabel: string;
    resetHref: string;
  };
  children: ReactNode;
}

export function MobileFilterBar({ filtersLabel, activeCount, sort, sheet, children }: MobileFilterBarProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: 44,
            padding: "0 16px",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-s)",
            fontWeight: 500,
            color: "var(--text-primary)",
            background: "var(--surface-card)",
            border: "1px solid var(--border-control)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
          }}
        >
          <Icon name="menu" size={18} color="var(--ink)" />
          {filtersLabel}
          {activeCount > 0 ? (
            <span
              className="vl-mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 20,
                height: 20,
                padding: "0 5px",
                fontSize: "var(--text-micro)",
                color: "#fff",
                background: "var(--brass)",
                borderRadius: "999px",
              }}
            >
              {activeCount}
            </span>
          ) : null}
        </button>
        <div style={{ flex: "none", width: 152 }}>
          <SortSelect {...sort} block />
        </div>
      </div>

      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        title={sheet.title}
        closeLabel={sheet.closeLabel}
        applyLabel={sheet.applyLabel}
        resetLabel={sheet.resetLabel}
        resetHref={sheet.resetHref}
      >
        {children}
      </FilterSheet>
    </>
  );
}
