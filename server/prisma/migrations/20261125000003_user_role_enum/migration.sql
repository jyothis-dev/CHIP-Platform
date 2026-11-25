-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

CREATE TYPE "chip"."UserRole" AS ENUM ('ADMIN', 'CLINICIAN', 'STAFF');

ALTER TABLE "chip"."users" ADD COLUMN "role_new" "chip"."UserRole";

UPDATE "chip"."users"
SET "role_new" = CASE lower(btrim("role"))
  WHEN 'admin' THEN 'ADMIN'::"chip"."UserRole"
  WHEN 'clinician' THEN 'CLINICIAN'::"chip"."UserRole"
  WHEN 'staff' THEN 'STAFF'::"chip"."UserRole"
  ELSE NULL
END;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "chip"."users" WHERE "role_new" IS NULL) THEN
    RAISE EXCEPTION 'users.role has a value outside ADMIN, CLINICIAN, STAFF';
  END IF;
END $$;

ALTER TABLE "chip"."users" DROP COLUMN "role";
ALTER TABLE "chip"."users" RENAME COLUMN "role_new" TO "role";
ALTER TABLE "chip"."users" ALTER COLUMN "role" SET NOT NULL;
