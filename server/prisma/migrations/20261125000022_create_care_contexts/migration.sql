CREATE TYPE "LinkStatus" AS ENUM ('NOT_LINKED', 'LINK_REQUESTED', 'LINKED', 'FAILED');

CREATE TABLE "care_contexts" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "healthRecordId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "linkStatus" "LinkStatus" NOT NULL,
    "linkedAt" TIMESTAMP(3),
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_contexts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "care_contexts_facilityId_referenceNumber_key" ON "care_contexts"("facilityId", "referenceNumber");

ALTER TABLE "care_contexts"
  ADD CONSTRAINT "care_contexts_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "facilities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "care_contexts"
  ADD CONSTRAINT "care_contexts_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "care_contexts"
  ADD CONSTRAINT "care_contexts_healthRecordId_fkey"
  FOREIGN KEY ("healthRecordId") REFERENCES "health_records"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "care_contexts"
  ADD CONSTRAINT "care_contexts_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "abdm_transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
