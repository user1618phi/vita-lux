CREATE TYPE "public"."admin_role" AS ENUM('owner', 'manager');--> statement-breakpoint
CREATE TYPE "public"."badge_kind" AS ENUM('hit', 'sale', 'new');--> statement-breakpoint
CREATE TYPE "public"."delivery_method" AS ENUM('courier', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."flush_type" AS ENUM('shower', 'rimless', 'tornado');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('photo', 'scheme');--> statement-breakpoint
CREATE TYPE "public"."mount_type" AS ENUM('floor', 'wall');--> statement-breakpoint
CREATE TYPE "public"."notify_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'confirmed', 'shipped', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."outlet_type" AS ENUM('horizontal', 'vertical', 'oblique');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'kaspi', 'install', 'cash');--> statement-breakpoint
CREATE TYPE "public"."price_mode" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."seat_material" AS ENUM('pp', 'duroplast');--> statement-breakpoint
CREATE TYPE "public"."stock_state" AS ENUM('in', 'order', 'out');--> statement-breakpoint
CREATE TABLE "admin_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"phone" text,
	"role" "admin_role" DEFAULT 'manager' NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "admin_user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "attribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"session_id" text NOT NULL,
	"channel" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"referrer" text,
	"landing_path" text,
	"first_touch_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_touch_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"entity" text NOT NULL,
	"entity_id" text,
	"action" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "brand_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "collection_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"state" "stock_state" DEFAULT 'order' NOT NULL,
	"qty" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"path" text NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"alt_ru" text,
	"alt_kk" text,
	"kind" "media_kind" DEFAULT 'photo' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_code" text NOT NULL,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"locale" text DEFAULT 'ru' NOT NULL,
	"subtotal_kzt" integer NOT NULL,
	"delivery_kzt" integer DEFAULT 0 NOT NULL,
	"total_kzt" integer NOT NULL,
	"delivery_method" "delivery_method" NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"city" text,
	"comment" text,
	"name_enc" text NOT NULL,
	"phone_enc" text NOT NULL,
	"phone_hash" text NOT NULL,
	"address_enc" text,
	"consent_version" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"idempotency_key" text NOT NULL,
	"notify_status" "notify_status" DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "order_ref_code_unique" UNIQUE("ref_code"),
	CONSTRAINT "order_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid,
	"sku" text NOT NULL,
	"product_handle" text NOT NULL,
	"name_snapshot" text NOT NULL,
	"unit_price_kzt" integer NOT NULL,
	"qty" integer NOT NULL,
	"line_total_kzt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"wholesale_usd_cents" integer,
	"markup_bp" integer,
	"fx_rate" numeric(10, 2),
	"retail_kzt" integer,
	"old_kzt" integer,
	"mode" "price_mode" DEFAULT 'manual' NOT NULL,
	"round_to" integer DEFAULT 1000 NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"collection_id" uuid,
	"base_article" text,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"outlet_type" "outlet_type",
	"mount_type" "mount_type",
	"flush_type" "flush_type",
	"seat_material" "seat_material",
	"body_material" text,
	"width_mm" integer,
	"depth_mm" integer,
	"height_mm" integer,
	"badge" "badge_kind",
	"sort_weight" integer DEFAULT 0 NOT NULL,
	"installment_months" integer DEFAULT 12 NOT NULL,
	"external_id" text,
	"external_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "product_i18n" (
	"product_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"subtitle" text,
	"description_md" text,
	"seo_title" text,
	"seo_description" text,
	CONSTRAINT "product_i18n_product_id_locale_pk" PRIMARY KEY("product_id","locale")
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"color" text,
	"finish" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"width_mm" integer,
	"depth_mm" integer,
	"height_mm" integer,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"external_id" text
);
--> statement-breakpoint
ALTER TABLE "admin_session" ADD CONSTRAINT "admin_session_user_id_admin_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution" ADD CONSTRAINT "attribution_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_user_id_admin_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_i18n" ADD CONSTRAINT "product_i18n_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant" ADD CONSTRAINT "variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_session_user_idx" ON "admin_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attribution_session_idx" ON "attribution" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "attribution_order_idx" ON "attribution" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "media_product_idx" ON "media" USING btree ("product_id","sort");--> statement-breakpoint
CREATE INDEX "order_status_created_idx" ON "order" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "order_phone_idx" ON "order" USING btree ("phone_hash");--> statement-breakpoint
CREATE INDEX "order_item_order_idx" ON "order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "price_variant_valid_idx" ON "price" USING btree ("variant_id","valid_from");--> statement-breakpoint
CREATE INDEX "product_category_idx" ON "product" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_status_idx" ON "product" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "product_external_idx" ON "product" USING btree ("external_source","external_id");--> statement-breakpoint
CREATE INDEX "variant_product_idx" ON "variant" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variant_sku_idx" ON "variant" USING btree ("sku");