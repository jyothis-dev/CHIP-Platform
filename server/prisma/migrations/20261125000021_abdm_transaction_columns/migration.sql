CREATE TYPE "Milestone" AS ENUM ('M1', 'M2', 'M3', 'M4');
CREATE TYPE "TransactionDirection" AS ENUM ('OUTBOUND', 'INBOUND');

ALTER TABLE "abdm_transactions" RENAME COLUMN "externalTransactionId" TO "externalTxnId";
ALTER TABLE "abdm_transactions" RENAME COLUMN "type" TO "workflow";
ALTER TABLE "abdm_transactions" RENAME COLUMN "internalStatus" TO "status";
ALTER TABLE "abdm_transactions" RENAME COLUMN "metadata" TO "safeMetadata";

ALTER TABLE "abdm_transactions" ADD COLUMN "milestone" "Milestone" NOT NULL;
ALTER TABLE "abdm_transactions" ADD COLUMN "direction" "TransactionDirection" NOT NULL;
ALTER TABLE "abdm_transactions" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "abdm_transactions" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "abdm_transactions" ADD COLUMN "callbackDeadlineAt" TIMESTAMP(3);
ALTER TABLE "abdm_transactions" ADD COLUMN "lastErrorCode" TEXT;
ALTER TABLE "abdm_transactions" ADD COLUMN "evidenceLabel" TEXT NOT NULL;

CREATE INDEX "abdm_transactions_externalTxnId_idx" ON "abdm_transactions"("externalTxnId");
CREATE INDEX "abdm_transactions_status_nextAttemptAt_idx" ON "abdm_transactions"("status", "nextAttemptAt");
