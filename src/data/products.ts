import type { IconName } from "@/components/ui/Icon";
import type { StockState } from "@/components/ui/StockStatus";

/* Numeric / configuration data for products. Human-readable copy lives in the
   i18n message catalogs (messages/*.json), zipped by index with these arrays.
   In production this is where the Medusa product mapping would land — поля
   `brand` и `rating` в модели НЕТ (см. CLAUDE.md), бренд всегда Vita Lux. */

export interface RelatedRef {
  handle: string;
  price: number;
  oldPrice?: number;
}

export interface ProductData {
  handle: string;
  sku: string;
  price: number;
  oldPrice: number;
  installmentMonths: number;
  stock: StockState;
  galleryCount: number;
  dims: { line: string; width: string; height: string; front: string };
  trustIcons: IconName[];
  bundle: { itemPrices: number[]; sum: number; set: number; save: number };
  related: RelatedRef[];
  whatsappPhone: string;
}

export const products: Record<string, ProductData> = {
  "aura-540": {
    handle: "aura-540",
    sku: "VL-A540-W",
    price: 189000,
    oldPrice: 215000,
    installmentMonths: 12,
    stock: "in",
    galleryCount: 4,
    dims: { line: "540 × 360 × 355 мм", width: "540 мм", height: "355 мм", front: "360 мм" },
    trustIcons: ["shield-check", "package", "home"],
    bundle: { itemPrices: [189000, 95000, 32000], sum: 316000, set: 289000, save: 27000 },
    related: [
      { handle: "aura-600-sink", price: 78000 },
      { handle: "aura-faucet", price: 42000, oldPrice: 52000 },
      { handle: "aura-install", price: 95000 },
      { handle: "aura-600-vanity", price: 165000 },
    ],
    whatsappPhone: "77000000000",
  },
};

export function getProduct(handle: string): ProductData | undefined {
  return products[handle];
}

/** wa.me deep link. The referral code that ties WhatsApp sales to the channel
    must be generated server-side and written to the DB (см. CLAUDE.md); this is
    the click-to-chat surface only. */
export function whatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
