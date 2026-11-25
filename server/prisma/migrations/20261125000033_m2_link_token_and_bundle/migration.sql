-- Link tokens, encounter-scoped care contexts, encrypted bundles, and mobile match keys.

ALTER TABLE "chip"."patients" ADD COLUMN "mobileHash" TEXT;
ALTER TABLE "chip"."patients" ADD COLUMN "mobileEnc" TEXT;

ALTER TABLE "chip"."health_records" ADD COLUMN "bundleEnc" TEXT;
ALTER TABLE "chip"."health_records" ADD COLUMN "bundleBytes" INTEGER;

ALTER TABLE "chip"."care_contexts" ADD COLUMN "encounterId" TEXT;
ALTER TABLE "chip"."care_contexts" ALTER COLUMN "healthRecordId" DROP NOT NULL;
ALTER TABLE "chip"."care_contexts" ALTER COLUMN "transactionId" DROP NOT NULL;

UPDATE "chip"."care_contexts" AS c
SET "encounterId" = h."encounterId"
FROM "chip"."health_records" AS h
WHERE c."healthRecordId" = h."id"
  AND h."encounterId" IS NOT NULL
  AND c."encounterId" IS NULL;

ALTER TABLE "chip"."care_contexts"
  ADD CONSTRAINT "care_contexts_encounterId_fkey"
  FOREIGN KEY ("encounterId") REFERENCES "chip"."encounters"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "care_contexts_patientId_linkStatus_idx"
  ON "chip"."care_contexts"("patientId", "linkStatus");

CREATE TABLE "chip"."link_tokens" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "hipId" TEXT NOT NULL,
    "tokenEnc" TEXT NOT NULL,
    "abhaAddress" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "link_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "link_tokens_patientId_hipId_idx" ON "chip"."link_tokens"("patientId", "hipId");

ALTER TABLE "chip"."link_tokens"
  ADD CONSTRAINT "link_tokens_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "chip"."patients"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
