# Known Issues, Limitations and Pending Integrations

Keep this honest and specific. The brief says it values transparency over presenting every workflow as complete.

## Sandbox blockers

| # | Workflow | Blocker (exact error / missing prerequisite) | Impact | Label | Requested from assignment contact? |
|---|---|---|---|---|---|
| B1 | M1 ABHA creation (Aadhaar OTP) | Aadhaar OTP was delivered. Verify then stopped in CHIP because `ABDM_BENEFIT_NAME` was empty. Official enrol/byAadhaar marks Benefit-Name optional for this flow. The local stop is removed. Verify has not been re-run against the sandbox | Enrolment stays IMPLEMENTED_NOT_SANDBOX_TESTED until enrol/byAadhaar returns 200 | IMPLEMENTED_NOT_SANDBOX_TESTED | No |
| B2 | Shared Aiven `defaultdb` | Other apps already use `public.users` / `public.audit_logs` | CHIP tables and enums live in PostgreSQL schema `chip` so they do not collide | IMPLEMENTED_NOT_SANDBOX_TESTED | No |

## Phase 1 M1 prerequisite gate (2026-11-25)

| Prerequisite | Status | Notes |
|---|---|---|
| Sandbox client ID | present | Configured in the server environment. Gateway session succeeds. The value is not recorded here |
| Sandbox client secret | present | Configured in the server environment. The value is not recorded here |
| CM ID | present (default) | Use `sbx` for sandbox (`ABDM_CM_ID`, default `sbx`) |
| Benefit name | not used for Aadhaar OTP | Official enrol/byAadhaar marks Benefit-Name optional. Send it only for a benefit programme. The product title is not that name |
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
| D2 | FHIR profile names and the NRCeS IG package id | ImmunizationRecord fetched 2026-11-25: `https://nrces.in/ndhm/fhir/r4/StructureDefinition/ImmunizationRecord` version 6.5.0. The other seven HI type profile URLs remain `UNVERIFIED` and those bundles are stored as `UNVERIFIED` and are not linked |
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
- The enrolment screen now collects the published consent text, rejects an invalid Aadhaar before any call, limits OTP entry to 6 digits, keeps each OTP valid for 10 minutes, resends at most twice, skips a second OTP when `ABHAProfile.mobile` matches, enforces ABHA address rules, shows the 14-digit number on the result, and can download the card image. Those paths are still `IMPLEMENTED_NOT_SANDBOX_TESTED`.

## Pending integrations
| Item | Reason | Next step |
|---|---|---|
| Live M1 sandbox run | OTP request reached the sandbox. Verify has not returned a sandbox 200 yet | Request a fresh OTP and submit it on `/abha` |
| M1 ABHA login (number/address) | Out of phase 1 scope | Phase 2 |

## Prerequisites to confirm with the assignment contact

The following are currently unconfirmed prerequisites, not observed sandbox errors. Update each row with the actual response/status when confirmed:
- Sandbox client ID/secret and CM ID; enabled milestone capabilities and role identifiers.
- Approved sandbox ABHA/test identity and permitted OTP delivery/access method.
- Benefit name, only if enrolment is through an NHA-approved benefit programme. The product title is not that value.
- Existing or manually provisioned HFR Facility ID.
- Bridge registration, facility-to-bridge linkage and HIP/HIU role enablement.
- Public callback ingress registration and separate HIU data-push URL configuration.
- Official sandbox Postman collection or equivalent test instructions, if supplied.

Until these are confirmed, do not claim a live workflow is blocked by a specific error; use `PENDING` with the missing prerequisite as the reason. Never use real Aadhaar or patient data as a substitute.
