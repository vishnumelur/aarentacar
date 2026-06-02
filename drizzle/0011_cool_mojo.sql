CREATE TYPE "public"."mail_event_status" AS ENUM('queued', 'sent', 'failed', 'bounced', 'deferred');--> statement-breakpoint
CREATE TABLE "mail_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_address" text NOT NULL,
	"template" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"status" "mail_event_status" NOT NULL,
	"message_id" text,
	"detail" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mail_events_status_idx" ON "mail_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mail_events_created_at_idx" ON "mail_events" USING btree ("created_at");