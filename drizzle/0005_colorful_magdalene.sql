ALTER TABLE "driver_pings" DROP CONSTRAINT "driver_pings_driver_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "booking_assignments" DROP CONSTRAINT "booking_assignments_driver_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "booking_assignments" DROP CONSTRAINT "booking_assignments_assigned_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "driver_pings" ADD CONSTRAINT "driver_pings_driver_id_driver_profiles_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_assignments" ADD CONSTRAINT "booking_assignments_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_assignments" ADD CONSTRAINT "booking_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;