-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TABLE "chip"."practitioners" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "hprId" TEXT,
    "hprVerifiedAt" TIMESTAMP(3),
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practitioners_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "practitioners_hprId_key" ON "chip"."practitioners"("hprId");
CREATE INDEX "practitioners_facilityId_idx" ON "chip"."practitioners"("facilityId");

ALTER TABLE "chip"."practitioners"
  ADD CONSTRAINT "practitioners_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "chip"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chip"."practitioners"
  ADD CONSTRAINT "practitioners_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "chip"."facilities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
