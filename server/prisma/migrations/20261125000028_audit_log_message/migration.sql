-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

ALTER TABLE "chip"."audit_logs" ADD COLUMN "message" TEXT NOT NULL DEFAULT 'Activity recorded.';
