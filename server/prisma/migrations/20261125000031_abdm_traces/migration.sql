-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TABLE "chip"."abdm_traces" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" INTEGER,
    "latencyMs" INTEGER,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abdm_traces_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "abdm_traces_createdAt_idx" ON "chip"."abdm_traces"("createdAt");
