# Requirements Traceability Matrix

Every requirement from the assignment brief, mapped to where it is implemented and its honest status. Update this file in the same commit as the code. Status values: `SANDBOX_TESTED` · `IMPLEMENTED_NOT_SANDBOX_TESTED` · `MOCKED` · `PENDING`.

## §3 Functional scope

| ID | Requirement | Module / file | Tier | Status | Evidence / reason |
|---|---|---|---|---|---|
| M1.1 | ABHA creation workflows | `modules/abha` | C | IMPLEMENTED_NOT_SANDBOX_TESTED | Aadhaar OTP enrolment path implemented; sandbox credentials missing (see `known-issues.md` B1) |
| M1.2 | OTP-based verification | `modules/abha` | C | PENDING | Phase 1 covers OTPs inside creation only. Login by ABHA number/address is phase 2 |
| M1.3 | ABHA number and ABHA address handling | `modules/abha`, `ABHAIdentity` | C/E | IMPLEMENTED_NOT_SANDBOX_TESTED | Masked number, ciphertext, hash, and one address stored from enrolment |
| M1.4 | Authentication and validation | `integrations/abdm/session.js`, Zod schemas | C | IMPLEMENTED_NOT_SANDBOX_TESTED | Gateway session + staff JWT + consent/Zod validation; not sandbox-proven |
| M1.5 | Error handling and transaction status tracking | `ABDMTransaction`, error map | C | IMPLEMENTED_NOT_SANDBOX_TESTED | INITIATED→ACCEPTED→FAILED/ACCEPTED; Jest coverage with mocked Axios |
| M2.1 | Patient and health record management | `modules/patients`, `health-records` | C | PENDING | |
| M2.2 | HIP-related integration | `modules/hip` | C | PENDING | |
| M2.3 | Health record linking | `modules/care-contexts` | C | PENDING | |
| M2.4 | Linking confirmation and callbacks | `callbacks/` | C | PENDING | |
| M2.5 | Health record sharing workflows | `hip/healthInformation` | C | PENDING | |
| M2.6 | FHIR resource/bundle preparation and validation | `integrations/abdm/fhir` | C | PENDING | |
| M3.1 | Consent request initiation | `modules/consent` | C | PENDING | |
| M3.2 | Consent status management | `ConsentRequest`, state machine | C | PENDING | |
| M3.3 | Consent notifications and callbacks | `callbacks/` | C | PENDING | |
| M3.4 | HIU health-information request and receipt workflow (paired with HIP response in M2) | `modules/hiu`, `modules/hip` | C/E by stage | PENDING | |
| M3.5 | Expiry, rejection, revocation handling | `consentGuard`, sweeper | C | PENDING | |
| M3.6 | Secure data transfer and transaction tracking | `crypto/`, `DataTransfer` | C/E by stage | PENDING | |
| M4.1 | HPR lookup | `modules/registries` | C | PENDING | |
| M4.2 | HFR lookup | `modules/registries` | C | PENDING | |
| M4.3 | Registration and verification workflows | `modules/registries` | E | PENDING | |
| M4.4 | Facility and professional information management | `Facility`, `Practitioner` | C | PENDING | |
| M4.5 | API response and error handling | registry error map | C | PENDING | |

## §4 Technical expectations

| Requirement | Where | Status |
|---|---|---|
| React / Node + Express / PostgreSQL / Swagger | repo structure | PENDING |
| Proper API architecture | `architecture.md` §6 | PENDING |
| Secure credential and token management | `config/`, `auth.js` | PENDING |
| Request validation | Zod schemas | PENDING |
| Callback handling | `callbacks/` | PENDING |
| Transaction and correlation ID tracking | `ABDMTransaction` | PENDING |
| Error handling and retry mechanisms | `retry.js`, sweeper | PENDING |
| Database persistence | Shell migration `20261124000000_wombto18_mvp` only. Target tables in `database-schema.md` are not migrated | IMPLEMENTED_NOT_SANDBOX_TESTED |
| Audit logging | `logAudit` writes actor, action, resource, outcome, correlationId, and human-readable `message` for login/logout, denials, patient create, and ABHA enrolment steps. Facility `GET /audit` + Activity Log UI | IMPLEMENTED_NOT_SANDBOX_TESTED |
| FHIR validation | validator wrapper | PENDING |
| Basic automated tests | Shell Jest passed (health, login, errors, rate limit). T1–T22 not written | IMPLEMENTED_NOT_SANDBOX_TESTED |
| Accepted ≠ completed | state machine, T1/T2 | PENDING |

## §6 Deliverables

| Deliverable | Location | Ready |
|---|---|---|
| Source code for all four modules | repo | ☐ |
| GitHub repo with commit history | repo URL | ☐ |
| Working prototype | `setup-and-deployment.md` | ☐ |
| Database schema and data models | `database-schema.md`, `prisma/schema.prisma`, `erd.png` | ☐ |
| API documentation | `/api-docs`, `api-inventory.md` | ☐ |
| Architecture diagram | `architecture.md` | ☐ |
| Sandbox testing evidence per milestone | `testing-evidence.md`, `evidence/` | ☐ |
| Screenshots / recorded demo | `evidence/`, video link | ☐ |
| Endpoints, callbacks, workflows documentation | `api-inventory.md`, `workflows.md` | ☐ |
| Known issues, limitations, pending integrations | `known-issues.md` | ☐ |
| Setup and deployment documentation | `setup-and-deployment.md` | ☐ |
| AI usage explanation | `ai-usage.md` | ☐ |
| Technical questions answered | `technical-answers.md` | ☐ |

## Milestone summary (fill before submission, as required by §6)

| Milestone | SANDBOX_TESTED | IMPLEMENTED_NOT_SANDBOX_TESTED | MOCKED | PENDING |
|---|---|---|---|---|
| M1 | | | | |
| M2 | | | | |
| M3 | | | | |
| M4 | | | | |


## Status definitions and evidence rules
- `SANDBOX_TESTED`: the specific workflow was executed successfully against the ABDM sandbox; include date/time, sanitized request/response or callback evidence, transaction reference and test identity alias.
- `IMPLEMENTED_NOT_SANDBOX_TESTED`: code exists but has not been executed successfully against the sandbox. State whether local tests were run and identify the exact sandbox blocker or remaining validation.
- `MOCKED`: the behaviour is simulated with clearly labelled fixtures; no live ABDM interaction occurred.
- `PENDING`: not implemented. Record reason, dependency and next action.
- Do not treat a passing unit test or fixture test as sandbox evidence. Do not treat an accepted outbound request as completion.

## Facility and bridge configuration traceability
The portal says one bridge serves every facility, and that the callback URL and the credentials are not facility settings. Do not track a per-facility bridge role unless a fetched API requires it.

Track these separately:
- Facility / HFR identifier and its source. M4 lookup does not create it.
- The single bridge id and client credentials, in environment only, present or missing.
- `ABDM_CALLBACK_BASE_URL` and `ABDM_HIU_DATA_PUSH_BASE_URL` as two values.
- Whether `ABDM_HIP_ID` is per facility. That question is `UNVERIFIED`.
