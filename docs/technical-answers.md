# Technical Answers (Assignment §7)

Draft answers based on the design. Before submission, replace every `[fill]` with specifics from the actual build: file paths, test names, real issues hit. Keep each answer to 5–12 lines and link to code.

## Architecture and interoperability

### 1. Explain the complete architecture of your ABDM integration.
One React frontend and one Express backend holding two ABDM roles: HIP (M2) and HIU (M3), plus M1 ABHA and M4 registry modules. All outbound traffic goes through a single ABDM client adapter (gateway token cache, per-API header contracts, retries, correlation IDs). All inbound traffic goes through one callback router (authenticate → validate → persist → dedup → ack → process). PostgreSQL stores domain data, transactions, callback events, consent artefacts and an audit log designed to be append-only at the application layer. See `architecture.md` §2 and the sequence diagrams in §4. [fill: repo links]

### 2. Explain the difference between HIP and HIU and how they interact.
A HIP (Health Information Provider) holds patient records, links them to the patient's ABHA as care contexts, and releases them only against a valid consent artefact. A HIU (Health Information User) requests access through the Consent Manager, and receives and decrypts records once the patient approves. They never talk directly. The CM/gateway brokers consent and the health-information request, and the HIP pushes encrypted data to the HIU's data-push URL and notifies the CM. In this prototype both roles live in one backend but interact only through ABDM, as two separate organisations would.

### 3. How have you implemented asynchronous callbacks in M2 and M3?
Not implemented. No callback route exists. Intended design: an outbound M2 or M3 call creates an `ABDMTransaction` in `INITIATED`. A 2xx moves it to `ACCEPTED`, then `WAITING_FOR_CALLBACK`. It does not move it to `COMPLETED`. The callback is stored as `CallbackEvent` with unique `(route, dedupKey)`, acknowledged as that contract specifies, then correlated. M1 is different: a fetched operation with no callback may complete on its success body. Failures retry only when the handler is safe to replay. A local deadline sets `EXPIRED` and does not prove ABDM failed. Tests T1–T6 are not executed. [fill after a real run]

### 4. How do you handle transaction IDs, correlation IDs and duplicate requests?
- Internal `correlationId` per operation, propagated to logs, audit and transaction rows.
- Outbound `requestId` (unique constraint) and external `txnId`/consent/transaction IDs stored separately and indexed.
- Duplicate inbound callbacks are caught by unique `(route, dedupKey)`: re-acknowledged, not reprocessed. This is intended design. The constraint is not in the current Prisma schema.
- Duplicate internal POSTs are caught by `Idempotency-Key`.
- Retries reuse the same request ID where the API permits it.

### 5. How do you ensure the implementation follows the current ABDM v3 specifications?
The ABDM docs MCP server and milestone skills are connected to the coding assistant. Each endpoint's doc page is fetched before coding, and each call site carries the doc URL and verification date. Outbound contracts live in one file (`contracts.js`), and callback payloads are validated with schemas derived from the docs. Everything is then exercised against the sandbox, with differences logged in `known-issues.md`. [fill: examples of corrections]

## Security and data management

### 6. How have you handled encrypted identifiers and authentication?
Not implemented for ABDM. No ABHA encryption code exists. Intended design: encrypt identifiers in transit only with the fetched certificate and algorithm, keeping dashes in an ABHA number. At rest, AES-256-GCM plus an HMAC is a local control, not a verified ABDM requirement. The gateway token would be cached in memory and not stored. App login today is bcrypt (cost 12) and a short-lived JWT. Argon2id is not in the code. [fill: library and doc URL after they are fetched]

### 7. How do you ensure health information is exchanged only through appropriate consent and authorization?
Not implemented. There is no consent guard and no T9 run. Intended design: one check immediately before any HIP release, reading the stored artefact again. It must be `GRANTED`, inside its validity window, not revoked, and the HI types, date range, care contexts, and patient must match. An earlier authorization must not be reused. The HIU accepts a push only for a health-information request it opened. Denied, expired, and revoked requests return 403.

### 8. How do you prevent sensitive information from appearing in logs?
Not implemented for ABDM fields. Pino today redacts password, passwordHash, refreshToken, token, authorization, and cookie (`server/src/shared/logger.js`). It does not yet redact Aadhaar, OTP, or ABHA. T12 has not been written or run. Intended design: extend that redact list, and do not log ABDM request or response bodies. The error handler already hides unexpected error details from the client. The error-handler Jest case has been run. That case is not T12.

### 9. How have you implemented audit trails and transaction tracking?
Partly implemented for login only. `logAudit` in `server/src/shared/audit.js` writes actor, action, resource, outcome, and correlation id after login and logout. There is no transaction monitor UI, no callback processor, and no proof that every future state change is audited. Append-only is an application convention, not a database guarantee. Intended design: one `ABDMTransaction` per outbound operation, internal status separate from `externalStatus`, and `CallbackEvent` rows for the timeline.

## AI-assisted development

### 10. Which AI tools did you use and why?
[fill: e.g. Cursor (agent + MCP for in-repo generation), Claude (architecture review, docs), Copilot (inline completions). One line on why each.]

### 11. How did you connect the official ABDM documentation to your AI assistant?
[fill: MCP config used (no secrets), which milestone skills were loaded, and the rule that every ABDM call must be fetched from the MCP before coding (`CURSOR_RULES.md`).]

### 12. How did you validate AI-generated code?
Compared every request and response against the MCP-fetched doc page. Ran it against the sandbox. Wrote fixture tests from doc examples. Manually reviewed all crypto, auth and consent code. Rejected any endpoint or header the docs didn't contain. [fill: concrete examples from `ai-usage.md`]

### 13. What technical issues did you encounter and how did you resolve them? Which parts needed manual intervention?
[fill from `known-issues.md` and `ai-usage.md`: e.g. callback URL registration and tunnelling, header differences between APIs, encryption padding, FHIR validation errors, sandbox test-data limits. Manual decisions: single backend with two roles, DB-backed retries instead of queues, consent guard as a single choke point, no raw payload storage.]

## Product ownership

### 14. If given complete ownership of CHIP, how would you make this production-ready and scalable?
- **Platform:** split into an integration gateway service (ABDM adapter + callbacks) and domain services. Replace DB polling with a durable queue (e.g. SQS/Kafka) and an outbox pattern for effectively-once business processing through durable inbox/outbox records, idempotent handlers, unique constraints and reconciliation.
- **Multi-tenancy:** per-facility HIP/HIU onboarding, per-tenant keys and credentials in a KMS/secrets manager, tenant-scoped data partitioning.
- **Reliability:** horizontal callback receivers behind a load balancer, idempotent processors, dead-letter queues with replay tooling, SLOs on callback latency.
- **Observability:** OpenTelemetry tracing across outbound calls and callbacks, dashboards per milestone, alerts on orphaned or expired transactions.
- **Compliance:** ABDM certification path (functional and security audits), DPDP Act alignment, a VAPT cycle, data-retention policies, consent analytics.
- **Interoperability:** a FHIR profile library covering all HI types with versioned IG upgrades, a terminology service (SNOMED CT/LOINC), and contract tests that run against the sandbox on every v3 spec change.
- **Product:** maternal–child longitudinal record linked across facilities, patient-facing consent dashboards, scan-and-share registration.


## Claims that must be verified before submission
This document is a response template, not proof that the listed components exist. Before submission:
- Replace every `[fill]` and every forward-looking instruction with actual repository paths, implemented behavior and executed evidence.
- Remove statements that tests "prove" a property unless those tests were run and the output is retained.
- Do not state that MCP/skills are connected until verified in the actual IDE session.
- Do not claim every state change is audited unless code paths and tests demonstrate it.
- Do not claim exactly-once processing across ABDM and the local system.
- If an implementation is only mocked or locally tested, label it accordingly and state that it was not sandbox-tested.
