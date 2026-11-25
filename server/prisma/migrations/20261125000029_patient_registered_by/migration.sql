-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

ALTER TABLE "chip"."patients" ADD COLUMN "registeredByUserId" TEXT;

CREATE INDEX "patients_registeredByUserId_idx" ON "chip"."patients"("registeredByUserId");

ALTER TABLE "chip"."patients"
  ADD CONSTRAINT "patients_registeredByUserId_fkey"
  FOREIGN KEY ("registeredByUserId") REFERENCES "chip"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
