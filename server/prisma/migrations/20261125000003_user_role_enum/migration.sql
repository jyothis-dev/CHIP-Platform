CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CLINICIAN', 'STAFF');

ALTER TABLE "users" ADD COLUMN "role_new" "UserRole";

UPDATE "users"
SET "role_new" = CASE lower(btrim("role"))
  WHEN 'admin' THEN 'ADMIN'::"UserRole"
  WHEN 'clinician' THEN 'CLINICIAN'::"UserRole"
  WHEN 'staff' THEN 'STAFF'::"UserRole"
  ELSE NULL
END;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "role_new" IS NULL) THEN
    RAISE EXCEPTION 'users.role has a value outside ADMIN, CLINICIAN, STAFF';
  END IF;
END $$;

ALTER TABLE "users" DROP COLUMN "role";
ALTER TABLE "users" RENAME COLUMN "role_new" TO "role";
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
