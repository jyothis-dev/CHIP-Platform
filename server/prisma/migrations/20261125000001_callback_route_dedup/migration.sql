-- Replace eventIdentity uniqueness with (route, dedupKey).
ALTER TABLE "callback_events" ADD COLUMN "route" TEXT NOT NULL;
ALTER TABLE "callback_events" ADD COLUMN "dedupKey" TEXT NOT NULL;

DROP INDEX "callback_events_eventIdentity_key";
ALTER TABLE "callback_events" DROP COLUMN "eventIdentity";

CREATE UNIQUE INDEX "callback_events_route_dedupKey_key" ON "callback_events"("route", "dedupKey");
