-- CreateEnum
CREATE TYPE "PatientType" AS ENUM ('MOTHER', 'CHILD');

-- CreateEnum
CREATE TYPE "EncounterType" AS ENUM ('ANTENATAL', 'DELIVERY', 'CHILD_FOLLOW_UP');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hfrReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "patientType" "PatientType" NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mother_child_relationships" (
    "id" TEXT NOT NULL,
    "motherPatientId" TEXT NOT NULL,
    "childPatientId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,

    CONSTRAINT "mother_child_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pregnancies" (
    "id" TEXT NOT NULL,
    "motherPatientId" TEXT NOT NULL,
    "estimatedDueDate" DATE,
    "status" TEXT NOT NULL,
    "deliveryDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pregnancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "type" "EncounterType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abha_identities" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "maskedReference" TEXT,
    "verificationStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abha_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "fhirProfile" TEXT,
    "recordType" TEXT NOT NULL,
    "documentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_requests" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "workflowReference" TEXT,
    "status" TEXT NOT NULL,
    "scope" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abdm_transactions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "externalTransactionId" TEXT,
    "type" TEXT NOT NULL,
    "internalStatus" TEXT NOT NULL,
    "externalStatus" TEXT,
    "correlationId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abdm_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "callback_events" (
    "id" TEXT NOT NULL,
    "eventIdentity" TEXT NOT NULL,
    "transactionId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" TEXT NOT NULL,
    "payloadMetadata" JSONB,

    CONSTRAINT "callback_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "facilityId" TEXT,
    "outcome" TEXT NOT NULL,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "patients_facilityId_idx" ON "patients"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "mother_child_relationships_motherPatientId_childPatientId_key" ON "mother_child_relationships"("motherPatientId", "childPatientId");

-- CreateIndex
CREATE INDEX "pregnancies_motherPatientId_idx" ON "pregnancies"("motherPatientId");

-- CreateIndex
CREATE INDEX "encounters_patientId_idx" ON "encounters"("patientId");

-- CreateIndex
CREATE INDEX "encounters_facilityId_idx" ON "encounters"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "abha_identities_patientId_key" ON "abha_identities"("patientId");

-- CreateIndex
CREATE INDEX "health_records_patientId_idx" ON "health_records"("patientId");

-- CreateIndex
CREATE INDEX "consent_requests_patientId_idx" ON "consent_requests"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "abdm_transactions_requestId_key" ON "abdm_transactions"("requestId");

-- CreateIndex
CREATE INDEX "abdm_transactions_correlationId_idx" ON "abdm_transactions"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "callback_events_eventIdentity_key" ON "callback_events"("eventIdentity");

-- CreateIndex
CREATE INDEX "callback_events_transactionId_idx" ON "callback_events"("transactionId");

-- CreateIndex
CREATE INDEX "audit_logs_facilityId_createdAt_idx" ON "audit_logs"("facilityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_correlationId_idx" ON "audit_logs"("correlationId");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mother_child_relationships" ADD CONSTRAINT "mother_child_relationships_motherPatientId_fkey" FOREIGN KEY ("motherPatientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mother_child_relationships" ADD CONSTRAINT "mother_child_relationships_childPatientId_fkey" FOREIGN KEY ("childPatientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregnancies" ADD CONSTRAINT "pregnancies_motherPatientId_fkey" FOREIGN KEY ("motherPatientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abha_identities" ADD CONSTRAINT "abha_identities_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callback_events" ADD CONSTRAINT "callback_events_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "abdm_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
