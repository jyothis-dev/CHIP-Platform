-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

ALTER TABLE "chip"."facilities" DROP COLUMN "hfrReference";
ALTER TABLE "chip"."facilities" ADD COLUMN "hfrId" TEXT;
ALTER TABLE "chip"."facilities" ADD COLUMN "hfrVerifiedAt" TIMESTAMP(3);
ALTER TABLE "chip"."facilities" ADD COLUMN "hfrStatus" TEXT;
CREATE UNIQUE INDEX "facilities_hfrId_key" ON "chip"."facilities"("hfrId");
ALTER TABLE "chip"."facilities" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
