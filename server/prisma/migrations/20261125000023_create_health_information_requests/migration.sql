-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TABLE "chip"."health_information_requests" (
    "id" TEXT NOT NULL,
    "role" "chip"."ExchangeRole" NOT NULL,
    "consentArtefactId" TEXT NOT NULL,
    "externalTransactionId" TEXT,
    "dataPushUrl" TEXT,
    "status" TEXT NOT NULL,
    "keyExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_information_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "chip"."health_information_requests"
  ADD CONSTRAINT "health_information_requests_consentArtefactId_fkey"
  FOREIGN KEY ("consentArtefactId") REFERENCES "chip"."consent_artefacts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
