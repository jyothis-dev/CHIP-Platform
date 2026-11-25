-- CHIP tables live in schema "chip" to avoid colliding with other apps on shared defaultdb.
CREATE SCHEMA IF NOT EXISTS "chip";

-- Replace eventIdentity uniqueness with (route, dedupKey).
ALTER TABLE "chip"."callback_events" ADD COLUMN "route" TEXT NOT NULL;
ALTER TABLE "chip"."callback_events" ADD COLUMN "dedupKey" TEXT NOT NULL;

DROP INDEX "chip"."callback_events_eventIdentity_key";
ALTER TABLE "chip"."callback_events" DROP COLUMN "eventIdentity";

CREATE UNIQUE INDEX "callback_events_route_dedupKey_key" ON "chip"."callback_events"("route", "dedupKey");
