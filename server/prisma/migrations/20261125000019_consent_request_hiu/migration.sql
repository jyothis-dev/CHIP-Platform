-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TYPE "chip"."ConsentStatus" AS ENUM ('REQUESTED', 'GRANTED', 'DENIED', 'EXPIRED', 'REVOKED');

ALTER TABLE "chip"."consent_requests" DROP CONSTRAINT "consent_requests_patientId_fkey";
DROP INDEX "chip"."consent_requests_patientId_idx";

ALTER TABLE "chip"."consent_requests" DROP COLUMN "patientId";
ALTER TABLE "chip"."consent_requests" DROP COLUMN "workflowReference";
ALTER TABLE "chip"."consent_requests" DROP COLUMN "scope";
ALTER TABLE "chip"."consent_requests" DROP COLUMN "validFrom";
ALTER TABLE "chip"."consent_requests" DROP COLUMN "validTo";

ALTER TABLE "chip"."consent_requests"
  ALTER COLUMN "status" TYPE "chip"."ConsentStatus"
  USING (
    CASE upper("status")
      WHEN 'REQUESTED' THEN 'REQUESTED'::"chip"."ConsentStatus"
      WHEN 'GRANTED' THEN 'GRANTED'::"chip"."ConsentStatus"
      WHEN 'DENIED' THEN 'DENIED'::"chip"."ConsentStatus"
      WHEN 'EXPIRED' THEN 'EXPIRED'::"chip"."ConsentStatus"
      WHEN 'REVOKED' THEN 'REVOKED'::"chip"."ConsentStatus"
      ELSE NULL
    END
  );

ALTER TABLE "chip"."consent_requests" ADD COLUMN "patientAbhaAddress" TEXT NOT NULL;
ALTER TABLE "chip"."consent_requests" ADD COLUMN "purposeCode" TEXT NOT NULL;
ALTER TABLE "chip"."consent_requests" ADD COLUMN "hiTypes" TEXT[] NOT NULL;
ALTER TABLE "chip"."consent_requests" ADD COLUMN "dateFrom" TIMESTAMP(3) NOT NULL;
ALTER TABLE "chip"."consent_requests" ADD COLUMN "dateTo" TIMESTAMP(3) NOT NULL;
ALTER TABLE "chip"."consent_requests" ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "chip"."consent_requests" ADD COLUMN "externalConsentRequestId" TEXT;
ALTER TABLE "chip"."consent_requests" ADD COLUMN "transactionId" TEXT NOT NULL;
ALTER TABLE "chip"."consent_requests" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "consent_requests_externalConsentRequestId_idx" ON "chip"."consent_requests"("externalConsentRequestId");

ALTER TABLE "chip"."consent_requests"
  ADD CONSTRAINT "consent_requests_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "chip"."abdm_transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
