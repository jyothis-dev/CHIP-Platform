-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TYPE "chip"."LinkStatus" AS ENUM ('NOT_LINKED', 'LINK_REQUESTED', 'LINKED', 'FAILED');

CREATE TABLE "chip"."care_contexts" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "healthRecordId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "linkStatus" "chip"."LinkStatus" NOT NULL,
    "linkedAt" TIMESTAMP(3),
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_contexts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "care_contexts_facilityId_referenceNumber_key" ON "chip"."care_contexts"("facilityId", "referenceNumber");

ALTER TABLE "chip"."care_contexts"
  ADD CONSTRAINT "care_contexts_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "chip"."facilities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chip"."care_contexts"
  ADD CONSTRAINT "care_contexts_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "chip"."patients"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chip"."care_contexts"
  ADD CONSTRAINT "care_contexts_healthRecordId_fkey"
  FOREIGN KEY ("healthRecordId") REFERENCES "chip"."health_records"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chip"."care_contexts"
  ADD CONSTRAINT "care_contexts_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "chip"."abdm_transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
