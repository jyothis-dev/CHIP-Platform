CREATE TYPE "TransferDirection" AS ENUM ('PUSH', 'RECEIVE');

CREATE TABLE "data_transfers" (
    "id" TEXT NOT NULL,
    "healthInformationRequestId" TEXT NOT NULL,
    "careContextId" TEXT NOT NULL,
    "direction" "TransferDirection" NOT NULL,
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

ALTER TABLE "data_transfers"
  ADD CONSTRAINT "data_transfers_healthInformationRequestId_fkey"
  FOREIGN KEY ("healthInformationRequestId") REFERENCES "health_information_requests"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "data_transfers"
  ADD CONSTRAINT "data_transfers_careContextId_fkey"
  FOREIGN KEY ("careContextId") REFERENCES "care_contexts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
