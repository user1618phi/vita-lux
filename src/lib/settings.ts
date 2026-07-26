import "server-only";
import { unstable_cache } from "next/cache";
import { db, hasDatabase, schema } from "@/db/client";

/* Runtime configuration, editable from the admin panel.

   These were hardcoded across the storefront (the free-delivery threshold in
   CheckoutView, the phone in data/home.ts, the Almaty address in the footer
   copy). Reading them from here means the brother can fix a phone number
   without a deploy — and the defaults below keep everything working before the
   database exists. */

export const SETTINGS_TAG = "settings";

export interface StoreSettings {
  phonePrimary: string;
  phoneSecondary: string;
  city: string;
  address: string;
  freeFromKzt: number;
  deliveryCostKzt: number;
  installmentMonths: number;
  installmentEnabled: boolean;
}

/* Defaults match what the code shipped with, so nothing changes behaviour
   until a real value is entered in the admin. */
const DEFAULTS: StoreSettings = {
  phonePrimary: "77000000000",
  phoneSecondary: "",
  city: "",
  address: "",
  freeFromKzt: 150000,
  deliveryCostKzt: 3900,
  installmentMonths: 12,
  installmentEnabled: true,
};

const KEYS: Record<keyof StoreSettings, string> = {
  phonePrimary: "contact.phonePrimary",
  phoneSecondary: "contact.phoneSecondary",
  city: "contact.city",
  address: "contact.address",
  freeFromKzt: "delivery.freeFromKzt",
  deliveryCostKzt: "delivery.costKzt",
  installmentMonths: "installment.months",
  installmentEnabled: "installment.enabled",
};

async function load(): Promise<StoreSettings> {
  if (!hasDatabase()) return DEFAULTS;

  try {
    const rows = await db().select().from(schema.setting);
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const out = { ...DEFAULTS };

    for (const [field, key] of Object.entries(KEYS) as [keyof StoreSettings, string][]) {
      const raw = byKey.get(key);
      if (raw === undefined || raw === null || raw === "") continue;

      const fallback = DEFAULTS[field];
      if (typeof fallback === "number") {
        const n = Number(raw);
        if (Number.isFinite(n)) (out[field] as number) = n;
      } else if (typeof fallback === "boolean") {
        (out[field] as boolean) = raw === true || raw === 1 || raw === "1" || raw === "true";
      } else {
        (out[field] as string) = String(raw);
      }
    }
    return out;
  } catch {
    // Never let a settings read take the storefront down.
    return DEFAULTS;
  }
}

export const getSettings = unstable_cache(load, ["store-settings"], { tags: [SETTINGS_TAG] });
