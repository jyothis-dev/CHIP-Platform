-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

ALTER TABLE "chip"."users" ADD COLUMN "facilityId" TEXT;

INSERT INTO "chip"."facilities" ("id", "name", "createdAt")
SELECT gen_random_uuid()::text, 'Demo Facility', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "chip"."users")
  AND NOT EXISTS (SELECT 1 FROM "chip"."facilities");

UPDATE "chip"."users"
SET "facilityId" = (
  SELECT "id" FROM "chip"."facilities" ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "facilityId" IS NULL;

ALTER TABLE "chip"."users" ALTER COLUMN "facilityId" SET NOT NULL;

ALTER TABLE "chip"."users"
  ADD CONSTRAINT "users_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "chip"."facilities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "users_facilityId_idx" ON "chip"."users"("facilityId");

ALTER TABLE "chip"."users" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
