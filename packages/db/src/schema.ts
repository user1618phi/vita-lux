import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* Vita Lux schema.

   Two rules hold the design together:

   1. Only enum KEYS live here (`white-gloss`, `horizontal`, `rimless`). Every
      localized label stays in messages/*.json, exactly as the storefront
      already resolves them. That is why src/lib/catalog.ts survives the move
      from mock data to Postgres untouched.

   2. Money is always integer. USD in cents, KZT in whole tenge. No float ever
      reaches the database — see src/lib/pricing.ts. */

/* ── enums ─────────────────────────────────────────────────────────────── */

export const productStatus = pgEnum("product_status", ["draft", "active", "archived"]);
export const stockState = pgEnum("stock_state", ["in", "order", "out"]);
export const outletType = pgEnum("outlet_type", ["horizontal", "vertical", "oblique"]);
export const mountType = pgEnum("mount_type", ["floor", "wall"]);
export const flushType = pgEnum("flush_type", ["shower", "rimless", "tornado"]);
export const seatMaterial = pgEnum("seat_material", ["pp", "duroplast"]);
export const badgeKind = pgEnum("badge_kind", ["hit", "sale", "new"]);
export const priceMode = pgEnum("price_mode", ["auto", "manual"]);
export const mediaKind = pgEnum("media_kind", ["photo", "scheme"]);
export const orderStatus = pgEnum("order_status", [
  "new",
  "confirmed",
  "shipped",
  "done",
  "cancelled",
]);
export const deliveryMethod = pgEnum("delivery_method", ["courier", "pickup"]);
export const paymentMethod = pgEnum("payment_method", ["card", "kaspi", "install", "cash"]);
export const notifyStatus = pgEnum("notify_status", ["pending", "sent", "failed"]);
export const adminRole = pgEnum("admin_role", ["owner", "manager"]);

/* ── taxonomy ──────────────────────────────────────────────────────────── */

/* Brands are a whitelist, not an open field: Vita Lux (own production) and
   SMOOW, both of which appear on the official price list. Nothing else. */
export const brand = pgTable("brand", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // "vita-lux" | "smoow"
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const category = pgTable("category", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // route segment: /catalog/[slug]
  parentId: uuid("parent_id"),
  sort: integer("sort").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const collection = pgTable("collection", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // "aura" | "standart" | "bronze"
  sort: integer("sort").notNull().default(0),
});

/* ── product ───────────────────────────────────────────────────────────── */

export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /* URL segment. Derived from the article, disambiguated by width when the
       article repeats — the price list has VL-6109 and VL-6119 twice each. */
    handle: text("handle").notNull().unique(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brand.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id),
    collectionId: uuid("collection_id").references(() => collection.id),
    baseArticle: text("base_article"), // "VL-6102" — shared by its color variants
    status: productStatus("status").notNull().default("draft"),

    // Filterable attributes. Keys only; labels come from messages/*.json.
    outletType: outletType("outlet_type"),
    mountType: mountType("mount_type"),
    flushType: flushType("flush_type"),
    seatMaterial: seatMaterial("seat_material"),
    bodyMaterial: text("body_material"),

    widthMm: integer("width_mm"),
    depthMm: integer("depth_mm"),
    heightMm: integer("height_mm"),

    badge: badgeKind("badge"),
    sortWeight: integer("sort_weight").notNull().default(0),
    installmentMonths: integer("installment_months").notNull().default(24),

    /* Reserved for the sync with the warehouse app the owner already uses.
       Present from day one so that integration needs no migration. */
    externalId: text("external_id"),
    externalSource: text("external_source"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("product_category_idx").on(t.categoryId),
    index("product_status_idx").on(t.status),
    uniqueIndex("product_external_idx").on(t.externalSource, t.externalId),
  ],
);

/* Per-locale copy. Closed vocabularies stay in messages/*.json; only text that
   is unique to a product lives here. */
export const productI18n = pgTable(
  "product_i18n",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(), // "ru" | "kk"
    name: text("name").notNull(),
    subtitle: text("subtitle"),
    descriptionMd: text("description_md"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
  },
  (t) => [primaryKey({ columns: [t.productId, t.locale] })],
);

/* Color variants of one body: VL-6102 / GL / GGL / GR / BGL / G.
   NOTE: `sku` deliberately has no unique index — the real price list repeats
   article numbers across differently-sized products. */
export const variant = pgTable(
  "variant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    color: text("color"), // "white" | "grey" | "gold" | "black" | "marble-lines"
    finish: text("finish").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    widthMm: integer("width_mm"), // overrides the product dimensions when set
    depthMm: integer("depth_mm"),
    heightMm: integer("height_mm"),
    status: productStatus("status").notNull().default("active"),
    sort: integer("sort").notNull().default(0),
    externalId: text("external_id"),
  },
  (t) => [index("variant_product_idx").on(t.productId), index("variant_sku_idx").on(t.sku)],
);

/* ── pricing ───────────────────────────────────────────────────────────── */

/* Append-only: the newest row whose validity window covers now() wins, which
   gives price history for free and makes "who changed this price" answerable.

   Both money columns are nullable on purpose — eight rows on the real price
   list carry "Нет в наличий" instead of a figure. Those render as
   "Цена по запросу" and must not be addable to the cart. */
export const price = pgTable(
  "price",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variant.id, { onDelete: "cascade" }),
    wholesaleUsdCents: integer("wholesale_usd_cents"),
    markupBp: integer("markup_bp"), // basis points: 12000 = ×2.2 retail
    fxRate: numeric("fx_rate", { precision: 10, scale: 2 }),
    retailKzt: integer("retail_kzt"),
    oldKzt: integer("old_kzt"),
    mode: priceMode("mode").notNull().default("manual"),
    roundTo: integer("round_to").notNull().default(1000),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_variant_valid_idx").on(t.variantId, t.validFrom)],
);

export const inventory = pgTable("inventory", {
  variantId: uuid("variant_id")
    .primaryKey()
    .references(() => variant.id, { onDelete: "cascade" }),
  state: stockState("state").notNull().default("order"),
  qty: integer("qty"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
});

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => variant.id, { onDelete: "set null" }),
    path: text("path").notNull(), // storage object key
    url: text("url").notNull(),
    width: integer("width"),
    height: integer("height"),
    altRu: text("alt_ru"),
    altKk: text("alt_kk"),
    kind: mediaKind("kind").notNull().default("photo"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("media_product_idx").on(t.productId, t.sort)],
);

/* Editable configuration the storefront reads at runtime: USD rate, default
   markup, phones, warehouse address, free-delivery threshold, installment terms.
   Keeps the brother from needing a deploy to change a phone number. */
export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
});

/* ── orders ────────────────────────────────────────────────────────────── */

/* Personal data is encrypted at rest with an app-level key (see
   src/lib/crypto.ts) because the database is hosted outside Kazakhstan for now.
   `phoneHash` exists so lookup and de-duplication work without decrypting, and
   so a database dump is not a dump of personal data. All PII sits in these
   three columns, which makes the eventual migration to a KZ-hosted Postgres a
   single scripted move. */
export const order = pgTable(
  "order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refCode: text("ref_code").notNull().unique(), // "VL-7K3M2", generated server-side
    status: orderStatus("status").notNull().default("new"),
    locale: text("locale").notNull().default("ru"),

    subtotalKzt: integer("subtotal_kzt").notNull(),
    deliveryKzt: integer("delivery_kzt").notNull().default(0),
    totalKzt: integer("total_kzt").notNull(),

    deliveryMethod: deliveryMethod("delivery_method").notNull(),
    paymentMethod: paymentMethod("payment_method").notNull(),
    city: text("city"),
    comment: text("comment"),

    nameEnc: text("name_enc").notNull(),
    phoneEnc: text("phone_enc").notNull(),
    phoneHash: text("phone_hash").notNull(),
    addressEnc: text("address_enc"),

    consentVersion: text("consent_version").notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),

    idempotencyKey: text("idempotency_key").notNull().unique(),
    notifyStatus: notifyStatus("notify_status").notNull().default("pending"),
    adminNote: text("admin_note"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [index("order_status_created_idx").on(t.status, t.createdAt), index("order_phone_idx").on(t.phoneHash)],
);

/* Snapshots are mandatory. Prices and names change; a placed order must not. */
export const orderItem = pgTable(
  "order_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => variant.id, { onDelete: "set null" }),
    sku: text("sku").notNull(),
    productHandle: text("product_handle").notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    unitPriceKzt: integer("unit_price_kzt").notNull(),
    qty: integer("qty").notNull(),
    lineTotalKzt: integer("line_total_kzt").notNull(),
  },
  (t) => [index("order_item_order_idx").on(t.orderId)],
);

/* Channel attribution — the record that makes a commission provable. */
export const attribution = pgTable(
  "attribution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => order.id, { onDelete: "set null" }),
    sessionId: text("session_id").notNull(),
    channel: text("channel"), // "site" | "whatsapp" | "kaspi" | "instagram"
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    referrer: text("referrer"),
    landingPath: text("landing_path"),
    firstTouchAt: timestamp("first_touch_at", { withTimezone: true }).notNull().defaultNow(),
    lastTouchAt: timestamp("last_touch_at", { withTimezone: true }).notNull().defaultNow(),
    ipHash: text("ip_hash"),
  },
  (t) => [index("attribution_session_idx").on(t.sessionId), index("attribution_order_idx").on(t.orderId)],
);

/* ── admin ─────────────────────────────────────────────────────────────── */

export const adminUser = pgTable("admin_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  phone: text("phone"),
  role: adminRole("role").notNull().default("manager"),
  passwordHash: text("password_hash").notNull(), // scrypt, node:crypto
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const adminSession = pgTable(
  "admin_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUser.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_session_user_idx").on(t.userId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id").references(() => adminUser.id, { onDelete: "set null" }),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    action: text("action").notNull(),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId)],
);
