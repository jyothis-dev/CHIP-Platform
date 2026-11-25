-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TYPE "chip"."ValidationStatus" AS ENUM ('VALID', 'INVALID', 'UNVERIFIED');

ALTER TABLE "chip"."health_records" DROP COLUMN "documentReference";
ALTER TABLE "chip"."health_records" DROP COLUMN "recordType";
ALTER TABLE "chip"."health_records" ADD COLUMN "hiType" TEXT NOT NULL;
ALTER TABLE "chip"."health_records" ADD COLUMN "igVersion" TEXT;
ALTER TABLE "chip"."health_records" ADD COLUMN "validationStatus" "chip"."ValidationStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "chip"."health_records" ADD COLUMN "validationSummary" TEXT;
ALTER TABLE "chip"."health_records" ADD COLUMN "sourceHash" TEXT;
ALTER TABLE "chip"."health_records" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
