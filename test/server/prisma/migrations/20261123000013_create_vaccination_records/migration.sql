-- CreateTable
CREATE TABLE "vaccination_records" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineCode" TEXT NOT NULL,
    "doseNumber" INTEGER NOT NULL,
    "administeredAt" TIMESTAMP(3) NOT NULL,
    "administeredById" TEXT NOT NULL,
    "batchNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaccination_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vaccination_records_childId_vaccineCode_doseNumber_key" ON "vaccination_records"("childId", "vaccineCode", "doseNumber");

-- AddForeignKey
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
