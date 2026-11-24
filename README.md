# WombTo18 — ABDM Integration Prototype (M1–M4)

## Objective

Build a working, well-structured ABDM integration prototype for WombTo18, a maternity-to-child healthcare platform, covering all four ABDM milestones:

- **M1** — Create and verify ABHA.
- **M2** — Create, link and share health records (HIP role).
- **M3** — Health information exchange with consent (HIU role).
- **M4** — HPR / HFR registry integration.

Delivery window: **48 hours**. Build in two tiers (see `docs/implementation-plan.md`):

- **Core tier (~8 focused hours):** login, one mother-to-child record, one M1 OTP path or an explicit `PENDING`, one HIP link with a fixture callback until the real path is fetched, a consent check that blocks sharing, and one M4 call or a labelled `MOCKED`. Details are in `docs/implementation-plan.md`.
- **Extension tier (remaining window):** extra M1 variants, patient-initiated linking, real encrypted M3 transfer, the HL7 validator, and further M4 registration calls.

Every requirement in the assignment is tracked in `docs/requirements-traceability.md` with one of four honest status labels. Nothing is dropped silently: anything not built is listed as `PENDING` with a reason.

## Status labels (aligned to assignment §6)

| Label | Meaning |
|---|---|
| `SANDBOX_TESTED` | Implemented and executed successfully against the ABDM sandbox; evidence captured. |
| `IMPLEMENTED_NOT_SANDBOX_TESTED` | Implemented in code, but not executed successfully against the ABDM sandbox. State the exact reason and evidence; do not imply tests passed unless they were run. |
| `MOCKED` | Behaviour simulated with labelled fixtures; no ABDM call is made. |
| `PENDING` | Not yet implemented; reason and next step recorded. |

The UI shows the same label next to each workflow.

## Demo scenario (synthetic data only)

1. Staff logs in.
2. Register or find a mother; create or verify her ABHA (M1).
3. Register the newborn and link it to the mother.
4. Add one child immunization record.
5. Build one FHIR bundle for that immunization and link it as a care context (M2).
6. As HIU, raise a consent request, receive the consent notification, and fetch records (M3).
7. As HIP, validate the consent and serve the health-information request (M2 sharing).
8. Look up the facility (HFR) and practitioner (HPR) and attach verified references (M4).
9. Show the transaction timeline (accepted → waiting → completed/failed) and the audit trail.

Pregnancy, antenatal visit, and delivery are `PENDING`. They are listed under deferred routes in `docs/api-inventory.md`.

The maternal and child records are lightweight demo records. Out of scope: clinical decision support, full immunization schedules, growth charts, billing and appointments.

## Architecture summary

One React frontend and one Express backend. The backend holds **both ABDM roles**:

- **HIP module:** owns local clinical records, links care contexts, and releases records only against a valid consent artefact.
- **HIU module:** raises consent requests and receives and decrypts health information.

These are roles in one deployment, not separate services. Details are in `docs/architecture.md`.

Shared building blocks:

1. **ABDM client adapter.** Gateway session token cache, documented headers (request ID, timestamp, CM ID and others, per API), timeouts, a retry policy for safe operations, correlation ID propagation and redacted logging.
2. **Callback router.** Public HTTPS routes per the official contracts: validate, persist durably, deduplicate, acknowledge exactly as documented, then process.
3. **Transaction store.** Internal request ID, external transaction or request IDs, workflow, milestone, internal and external status kept separately, attempts and last error. An accepted request is never treated as completed.
4. **Idempotency.** A unique constraint on the outbound request ID, a unique callback dedup key, and an `Idempotency-Key` header on internal POST routes.
5. **Retry and recovery.** A DB-backed retry schedule (`attempts`, `nextAttemptAt`) and a lightweight in-process sweeper. There is no Redis or queue infrastructure, by design.
6. **Audit log.** Actor, action, resource, facility, correlation ID and outcome, with no secrets or clinical payloads.
7. **FHIR module.** Builds one bundle for the selected encounter after the NRCeS profile name and IG version are fetched. Those names are `UNVERIFIED`. The Java validator is Extension, not Core.
8. **API docs and tests.** Swagger/OpenAPI for internal routes plus the callback routes; Jest and Supertest, including callback fixture tests.

## Technology

| Layer | Choice | Note |
|---|---|---|
| Frontend | React + Vite (JSX) | Assignment preference |
| Backend | Node.js + Express (ES Modules) | Assignment preference |
| Database | PostgreSQL + Prisma | Migrations committed |
| HTTP | Axios with interceptors | Central ABDM client |
| Validation | Zod (or Joi) | Request and callback payloads |
| Logging | Pino with `redact` paths | See `docs/security.md` |
| Docs | Swagger/OpenAPI 3 | `/api-docs` |
| Tests | Jest + Supertest | Callback fixtures, state machine, redaction |
| FHIR validation | HL7 FHIR Validator (Java CLI) with the NRCeS ABDM IG package | Version pinned in `.env.example` |

Excluded by design for prototype scope: microservices, Redis, BullMQ and Kubernetes. The production path for these is covered in `docs/technical-answers.md`, question 14.

## Documentation map

| Document | Purpose | Assignment ref |
|---|---|---|
| `docs/requirements-traceability.md` | Every assignment requirement mapped to module, status and evidence | §3, §4, §6 |
| `docs/architecture.md` | Components, HIP/HIU boundary, sequence diagrams, state machine | §6, §7 |
| `docs/workflows.md` | M1–M4 workflow specifications and callback lifecycle | §3 |
| `docs/api-inventory.md` | Internal API routes and ABDM callback routes | §6 |
| `docs/database-schema.md` | Data model and constraints | §6 |
| `docs/security.md` | Credentials, encryption, redaction, consent enforcement | §5, §7 |
| `docs/testing-evidence.md` | Test plan and per-milestone sandbox evidence | §6 |
| `docs/setup-and-deployment.md` | Local setup, environment, callback tunnel, deployment | §6 |
| `docs/known-issues.md` | Limitations, blockers and pending integrations | §6 |
| `docs/ai-usage.md` | AI tools, MCP/skills setup, prompts and manual corrections | §6, §7 |
| `docs/technical-answers.md` | Answers to all assignment §7 questions | §7 |
| `CURSOR_RULES.md` | Rules for the AI coding assistant | §2 |

## Non-negotiable correctness

- The official ABDM v3 documentation (through the ABDM docs MCP server and milestone skills) and the assigned sandbox are the source of truth. Every ABDM call site carries a comment that links to the doc page it was built from.
- Never invent endpoints, headers, payload fields, callback acknowledgements, status values, cryptography or FHIR profiles.
- Do not assume every callback returns HTTP 202. Verify each contract.
- An accepted request does not mean a completed workflow. Only the matching callback or a documented status response finalizes a transaction.
- Consent is enforced at the HIP before any record leaves the system.
- Use synthetic or approved sandbox data only. No real Aadhaar, OTP, token or secret may appear in logs, screenshots or fixtures.

## Prerequisites and scope caveats

- The sandbox credentials, enabled roles, facility/bridge configuration, callback registration and approved test identity are external prerequisites. Until they are supplied, do not attempt live ABDM calls or use real patient/Aadhaar data.
- The Core tier is a prioritisation target, not proof that every workflow is complete. Update traceability with the actual implementation and evidence. If only eight hours are available in total, stop after Core and mark the rest `PENDING`; do not imply the Extension tier was completed.
- M3 Core includes the HIU health-information request path, not consent initiation alone. If encrypted transfer cannot be completed, isolate the blocked transfer stage as `MOCKED` or `PENDING` and document the exact blocker.
- M2 owns the HIP side of answering and sharing records; M3 owns the HIU side of consent, requesting and receiving them.

Official starting point: https://docs.abdm.gov.in/docs/hiecm/v3/getting-started/build-with-ai
Official prompt setup: https://docs.abdm.gov.in/agent-setup/prompt.md

The portal titles M4 “Register Healthcare Professionals and Health Facilities.” Lookup alone does not define that milestone. Which registration APIs are mandatory is `UNVERIFIED` until those pages are fetched. The same page says one bridge serves every facility, and that the callback URL and the credentials are not facility settings. An ABHA number keeps its dashes when it is encrypted. The cipher, padding, and certificate URL are `UNVERIFIED` until the encryption page is fetched.

Do not invent MCP configuration. Follow the current developer-portal setup instructions and copy the exact non-secret configuration for the chosen client.
