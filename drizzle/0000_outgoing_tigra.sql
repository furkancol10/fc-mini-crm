CREATE TYPE "public"."customer_kind" AS ENUM('lead', 'active');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."quote_item_kind" AS ENUM('part', 'labor', 'service');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'staff');--> statement-breakpoint
CREATE TYPE "public"."user_specialty" AS ENUM('service', 'agency', 'all');--> statement-breakpoint
CREATE TYPE "public"."work_log_type" AS ENUM('status', 'note', 'quote', 'payment');--> statement-breakpoint
CREATE TYPE "public"."work_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."work_status" AS ENUM('new', 'quoted', 'approved', 'in_progress', 'waiting', 'ready', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."work_type" AS ENUM('service', 'agency');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"phone" text,
	"email" text,
	"tax_no" text,
	"kind" "customer_kind" DEFAULT 'lead' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_item_id" integer NOT NULL,
	"amount_kurus" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"invoice_ref" text,
	"note" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_kurus" > 0)
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"kind" "quote_item_kind" DEFAULT 'service' NOT NULL,
	"description" text NOT NULL,
	"qty" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_price_kurus" integer NOT NULL,
	"vat_rate" integer DEFAULT 20 NOT NULL,
	"line_subtotal_kurus" integer DEFAULT 0 NOT NULL,
	"line_vat_kurus" integer DEFAULT 0 NOT NULL,
	"line_total_kurus" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "quote_items_unit_price_nonneg" CHECK ("quote_items"."unit_price_kurus" >= 0),
	CONSTRAINT "quote_items_vat_rate_valid" CHECK ("quote_items"."vat_rate" >= 0 AND "quote_items"."vat_rate" <= 100)
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_item_id" integer NOT NULL,
	"quote_no" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"vat_included" boolean DEFAULT false NOT NULL,
	"subtotal_kurus" integer DEFAULT 0 NOT NULL,
	"vat_total_kurus" integer DEFAULT 0 NOT NULL,
	"total_kurus" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"valid_until" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_quote_no_unique" UNIQUE("quote_no")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"specialty" "user_specialty" DEFAULT 'all' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"assigned_to" integer,
	"code" text NOT NULL,
	"public_token" text NOT NULL,
	"work_type" "work_type" NOT NULL,
	"title" text NOT NULL,
	"status" "work_status" DEFAULT 'new' NOT NULL,
	"priority" "work_priority" DEFAULT 'normal' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"due_date" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_items_code_unique" UNIQUE("code"),
	CONSTRAINT "work_items_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "work_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_item_id" integer NOT NULL,
	"actor_id" integer,
	"type" "work_log_type" NOT NULL,
	"message" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_kind_idx" ON "customers" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "payments_work_item_idx" ON "payments" USING btree ("work_item_id");--> statement-breakpoint
CREATE INDEX "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quotes_work_item_idx" ON "quotes" USING btree ("work_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_work_item_version_uniq" ON "quotes" USING btree ("work_item_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_one_approved_per_work_item_idx" ON "quotes" USING btree ("work_item_id") WHERE "quotes"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "work_items_customer_idx" ON "work_items" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "work_items_assigned_to_idx" ON "work_items" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "work_items_status_idx" ON "work_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "work_items_type_idx" ON "work_items" USING btree ("work_type");--> statement-breakpoint
CREATE INDEX "work_logs_work_item_idx" ON "work_logs" USING btree ("work_item_id");