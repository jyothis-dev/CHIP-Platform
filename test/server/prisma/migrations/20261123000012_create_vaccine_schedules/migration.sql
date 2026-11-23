-- CreateTable
CREATE TABLE "vaccine_schedules" (
    "id" TEXT NOT NULL,
    "vaccineCode" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "doseNumber" INTEGER NOT NULL,
    "dueAgeDays" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "vaccine_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vaccine_schedules_vaccineCode_doseNumber_key" ON "vaccine_schedules"("vaccineCode", "doseNumber");
