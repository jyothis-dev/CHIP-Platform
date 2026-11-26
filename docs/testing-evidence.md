# Testing and Sandbox Evidence

## Automated test plan (Jest + Supertest)

The rows below are planned cases. The Result column stays `not executed` until a command output is pasted here. Do not describe them as passing merely because they are listed.

Shell Jest, executed 2026-11-25 from `server/` with `npm test` (Prisma and Axios mocked, not sandbox): 15 suites, 63 passed, 0 failed, 0 skipped. Exit code 0. Includes the first Aadhaar OTP request body, which now sends an empty `txnId`. That run is not a sandbox call.

| # | Test | Type |
|---|---|---|
| T1 | Outbound M2/M3 acceptance sets `ACCEPTED/WAITING_FOR_CALLBACK`, never `COMPLETED`. M1 synchronous success is a separate case and is not executed | Unit |
| T2 | Matching callback moves the transaction to `COMPLETED` | Integration (fixture) |
| T3 | Duplicate callback → `DUPLICATE`, processed once, same acknowledgement returned | Integration |
| T4 | Callback for an unknown transaction → `ORPHANED`, no state change | Integration |
| T5 | Invalid callback payload → rejected per contract | Integration |
| T6 | Late callback after local timeout/expiry is persisted and reconciled; no blind reopen or discard | Unit + integration fixture |
| T7 | Retry only documented safe-to-replay operations; respect `Retry-After`; do not blindly retry OTP/consent creation or ambiguous outcomes | Unit (mocked Axios) |
| T8 | Token refresh on 401 happens once, then fails cleanly | Unit |
| T9 | Consent guard: DENIED / EXPIRED / REVOKED / out-of-range HI type / date range each rejected | Unit |
| T10 | HI request with a valid consent → data released (or mock flagged) | Integration |
| T11 | FHIR bundle for the child immunization passes validation; a broken bundle fails and blocks linking | Integration |
| T12 | Log redaction: no OTP/Aadhaar/ABHA/token in serialized logs | Unit |
| T13 | Facility scope: user from facility A cannot read a facility B patient | Integration |
| T14 | Idempotency-Key repeat returns the original response | Integration |
| T15 | Config guard refuses a non-sandbox ABDM URL | Unit |

Record the test command and the latest results summary (e.g. `npm test -- --coverage`) here before submission.

## Sandbox evidence log

One row per sandbox execution. References are masked (e.g. `txn …a91f`). Screenshots are stored in `docs/evidence/` and named `M<n>-<workflow>-<yyyymmdd-hhmm>.png`.

| Milestone | Workflow | Date/time (IST) | Environment | Masked request/txn ref | Expected | Actual | Label | Evidence |
|---|---|---|---|---|---|---|---|---|
| M1 | ABHA creation (Aadhaar OTP) | 2026-11-25 | local/mock | n/a | ABHA created and the phase-1 screen cases can be exercised | Jest with mocked Axios. The first OTP request body sends an empty `txnId`. A live sandbox OTP call the same day returned HTTP 400 before that correction and has not been repeated. | IMPLEMENTED_NOT_SANDBOX_TESTED | Jest `abha.service.test.js` (`npm test` in `server/`: 15 suites, 63 passed, exit 0) |
| M1 | ABHA verification/login | | sandbox | | | | PENDING | Out of phase 1 |
| M2 | FHIR validation | 2026-11-25 | local Jest | mocked | `fhir/bundle.test.js` valid immunization bundle and dangling reference. Not sandbox | IMPLEMENTED_NOT_SANDBOX_TESTED | no | |
| M2 | HIP-initiated link + callback | 2026-11-25 | local Jest | mocked | Callback without bearer is 401. Duplicate callback returns 202 and does not process again. No sandbox request id | IMPLEMENTED_NOT_SANDBOX_TESTED | no | |
| M2 | HI request handled with consent check | 2026-11-25 | local Jest | mocked | Missing, expired, and wrong care-context consents are refused before a push. No sandbox request id | IMPLEMENTED_NOT_SANDBOX_TESTED | no | |
| M2 | Register bridge URL | 2026-11-26 21:03 IST | sandbox gateway | request `94913168` | `PATCH /api/hiecm/gateway/v3/bridge/url` 202, then bridge-services shows that URL, `bridge.active` true, and a HIP service | HTTP 202. The following bridge-services call matched the callback URL and `bridge.active` true. `services` had no HIP entry. | IMPLEMENTED_NOT_SANDBOX_TESTED | Server log for request `94913168-0795-44e9-a769-3808a6384576` |
| M2 | HIP link token (generate-token) | 2026-11-27 01:57 IST | sandbox | `12d1bf5f` (earlier: `32a068a4`, `cee7f323`) | 202, then an on-generate-token callback carrying a link token | HTTP 202. The callback arrived and was PROCESSED, but it carried `ABDM-1207` ("The information you provided does not match the details on record with Aadhaar"). The exchange is FAILED and the care context is marked FAILED. The request sends abhaNumber, abhaAddress, name, gender and yearOfBirth, so one of them differs from the ABHA record. Not yet corrected | SANDBOX_TESTED (failing: ABDM-1207) | `abdm_transactions` and `callback_events` rows for those request ids |
| M2 | Patient-initiated linking (discover, init, confirm) | 2026-11-27 02:05 to 02:07 IST | sandbox | discover `f8fb6957`, link-init `f4a6fd54`, on-confirm `a44c759a` | ABDM calls discover, init and confirm, and CHIP answers each | Inbound callbacks PROCESSED: discover 2, init 2, confirm 2. Our on-discover (`34530e3b`), on-init (`ea540d55`) and on-confirm answers were accepted with 202. One discover callback is recorded as DEAD and has not been investigated. No care context is LINKED yet (3 FAILED, 2 LINK_REQUESTED, 2 NOT_LINKED) | SANDBOX_TESTED (partial: final LINKED not observed) | `abdm_transactions` and `callback_events` rows |
| M3 | Consent request + status callback | 2026-11-27 00:59 IST | sandbox | init `8391e049`, status `5f4a2436` | init 202, then an on-init callback links the ABDM consent request id, and the patient sees the request in the PHR app | init 202. The `on-init` callback arrived and was PROCESSED, and the request reached REQUESTED with an ABDM id. The PHR app showed a pending consent from requester "Cyber Hospital" (types Discharge Summary and Immunization Record, 15 Sep 2014 to 27 Nov 2026). A second request at 01:53 IST (`e1f643cd`) is still INIT_SENT with no on-init callback. The status call `5f4a2436` returned 202 and no status callback has been seen. `requester.identifier` was the HIU id at the time (no HFR id was saved yet) and ABDM accepted it | SANDBOX_TESTED (init and on-init only) | `abdm_transactions` rows with those request ids; PHR screenshot `Screenshot 2026-11-27 015400` (stored outside the repo, not yet in `docs/evidence/`) |
| M3 | Consent GRANTED / DENIED / REVOKED handling | | sandbox | | | The patient cannot grant yet: the PHR app says no facility is available, because no care context is LINKED for that ABHA address. One `/api/v3/hiu/consent/request/notify` callback is recorded as DEAD and has not been investigated | PENDING | |
| M3 | Health information transfer | | sandbox | | | | | |
| M4 | HFR lookup | 2026-11-27 01:48 IST | sandbox registry host | search `39c29b60`, `d9be32c8`; LGD districts `1a2cee4c`; LGD states `05ed018d`, `b2c78027` | `POST /FacilityManagement/v1.5/facility/search` and the LGD lists answer 200 with the gateway session token | All five calls returned HTTP 200 on `apihspsbx.abdm.gov.in/v4/int`, so the registry accepts the gateway token and this search path works. The facility HFR id was then saved on the local facility with status "Submitted" | SANDBOX_TESTED | `abdm_transactions` rows (`m4.hfr.search`, `m4.hfr.lgd.*`, all COMPLETED). Screenshot not yet captured |
| M4 | HPR lookup | | sandbox | | | No HPR call has been made yet | PENDING | |
| M4 | Bridge services read | 2026-11-27 01:48 IST | sandbox gateway | `3da3d6ef`, `96e29786` | bridge-services lists the facility service with its roles | HTTP 200. The bridge URL matches the callback base, the bridge is active, and the facility service lists types HIP and HIU | SANDBOX_TESTED | `abdm_transactions` rows (`m4.bridge.services`). Same data as the Registry page |

## Evidence rules
- Synthetic or approved sandbox data only. Never capture Aadhaar, OTP, full ABHA number, tokens, secrets or private keys.
- Each screenshot shows the UI status label **and** the transaction timeline (accepted → callback → completed), which proves the async handling.
- Record a 5–8 minute demo video: journey → M1 → M2 → M3 → M4 → transaction monitor → audit log → test run.


## Additional required cases
| # | Test | Type |
|---|---|---|
| T16 | Same `Idempotency-Key` + same request-body hash returns the original safe result | Integration |
| T17 | Same `Idempotency-Key` + different request-body hash returns conflict and causes no second side effect | Integration |
| T18 | Callback containing sensitive fields persists only the minimum required encrypted/normalized data; logs remain redacted | Integration |
| T19 | Callback with no documented unique event ID uses the approved stable dedup strategy; duplicate side effect is prevented | Integration |
| T20 | Client id, client secret, and callback base URL are read from the process environment, not from a facility row | Integration |
| T21 | Consent is rechecked at the time of data release; revoked/expired consent cannot pass a stale earlier authorization check | Integration |
| T22 | Timeout with ambiguous remote outcome triggers reconciliation before any replay | Unit + integration fixture |

## Evidence record template
For every executed test or sandbox workflow, record: test ID/workflow, execution timestamp (timezone), environment, sanitized transaction/reference ID, result, evidence filename/link, and whether it was sandbox, local integration, unit or mocked. A test plan row is not evidence of execution.
