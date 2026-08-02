CREATE TABLE "x2pos_account" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"amount_kzt" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'KZT' NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "x2pos_customer" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"city" text,
	"debt_kzt" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "x2pos_doc" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"status" text NOT NULL,
	"doc_date" text,
	"quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"amount_kzt" integer DEFAULT 0 NOT NULL,
	"supplier" text,
	"items" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "x2pos_sale" (
	"id" text PRIMARY KEY NOT NULL,
	"sold_at" timestamp with time zone,
	"total_kzt" integer DEFAULT 0 NOT NULL,
	"paid_kzt" integer DEFAULT 0 NOT NULL,
	"status" text,
	"is_return" boolean DEFAULT false NOT NULL,
	"from_site" boolean DEFAULT false NOT NULL,
	"customer_name" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "x2pos_sale_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" text NOT NULL,
	"name" text NOT NULL,
	"vendor_code" text,
	"qty" numeric(12, 3) DEFAULT '0' NOT NULL,
	"total_kzt" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "x2pos_sale_item" ADD CONSTRAINT "x2pos_sale_item_sale_id_x2pos_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."x2pos_sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "x2pos_sale_date_idx" ON "x2pos_sale" USING btree ("sold_at");--> statement-breakpoint
CREATE INDEX "x2pos_sale_site_idx" ON "x2pos_sale" USING btree ("from_site");--> statement-breakpoint
CREATE INDEX "x2pos_sale_item_sale_idx" ON "x2pos_sale_item" USING btree ("sale_id");