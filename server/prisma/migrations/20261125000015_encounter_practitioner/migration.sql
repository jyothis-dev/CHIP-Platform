ALTER TABLE "encounters" ADD COLUMN "practitionerId" TEXT;

ALTER TABLE "encounters"
  ADD CONSTRAINT "encounters_practitionerId_fkey"
  FOREIGN KEY ("practitionerId") REFERENCES "practitioners"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
