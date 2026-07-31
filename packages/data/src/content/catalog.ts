import type { CatalogItem, CategoryFilterConfig, PriceBucket } from "@vita/core/catalog";
import { img } from "@vita/core/img";

/* Catalog inventory (mock). Numeric/enum attributes only — display copy lives in
   the i18n catalogs (messages/*.json), keyed by handle. Все товары — Vita Lux;
   поля `brand`/`rating` отсутствуют. Photos mirror the Vita Lux macket
   (Unsplash) until real product photography is shot — see @vita/core/img. */

// Photo ids reused across the catalog (from the macket).
const PHOTO = {
  toiletWall: "1611066415697-7f58dc0a5d10",
  toiletFloor: "1563204719-44395a035bb6",
  toiletAlt: "1762810963385-0d91f2539fa2",
  sinkOvale: "1595514535316-b8c85bf9bbf9",
  sinkNoir: "1617198191416-f6e6b0de337f",
  sinkAlt: "1595515770330-ceeea7d82cfd",
  faucetBronze: "1773177930149-48a2f5df9e07",
  faucetChrome: "1761353854551-361b1c804849",
  faucetAlt: "1773177930292-463ca3c5b86a",
  showerRain: "1613849925362-38fb4c16ff36",
  showerHalo: "1677454759826-3922020f2ffb",
  showerAlt: "1654805678230-f0e33c7c903c",
  bathOnda: "1507652313519-d4e9174996dd",
  bathCalm: "1625801882109-032ad88edeb3",
  bathAlt: "1631215750638-bdde5f616128",
  vanityWood: "1682888818696-906287d759f5",
  mirrorLumen: "1613849925580-8ef3bc1cf219",
  furnitureAlt: "1595515106883-5d5da3043540",
} as const;

export const catalogItems: CatalogItem[] = [
  /* ── Унитазы (brief-aligned collections + outlet/mount) ─────────────── */
  {
    handle: "aura-540", sku: "VL-A540-W", category: "toilets", collection: "aura",
    price: 189000, oldPrice: 215000, outletType: "horizontal", mountType: "wall",
    finish: "white-gloss", material: "sanware", stock: "in", badge: "hit", installmentMonths: 24,
    image: img(PHOTO.toiletWall), gallery: [img(PHOTO.toiletWall), img(PHOTO.toiletAlt)],
  },
  {
    handle: "aura-560", sku: "VL-A560-W", category: "toilets", collection: "aura",
    price: 205000, outletType: "horizontal", mountType: "wall",
    finish: "white-gloss", material: "sanware", stock: "in", badge: "new", installmentMonths: 24,
    image: img(PHOTO.toiletAlt), gallery: [img(PHOTO.toiletAlt), img(PHOTO.toiletWall)],
  },
  {
    handle: "aura-520", sku: "VL-A520-W", category: "toilets", collection: "aura",
    price: 172000, outletType: "horizontal", mountType: "wall",
    finish: "white-gloss", material: "sanware", stock: "in", installmentMonths: 24,
    image: img(PHOTO.toiletWall), gallery: [img(PHOTO.toiletWall)],
  },
  {
    handle: "standart-330", sku: "VL-S330-W", category: "toilets", collection: "standart",
    price: 132000, outletType: "oblique", mountType: "floor",
    finish: "white-gloss", material: "sanware", stock: "in", installmentMonths: 24,
    image: img(PHOTO.toiletFloor), gallery: [img(PHOTO.toiletFloor)],
  },
  {
    handle: "standart-350", sku: "VL-S350-W", category: "toilets", collection: "standart",
    price: 118000, oldPrice: 139000, outletType: "horizontal", mountType: "floor",
    finish: "white-gloss", material: "sanware", stock: "in", badge: "sale", installmentMonths: 24,
    image: img(PHOTO.toiletFloor), gallery: [img(PHOTO.toiletFloor), img(PHOTO.toiletAlt)],
  },
  {
    handle: "standart-360", sku: "VL-S360-M", category: "toilets", collection: "standart",
    price: 145000, outletType: "vertical", mountType: "floor",
    finish: "white-matte", material: "sanware", stock: "order", installmentMonths: 24,
    image: img(PHOTO.toiletAlt), gallery: [img(PHOTO.toiletAlt)],
  },
  {
    handle: "standart-340", sku: "VL-S340-W", category: "toilets", collection: "standart",
    price: 109000, outletType: "vertical", mountType: "floor",
    finish: "white-gloss", material: "sanware", stock: "out", installmentMonths: 24,
    image: img(PHOTO.toiletFloor), gallery: [img(PHOTO.toiletFloor)],
  },
  {
    handle: "bronze-580", sku: "VL-B580-G", category: "toilets", collection: "bronze",
    price: 268000, outletType: "horizontal", mountType: "wall",
    finish: "graphite-matte", material: "sanware", stock: "in", badge: "hit", installmentMonths: 24,
    image: img(PHOTO.toiletWall), gallery: [img(PHOTO.toiletWall), img(PHOTO.toiletAlt)],
  },
  {
    handle: "bronze-600", sku: "VL-B600-A", category: "toilets", collection: "bronze",
    price: 245000, outletType: "oblique", mountType: "floor",
    finish: "anthracite-matte", material: "sanware", stock: "order", installmentMonths: 24,
    image: img(PHOTO.toiletFloor), gallery: [img(PHOTO.toiletFloor)],
  },

  /* ── Раковины ──────────────────────────────────────────────────────── */
  {
    handle: "sink-ovale", sku: "VL-SNK-OVL", category: "sinks", collection: "aura",
    price: 78900, oldPrice: 94900, finish: "white-gloss", material: "ceramic",
    stock: "in", badge: "sale", installmentMonths: 24,
    image: img(PHOTO.sinkOvale), gallery: [img(PHOTO.sinkOvale), img(PHOTO.sinkAlt), img(PHOTO.sinkNoir)],
  },
  {
    handle: "sink-noir", sku: "VL-SNK-NOIR", category: "sinks", collection: "bronze",
    price: 64500, finish: "black-matte", material: "ceramic",
    stock: "in", badge: "new", installmentMonths: 24,
    image: img(PHOTO.sinkNoir), gallery: [img(PHOTO.sinkNoir), img(PHOTO.sinkOvale)],
  },

  /* ── Смесители ─────────────────────────────────────────────────────── */
  {
    handle: "faucet-bronze", sku: "VL-FCT-BRZ", category: "faucets", collection: "bronze",
    price: 56900, oldPrice: 69900, finish: "bronze", material: "brass",
    stock: "in", badge: "hit", installmentMonths: 24,
    image: img(PHOTO.faucetBronze), gallery: [img(PHOTO.faucetBronze), img(PHOTO.faucetChrome), img(PHOTO.faucetAlt)],
  },
  {
    handle: "faucet-chrome", sku: "VL-FCT-CHR", category: "faucets", collection: "standart",
    price: 72900, finish: "chrome", material: "brass", mountType: "wall",
    stock: "in", badge: "new", installmentMonths: 24,
    image: img(PHOTO.faucetChrome), gallery: [img(PHOTO.faucetChrome), img(PHOTO.faucetAlt)],
  },

  /* ── Ванны и душ ───────────────────────────────────────────────────── */
  {
    handle: "shower-rain", sku: "VL-SHW-RAIN", category: "bath", collection: "bronze",
    price: 184900, oldPrice: 214900, finish: "black-matte", material: "steel",
    stock: "in", badge: "hit", installmentMonths: 24,
    image: img(PHOTO.showerRain), gallery: [img(PHOTO.showerRain), img(PHOTO.showerAlt), img(PHOTO.showerHalo)],
  },
  {
    handle: "shower-halo", sku: "VL-SHW-HALO", category: "bath", collection: "standart",
    price: 38900, finish: "chrome", material: "steel",
    stock: "in", installmentMonths: 24,
    image: img(PHOTO.showerHalo), gallery: [img(PHOTO.showerHalo), img(PHOTO.showerRain)],
  },
  {
    handle: "bath-onda", sku: "VL-BTH-ONDA", category: "bath", collection: "aura",
    price: 412000, oldPrice: 469000, finish: "white-gloss", material: "cast-marble",
    stock: "in", badge: "hit", installmentMonths: 24,
    image: img(PHOTO.bathOnda), gallery: [img(PHOTO.bathOnda), img(PHOTO.bathCalm), img(PHOTO.bathAlt)],
  },
  {
    handle: "bath-calm", sku: "VL-BTH-CALM", category: "bath", collection: "standart",
    price: 268000, finish: "white-gloss", material: "acrylic",
    stock: "in", installmentMonths: 24,
    image: img(PHOTO.bathCalm), gallery: [img(PHOTO.bathCalm), img(PHOTO.bathAlt)],
  },

  /* ── Мебель для ванной ─────────────────────────────────────────────── */
  {
    handle: "vanity-wood", sku: "VL-FRN-WOOD", category: "furniture", collection: "standart",
    price: 159900, oldPrice: 179900, finish: "wood", material: "mdf", mountType: "wall",
    stock: "in", badge: "sale", installmentMonths: 24,
    image: img(PHOTO.vanityWood), gallery: [img(PHOTO.vanityWood), img(PHOTO.furnitureAlt), img(PHOTO.mirrorLumen)],
  },
  {
    handle: "mirror-lumen", sku: "VL-FRN-LUM", category: "furniture", collection: "standart",
    price: 96900, finish: "wood", material: "mdf", mountType: "wall",
    stock: "in", badge: "new", installmentMonths: 24,
    image: img(PHOTO.mirrorLumen), gallery: [img(PHOTO.mirrorLumen), img(PHOTO.furnitureAlt)],
  },
];

/* Shared price buckets spanning the whole catalog (₸). */
const PRICE_BUCKETS: PriceBucket[] = [
  { id: "0-80000", min: 0, max: 80000 },
  { id: "80000-150000", min: 80000, max: 150000 },
  { id: "150000-260000", min: 150000, max: 260000 },
  { id: "260000", min: 260000, max: null },
];

const ALL_COLLECTIONS = ["aura", "standart", "bronze"];

/* Per-category filter facets. Тип выпуска / тип монтажа — только там, где
   релевантно (унитазы); для остальных категорий эти группы пусты и скрываются. */
export const categoryFilters: Record<string, CategoryFilterConfig> = {
  toilets: {
    collections: ALL_COLLECTIONS,
    outlet: ["horizontal", "vertical", "oblique"],
    mount: ["wall", "floor"],
    finishes: ["white-gloss", "white-matte", "graphite-matte", "anthracite-matte"],
    price: PRICE_BUCKETS,
  },
  sinks: {
    collections: ALL_COLLECTIONS,
    outlet: [],
    mount: [],
    finishes: ["white-gloss", "black-matte"],
    price: PRICE_BUCKETS,
  },
  faucets: {
    collections: ALL_COLLECTIONS,
    outlet: [],
    mount: [],
    finishes: ["bronze", "chrome"],
    price: PRICE_BUCKETS,
  },
  bath: {
    collections: ALL_COLLECTIONS,
    outlet: [],
    mount: [],
    finishes: ["white-gloss", "black-matte", "chrome"],
    price: PRICE_BUCKETS,
  },
  furniture: {
    collections: ALL_COLLECTIONS,
    outlet: [],
    mount: [],
    finishes: ["wood"],
    price: PRICE_BUCKETS,
  },
};

export function getCategoryItems(category: string): CatalogItem[] {
  return catalogItems.filter((it) => it.category === category);
}

export function getCategoryConfig(category: string): CategoryFilterConfig | undefined {
  return categoryFilters[category];
}

export function getCatalogItem(handle: string): CatalogItem | undefined {
  return catalogItems.find((it) => it.handle === handle);
}
