CREATE TABLE "agent_permissions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"can_approve_bookings" boolean DEFAULT false NOT NULL,
	"can_review_kyc" boolean DEFAULT false NOT NULL,
	"can_edit_pricing" boolean DEFAULT false NOT NULL,
	"can_manage_promos" boolean DEFAULT false NOT NULL,
	"can_view_revenue" boolean DEFAULT false NOT NULL,
	"can_manage_drivers" boolean DEFAULT false NOT NULL,
	"can_edit_settings" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_permissions" ADD CONSTRAINT "agent_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_read_at_idx" ON "notifications" USING btree ("read_at");