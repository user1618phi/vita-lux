CREATE TABLE "x2pos_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"order_id" uuid NOT NULL,
	"form_guid" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "x2pos_outbox_form_guid_unique" UNIQUE("form_guid")
);
--> statement-breakpoint
CREATE TABLE "x2pos_sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "x2pos_order_id" text;--> statement-breakpoint
ALTER TABLE "price" ADD COLUMN "wholesale_kzt" integer;--> statement-breakpoint
ALTER TABLE "price" ADD COLUMN "base_retail_kzt" integer;--> statement-breakpoint
ALTER TABLE "x2pos_outbox" ADD CONSTRAINT "x2pos_outbox_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "x2pos_outbox_pending_idx" ON "x2pos_outbox" USING btree ("done_at","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_external_idx" ON "variant" USING btree ("external_id") WHERE "variant"."external_id" is not null;