CREATE TYPE "public"."payment_method" AS ENUM('card', 'tabby', 'cod', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('initiated', 'succeeded', 'failed', 'refunded', 'manual_pending');--> statement-breakpoint
CREATE TYPE "public"."payment_hold_status" AS ENUM('held', 'released', 'captured', 'partially_captured');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('initiated', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"gateway_ref" text,
	"amount_aed" integer NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"status" "payment_status" DEFAULT 'initiated' NOT NULL,
	"captured_at" timestamp with time zone,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"gateway_ref" text,
	"amount_aed" integer NOT NULL,
	"captured_amount_aed" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"status" "payment_hold_status" DEFAULT 'held' NOT NULL,
	"released_at" timestamp with time zone,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"payment_id" uuid,
	"gateway_ref" text,
	"amount_aed" integer NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"reason" text,
	"status" "refund_status" DEFAULT 'initiated' NOT NULL,
	"issued_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_holds" ADD CONSTRAINT "payment_holds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payments_gateway_ref_idx" ON "payments" USING btree ("gateway_ref");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_holds_booking_idx" ON "payment_holds" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payment_holds_gateway_ref_idx" ON "payment_holds" USING btree ("gateway_ref");--> statement-breakpoint
CREATE INDEX "refunds_booking_idx" ON "refunds" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");