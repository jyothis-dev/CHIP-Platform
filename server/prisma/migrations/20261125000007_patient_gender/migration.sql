-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

ALTER TABLE "chip"."patients" ADD COLUMN "gender" TEXT NOT NULL;
