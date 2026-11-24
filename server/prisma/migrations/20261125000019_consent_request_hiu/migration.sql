CREATE TYPE "ConsentStatus" AS ENUM ('REQUESTED', 'GRANTED', 'DENIED', 'EXPIRED', 'REVOKED');

ALTER TABLE "consent_requests" DROP CONSTRAINT "consent_requests_patientId_fkey";
DROP INDEX "consent_requests_patientId_idx";

ALTER TABLE "consent_requests" DROP COLUMN "patientId";
ALTER TABLE "consent_requests" DROP COLUMN "workflowReference";
ALTER TABLE "consent_requests" DROP COLUMN "scope";
ALTER TABLE "consent_requests" DROP COLUMN "validFrom";
ALTER TABLE "consent_requests" DROP COLUMN "validTo";

ALTER TABLE "consent_requests"
  ALTER COLUMN "status" TYPE "ConsentStatus"
  USING (
    CASE upper("status")
      WHEN 'REQUESTED' THEN 'REQUESTED'::"ConsentStatus"
      WHEN 'GRANTED' THEN 'GRANTED'::"ConsentStatus"
      WHEN 'DENIED' THEN 'DENIED'::"ConsentStatus"
      WHEN 'EXPIRED' THEN 'EXPIRED'::"ConsentStatus"
      WHEN 'REVOKED' THEN 'REVOKED'::"ConsentStatus"
      ELSE NULL
    END
  );

ALTER TABLE "consent_requests" ADD COLUMN "patientAbhaAddress" TEXT NOT NULL;
ALTER TABLE "consent_requests" ADD COLUMN "purposeCode" TEXT NOT NULL;
ALTER TABLE "consent_requests" ADD COLUMN "hiTypes" TEXT[] NOT NULL;
ALTER TABLE "consent_requests" ADD COLUMN "dateFrom" TIMESTAMP(3) NOT NULL;
ALTER TABLE "consent_requests" ADD COLUMN "dateTo" TIMESTAMP(3) NOT NULL;
ALTER TABLE "consent_requests" ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "consent_requests" ADD COLUMN "externalConsentRequestId" TEXT;
ALTER TABLE "consent_requests" ADD COLUMN "transactionId" TEXT NOT NULL;
ALTER TABLE "consent_requests" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "consent_requests_externalConsentRequestId_idx" ON "consent_requests"("externalConsentRequestId");

ALTER TABLE "consent_requests"
  ADD CONSTRAINT "consent_requests_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "abdm_transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
