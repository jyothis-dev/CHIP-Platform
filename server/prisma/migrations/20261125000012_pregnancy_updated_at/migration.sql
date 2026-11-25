-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

ALTER TABLE "chip"."pregnancies" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
