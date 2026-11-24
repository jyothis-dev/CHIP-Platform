# Workflows — WombTo18 ABDM Prototype

All ABDM paths, payloads, headers, acknowledgements and status values must be verified via the ABDM docs MCP server before implementation. The steps below are a checklist to verify, not a protocol contract.

Tier legend: **[C]** Core (build first) · **[E]** Extension (build if time allows within the 48h window; otherwise `PENDING`).

## Local mother-and-child journey [C]
1. Register mother → 2. Newborn linked to that mother → 3. One child immunization.

Pregnancy, antenatal visit, and delivery are `PENDING`. They are not part of this build.

This is a demo data journey only, not a clinical product.

## M1 — ABHA creation and verification

| # | Workflow | Tier |
|---|---|---|
| 1.1 | ABHA creation via Aadhaar OTP (sandbox test identifiers only) | C |
| 1.2 | ABHA verification/login via OTP (ABHA number or address) | C |
| 1.3 | ABHA address selection/creation after enrolment | E |
| 1.4 | Mobile-OTP variant / ABHA profile fetch | E |
| 1.5 | ABHA card download (display only, not stored) | E |

Requirements:
- Encrypt identifiers and OTPs exactly as the fetched docs specify (certificate source, algorithm, padding, and encoding). Those details are `UNVERIFIED` until that page is read. Keep the dashes in an ABHA number before encryption. The Build with AI page states that bare digits are refused.
- Store `txnId` on `ABDMTransaction`. Show `PENDING_VERIFICATION` until OTP verification succeeds.
- If the fetched verify operation returns the profile and defines no callback, that response may set the M1 transaction to `COMPLETED`. If it defines a callback, wait for that callback. Do not force every M1 call through `WAITING_FOR_CALLBACK`.
- Persist only: encrypted ABHA number, key version, a lookup hash, the masked value for display, one ABHA address, and verification status and time. Never the OTP, Aadhaar, or user tokens.
- Map documented error codes to safe UI messages (invalid OTP, expired txn, rate limit). Never echo raw ABDM error bodies to the UI.
- OTP attempts and resend follow the documented limits. No automatic retry of OTP-consuming calls.

## M2 — HIP: records, care-context linking and sharing

| # | Workflow | Tier |
|---|---|---|
| 2.1 | Build and validate one FHIR bundle for the child immunization | C |
| 2.2 | HIP-initiated care-context linking + callback | C |
| 2.3 | Patient-initiated linking: discover → init → confirm callbacks | E |
| 2.4 | Respond to health-information request: validate consent → encrypt → push → notify | C (encryption may be `MOCKED` if blocked) |
| 2.5 | Link status visible per care context | C |

Requirements:
- A care context is linked only if its `HealthRecord` passed FHIR validation.
- A link is shown as `LINKED` only after the documented completion callback or status.
- Patient matching for discovery (2.3) uses documented demographic and identifier rules. Ambiguous matches return no match, never a guess.
- Health-information request handling runs the consent checks listed in `architecture.md` §5 before building any bundle.

## M3 — HIU: consent and health information exchange

| # | Workflow | Tier |
|---|---|---|
| 3.1 | Consent request initiation (purpose, HI types, date range, expiry, requester) | C |
| 3.2 | Consent request status/ID callback | C |
| 3.3 | Consent notification handling: GRANTED, DENIED, EXPIRED, REVOKED | C |
| 3.4 | Fetch consent artefact(s) | C |
| 3.5 | HIU health-information request with the documented request/key-material exchange | C (minimum request stage); mark encrypted transfer separately if blocked |
| 3.6 | Receive data at the HIU data-push URL, decrypt and validate using the fetched specification, persist transfer metadata | C. The route is Core. Encrypted-body handling is `MOCKED` or `PENDING` when the sandbox or the crypto page is unavailable. Same tier as the HIP push in 2.4. |
| 3.7 | Consent expiry sweeper (local enforcement even without callback) | C |

Consent state rules:
- `REQUESTED → GRANTED | DENIED | EXPIRED`. `GRANTED → REVOKED | EXPIRED`.
- Only `GRANTED` and within validity allows a health-information request.
- `DENIED`, `EXPIRED` and `REVOKED` are terminal for data access. The UI disables the fetch actions and the API returns 403 with a reason code.

## M4 — HFR and HPR

| # | Workflow | Tier |
|---|---|---|
| 4.1 | One sandbox-supported HFR operation: lookup or a registration step the fetched M4 page marks as required | C |
| 4.2 | One sandbox-supported HPR operation: lookup or a registration step the fetched M4 page marks as required | C |
| 4.3 | Attach an HFR id to `Facility` and an HPR id to `Practitioner` when a response supplies them | C |
| 4.4 | Remaining facility registration or verification calls | E |
| 4.5 | Remaining professional registration or verification calls | E |

The portal titles M4 “Register Healthcare Professionals and Health Facilities.” Lookup-only is not the milestone definition. Which calls are mandatory is `UNVERIFIED`. If the sandbox cannot perform registration, record `PENDING` with that prerequisite. Do not relabel a lookup as registration.

Requirements:
- Cache registry results with `fetchedAt`. Show the "last verified" time.
- If the sandbox registry APIs are unavailable or need prerequisites you don't have, use fixtures labelled `MOCKED` and record the blocker. Never claim registration succeeded.
- Map registry error codes (not found, invalid ID, unauthorised) to clear UI states.

## Callback lifecycle (all milestones)
1. Authenticate the caller per the documented contract.
2. Validate headers and body against the schema.
3. Insert `CallbackEvent` with unique `(route, dedupKey)`. On a duplicate of that pair, acknowledge and stop. Do not treat the HIP copy and the HIU copy of one ABDM id as the same event.
4. Return the exact documented acknowledgement.
5. Correlate to `ABDMTransaction` via the documented field. Unknown correlation → event stored as `ORPHANED`, alert in the monitor, no state change.
6. Apply the allowed transition. Write the audit record.
7. On processing error, retry only if the handler is safe to replay; after bounded attempts, mark `DEAD` and retain diagnostic metadata.
8. A callback arriving after a local timeout/expiry is still persisted. Do not blindly reopen a terminal transaction or discard the callback; reconcile with the documented external status and retain the event history.

## Internal status labels
`INITIATED → ACCEPTED → WAITING_FOR_CALLBACK → COMPLETED`, with outcomes `FAILED`, `REJECTED`, `EXPIRED` and `REVOKED` (consent only). External ABDM status is stored separately.


## Cross-milestone boundary
- M2 is the HIP side: care-context linking, responding to an HIU request, consent validation, FHIR bundle preparation, encryption/push and transfer-status notification.
- M3 is the HIU side: consent request/status/artefact, health-information request, receiving/decrypting/validating the response and recording receipt.
- These are two ends of one exchange. Verify the exact protocol sequence and callbacks from the official MCP documentation before implementation; this checklist is not an endpoint contract.
