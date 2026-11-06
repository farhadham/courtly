CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"court_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"duration_hours" smallint NOT NULL,
	"price_cents" integer NOT NULL,
	"status" text DEFAULT 'CONFIRMED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_end_after_start" CHECK ("bookings"."end_at" > "bookings"."start_at"),
	CONSTRAINT "bookings_duration_hours" CHECK ("bookings"."duration_hours" in (1, 2)),
	CONSTRAINT "bookings_status_valid" CHECK ("bookings"."status" in ('CONFIRMED', 'CANCELLED')),
	CONSTRAINT "bookings_price_non_negative" CHECK ("bookings"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sport_type" text NOT NULL,
	"hourly_price_cents" integer NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "courts_name_unique" UNIQUE("name"),
	CONSTRAINT "courts_sport_type_length" CHECK (char_length("courts"."sport_type") between 1 and 50),
	CONSTRAINT "courts_hourly_price_non_negative" CHECK ("courts"."hourly_price_cents" >= 0),
	CONSTRAINT "courts_opening_window" CHECK ("courts"."opens_at" < "courts"."closes_at")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'USER' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_valid" CHECK ("users"."role" in ('USER', 'ADMIN'))
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;