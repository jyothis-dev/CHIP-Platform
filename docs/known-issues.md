# Known Issues, Limitations and Pending Integrations

Keep this honest and specific. The brief says it values transparency over presenting every workflow as complete.

## Sandbox blockers

| # | Workflow | Blocker (exact error / missing prerequisite) | Impact | Workaround | Label | Requested from assignment contact? |
|---|---|---|---|---|---|---|
| B1 | | | | | | |

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
| D4 | Transit cipher, padding, and certificate URL for ABHA. Dashes must be kept. That part is from the Build with AI page | `UNVERIFIED` beyond the dash rule |
| D5 | Whether a HIP id is per facility. Credentials and the callback URL are not | One bridge is from the portal. HIP id scope is `UNVERIFIED` |

## Prototype limitations (by design)
- Single backend hosts both HIP and HIU roles. Production would separate them per tenant.
- DB-polled retry sweeper instead of a durable queue. Fine for prototype load, not for scale.
- Minimal maternal/child domain model. No clinical decision support, schedules or billing.
- FHIR coverage is limited to the selected HI types: [list].
- Demo login / simplified RBAC.
- Single-instance deployment. The sweeper is not leader-elected.

## Pending integrations
| Item | Reason | Next step |
|---|---|---|
| | | |


## Prerequisites to confirm with the assignment contact

The following are currently unconfirmed prerequisites, not observed sandbox errors. Update each row with the actual response/status when confirmed:
- Sandbox client ID/secret and CM ID; enabled milestone capabilities and role identifiers.
- Approved sandbox ABHA/test identity and permitted OTP delivery/access method.
- Existing or manually provisioned HFR Facility ID.
- Bridge registration, facility-to-bridge linkage and HIP/HIU role enablement.
- Public callback ingress registration and separate HIU data-push URL configuration.
- Official sandbox Postman collection or equivalent test instructions, if supplied.

Until these are confirmed, do not claim a live workflow is blocked by a specific error; use `PENDING` with the missing prerequisite as the reason. Never use real Aadhaar or patient data as a substitute.
