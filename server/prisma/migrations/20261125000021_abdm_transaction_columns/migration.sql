-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TYPE "chip"."Milestone" AS ENUM ('M1', 'M2', 'M3', 'M4');
CREATE TYPE "chip"."TransactionDirection" AS ENUM ('OUTBOUND', 'INBOUND');

ALTER TABLE "chip"."abdm_transactions" RENAME COLUMN "externalTransactionId" TO "externalTxnId";
ALTER TABLE "chip"."abdm_transactions" RENAME COLUMN "type" TO "workflow";
ALTER TABLE "chip"."abdm_transactions" RENAME COLUMN "internalStatus" TO "status";
ALTER TABLE "chip"."abdm_transactions" RENAME COLUMN "metadata" TO "safeMetadata";

ALTER TABLE "chip"."abdm_transactions" ADD COLUMN "milestone" "chip"."Milestone" NOT NULL;
ALTER TABLE "chip"."abdm_transactions" ADD COLUMN "direction" "chip"."TransactionDirection" NOT NULL;
ALTER TABLE "chip"."abdm_transactions" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "chip"."abdm_transactions" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "chip"."abdm_transactions" ADD COLUMN "callbackDeadlineAt" TIMESTAMP(3);
ALTER TABLE "chip"."abdm_transactions" ADD COLUMN "lastErrorCode" TEXT;
ALTER TABLE "chip"."abdm_transactions" ADD COLUMN "evidenceLabel" TEXT NOT NULL;

CREATE INDEX "abdm_transactions_externalTxnId_idx" ON "chip"."abdm_transactions"("externalTxnId");
CREATE INDEX "abdm_transactions_status_nextAttemptAt_idx" ON "chip"."abdm_transactions"("status", "nextAttemptAt");
