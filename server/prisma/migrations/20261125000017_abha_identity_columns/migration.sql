ALTER TABLE "abha_identities" DROP COLUMN "maskedReference";
ALTER TABLE "abha_identities" ADD COLUMN "abhaNumberEnc" TEXT NOT NULL;
ALTER TABLE "abha_identities" ADD COLUMN "encKeyVersion" INTEGER NOT NULL;
ALTER TABLE "abha_identities" ADD COLUMN "abhaNumberHash" TEXT NOT NULL;
ALTER TABLE "abha_identities" ADD COLUMN "hashKeyVersion" INTEGER NOT NULL;
ALTER TABLE "abha_identities" ADD COLUMN "abhaNumberMasked" TEXT NOT NULL;
ALTER TABLE "abha_identities" ADD COLUMN "abhaAddress" TEXT;
ALTER TABLE "abha_identities" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "abha_identities" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "abha_identities_abhaNumberHash_key" ON "abha_identities"("abhaNumberHash");
