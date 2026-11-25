# AI-Assisted Development Log (Assignment §6, §7)

The evaluators score "effective use of AI-assisted development tools" and will ask you to defend the code. Log as you go. Evidence written after the fact is weaker.

## Tools

| Tool | Used for | Why |
|---|---|---|
| Cursor (Agent + MCP) | [fill] | [fill] |
| Claude | [fill] | [fill] |
| GitHub Copilot / other | [fill] | [fill] |

## ABDM documentation connection
- Config file `.cursor/mcp.json` contains `abdm-docs` at `https://docs.abdm.gov.in/mcp`. No secret is in that file. A live MCP session has not been verified, so do not write that the assistant is connected.
- Skills on disk: `abdm-m1` under `.cursor/skills/abdm-m1/` (catalogue 2026.09.16). M2, M3, and M4 skills are not installed.
- Rule enforced: no ABDM call without a fetched doc page; doc URL commented at each call site (`CURSOR_RULES.md`).
- No verified AI-generated mistake recorded yet.

## Session log

| # | Slice | Prompt / goal (short) | AI output | Verified against | Manual corrections | Commit |
|---|---|---|---|---|---|---|
| 1 | Scaffold | | | | | |
| 2 | ABDM client | | | | | |
| 3 | Callback router | | | | | |
| 4 | M1 OTP request | First enrolment OTP call returned HTTP 400 | Stopped sending a client-generated txnId. The first request now sends an empty txnId. A refused call logs and returns only the ABDM code and message | Official endpoint page for `POST /abha/api/v3/enrollment/request/otp`: txnId is optional and empty on the first call. Jest `npm test` in `server/`: 15 suites, 63 passed, exit 0. Not a sandbox retry | None in this change | not committed |
| 5 | M2 FHIR | | | | | |
| 6 | M2 linking | | | | | |
| 7 | M3 consent | | | | | |
| 8 | M4 | | | | | |

## Manual reviews of security-critical code

| Area | File | What was checked | Outcome |
|---|---|---|---|
| ABHA identifier encryption | | algorithm, padding and key source match the docs | |
| Callback authentication | | matches documented contract | |
| Consent guard | | all rules + tests | |
| M3 key exchange / payload encryption | | matches official sample | |
| Log redaction | | redact paths + T12 | |

## AI mistakes caught (keep 3–5 concrete examples for the interview)
1. [e.g. AI used a v1/v0.5 path; replaced with the v3 path from the MCP doc page]
2. [e.g. AI returned 202 for every callback; changed to the documented ack per route]
3. [e.g. AI marked a transaction COMPLETED on HTTP 2xx; fixed and covered by T1]


## Accuracy rule for this log
Only record AI-generated mistakes that actually occurred during this implementation, with the prompt/output context, how the mistake was detected, the authoritative source used to correct it, and the resulting code/document change. Do not invent illustrative mistakes and present them as project history. If no mistake has occurred yet, write `No verified AI-generated mistake recorded yet` and update this section if one occurs.
