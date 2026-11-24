CREATE TYPE "ExchangeRole" AS ENUM ('HIU', 'HIP');

CREATE TABLE "consent_artefacts" (
    "id" TEXT NOT NULL,
    "role" "ExchangeRole" NOT NULL,
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

CREATE UNIQUE INDEX "consent_artefacts_role_externalArtefactId_key" ON "consent_artefacts"("role", "externalArtefactId");

ALTER TABLE "consent_artefacts"
  ADD CONSTRAINT "consent_artefacts_consentRequestId_fkey"
  FOREIGN KEY ("consentRequestId") REFERENCES "consent_requests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
