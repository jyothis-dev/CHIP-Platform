# WombTo18 — ABDM Prototype (8-Hour MVP)

## Objective

Build a small, demonstrable ABDM integration prototype for WombTo18, a maternity-to-child healthcare platform. **The implementation time budget is approximately 8 focused hours.** Do not attempt to build a full maternity EMR or complete every ABDM workflow.

The demo uses a small synthetic patient scenario:
- Register one mother.
- Create one pregnancy and one antenatal visit.
- Record one delivery and register one newborn.
- Add one child follow-up/immunization record.
- Demonstrate the ABDM integration architecture and a narrowly selected workflow for M1–M4.

The maternal/child records are lightweight demo records only. Do not build clinical decision support, a complete immunization schedule, growth charts, billing, appointments, or a production-grade patient portal.

## Required architecture

One Express backend and one application with two integration roles:

- **HIP side:** holds local patient/clinical records and provides records when a valid consent-based request is received.
- **HIU side:** initiates consent-based requests and receives records.

These are workflow roles, not separate services or separate applications. The same backend can expose both sides, but each operation must follow the official sandbox role configuration and protocol.

Core components:
1. ABDM client adapter: centralizes documented headers, request identifiers, timestamp, CM identifier, auth, timeouts, and safe logging. Generate a correlation ID for every internal integration operation. Use retries only for documented transient and safe-to-retry operations.
2. Callback router: public HTTPS callback routes as required by the sandbox. Validate the documented contract, persist events, deduplicate, then process. Return the exact acknowledgement required by ABDM. **Do not assume every callback should return HTTP 202**; verify each callback contract. If processing asynchronously, acknowledge only after durable persistence where the contract allows.
3. Transaction table: internal request ID, documented external transaction ID, workflow type, status, correlation ID, timestamps, and safe metadata. Keep external status separate from internal status. A successful HTTP acknowledgement does not mean the workflow completed; apply final status only after the matching callback or documented status response.
4. Idempotency: unique constraints for internal request IDs and stable callback event IDs where provided. If the callback has no unique event ID, define a safe deduplication strategy from documented fields; do not assume every callback has a callback ID.
5. Audit log: actor, action, resource type/id, facility, timestamp, outcome. Never log Aadhaar, OTP, access tokens, client secrets, private keys, or raw clinical payloads.
6. FHIR module: create the smallest required resource/bundle for one selected clinical use case and validate against the exact applicable ABDM/NRCeS profile and version.
7. Swagger/OpenAPI for internal IMS endpoints; Jest/Supertest or the existing project test runner for a few focused tests, including callback fixture tests.

## Minimal WombTo18 user journey

1. Staff logs in.
2. Register/find a mother.
3. Create pregnancy profile and one antenatal visit.
4. Record delivery.
5. Register newborn and link newborn to mother.
6. Add one child follow-up/immunization record.
7. Display ABHA identity/workflow status.
8. Demonstrate one M2 care-context/record workflow.
9. Demonstrate one M3 consent state and the HIP/HIU boundary.
10. Show M4 HFR/HPR lookup result or clearly labelled mock.
11. Show transaction and audit timeline.

## M1–M4 scope for an 8-hour prototype

| Milestone | Minimum demonstration | What not to build |
|---|---|---|
| M1 | One sandbox-supported ABHA create/verify or login workflow; show pending and final status | Every Aadhaar/mobile/ABHA-address variation and full profile/card polish |
| M2 | One local clinical record mapped to a minimal applicable FHIR bundle; one supported care-context linking path and callback | Both HIP-initiated and patient-initiated linking unless time remains |
| M3 | One consent initiation/status flow and a clearly separated HIP/HIU design; use a labelled simulation for encrypted transfer if real sandbox transfer is not feasible | Full bidirectional production-grade HIE unless explicitly required and sandbox-ready |
| M4 | One HFR lookup and/or HPR lookup if accessible; otherwise fixture-backed mock labelled as mock | Full registry registration lifecycle if sandbox APIs/prerequisites are unavailable |

Use only approved sandbox test identifiers and OTPs. Never use real Aadhaar or personal health data.

## Technology

- React + Vite, JavaScript/JSX
- Node.js + Express, JavaScript ES Modules
- PostgreSQL + Prisma (or existing project database if already configured)
- Axios
- Swagger/OpenAPI
- Jest + Supertest (or existing test stack)
- Pino or equivalent structured logger with redaction

Avoid microservices, Redis, BullMQ, queues, Kubernetes, complex admin, and unnecessary abstractions.

## Minimal screens

1. Login (can be a simple demo login if allowed by assignment)
2. Dashboard
3. Mother/Child list and registration
4. Mother profile: pregnancy + antenatal visit + delivery
5. Child profile: newborn + one follow-up/immunization record
6. ABDM panel: M1 status, M2 care-context status, M3 consent status, M4 lookup
7. Transaction monitor

A compact tabbed profile is sufficient. Do not create a separate screen for every API call.

## Minimal database

- `User` (or simple demo auth)
- `Facility`
- `Patient` (mother/child)
- `MotherChildRelationship`
- `Pregnancy`
- `Encounter` (antenatal, delivery, child follow-up)
- `ABHAIdentity` (only required safe references/status; protect identifiers)
- `HealthRecord` (metadata and controlled FHIR reference)
- `ConsentRequest` (minimum metadata for selected M3 workflow)
- `ABDMTransaction`
- `CallbackEvent`
- `AuditLog`

Do not store OTPs, access tokens, secrets, or private keys in the database. Do not store raw sensitive callback payloads unless the official requirement and security design justify it; prefer redacted/minimized payload storage.

## Suggested 8-hour timebox

See `docs/implementation-plan.md`. If a real sandbox workflow is blocked by credentials, role configuration, public callback access, or missing prerequisites, timebox the investigation and implement a clearly labelled fixture-backed simulation. Do not claim it is sandbox-tested.

## Non-negotiable correctness

- Official ABDM documentation, current schemas, MCP/skills, and assigned sandbox are the source of truth.
- Verify exact API paths, required headers, payloads, callback routes/acknowledgements, status values, cryptography, FHIR profiles, and retries. The user's workflow notes are requirements to investigate, not proof of exact protocol details.
- Do not hard-code an assumed HTTP 202 response for all callbacks.
- Do not equate API acceptance with completion.
- Match callbacks to the correct transaction and process duplicates safely.
- Enforce consent before sharing data.
- Label each workflow: `SANDBOX_TESTED`, `IMPLEMENTED_NOT_TESTED`, `MOCKED`, or `BLOCKED`.

## Definition of done

At the end of 8 focused hours, deliver:
- A runnable application with the simplified mother-to-child journey.
- One real sandbox workflow if access is ready (prefer M1 or M2 depending on prerequisites).
- A shared HIP/HIU integration architecture in one Express backend.
- Transaction persistence and at least one callback route tested with fixtures.
- A minimal FHIR example with profile validation if the relevant validator/profile is available.
- A basic consent status demonstration and M4 lookup/mock with honest labels.
- Swagger, a few automated tests, setup steps, screenshots, and a short limitations list.

Official starting point: https://docs.abdm.gov.in/docs/hiecm/v3/getting-started/build-with-ai
