-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE INDEX "patients_facilityId_name_idx" ON "chip"."patients"("facilityId", "name");
