CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'diesel', 'hybrid', 'electric');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('automatic', 'manual');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('active', 'maintenance', 'retired');--> statement-breakpoint
CREATE TYPE "public"."rate_kind" AS ENUM('hourly', 'daily', 'weekly', 'monthly', 'package');--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "vehicle_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"advance_book_min_days" integer DEFAULT 0 NOT NULL,
	"min_driver_age" integer DEFAULT 21 NOT NULL,
	"default_deposit_aed" integer DEFAULT 1000 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vehicle_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_id" uuid NOT NULL,
	"branch_id" uuid,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer NOT NULL,
	"plate" text NOT NULL,
	"color" text,
	"transmission" "transmission" DEFAULT 'automatic' NOT NULL,
	"seats" integer DEFAULT 5 NOT NULL,
	"doors" integer DEFAULT 4 NOT NULL,
	"fuel_type" "fuel_type" DEFAULT 'petrol' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "vehicle_status" DEFAULT 'active' NOT NULL,
	"primary_photo_url" text,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vehicles_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
CREATE TABLE "vehicle_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"rate_kind" "rate_kind" NOT NULL,
	"price_aed" integer NOT NULL,
	"package_name" text,
	"package_hours" integer,
	"package_description" text,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle_types" ADD CONSTRAINT "vehicle_types_category_id_vehicle_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."vehicle_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_type_id_vehicle_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_rates" ADD CONSTRAINT "vehicle_rates_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_types_category_idx" ON "vehicle_types" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "vehicles_type_idx" ON "vehicles" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "vehicles_status_idx" ON "vehicles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vehicles_branch_idx" ON "vehicles" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "vehicle_rates_vehicle_idx" ON "vehicle_rates" USING btree ("vehicle_id");