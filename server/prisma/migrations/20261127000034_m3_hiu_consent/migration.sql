-- M3 HIU: consent requests, artefacts, health information requests, received records.
-- Hand-written and limited to the "chip" schema. Applied migrations are not edited.

CREATE TYPE "chip"."HiuRequestStatus" AS ENUM ('INIT_SENT', 'INIT_FAILED', 'REQUESTED', 'GRANTED', 'DENIED', 'EXPIRED', 'REVOKED');

-- consent_requests (HIU only; unused before M3)
ALTER TABLE "chip"."consent_requests"
  ADD COLUMN "patientId" TEXT,
  ADD COLUMN "facilityId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "purposeText" TEXT,
  ADD COLUMN "purposeRefUri" TEXT,
  ADD COLUMN "accessMode" TEXT,
  ADD COLUMN "frequency" JSONB,
  ADD COLUMN "dataEraseAt" TIMESTAMP(3),
  ADD COLUMN "requesterName" TEXT,
  ADD COLUMN "statusChangedAt" TIMESTAMP(3),
  ADD COLUMN "grantedAt" TIMESTAMP(3),
  ADD COLUMN "deniedAt" TIMESTAMP(3),
  ADD COLUMN "expiredAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "lastErrorMessage" TEXT;

ALTER TABLE "chip"."consent_requests"
  ALTER COLUMN "status" TYPE "chip"."HiuRequestStatus"
  USING ("status"::text::"chip"."HiuRequestStatus");

DROP INDEX IF EXISTS "chip"."consent_requests_externalConsentRequestId_idx";
CREATE UNIQUE INDEX "consent_requests_externalConsentRequestId_key"
  ON "chip"."consent_requests"("externalConsentRequestId");
CREATE INDEX "consent_requests_patientId_createdAt_idx"
  ON "chip"."consent_requests"("patientId", "createdAt");
CREATE INDEX "consent_requests_status_idx" ON "chip"."consent_requests"("status");

ALTER TABLE "chip"."consent_requests"
  ADD CONSTRAINT "consent_requests_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "chip"."patients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- consent_artefacts (shared with HIP; additive, and nullable where an HIU row exists before fetch)
ALTER TABLE "chip"."consent_artefacts"
  ADD COLUMN "hipName" TEXT,
  ADD COLUMN "careContexts" JSONB,
  ADD COLUMN "accessMode" TEXT,
  ADD COLUMN "expiredAt" TIMESTAMP(3),
  ADD COLUMN "fetchedAt" TIMESTAMP(3),
  ADD COLUMN "lastFetchRequestId" TEXT,
  ADD COLUMN "signature" TEXT,
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "lastErrorMessage" TEXT,
  ALTER COLUMN "patientRef" DROP NOT NULL,
  ALTER COLUMN "hipId" DROP NOT NULL,
  ALTER COLUMN "dateFrom" DROP NOT NULL,
  ALTER COLUMN "dateTo" DROP NOT NULL,
  ALTER COLUMN "expiresAt" DROP NOT NULL;

-- health_information_requests
ALTER TABLE "chip"."health_information_requests"
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "privateKeyEnc" TEXT,
  ADD COLUMN "nonce" TEXT,
  ADD COLUMN "dateFrom" TIMESTAMP(3),
  ADD COLUMN "dateTo" TIMESTAMP(3),
  ADD COLUMN "pagesExpected" INTEGER,
  ADD COLUMN "pagesReceived" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sessionStatus" TEXT,
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "lastErrorMessage" TEXT;

CREATE INDEX "health_information_requests_externalTransactionId_idx"
  ON "chip"."health_information_requests"("externalTransactionId");
CREATE INDEX "health_information_requests_requestId_idx"
  ON "chip"."health_information_requests"("requestId");

-- data_transfers: an HIU receipt has no local care context
ALTER TABLE "chip"."data_transfers"
  ADD COLUMN "careContextReference" TEXT,
  ADD COLUMN "hipId" TEXT,
  ADD COLUMN "pageNumber" INTEGER,
  ALTER COLUMN "careContextId" DROP NOT NULL;

-- received_health_records
CREATE TABLE "chip"."received_health_records" (
    "id" TEXT NOT NULL,
    "dataTransferId" TEXT NOT NULL,
    "consentArtefactId" TEXT NOT NULL,
    "patientId" TEXT,
    "careContextReference" TEXT NOT NULL,
    "hiType" TEXT,
    "bundleEnc" TEXT,
    "checksumOk" BOOLEAN NOT NULL,
    "validationStatus" "chip"."ValidationStatus" NOT NULL,
    "validationProblems" JSONB,
    "byteLength" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgedAt" TIMESTAMP(3),
    "purgeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "received_health_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "received_health_records_consentArtefactId_idx"
  ON "chip"."received_health_records"("consentArtefactId");

ALTER TABLE "chip"."received_health_records"
  ADD CONSTRAINT "received_health_records_dataTransferId_fkey"
  FOREIGN KEY ("dataTransferId") REFERENCES "chip"."data_transfers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chip"."received_health_records"
  ADD CONSTRAINT "received_health_records_consentArtefactId_fkey"
  FOREIGN KEY ("consentArtefactId") REFERENCES "chip"."consent_artefacts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chip"."received_health_records"
  ADD CONSTRAINT "received_health_records_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "chip"."patients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
