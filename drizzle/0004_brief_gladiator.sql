CREATE TYPE "public"."driver_status" AS ENUM('available', 'on_duty', 'off_duty', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('offered', 'accepted', 'declined', 'reassigned');--> statement-breakpoint
CREATE TABLE "driver_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"license_no" text NOT NULL,
	"license_expiry" date NOT NULL,
	"status" "driver_status" DEFAULT 'off_duty' NOT NULL,
	"current_lat" double precision,
	"current_lng" double precision,
	"last_ping_at" timestamp with time zone,
	"rating_avg" integer,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "driver_pings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"booking_id" uuid,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"heading" integer,
	"speed" double precision,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"status" "assignment_status" DEFAULT 'offered' NOT NULL,
	"decline_reason" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_pings" ADD CONSTRAINT "driver_pings_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_pings" ADD CONSTRAINT "driver_pings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_assignments" ADD CONSTRAINT "booking_assignments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_assignments" ADD CONSTRAINT "booking_assignments_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_assignments" ADD CONSTRAINT "booking_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "driver_pings_driver_recorded_at_idx" ON "driver_pings" USING btree ("driver_id","recorded_at");--> statement-breakpoint
CREATE INDEX "booking_assignments_booking_idx" ON "booking_assignments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_assignments_driver_idx" ON "booking_assignments" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "booking_assignments_status_idx" ON "booking_assignments" USING btree ("status");