-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

-- CreateEnum
CREATE TYPE "chip"."PatientType" AS ENUM ('MOTHER', 'CHILD');

-- CreateEnum
CREATE TYPE "chip"."EncounterType" AS ENUM ('ANTENATAL', 'DELIVERY', 'CHILD_FOLLOW_UP');

-- CreateTable
CREATE TABLE "chip"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chip"."facilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hfrReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chip"."patients" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "patientType" "chip"."PatientType" NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chip"."mother_child_relationships" (
    "id" TEXT NOT NULL,
    "motherPatientId" TEXT NOT NULL,
    "childPatientId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,

    CONSTRAINT "mother_child_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chip"."pregnancies" (
    "id" TEXT NOT NULL,
    "motherPatientId" TEXT NOT NULL,
    "estimatedDueDate" DATE,
    "status" TEXT NOT NULL,
    "deliveryDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pregnancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chip"."encounters" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "type" "chip"."EncounterType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chip"."abha_identities" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "maskedReference" TEXT,
    "verificationStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abha_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chip"."health_records" (
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
CREATE TABLE "chip"."consent_requests" (
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
CREATE TABLE "chip"."abdm_transactions" (
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
CREATE TABLE "chip"."callback_events" (
    "id" TEXT NOT NULL,
    "eventIdentity" TEXT NOT NULL,
    "transactionId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" TEXT NOT NULL,
    "payloadMetadata" JSONB,

    CONSTRAINT "callback_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chip"."audit_logs" (
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
CREATE UNIQUE INDEX "users_email_key" ON "chip"."users"("email");

-- CreateIndex
CREATE INDEX "patients_facilityId_idx" ON "chip"."patients"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "mother_child_relationships_motherPatientId_childPatientId_key" ON "chip"."mother_child_relationships"("motherPatientId", "childPatientId");

-- CreateIndex
CREATE INDEX "pregnancies_motherPatientId_idx" ON "chip"."pregnancies"("motherPatientId");

-- CreateIndex
CREATE INDEX "encounters_patientId_idx" ON "chip"."encounters"("patientId");

-- CreateIndex
CREATE INDEX "encounters_facilityId_idx" ON "chip"."encounters"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "abha_identities_patientId_key" ON "chip"."abha_identities"("patientId");

-- CreateIndex
CREATE INDEX "health_records_patientId_idx" ON "chip"."health_records"("patientId");

-- CreateIndex
CREATE INDEX "consent_requests_patientId_idx" ON "chip"."consent_requests"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "abdm_transactions_requestId_key" ON "chip"."abdm_transactions"("requestId");

-- CreateIndex
CREATE INDEX "abdm_transactions_correlationId_idx" ON "chip"."abdm_transactions"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "callback_events_eventIdentity_key" ON "chip"."callback_events"("eventIdentity");

-- CreateIndex
CREATE INDEX "callback_events_transactionId_idx" ON "chip"."callback_events"("transactionId");

-- CreateIndex
CREATE INDEX "audit_logs_facilityId_createdAt_idx" ON "chip"."audit_logs"("facilityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_correlationId_idx" ON "chip"."audit_logs"("correlationId");

-- AddForeignKey
ALTER TABLE "chip"."patients" ADD CONSTRAINT "patients_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "chip"."facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."mother_child_relationships" ADD CONSTRAINT "mother_child_relationships_motherPatientId_fkey" FOREIGN KEY ("motherPatientId") REFERENCES "chip"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."mother_child_relationships" ADD CONSTRAINT "mother_child_relationships_childPatientId_fkey" FOREIGN KEY ("childPatientId") REFERENCES "chip"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."pregnancies" ADD CONSTRAINT "pregnancies_motherPatientId_fkey" FOREIGN KEY ("motherPatientId") REFERENCES "chip"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."encounters" ADD CONSTRAINT "encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "chip"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."encounters" ADD CONSTRAINT "encounters_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "chip"."facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."abha_identities" ADD CONSTRAINT "abha_identities_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "chip"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."health_records" ADD CONSTRAINT "health_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "chip"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."health_records" ADD CONSTRAINT "health_records_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "chip"."encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."consent_requests" ADD CONSTRAINT "consent_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "chip"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."callback_events" ADD CONSTRAINT "callback_events_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "chip"."abdm_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "chip"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip"."audit_logs" ADD CONSTRAINT "audit_logs_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "chip"."facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
