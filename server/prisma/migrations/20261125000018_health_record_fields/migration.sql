CREATE TYPE "ValidationStatus" AS ENUM ('VALID', 'INVALID', 'UNVERIFIED');

ALTER TABLE "health_records" DROP COLUMN "documentReference";
ALTER TABLE "health_records" DROP COLUMN "recordType";
ALTER TABLE "health_records" ADD COLUMN "hiType" TEXT NOT NULL;
ALTER TABLE "health_records" ADD COLUMN "igVersion" TEXT;
ALTER TABLE "health_records" ADD COLUMN "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "health_records" ADD COLUMN "validationSummary" TEXT;
ALTER TABLE "health_records" ADD COLUMN "sourceHash" TEXT;
ALTER TABLE "health_records" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
