# AI Assistant Rules — WombTo18 ABDM Prototype

These rules apply to Cursor, Claude, Copilot or any other assistant working in this repo.

## Scope
- 24-hour assignment covering M1–M4. Build the **Core tier** first, a thin but correct slice of every milestone, then the **Extension tier** (`docs/implementation-plan.md`).
- Every assignment requirement is tracked in `docs/requirements-traceability.md`. When you finish or defer something, update its status there in the same change.
- Local demo journey: mother → newborn linked to that mother → one child immunization. Pregnancy, antenatal visit, and delivery stay `PENDING`.

## Source of truth: ABDM docs MCP server and skills
1. Connect the official ABDM documentation MCP server (config from the developer portal's "Build with AI" page) in `.cursor/mcp.json` or your client's MCP settings. Do not commit tokens; the MCP config must not contain secrets.
2. Load the milestone-specific AI skills from the portal (M1 ABHA, M2 care context, M3 consent, M4 registries, plus auth/FHIR/testing skills if provided).
3. **Before writing any ABDM call or callback handler**, fetch its documentation page through the MCP server and confirm the path, method, headers, request/response schema, acknowledgement, error codes and status values.
4. Put the doc reference above each call site:
   ```js
   // ABDM v3: <doc page title> — <doc URL>  (verified YYYY-MM-DD)
   ```
5. If MCP output and sandbox behaviour differ, the sandbox wins for testing, and the difference is recorded in `docs/known-issues.md`.

## Architecture
- One React + Vite frontend and one Express backend (ES Modules), PostgreSQL + Prisma.
- HIP and HIU are modules in one backend, not separate services.
- All outbound ABDM traffic goes through `integrations/abdm/client.js`. No direct Axios calls to ABDM elsewhere.
- All inbound ABDM traffic goes through `integrations/abdm/callbacks/` (validate → persist → dedup → ack → process).
- No microservices, Redis, BullMQ or generic workflow engine. Retries use DB columns and an in-process sweeper.

## Correctness
- Never invent endpoints, headers, payloads, acknowledgements, status values, FHIR profiles or cryptography.
- Never assume HTTP 202 for every callback.
- Persist the callback before acknowledging, where the contract allows.
- HTTP acceptance is not completion for M2 and M3. Those workflows move `ACCEPTED → WAITING_FOR_CALLBACK` and finalize only on the matching callback or a documented status API. An M1 operation with no callback may move to `COMPLETED` on the success body the fetched contract describes. Do not force that M1 call through `WAITING_FOR_CALLBACK`.
- Correlate callbacks using the documented field. Deduplicate on `(route, dedupKey)`, not on `dedupKey` alone. The same ABDM id can arrive on the HIP route and the HIU route.
- Enforce consent (status, validity window, HI types, date range, purpose, patient) before any data leaves the HIP.
- Cryptography uses only the official algorithm and sample code (ABHA identifier encryption, M3 key exchange and payload encryption). Any crypto code gets a manual review note in `docs/ai-usage.md`.
- Label each workflow `SANDBOX_TESTED`, `IMPLEMENTED_NOT_SANDBOX_TESTED`, `MOCKED`, or `PENDING`, in the code (a constant), the UI, and the docs. There is no `IMPLEMENTED_NOT_TESTABLE` label.

## Security
- Synthetic or approved sandbox data only.
- Never log Aadhaar, OTP, ABHA number/address, tokens, secrets, private keys or clinical payloads. Use the Pino redact list in `shared/logging`.
- Credentials stay server-side in `.env`. `.env` is git-ignored; only `.env.example` is committed.
- Enforce authentication, role, and facility/patient scope on every backend route.

## Working method
- Build one vertical slice at a time: schema → service → route → Swagger → test → UI → evidence.
- Run the tests after each slice. Keep commits small and descriptive (`feat(m2): HIP care-context link callback`), so the commit history shows the progression.
- After each slice, append to `docs/ai-usage.md`: prompt or goal, what the AI produced, what you verified against the docs, what you corrected.
- Update Swagger, `docs/testing-evidence.md` and the traceability matrix before moving to the next slice.


## Implementation and evidence discipline
- Use the assignment's exact status labels: `SANDBOX_TESTED`, `IMPLEMENTED_NOT_SANDBOX_TESTED`, `MOCKED`, `PENDING`. If the evaluator's brief specifies different exact wording, use that wording consistently.
- Never mark a workflow `SANDBOX_TESTED` without a recorded sandbox run and sanitized evidence. Never claim a unit/integration test passed unless it was actually executed.
- `IMPLEMENTED_NOT_SANDBOX_TESTED` means implemented but not sandbox-executed; it does not automatically mean unit-tested. Record test status separately.
- M3 Core must include the HIU health-information request stage. Keep HIP serving/sharing in M2. Use official docs to verify the exact cross-milestone sequence.
- A local timeout is not proof of remote failure. Preserve late callbacks and reconcile remote state; do not discard them or blindly reopen a terminal local state.
- Retry only operations verified as safe to replay. Never blindly retry OTP-consuming or consent-creation calls, or an operation with an ambiguous remote outcome.
- Do not promise exactly-once delivery across ABDM and local infrastructure. Implement effectively-once business processing using durable inbox/outbox patterns, unique constraints, idempotent handlers and reconciliation.
- One bridge serves every facility in this prototype. Client credentials and `ABDM_CALLBACK_BASE_URL` are process environment, not columns on `Facility`. Do not build `ABDMBridge`, `FacilityBridge`, or `FacilityBridgeRole` unless a fetched M4 operation requires them. Whether a HIP id is per facility is `UNVERIFIED` until that page is fetched. A facility may still store an HFR id.
- Keep callback ingress URL and HIU data-push URL as separate configuration values, even if both are served by this Express deployment.
- Do not store raw clinical payloads or sensitive callback bodies in logs. Persist only the minimum validated callback data needed for processing; encrypt sensitive retained fields and apply access/retention controls.
