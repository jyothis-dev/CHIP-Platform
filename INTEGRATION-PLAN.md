# INTEGRATION-PLAN

Phase 1 of M1 for CHIP. Functionality: `create-abha-aadhaar-otp`. Skill: `.cursor/skills/abdm-m1` (catalogue 2026.09.16).

Updated: 2026-11-25. Steps done: 3 of 8 (38%).

## Scope

- Goal: staff enrols one registered patient by Aadhaar OTP and the sandbox returns that ABHA.
- Role: facility staff on the CHIP front desk.
- In scope: CRT_ABHA_101, CRT_ABHA_104, CRT_ABHA_102, CRT_ABHA_105, CRT_ABHA_106, CRT_ABHA_107, CRT_ABHA_108, CRT_ABHA_109, CRT_ABHA_112, CRT_ABHA_113, CRT_ABHA_114, CRT_ABHA_116.
- Card case: CRT_ABHA_114. This app shows the ABHA card from ABDM.
- Out of scope: M1 functionalities 2–17, including ABHA login, and milestones M2, M3, and M4.
- Entity type: not chosen. Government and private share this functionality. A private entity must remove the word "government" from the consent declarations before the workbook run. The text on screen is the wording the skill quotes, which includes that word.

## Where the work stands

The enrolment routes and the `/abha` screen exist. Jest covers them with mocked Axios. Status of the live journey: `IMPLEMENTED_NOT_SANDBOX_TESTED`. The Aadhaar OTP request has reached the sandbox. `BENEFIT_NAME` is not sent unless `ABDM_BENEFIT_NAME` is set, and the Aadhaar OTP enrol call does not require it. A tester still types the Aadhaar number, mobile number, and OTP.

<!-- abdm-tracker:start -->

Tracker rows are written by `abdm_report.py tracker` after a sandbox run. No case result is filled in by hand.

<!-- abdm-tracker:end -->

## Steps

| # | Step | Status | Exit | Evidence |
|---|---|---|---|---|
| 1 | API chain for Aadhaar OTP enrolment: request OTP, verify, mobile OTP, suggestions, address, card | done | Routes exist and Jest passes against mocked Axios | `server/src/modules/abha/`, `docs/testing-evidence.md` 2026-11-25. Not a sandbox request id |
| 2 | Record entity type | blocked | The plan says government or private | Waiting on the integrator |
| 3 | Sandbox client id, client secret, and portal benefit name | blocked | A gateway session returns a token. Evidence is the request id only | `docs/known-issues.md` B1 |
| 4 | Screen and flow gaps for the cases in scope | done | Each case can be shown without explaining the gap away. Jest covers the refusal, resend cap, same-mobile branch, address rules, and returning-patient match | `npm test` in `server/`: 14 suites, 57 passed, 0 failed, mocked Axios. Not a sandbox request id |
| 5 | Log redaction of Aadhaar, OTP, ABHA number, and tokens | done | A fixture log contains none of those values | `server/src/shared/logger.test.js` |
| 6 | Re-read the live certificate page and close D4 | pending | Cipher and certificate URL match the page fetched that day | `docs/known-issues.md` D4 |
| 7 | Smoke test with no identity | blocked | Session and certificate both return 200. No Aadhaar in the body | Needs step 3 |
| 8 | Tester run, then workbook | blocked | Each case ends with a request id or a screen attestation. Aadhaar, mobile, and OTP stay out of this file | Needs steps 2, 3, and 4, and the tester at the keyboard |

## Screen map

| Case | Screen or route |
|---|---|
| CRT_ABHA_101 | `/abha` consent and Aadhaar steps |
| CRT_ABHA_104 | `/abha` Aadhaar field. Invalid input shows "Aadhaar Number is not valid" and sends no call |
| CRT_ABHA_102 | `/abha` consent step, before the Aadhaar number is sent |
| CRT_ABHA_105 | `/abha` Aadhaar OTP step. Six digits. Masked mobile phrase from the request/otp message |
| CRT_ABHA_106 | Resend OTP on that step. Disabled for 60 seconds, two resends, then the maximum-attempts sentence |
| CRT_ABHA_107 | Verify on that step. A wrong OTP shows the ABDM message and keeps the same transaction |
| CRT_ABHA_108 | Communication mobile whose last four match `ABHAProfile.mobile` skips the second OTP |
| CRT_ABHA_109 | A different mobile uses the mobile OTP step, with the same resend rule |
| CRT_ABHA_112 | `/abha` address step. Suggestions, rules beside the field, and "ABHA address already exists." |
| CRT_ABHA_113 | Result step shows the 14-digit number and profile. Patient list and audit stay masked |
| CRT_ABHA_114 | Result step shows the card PNG and a download. The image is not stored |
| CRT_ABHA_116 | Patient registration. A full match on name, gender, date of birth, and mobile last 4 reuses that patient |

## M2 — HIP records, linking, and sharing

Phase 2. Skill: `.cursor/skills/abdm-m2` (catalogue 2026.09.16). Role: HIP. Entity type does not change the mandatory M2 cases. M1 steps above stay as they are.

Updated: 2026-11-25. Steps done: 10 of 10 (100%). Sandbox linking is still blocked on `ABDM_HIP_ID`.

### Scope

- Goal: a saved visit becomes a care context ABDM can find, and a granted consent is the only path that pushes an encrypted FHIR bundle.
- In scope: `Health_RECORD_CREATION_101`, `HIP_INTI_LINK_504`, `HIP_INTI_LINK_505`, `HIP_INTI_LINK_506`, `USER_INIT_LINK_601` through `USER_INIT_LINK_607`, `HIP_INIT_NOTIFY_HIECM`, `HIP_INIT_SHARE_CARECONTEXT`.
- Claimed HI type for the first slice: `ImmunizationRecord` (NRCES profile `https://nrces.in/ndhm/fhir/r4/StructureDefinition/ImmunizationRecord`, version 6.5.0, fetched 2026-11-25). The other seven HI type strings use the same factory and stay `UNVERIFIED` until each profile URL is fetched.
- Out of scope: M3 HIU consent initiation, M4 registry registration, gateway v1 `/gateway/v1/bridges`.

### Configuration

- Callback base is `ABDM_CALLBACK_BASE_URL`. The current tunnel is not written here. It was registered again on 2026-11-26 at 21:03 IST with `PATCH /api/hiecm/gateway/v3/bridge/url` (request `94913168-0795-44e9-a769-3808a6384576`, HTTP 202). The following bridge-services call showed that URL and `bridge.active` true. `services` still had no HIP entry. Health records has a Register callback URL button for the next tunnel address.
- `ABDM_HIP_ID` is the `services` entry from `GET /api/hiecm/gateway/v3/bridge-services` whose types include `HIP`. It is not on the client-credentials screen. Empty means linking calls are refused locally.

#### Preflight log

| Date | Step | Observed |
|---|---|---|
| 2026-11-26 | Preflight check (via `/hip/readiness`) | `bridge.url` matches callback base, `bridge.active` true, `ABDM_HIP_ID` configured in env, `services` empty — no HIP entry. Blocker: facility not yet linked to client ID via Software Linkage on HSPA sandbox portal. |

### Steps

| # | Step | Status | Exit | Evidence |
|---|---|---|---|---|
| 1 | M2 section in this file | done | Section exists and M1 rows are unchanged | This section, 2026-11-25 |
| 2 | Link token, encounter care context, encrypted bundle, mobile hash | done | Migration SQL added, applied migrations untouched | `server/prisma/migrations/20261125000033_m2_link_token_and_bundle` |
| 3 | Gateway contracts, headers, data push, Fidelius helper | done | Contracts match the M2 skill paths. A fixture round-trips | `fidelius.test.js` passed 2026-11-25 |
| 4 | Callback inbox | done | Missing bearer is rejected before handling. A duplicate ack does not process twice | `hip.routes.test.js` |
| 5 | Immunization bundle and the other HI type factory | done | A valid immunization bundle is stored. A dangling reference is refused | `fhir/bundle.test.js` |
| 6 | Link token reuse, care-context link, context notify, SMS | done | Save of a verified patient starts the link without a second click | `server/src/modules/hip/link.js`, `records.js` |
| 7 | User-initiated discover, on-init, on-confirm | done | Only unlinked contexts for one matched patient are returned | `server/src/modules/hip/discover.js` |
| 8 | Consent guard, encrypted push, transfer notify | done | A missing or expired consent does not push | `hip.routes.test.js` consent guard cases |
| 9 | Records screen, bundle inspector, readiness, exchange timeline | done | Staff routes render those states | `client/src/modules/hip/pages/HipRecords.jsx` |
| 10 | Jest, OpenAPI, milestone docs | done | Selected Jest files passed. Sandbox status stays `IMPLEMENTED_NOT_SANDBOX_TESTED` | 4 suites, 21 passed, 2026-11-25. Not a sandbox request id |

## M3 — HIU consent and data fetch

Phase 3. Skill: `.claude/skills/abdm-m3` (catalogue 2026.09.16). Role: HIU. M1 and M2 steps above stay as they are.

Updated: 2026-11-27. Steps done: 10 of 13 (77%). Sandbox status: `IMPLEMENTED_NOT_SANDBOX_TESTED`.

### Scope

- Goal: a clinician requests a patient's records by ABHA address, and only a granted, unexpired, unrevoked artefact shows decrypted records.
- Entity type for this run: government (fast track, the fewest record-fetch cases). Under government, HIU_FLOW_107 to 114 are optional. If the organisation registers as private, all eight become mandatory.
- In scope: HIU_FLOW_102, 103, 104, 105, 106, 201, 202, 301 (mandatory), and HIU_FLOW_111 (`ImmunizationRecord`, the one claimed HI type).
- Not run: HIU_FLOW_107, 108, 109, 110, 112, 113, 114. Reason: HI type not claimed (government).
- Out of scope: M4, and HIP-side changes beyond the shared crypto codec, the plaintext MD5 checksum and the push bearer.

### Configuration

- `ABDM_HIU_ID` is the `services` entry from `GET /api/hiecm/gateway/v3/bridge-services` whose types include `HIU`. Empty means every HIU call is refused locally (`HIU_ID_MISSING`), and every HIU callback is refused.
- The data push URL is `ABDM_HIU_DATA_PUSH_BASE_URL` (or `ABDM_CALLBACK_BASE_URL`) followed by `/api/v3/hiu/health-information/transfer`. It must be public HTTPS. `/consents` readiness shows it.
- Raising requests and viewing records needs the CLINICIAN or ADMIN role. Seed with `SEED_ADMIN_ROLE=CLINICIAN`.

### Steps

| # | Step | Status | Exit | Evidence |
|---|---|---|---|---|
| 1 | M3 section in this file | done | Section exists and M1 and M2 rows are unchanged | This section, 2026-11-27 |
| 2 | Shared callback inbox, gateway `milestone` option, role-aware consent lookup | done | Existing HIP tests pass unchanged | `server/src/integrations/abdm/callbackInbox.js`; `hip.routes.test.js` passed 2026-11-27 |
| 3 | Fidelius codec (Weierstrass SPKI, HKDF over the Weierstrass x) | done | A record from an independent Weierstrass (BouncyCastle-style) peer decrypts | `fidelius/curve25519.test.js` 6 passed 2026-11-27. Not yet a sandbox HIP push |
| 4 | Env keys and migration | done | Migration is hand-written and limited to the `chip` schema | `server/prisma/migrations/20261127000034_m3_hiu_consent`. Not yet applied: see step 11 |
| 5 | M3 contracts and readiness | done | Headers match the specification table | `contracts.js` `hiu*`; `/hiu/readiness` |
| 6 | Consent init, on-init, status, on-status | done | The init body matches the specification. ABDM's refusal message is stored verbatim | `hiu.routes.test.js` |
| 7 | Notify, on-notify ack, a fetch for every artefact, on-fetch | done | Two artefacts lead to two fetches and one ack listing both. Wrong `X-HIU-ID` is refused | `hiu.routes.test.js` |
| 8 | HI request, data push receiver, decrypt, MD5 check, notify | done | A push decrypts and is stored re-encrypted. A checksum mismatch is `ERRORED` and notified as `FAILED` | `hiu.routes.test.js` data push cases |
| 9 | Sweeper (status poll on expiry, `dataEraseAt` purge, key wipe) and screens | done | Revoked or expired returns 410 with the reason | `/consents`, `/consents/:id`; `npm test` in `server/`: 20 suites, 114 passed, 2026-11-27 |
| 10 | OpenAPI and docs | done | `/api-docs` lists every HIU route | `api.test.js` path list |
| 11 | Apply the migration and regenerate Prisma Client | blocked | `prisma migrate deploy` applies 0034 and `prisma generate` succeeds | Waiting on the integrator. The dev database is shared with another app's `public` tables, so the generated diff was not used |
| 12 | Sandbox smoke | blocked | Session 200. bridge-services lists an HIU service. init, then on-init with the same `response.requestId` | Needs the HIU service id (Software Linkage on the HSPA sandbox portal) and a live tunnel |
| 13 | Tester run and workbook | blocked | Each in-scope case ends with a request id or a screen attestation | Needs step 12, a tester with an `@sbx` ABHA address in the PHR app, and a HIP holding an ImmunizationRecord for that patient. Run log: `abdm-ft/m3-<timestamp>.md` |

### Screen map

| Case | Screen or route |
|---|---|
| HIU_FLOW_102 | `/consents` form: patient (ABHA address), purpose, HI types, from, to, consent expiry. Then the list shows it as Requested with the time |
| HIU_FLOW_103 | PHR app (tester). `/consents/:id` Check status with ABDM, which leads to on-status REQUESTED |
| HIU_FLOW_104 | `/consents` list: name, ABHA address and number, HI types, purpose, range, created on, expiry, status, status time |
| HIU_FLOW_105 | `/consents/:id` Denied with time. No fetch or data request in the timeline |
| HIU_FLOW_106 | `/consents/:id` artefact: requested vs granted, with values the patient edited marked |
| HIU_FLOW_111 | `/consents/:id` Request records, then View records: the immunization record, with a raw FHIR toggle |
| HIU_FLOW_201 | `/consents` and `/consents/:id` Revoked with time |
| HIU_FLOW_202 | `/consents/:id` View records says "Consent revoked on …". Records are purged |
| HIU_FLOW_301 | The sweeper polls status once the expiry passes, so the request becomes Expired without anyone clicking |

### Open questions for the first sandbox observation

1. Do consent status and consent fetch answer with a 200 and a body, or with a 202 and then a callback? Both are handled.
2. What should `requester.identifier` be? The code sends the facility HFR id, with type `HFR`.
3. What is the acknowledgement on a DENIED or EXPIRED notify, which carries no artefacts? The code sends an empty array.
4. Is the notify `sessionStatus` `TRANSFERRED` or something else? The code sends `TRANSFERRED` or `FAILED`.
5. Does `nonce` belong inside `keyMaterial` only? The code sends it there, as the specification sample does.
6. Does the first real HIP push decrypt? That push is the Fidelius interop check.

## M4 — HFR facility and HPR professional registry

Phase 4. Skill: `.claude/skills/abdm-m4` (catalogue 2026.09.16). Entity type: **private** (chosen 2026-11-27). Role: facility staff and admin. Full design: the approved M4 plan (lookups, then facility bridge link, then registration phases).

Updated: 2026-11-27. Steps done: 0 of 12 (0%). Sandbox status: `PENDING`.

### Scope

- Goal: staff look up facilities and professionals in the registries, and an admin links the facility to the CHIP bridge as HIP and HIU, so `ABDM_HIP_ID` and `ABDM_HIU_ID` can be read from `bridge-services`.
- In scope, phase 1: HFR facility search and LGD master data; HPR exists, search by id, search by mobile, professional info; bridge link `POST /v1/bridges/MutipleHRPAddUpdateServices`; readiness and bridge status.
- Out of scope for phase 1: HFR onboarding writes (phase 2), in-app HPR login (phase 3), HPID creation and professional registration (phase 4). M4 never creates a facility ID or an HPID by itself.
- Never stored: registry profile data (name, council number, mobile, email). Only `hfrId`, `hprId`, status and timestamps.

### Configuration

- `ABDM_HFR_BASE_URL` and `ABDM_HPR_BASE_URL`: the registry host `https://apihspsbx.abdm.gov.in/v4/int` (host must be on `ABDM_SANDBOX_HOST_ALLOWLIST`).
- `ABDM_BRIDGE_ID`: the bridge id from the sandbox registration. Empty means the link call is refused locally.

### Steps

| # | Step | Status | Exit | Evidence |
|---|---|---|---|---|
| 1 | Prerequisites: sandbox session token, bridge id, facility manager | blocked | A gateway session returns a token and `bridge-services` is read | Waiting on the integrator (known-issues B1) |
| 2 | Verify open contract questions with the abdm-docs server | pending | Each item in the plan's verify list is answered or recorded as UNVERIFIED | |
| 3 | Plumbing: registry bases, query support, redaction keys, contracts | pending | Existing client and contract tests pass and new ones cover the registry base | |
| 4 | Lookups: facility search, LGD masters, HPR exists/search/info | pending | Jest passes with mocked `abdmRequest`; RBAC and validation covered | |
| 5 | Facility link: migration, bridge link, bridge status, readiness | pending | Jest covers one HIP and one HIU entry, never combined, and success only after `bridge-services` shows the role | |
| 6 | Screens: lookup and facility link | pending | Pages render readiness, results and errors; client tests pass | |
| 7 | OpenAPI, docs, traceability | pending | `docs/` updated in the same change | |
| 8 | Sandbox run: search, link as HIP, link as HIU, verify | blocked | Request ids logged; `bridge-services` lists both roles | Needs step 1 and the facility manager at the keyboard |
| 9 | Retest M2 link token and M3 consent request | blocked | `ABDM-1035` and `ABDM-1040` are gone | Needs step 8 |
| 10 | NHA workbooks (HFR and HPR), private entity | blocked | Results and report built by `abdm_report.py` | Needs steps 8 and 9 |
| 11 | Phase 2: HFR onboarding | pending | Separate approval | |
| 12 | Phases 3 and 4: HPR login, HPID, professional registration | pending | Separate approval | |


ngrok http 8080
