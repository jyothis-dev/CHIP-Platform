CREATE TYPE "CallbackProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'DUPLICATE', 'ORPHANED', 'RETRY', 'DEAD');

ALTER TABLE "callback_events"
  ALTER COLUMN "processingStatus" TYPE "CallbackProcessingStatus"
  USING (
    CASE upper("processingStatus")
      WHEN 'RECEIVED' THEN 'RECEIVED'::"CallbackProcessingStatus"
      WHEN 'PROCESSED' THEN 'PROCESSED'::"CallbackProcessingStatus"
      WHEN 'DUPLICATE' THEN 'DUPLICATE'::"CallbackProcessingStatus"
      WHEN 'ORPHANED' THEN 'ORPHANED'::"CallbackProcessingStatus"
      WHEN 'RETRY' THEN 'RETRY'::"CallbackProcessingStatus"
      WHEN 'DEAD' THEN 'DEAD'::"CallbackProcessingStatus"
      ELSE NULL
    END
  );

ALTER TABLE "callback_events" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "callback_events" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "callback_events" ADD COLUMN "payloadMinimumEnc" TEXT;
ALTER TABLE "callback_events" ADD COLUMN "payloadRedacted" JSONB;
ALTER TABLE "callback_events" DROP COLUMN "payloadMetadata";
ALTER TABLE "callback_events" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "callback_events" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
