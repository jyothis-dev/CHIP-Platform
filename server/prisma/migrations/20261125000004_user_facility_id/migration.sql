ALTER TABLE "users" ADD COLUMN "facilityId" TEXT;

INSERT INTO "facilities" ("id", "name", "createdAt")
SELECT gen_random_uuid()::text, 'Demo Facility', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "users")
  AND NOT EXISTS (SELECT 1 FROM "facilities");

UPDATE "users"
SET "facilityId" = (
  SELECT "id" FROM "facilities" ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "facilityId" IS NULL;

ALTER TABLE "users" ALTER COLUMN "facilityId" SET NOT NULL;

ALTER TABLE "users"
  ADD CONSTRAINT "users_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "facilities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "users_facilityId_idx" ON "users"("facilityId");

ALTER TABLE "users" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
