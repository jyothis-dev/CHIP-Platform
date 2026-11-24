# Cursor Rules — WombTo18 8-Hour MVP

## Deadline and scope
The total implementation budget is approximately 8 focused hours. Build a small, demonstrable prototype—not a complete maternity EMR or production ABDM platform.

The local demo: mother registration -> pregnancy -> one antenatal visit -> delivery -> newborn registration -> one child follow-up/immunization record.

ABDM scope: one M1 path, one M2 record/care-context path, one M3 consent-state path, one M4 lookup or clearly labelled mock. Prefer a real sandbox workflow where prerequisites are ready.

## Architecture
- One React + Vite frontend.
- One Express backend, JavaScript ES Modules.
- One backend contains HIP and HIU workflow modules; they are roles in the same app, not separate services.
- PostgreSQL + Prisma.
- Central ABDM client, callback router, transaction tracking, audit log, minimal FHIR module.
- No microservices, Redis, BullMQ, complex queue, full EMR, or unnecessary abstraction.

## Before coding
1. Read README and all docs.
2. Inspect existing repo.
3. Verify exact API/header/callback/FHIR/crypto contracts using official ABDM docs, MCP/skills, and assigned sandbox.
4. Confirm credentials, CM ID, facility/bridge prerequisites, public callback URL, and enabled roles.
5. Identify blockers quickly; do not spend the whole time troubleshooting unavailable sandbox prerequisites.
6. Implement only after the user approves the short plan.

## Correctness
- The supplied workflow notes are a checklist to verify, not authoritative protocol contracts.
- Never invent endpoints, headers, payloads, callback acknowledgement, status values, FHIR profiles, or cryptographic details.
- Do not assume every callback should return HTTP 202.
- Persist callback before acknowledging when contract permits.
- HTTP acceptance is not workflow completion.
- Correlate callbacks to transactions and deduplicate.
- Enforce valid consent before sharing.
- Use official encryption examples; never improvise cryptography.
- Clearly label `SANDBOX_TESTED`, `IMPLEMENTED_NOT_TESTED`, `MOCKED`, or `BLOCKED`.

## Security
- Synthetic test data only.
- Never log Aadhaar, OTP, ABHA identifiers, tokens, secrets, private keys, or clinical payloads.
- Keep credentials server-side.
- Enforce basic authentication and facility/patient access on the backend.

## Implementation discipline
- Use JavaScript/JSX, Axios, and custom CSS.
- Implement one vertical slice at a time.
- Keep screens and APIs minimal.
- Run the app and focused tests after each slice.
- Update Swagger and evidence docs.
