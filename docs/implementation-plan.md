# Implementation Plan — WombTo18 ABDM Prototype

48-hour window. **Core tier** first (~8 focused hours): a correct, thin slice of every milestone. Then the **Extension tier** for depth. Anything not reached is `PENDING` in `requirements-traceability.md` with a reason. Commit after each row, so the history shows the progression.

## Core tier (~8 focused hours)

This is one thin slice, not every workflow in `workflows.md`. Anything else stays `PENDING`.

| Time | Task | Done when |
|---|---|---|
| 0:00–0:45 | Read the fetched M1 page only. List sandbox client id, CM id, callback URL, and test identity as present or missing in `known-issues.md`. Do not invent the callback table. | Each prerequisite is filled or marked missing |
| 0:45–2:00 | Keep the existing Express and Vite shell. Add the target Prisma migration from `database-schema.md`, Pino redaction, and login against `User`. | `npm test` in `server/` still passes, including login |
| 2:00–3:15 | Domain slice: one mother, one newborn linked to that mother, one immunization encounter. No pregnancy, antenatal visit, or delivery | Those three records save and show in the UI |
| 3:15–4:30 | M1: one OTP create or verify path, only if the fetched contract and credentials exist. Otherwise stop and mark `PENDING`. | `SANDBOX_TESTED` only with a sanitized log. Otherwise `PENDING` or `IMPLEMENTED_NOT_SANDBOX_TESTED` |
| 4:30–6:00 | M2: one HIP-initiated link. Callback path stays blank until fetched. Until then, a fixture posts to the handler. Consent guard returns 403 for denied, expired, and revoked. | Link status is `LINKED` only after the fixture or the real callback |
| 6:00–7:00 | M3: create a consent row and block the HI request unless status is `GRANTED` and in date. Data-push route exists. Encrypted body handling is `MOCKED` if the crypto page or sandbox is missing. | T21-style check is executed locally, or the gap is written down |
| 7:00–7:30 | M4: one fetched HFR or HPR call, or `MOCKED` with the missing prerequisite. Do not call a lookup “registration.” | Label matches what ran |
| 7:30–8:00 | Tests T1–T4, T12, T17, T21 as far as the slice exists. Update traceability. | Executed tests recorded. Unrun rows stay unrun |

Java FHIR validation, patient-initiated linking, extra M1 methods, real M3 encrypt/decrypt, M4 registration beyond that one call, and the pregnancy / antenatal / delivery routes are not in this Core slice. The maternity routes stay `PENDING`.

## Extension tier (remaining window, in priority order)
1. Complete and sandbox-verify the M3 encrypted health-information exchange using the official crypto sample (HIU request + HIP push + transfer notification); if blocked, keep the implemented request stage separate from the mocked/pending encrypted-transfer stages.
2. M2 patient-initiated linking (discover/init/confirm).
3. M1 extra variants: ABHA address creation, mobile OTP, profile fetch, card.
4. M4 registration/verification workflows supported by the sandbox.
5. UI polish on the transaction timeline. Recorded demo video.
6. `docs/technical-answers.md` and `docs/ai-usage.md` finalised with real examples from the build.

## Rules when time slips
Cut depth, never correctness. Do not cut:
- Request and callback correlation.
- Durable transaction persistence.
- Callback deduplication.
- Consent enforcement before sharing.
- Secret and identifier redaction.
- Honest status labels.

## Blocker protocol
If a sandbox prerequisite (credentials, role, callback registration, test data) blocks a workflow for more than 30 minutes:
1. Record the blocker in `known-issues.md` with the exact error code.
2. Implement it against fixtures copied from the doc examples.
3. Label it `IMPLEMENTED_NOT_SANDBOX_TESTED` (real code path, not executed on the sandbox) or `MOCKED` (simulated). Do not use `IMPLEMENTED_NOT_TESTABLE`.
4. Notify the assignment contact if the blocker needs sandbox configuration from them. The brief invites this.


## Prerequisite gate (before milestone coding)
1. Confirm the exact sandbox tenant/client credentials, CM ID, enabled M1/M2/M3/M4 capabilities and role identifiers.
2. Confirm whether an HFR Facility ID already exists. M2/M3 facility prerequisites may be met through an existing/manual HFR registration; M4 lookup alone does not create a Facility ID.
3. Confirm bridge registration/linkage, facility-to-bridge association, role assignment, public callback URL registration and the separate HIU data-push URL requirements.
4. Confirm an approved sandbox test identity and the permitted OTP delivery/access method. Never substitute real Aadhaar/patient information.
5. Record every unavailable prerequisite in `known-issues.md` and mark only the affected workflow `PENDING` or `MOCKED`.

## Retry and timeout rules
- Retry only documented, idempotent or otherwise safely replayable operations; respect `Retry-After`, use bounded exponential backoff with jitter, and cap attempts.
- Do not automatically retry OTP, consent creation, or any non-idempotent operation unless the official contract explicitly defines safe replay.
- For timeout/connection loss after a request may have reached ABDM, reconcile by documented transaction/status lookup or callback before issuing another request.
- Treat local expiry as a local deadline, not proof of remote failure. Preserve and reconcile late callbacks.
