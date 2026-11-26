-- M4 registry link: bridge role state on the facility row.
-- Hand-written and limited to the "chip" schema. Applied migrations are not edited.
-- hfrId, hfrStatus and hfrVerifiedAt already exist. No registry profile data is stored.

ALTER TABLE "chip"."facilities"
  ADD COLUMN "hfrRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "hipName" TEXT,
  ADD COLUMN "hfrLinkCheckedAt" TIMESTAMP(3);
