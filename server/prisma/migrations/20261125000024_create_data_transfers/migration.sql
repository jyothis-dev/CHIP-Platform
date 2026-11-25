-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TYPE "chip"."TransferDirection" AS ENUM ('PUSH', 'RECEIVE');

CREATE TABLE "chip"."data_transfers" (
    "id" TEXT NOT NULL,
    "healthInformationRequestId" TEXT NOT NULL,
    "careContextId" TEXT NOT NULL,
    "direction" "chip"."TransferDirection" NOT NULL,
    "externalTransferRef" TEXT,
    "correlationId" TEXT,
    "status" TEXT NOT NULL,
    "receiptStatus" TEXT,
    "receivedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "bytes" INTEGER,
    "mocked" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_transfers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "chip"."data_transfers"
  ADD CONSTRAINT "data_transfers_healthInformationRequestId_fkey"
  FOREIGN KEY ("healthInformationRequestId") REFERENCES "chip"."health_information_requests"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chip"."data_transfers"
  ADD CONSTRAINT "data_transfers_careContextId_fkey"
  FOREIGN KEY ("careContextId") REFERENCES "chip"."care_contexts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
