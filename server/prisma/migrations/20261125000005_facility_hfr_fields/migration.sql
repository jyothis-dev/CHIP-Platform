ALTER TABLE "facilities" DROP COLUMN "hfrReference";
ALTER TABLE "facilities" ADD COLUMN "hfrId" TEXT;
ALTER TABLE "facilities" ADD COLUMN "hfrVerifiedAt" TIMESTAMP(3);
ALTER TABLE "facilities" ADD COLUMN "hfrStatus" TEXT;
CREATE UNIQUE INDEX "facilities_hfrId_key" ON "facilities"("hfrId");
ALTER TABLE "facilities" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
