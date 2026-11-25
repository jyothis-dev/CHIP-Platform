# Known Issues, Limitations and Pending Integrations

Keep this honest and specific. The brief says it values transparency over presenting every workflow as complete.

## Sandbox blockers

| # | Workflow | Blocker (exact error / missing prerequisite) | Impact | Label | Requested from assignment contact? |
|---|---|---|---|---|---|
| B1 | M1 ABHA creation (Aadhaar OTP) | Sandbox client ID and client secret not supplied to this environment | Live session and enrolment calls cannot run; code is tested with mocked Axios only | PENDING | No |
| B2 | Shared Aiven `defaultdb` | Other apps already use `public.users` / `public.audit_logs` | CHIP tables and enums live in PostgreSQL schema `chip` so they do not collide | IMPLEMENTED_NOT_SANDBOX_TESTED | No |

## Phase 1 M1 prerequisite gate (2026-11-25)

| Prerequisite | Status | Notes |
|---|---|---|
| Sandbox client ID | missing | Set `ABDM_CLIENT_ID` in `server/.env` when issued |
| Sandbox client secret | missing | Set `ABDM_CLIENT_SECRET` in `server/.env` when issued |
| CM ID | present (default) | Use `sbx` for sandbox (`ABDM_CM_ID`, default `sbx`) |
| Benefit name | missing | Set `ABDM_BENEFIT_NAME` from the portal; do not invent a name. Enrol call stops without it |
| Gateway base URL | present (known host) | `https://dev.abdm.gov.in` — set `ABDM_GATEWAY_BASE_URL` and include host on `ABDM_SANDBOX_HOST_ALLOWLIST` |
| ABHA base URL | present (known host) | `https://abhasbx.abdm.gov.in` — set `ABDM_ABHA_BASE_URL` and include host on allowlist |
| Tester who can receive Aadhaar OTP | missing | Required for a live sandbox run; unit tests use fixtures only |
| Approved Aadhaar test identity | missing | Required for a live sandbox run |
| Approved test mobile | missing | Required when communication-mobile verify runs |

## Spec vs sandbox differences

| # | API | Documented behaviour | Observed behaviour | Handling |
|---|---|---|---|---|

## Documentation limits that are still open
These are not sandbox errors. Do not close them by inventing an API.

| # | Item | Status |
|---|---|---|
| D1 | Callback path, acknowledgement, and correlation columns in `api-inventory.md` are blank | `UNVERIFIED` until MCP returns each operation |
| D2 | FHIR profile names and the NRCeS IG package id | `UNVERIFIED` |
| D3 | Which M4 registration calls are mandatory. The portal title is registration, not lookup | `UNVERIFIED` |
| D4 | Transit cipher, padding, and certificate URL for ABHA. Dashes must be kept. That part is from the Build with AI page | Catalogue names `RSA/ECB/OAEPWithSHA-1AndMGF1Padding` and `GET /v3/profile/public/certificate`; still re-verify on the live page before claiming `SANDBOX_TESTED` |
| D5 | Whether a HIP id is per facility. Credentials and the callback URL are not | One bridge is from the portal. HIP id scope is `UNVERIFIED` |
| D6 | Whether `enrol/abha-address` requires a callback before `COMPLETED` | Until the fetched page says otherwise, the transaction stays `ACCEPTED` after address create |

## Prototype limitations (by design)
- Single backend hosts both HIP and HIU roles. Production would separate them per tenant.
- DB-polled retry sweeper instead of a durable queue. Fine for prototype load, not for scale.
- Minimal maternal/child domain model. No clinical decision support, schedules or billing.
- FHIR coverage is limited to the selected HI types: [list].
- Demo login / simplified RBAC.
- Single-instance deployment. The sweeper is not leader-elected.
- Phase 1 M1 covers Aadhaar-OTP creation only. Login by ABHA number or address is not built.

## Pending integrations
| Item | Reason | Next step |
|---|---|---|
| Live M1 sandbox run | Client ID/secret, benefit name, and tester OTP access missing | Supply credentials and a tester; then run task 7 of the phase 1 plan |
| M1 ABHA login (number/address) | Out of phase 1 scope | Phase 2 |

## Prerequisites to confirm with the assignment contact

The following are currently unconfirmed prerequisites, not observed sandbox errors. Update each row with the actual response/status when confirmed:
- Sandbox client ID/secret and CM ID; enabled milestone capabilities and role identifiers.
- Approved sandbox ABHA/test identity and permitted OTP delivery/access method.
- Benefit name approved for the enrol call.
- Existing or manually provisioned HFR Facility ID.
- Bridge registration, facility-to-bridge linkage and HIP/HIU role enablement.
- Public callback ingress registration and separate HIU data-push URL configuration.
- Official sandbox Postman collection or equivalent test instructions, if supplied.

Until these are confirmed, do not claim a live workflow is blocked by a specific error; use `PENDING` with the missing prerequisite as the reason. Never use real Aadhaar or patient data as a substitute.
