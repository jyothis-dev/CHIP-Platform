CREATE TABLE "health_information_requests" (
    "id" TEXT NOT NULL,
    "role" "ExchangeRole" NOT NULL,
    "consentArtefactId" TEXT NOT NULL,
    "externalTransactionId" TEXT,
    "dataPushUrl" TEXT,
    "status" TEXT NOT NULL,
    "keyExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_information_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "health_information_requests"
  ADD CONSTRAINT "health_information_requests_consentArtefactId_fkey"
  FOREIGN KEY ("consentArtefactId") REFERENCES "consent_artefacts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
