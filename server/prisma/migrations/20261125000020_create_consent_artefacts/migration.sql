-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TYPE "chip"."ExchangeRole" AS ENUM ('HIU', 'HIP');

CREATE TABLE "chip"."consent_artefacts" (
    "id" TEXT NOT NULL,
    "role" "chip"."ExchangeRole" NOT NULL,
    "externalArtefactId" TEXT NOT NULL,
    "consentRequestId" TEXT,
    "patientRef" TEXT NOT NULL,
    "hipId" TEXT NOT NULL,
    "hiTypes" TEXT[] NOT NULL,
    "careContextRefs" TEXT[] NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_artefacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consent_artefacts_role_externalArtefactId_key" ON "chip"."consent_artefacts"("role", "externalArtefactId");

ALTER TABLE "chip"."consent_artefacts"
  ADD CONSTRAINT "consent_artefacts_consentRequestId_fkey"
  FOREIGN KEY ("consentRequestId") REFERENCES "chip"."consent_requests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
