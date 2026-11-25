-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TABLE "chip"."idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "requestBodyHash" TEXT NOT NULL,
    "responseRef" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_keys_key_userId_route_key" ON "chip"."idempotency_keys"("key", "userId", "route");

ALTER TABLE "chip"."idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "chip"."users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
