CREATE TYPE "public"."credential_env" AS ENUM('live', 'test');--> statement-breakpoint
CREATE TYPE "public"."credential_provider" AS ENUM('stripe', 'tabby', 'mapbox', 'smtp');--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "credential_provider" NOT NULL,
	"env" "credential_env" DEFAULT 'live' NOT NULL,
	"key_name" text NOT NULL,
	"value_encrypted" "bytea" NOT NULL,
	"last_four" text,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_credentials_provider_env_key_uq" UNIQUE("provider","env","key_name")
);
--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;