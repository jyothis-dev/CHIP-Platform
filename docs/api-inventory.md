# API Inventory — WombTo18 ABDM Prototype

All internal routes that are implemented are in `server/src/docs/openapi.yaml`, served at `http://localhost:8000/api-docs`. The table below includes routes that are not built yet. Those stay out of the spec until the handlers exist. State-changing routes accept `Idempotency-Key` once they exist. Asynchronous internal operations may return `202` with `{ transactionId, status, evidenceLabel }`, and the client may poll `GET /api/transactions/:id`. This is an internal API convention only; do not apply it to synchronous M1 actions or assume it matches ABDM callback acknowledgements.

## Internal routes

| Method | Route | Purpose | Milestone |
|---|---|---|---|
| POST | `/api/auth/login` | Staff login | — |
| GET | `/api/dashboard` | Counts, pending transactions, recent callbacks | — |
| GET/POST | `/api/patients?q=&page=&pageSize=` | Search/register mother, child, or general patient (IMPLEMENTED_NOT_SANDBOX_TESTED). The list is paged and returns `managedBy` staff | — |
| GET | `/api/patients/:id` | Profile with managing staff and masked ABHA status (IMPLEMENTED_NOT_SANDBOX_TESTED) | — |
| POST | `/api/patients/:motherId/children` | Register newborn, link to mother | — |
| POST | `/api/patients/:id/encounters` | Child follow-up / immunization | — |
| GET | `/api/abha/traces?page=&pageSize=` | Paged development log of ABHA requests and redacted responses (IMPLEMENTED_NOT_SANDBOX_TESTED). On in development unless `ABDM_TRACE=false` | M1 |
| POST | `/api/abha/enrolment/otp` | Start ABHA creation (request OTP) | M1 |
| POST | `/api/abha/enrolment/verify` | Verify OTP and enrol | M1 |
| POST | `/api/abha/login/otp` | Start ABHA verification/login | M1 |
| POST | `/api/abha/login/verify` | Verify login OTP | M1 |
| GET | `/api/patients/:id/abha` | Masked ABHA identity and status | M1 |
| POST | `/api/health-records` | Build and validate FHIR for an encounter | M2 |
| GET | `/api/health-records/:id/validation` | Validation result | M2 |
| POST | `/api/care-contexts/:id/link` | Start HIP-initiated linking | M2 |
| GET | `/api/patients/:id/care-contexts` | Link status | M2 |
| POST | `/api/consents` | Raise consent request (HIU) | M3 |
| GET | `/api/consents/:id` | Consent status and artefacts | M3 |
| POST | `/api/consents/:id/artefact` | Fetch the consent artefact. Not the health-information request | M3 |
| POST | `/api/consents/:id/health-information` | Start the HIU health-information request. Requires `GRANTED` and a fresh consent check | M3 |
| GET | `/api/consents/:id/records` | Received record metadata | M3 |
| GET | `/api/registries/hfr?query=` | HFR lookup | M4 |
| GET | `/api/registries/hpr?query=` | HPR lookup | M4 |
| POST | `/api/facilities/:id/hfr-link` | Attach verified HFR ID | M4 |
| POST | `/api/practitioners/:id/hpr-link` | Attach verified HPR ID | M4 |
| GET | `/api/transactions` / `/api/transactions/:id` | Transaction monitor and timeline | All |
| GET | `/api/audit?action=&resourceType=&resourceId=&outcome=&from=&to=&page=&pageSize=` | Paged facility activity log with human-readable `message` (IMPLEMENTED_NOT_SANDBOX_TESTED) | All |
| GET | `/health` | Liveness and DB check | — |

## Deferred routes

Not in the current build. Status `PENDING`. The demo does not need a pregnancy, an antenatal visit, or a delivery.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/patients/:id/pregnancies` | Create pregnancy |
| POST | `/api/pregnancies/:id/visits` | Antenatal visit |
| POST | `/api/pregnancies/:id/delivery` | Record delivery |

## ABDM inbound callback routes

Fill the "Exact path" and "Ack" columns from the official v3 docs (MCP) before implementing. Do not guess them. A local fixture is not an ABDM route and must not be documented as one. Callback path, ack, and correlation cells stay blank.

| Callback purpose | Role | Exact path (from docs) | Ack (from docs) | Correlation field (from docs) | Tier |
|---|---|---|---|---|---|
| Care-context link result | HIP | | | | C |
| Patient discovery | HIP | | | | E |
| Link init | HIP | | | | E |
| Link confirm | HIP | | | | E |
| Consent notification (to HIP) | HIP | | | | C |
| Health-information request | HIP | | | | C |
| Consent request status / ID | HIU | | | | C |
| Consent notification (to HIU) | HIU | | | | C |
| Consent artefact fetch result | HIU | | | | C |
| Health-information request ack | HIU | | | | C |
| Data push receiver | HIU | | | | C |

The data-push receiver is the same tier as workflow 3.6. The route is Core. Decrypting a real payload is `MOCKED` or `PENDING` until the crypto page and sandbox are available. Paths, acks, and correlation fields stay blank until fetched. Do not fill them from memory.

Each callback route is listed in Swagger under the tag `ABDM Callbacks`, with its schema and documented acknowledgement.

## ABDM outbound calls
Keep the outbound contract map in `server/src/integrations/abdm/contracts.js`: name, method, path, required headers, doc URL and verified date. This file is the single place to update when the v3 specification changes.

Phase 1 M1 contracts verified against the ABDM M1 catalogue snapshot 2026.09.16 (`verifiedOn: 2026-09-16`):

| Contract | Method | Path | Base |
|---|---|---|---|
| session | POST | `/api/hiecm/gateway/v3/sessions` | gateway `https://dev.abdm.gov.in` |
| certificate | GET | `/abha/api/v3/profile/public/certificate` | ABHA |
| requestAadhaarOtp | POST | `/abha/api/v3/enrollment/request/otp` | ABHA |
| enrolByAadhaar | POST | `/abha/api/v3/enrollment/enrol/byAadhaar` | ABHA |
| requestMobileOtp | POST | `/abha/api/v3/enrollment/request/otp` | ABHA |
| verifyMobileOtp | POST | `/abha/api/v3/enrollment/auth/byAbdm` | ABHA |
| addressSuggestion | GET | `/abha/api/v3/enrollment/enrol/suggestion` | ABHA |
| createAbhaAddress | POST | `/abha/api/v3/enrollment/enrol/abha-address` | ABHA |
| abhaCard | GET | `/abha/api/v3/profile/account/abha-card` | ABHA |

Internal Express routes (Vite strips `/api` before proxying): `POST /abha/enrolment/otp`, `POST /abha/enrolment/verify`, `POST /abha/enrolment/mobile/verify`, `GET /abha/enrolment/:transactionId/address-suggestions`, `POST /abha/enrolment/address`, `GET /abha/enrolment/:transactionId/card`, `GET /patients`, `POST /patients`, `GET /patients/:id`, `GET /patients/:id/abha`, `GET /audit`.


## ABDM contract completion gate
The callback path, required headers, authentication mechanism, body schema, acknowledgement status/body and correlation fields must be populated from the exact official MCP operation documentation before the corresponding callback is implemented. Blank values are intentional until verified; do not guess them. Attach the source documentation URL at the implementation call site and record the API/operation version where available.
