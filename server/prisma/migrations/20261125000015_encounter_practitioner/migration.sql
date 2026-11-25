-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

ALTER TABLE "chip"."encounters" ADD COLUMN "practitionerId" TEXT;

ALTER TABLE "chip"."encounters"
  ADD CONSTRAINT "encounters_practitionerId_fkey"
  FOREIGN KEY ("practitionerId") REFERENCES "chip"."practitioners"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
