CREATE TABLE "practitioners" (
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

CREATE UNIQUE INDEX "practitioners_hprId_key" ON "practitioners"("hprId");
CREATE INDEX "practitioners_facilityId_idx" ON "practitioners"("facilityId");

ALTER TABLE "practitioners"
  ADD CONSTRAINT "practitioners_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "practitioners"
  ADD CONSTRAINT "practitioners_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "facilities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
