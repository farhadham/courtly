ALTER TABLE "courts" DROP CONSTRAINT "courts_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "courts_name_unique" ON "courts" USING btree (lower("name"));