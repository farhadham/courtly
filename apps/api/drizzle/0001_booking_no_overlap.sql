-- Hand-written because drizzle-kit cannot express `EXCLUDE` in its schema DSL.
-- See docs/adr/0001-interval-bookings-with-exclusion-constraint.md.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("court_id" WITH =, tstzrange("start_at", "end_at") WITH &&) WHERE ("status" <> 'CANCELLED');
