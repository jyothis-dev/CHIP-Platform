-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TYPE "chip"."CallbackProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'DUPLICATE', 'ORPHANED', 'RETRY', 'DEAD');

ALTER TABLE "chip"."callback_events"
  ALTER COLUMN "processingStatus" TYPE "chip"."CallbackProcessingStatus"
  USING (
    CASE upper("processingStatus")
      WHEN 'RECEIVED' THEN 'RECEIVED'::"chip"."CallbackProcessingStatus"
      WHEN 'PROCESSED' THEN 'PROCESSED'::"chip"."CallbackProcessingStatus"
      WHEN 'DUPLICATE' THEN 'DUPLICATE'::"chip"."CallbackProcessingStatus"
      WHEN 'ORPHANED' THEN 'ORPHANED'::"chip"."CallbackProcessingStatus"
      WHEN 'RETRY' THEN 'RETRY'::"chip"."CallbackProcessingStatus"
      WHEN 'DEAD' THEN 'DEAD'::"chip"."CallbackProcessingStatus"
      ELSE NULL
    END
  );

ALTER TABLE "chip"."callback_events" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "chip"."callback_events" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "chip"."callback_events" ADD COLUMN "payloadMinimumEnc" TEXT;
ALTER TABLE "chip"."callback_events" ADD COLUMN "payloadRedacted" JSONB;
ALTER TABLE "chip"."callback_events" DROP COLUMN "payloadMetadata";
ALTER TABLE "chip"."callback_events" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "chip"."callback_events" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
