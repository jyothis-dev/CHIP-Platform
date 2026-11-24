# 8-Hour Implementation Plan — WombTo18

## Scope discipline

You have about 8 focused hours total alongside daily work. The target is a **small working prototype**, not a production ABDM implementation. Use one synthetic mother/child journey, one selected M1 path, one M2 linking path, a minimal M3 consent state flow, and one M4 lookup or labelled mock.

## Timebox

| Time | Task | Deliverable |
|---|---|---|
| 0:00–0:30 | Inspect assignment, repo, official docs, sandbox credentials and enabled roles | Confirmed API/workflow checklist; blockers listed |
| 0:30–1:30 | Minimal app/backend/DB setup and basic auth | React + Express + PostgreSQL running |
| 1:30–2:15 | Mother, pregnancy, antenatal visit, delivery, newborn, child follow-up | Local WombTo18 demo journey works |
| 2:15–3:30 | M1 | One supported ABHA workflow or clearly labelled sandbox-blocked mock |
| 3:30–4:45 | M2 | One FHIR example + one care-context path + callback state |
| 4:45–5:45 | M3 | Consent initiation/status callback; transfer only if ready |
| 5:45–6:15 | M4 | One HFR/HPR lookup or fixture-backed mock |
| 6:15–7:15 | Shared callback/transaction/audit hardening and tests | Duplicate callback test, transaction lifecycle, redacted logs |
| 7:15–8:00 | Swagger, README, demo screenshots/video, limitations | Submission package |

## What to cut first

If time slips:
1. Do not build a full ABHA profile/card; show masked identity and status.
2. Do not implement both M2 linking paths; choose one.
3. Do not implement full M3 encrypted transfer unless the official sample and sandbox are ready; demonstrate consent states and clearly mark transfer as blocked/mock.
4. Do not build HPR/HFR registration; do one lookup or labelled mock.
5. Keep UI to a dashboard and mother/child profile tabs.

Do not cut:
- Correct request/callback correlation.
- Durable transaction persistence.
- Callback deduplication.
- Consent enforcement before sharing.
- Secret/identifier redaction.
- Honest feature status labels.

## First 30-minute checklist

1. Confirm the sandbox base URL, credentials, CM ID, facility/bridge prerequisites, and enabled M1–M4 APIs.
2. Confirm whether the sandbox requires public HTTPS callbacks and which callback routes are in scope.
3. Confirm exact required headers and callback acknowledgement for the first workflow.
4. Choose the simplest sandbox-supported M1 and M2 paths.
5. If a prerequisite is missing after 30 minutes, record it and use a labelled mock for that workflow instead of losing the timebox.

## Acceptance criteria at hour 8

- The app starts locally.
- Staff can complete the mother-to-child demo journey.
- One M1 path is either sandbox-tested or honestly labelled blocked/mock.
- One M2 FHIR/care-context example is implemented or its blocker is documented.
- M3 consent status is visible and invalid consent blocks sharing.
- M4 lookup or fixture is clearly labelled.
- Transaction table distinguishes accepted from completed.
- Callback fixture test verifies persistence, correlation, and duplicate handling.
- Swagger and a concise limitations/evidence document are included.
