# AI-Assisted Development Log (Assignment §6, §7)

The evaluators score "effective use of AI-assisted development tools" and will ask you to defend the code. Log as you go. Evidence written after the fact is weaker.

Items marked **CONFIRM** are things only the developer knows (the actual prompts used, which tool wrote which slice). Fill them in rather than leaving a guess.

## Tools

| Tool | Used for | Why |
|---|---|---|
| Cursor (Agent + MCP) | M1 and M2 slices. `.cursor/skills/abdm-m1` and `abdm-m2` are installed. **CONFIRM** the exact slices | Cursor rules in `CURSOR_RULES.md` enforce "no ABDM call without a fetched doc page" |
| Claude Code | M3 and M4 slices (`.claude/skills/abdm-m3`, `abdm-m4`), the integration plan, docs and sandbox-log analysis. **CONFIRM** the exact slices | Reads the `abdm-docs` MCP server and updates `INTEGRATION-PLAN.md` after each step |
| ABDM `abdm-docs` MCP server | Contract facts: paths, headers, bodies, error decoding, FHIR profiles | It is the official source. Used instead of memory of the API |
| GitHub Copilot / other | None recorded | |

## ABDM documentation connection
- Config file `.cursor/mcp.json` contains `abdm-docs` at `https://docs.abdm.gov.in/mcp`. No secret is in that file. The Claude Code session reads the same server. Contract reads are recorded in `INTEGRATION-PLAN.md` (for example M4 paths, headers and bodies read on 2026-11-27).
- Skills on disk (catalogue 2026.09.16):
  - `.cursor/skills/`: `abdm-m1`, `abdm-m2`
  - `.claude/skills/`: `abdm-m2`, `abdm-m3`, `abdm-m4`
- Rule enforced: no ABDM call without a fetched doc page; doc URL commented at each call site (`CURSOR_RULES.md`).
- Workflow per milestone: load the skill router, write the plan steps with exit conditions in `INTEGRATION-PLAN.md`, build one flow at a time, run Jest with mocked Axios, then run against the sandbox and record the request id. Nothing is marked `SANDBOX_TESTED` without a sandbox request id.

## Session log

Commit hashes are from `git log`. **CONFIRM** the prompt text for each row.

| # | Slice | Prompt / goal (short) | AI output | Verified against | Manual corrections | Commit |
|---|---|---|---|---|---|---|
| 1 | Scaffold, DB, health check | **CONFIRM** | Express app, Prisma schema, migrations, health endpoint reporting DB status | `npm test`, local run | **CONFIRM** | `2faf12a`, `7a8ae86`, `ed1b9ae` |
| 2 | Docs, rules, audit logging | **CONFIRM** | `CURSOR_RULES.md`, README, audit logging rules, Swagger | Read against the brief | **CONFIRM** | `25c5fdb`, `f48c054`, `83e0222`, `54d7eff` |
| 3 | Client structure, patient validation | **CONFIRM** | React modular client, child-age validation | Jest | **CONFIRM** | `1f53e47`, `9cc502f` |
| 4 | M1 OTP request | First enrolment OTP call returned HTTP 400 | Stopped sending a client-generated txnId. The first request now sends an empty txnId. A refused call logs and returns only the ABDM code and message | Official endpoint page for `POST /abha/api/v3/enrollment/request/otp`: txnId is optional and empty on the first call. Jest `npm test` in `server/`: 15 suites, 63 passed, exit 0. Not a sandbox retry | None in this change | not committed |
| 5 | M1 consent, resend, pagination | **CONFIRM** | Consent text step, OTP resend cap, paginated ABHA traces and audit logs | Jest (57 tests at the time of plan step 4) | **CONFIRM** | `fee38a2`, `1b5f35e` |
| 6 | M2 callback registration and linking | **CONFIRM** | HIP callback-URL registration UI, link token, discover, on-init, on-confirm | `hip.routes.test.js`, `fidelius.test.js`. Sandbox: generate-token accepted, link refused with `ABDM-1207` | **CONFIRM** | `0d1c2c4` |
| 7 | M3 consent | **CONFIRM** | HIU consent request, status, notify, fetch, data push receiver, Fidelius codec | `hiu.routes.test.js`; `npm test` 20 suites, 114 passed on 2026-11-27. Sandbox: init `8391e049` accepted, on-init processed | **CONFIRM** | `9240495` |
| 8 | M4 registries | **CONFIRM** | HFR and HPR lookups, LGD masters, facility bridge link, readiness | `registries.routes.test.js` with mocked ABDM. Sandbox: HFR search `39c29b60` and LGD lists HTTP 200 | **CONFIRM** | `3a464e8` |
| 9 | Auth token reactivity | **CONFIRM** | `useSyncExternalStore` token subscription | Not recorded | **CONFIRM** | `afafd42` |

## Manual reviews of security-critical code

Do these by hand and record the result. Only the log redaction row has test evidence on file today.

| Area | File | What was checked | Outcome |
|---|---|---|---|
| ABHA identifier encryption | `server/src/modules/abha/` | algorithm, padding and key source match the docs. Open item D4: re-verify the cipher and certificate URL on the live page | Pending |
| Callback authentication | `server/src/integrations/abdm/callbackInbox.js` | A missing bearer is rejected before handling (`hip.routes.test.js`) | Test passes. Manual review pending |
| Consent guard | `server/src/modules/hip/` | A missing or expired consent does not push (`hip.routes.test.js` consent guard cases) | Test passes. Manual review pending |
| M3 key exchange / payload encryption | `server/src/integrations/abdm/fidelius/` | Matches an independent Weierstrass peer locally. Not yet a sandbox HIP push (B4) | Pending sandbox |
| Log redaction | `server/src/shared/logger.test.js` | A fixture log contains no Aadhaar, OTP, ABHA number or token | Passed |

## AI mistakes caught

Only mistakes that actually occurred in this project are listed. Add more as they are found.

1. **Client-generated `txnId` on the first OTP request.** The generated code sent one and ABDM returned HTTP 400. Detected by the sandbox response. Corrected against the official endpoint page (txnId is optional and empty on the first call). Code now sends an empty txnId. (Session row 4.)
2. **A required `Benefit-Name` blocked Aadhaar OTP verify.** The generated code stopped locally when `ABDM_BENEFIT_NAME` was empty. The official `enrol/byAadhaar` page marks it optional for this flow, so the local stop was removed. (`known-issues.md` B1.)
3. **A generated `prisma migrate diff` would have dropped another app's tables.** The shared database has `public.users` and `public.audit_logs` from other apps. The diff was read before it was applied on 2026-11-27, and migration 0034 was hand-written for the `chip` schema only. (`known-issues.md` B2.)

## Accuracy rule for this log
Only record AI-generated mistakes that actually occurred during this implementation, with the prompt/output context, how the mistake was detected, the authoritative source used to correct it, and the resulting code/document change. Do not invent illustrative mistakes and present them as project history. If no mistake has occurred yet, write `No verified AI-generated mistake recorded yet` and update this section if one occurs.
