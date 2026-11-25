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

- Callback base is `ABDM_CALLBACK_BASE_URL`. The current tunnel is not written here. Register it with `PATCH /api/hiecm/gateway/v3/bridge/url` only after a person confirms it.
- `ABDM_HIP_ID` is the `services` entry from `GET /api/hiecm/gateway/v3/bridge-services` whose types include `HIP`. It is not on the client-credentials screen. Empty means linking calls are refused locally.

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
