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
- The first Aadhaar enrolment OTP request sends an empty `txnId`. Store the `txnId` ABDM returns on `ABDMTransaction`, and send that same id on resend. Show `PENDING_VERIFICATION` until OTP verification succeeds.
- If the fetched verify operation returns the profile and defines no callback, that response may set the M1 transaction to `COMPLETED`. If it defines a callback, wait for that callback. Do not force every M1 call through `WAITING_FOR_CALLBACK`.
- Persist only: encrypted ABHA number, key version, a lookup hash, the masked value for display, one ABHA address, and verification status and time. Never the OTP, Aadhaar, or user tokens.
- Map OTP failures to the message ABDM returned. Do not replace that sentence with local wording, and do not log the request or response body.
- A wrong OTP keeps the same enrolment transaction so the person can retry.
- Resend stays disabled for 60 seconds, allows two resends, then shows "Maximum OTP resend attempts reached. Please try again after 30 mins" without a third call.
- A communication mobile whose last four digits match `ABHAProfile.mobile` skips the second OTP. A different last four starts mobile verification.
- ABHA address rules (length 8–18 including `@sbx` or `@abdm`, letters and digits, at most one dot and one underscore, neither first nor last) are checked on the screen before submit. The create call sends the handle without the `@` suffix.
- After creation the result screen shows the 14-digit ABHA number and profile. `GET /patients/:id/abha` and the audit row stay masked.
- Before creating a patient, a full match on name, gender, date of birth, and mobile last 4 returns `409 PATIENT_MATCH` and reuses that patient. A mismatch creates a new patient. The full mobile is not stored.
- OTP attempts and resend follow the documented limits. No automatic retry of OTP-consuming calls.

## M2 — HIP: records, care-context linking and sharing

Status: `IMPLEMENTED_NOT_SANDBOX_TESTED`. Skill catalogue 2026.09.16. CHIP acts as the HIP. A 202 from the gateway is receipt. `LINKED` is set from the link callback.

1. Objective. Save a visit as a care context and push an encrypted FHIR bundle only after a granted consent.
2. Role. HIP.
3. Specification. `.cursor/skills/abdm-m2` and `https://docs.abdm.gov.in/docs/hiecm/v3/api/m2`. ImmunizationRecord profile fetched 2026-11-25 from `https://nrces.in/ndhm/fhir/r4/StructureDefinition/ImmunizationRecord`, version 6.5.0. The other seven HI type profile URLs are still `UNVERIFIED`.
4. Prerequisites. Gateway session credentials. `ABDM_HIP_ID` from `GET /api/hiecm/gateway/v3/bridge-services`. `ABDM_CALLBACK_BASE_URL`, registered with `PATCH /api/hiecm/gateway/v3/bridge/url` only after a person confirms it. Gateway v1 `/gateway/v1/bridges` is not used.
5. Actors. Facility staff, the CHIP API, the ABDM gateway, and the sandbox PHR app.
6. Workflow. Saving a `VALID` immunization bundle for a verified ABHA starts generate-token (or reuses a token younger than six months) and then `POST /api/hiecm/hip/v3/link/carecontext`. A patient with a mobile and no ABHA address takes the SMS deep-link call. Discovery, init, and confirm are callbacks. Consent notify is stored, and a health-information request is pushed only when the stored consent allows it.
7. Operations. The gateway paths are the contracts in `server/src/integrations/abdm/contracts.js`. Data push goes to the `dataPushUrl` on the health-information request, not through the gateway.
8. Callbacks. Nine inbound paths under `/api/v3/...`. Each requires a bearer token. An answer callback must carry `response.requestId` for a request this HIP sent. A duplicate `(route, dedupKey)` is acknowledged and not processed again. The skill snapshot does not give the inbound acknowledgement body, so the HTTP response is 202.
9. Data. `Encounter` is the visit. `CareContext.referenceNumber` is the encounter id. The FHIR bundle is encrypted at rest. The link token is encrypted at rest. Mobile is stored as a hash plus ciphertext.
10. Identifiers. Outbound `REQUEST-ID` is the `ABDMTransaction.requestId`. Callbacks correlate on `response.requestId`.
11. Security. Consent must be `GRANTED`, unexpired, for this HIP id, and must cover the care context, date range, and HI type. Curve25519 material stays in memory.
12. Errors. Missing `ABDM_HIP_ID` refuses the outbound call locally (`HIP_ID_MISSING`). An ABDM refusal is `ABDM_UPSTREAM` or the upstream code.
13. Tests. Jest with mocked Axios and Prisma: `fidelius.test.js`, `fhir/bundle.test.js`, `hip.routes.test.js`. 21 tests passed on 2026-11-25 in those files together with `patients.routes.test.js`. No sandbox request id.
14. Limitations. The local facility name is Sahyadri Hospital. `ABDM_HIP_ID` is set locally. On 2026-11-26 at 21:03 IST, `PATCH /api/hiecm/gateway/v3/bridge/url` returned 202 (request `94913168-0795-44e9-a769-3808a6384576`) and the following `GET /api/hiecm/gateway/v3/bridge-services` showed that callback URL with `bridge.active` true. `services` still had no entry whose types include HIP, so the facility is not linked to this client. Only `ImmunizationRecord` is claimed. A PHR app pull has not been run.

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
