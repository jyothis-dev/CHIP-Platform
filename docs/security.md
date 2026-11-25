# Security and Data Protection

## Credentials and configuration
- Sandbox credentials live in `.env` (git-ignored) or a secrets manager. Only `.env.example` with placeholders is committed. Add a pre-commit secret scan (e.g. `gitleaks`) and a CI step for it.
- Config is validated at startup with Zod. The app **refuses to start** if any ABDM base URL is not on the sandbox allow-list (no production endpoints).
- No secret is exposed through `VITE_*` variables. The frontend never talks to ABDM directly.
- The gateway session token is cached in memory only, refreshed before expiry, and never persisted or logged.

## Identifier and payload protection
| Data | Handling |
|---|---|
| Aadhaar / OTP | In memory only for the request; encrypted per the official ABHA spec before sending; never stored or logged |
| ABHA number | Local at-rest control, not a verified ABDM wire rule: AES-256-GCM (`ABHA_ENC_KEY` plus key version), HMAC-SHA256 for lookup, masked for display. Transit encryption uses only the fetched certificate and algorithm. Keep dashes in the value that is encrypted. |
| ABHA address | Stored for consent requests; masked in logs |
| Clinical data | Source records only; FHIR bundles generated on demand; never logged |
| M3 ephemeral keys | Generated per health-information request; private key in memory or encrypted with a short TTL; destroyed after decryption |
| Callback payloads | Stored redacted/minimised only |

## Log redaction
Pino `redact` with `censor: '[REDACTED]'`. Minimum paths:
```
req.headers.authorization, req.headers["x-auth-token"], *.otp, *.aadhaar, *.aadhaarNumber,
*.abhaNumber, *.healthIdNumber, *.abhaAddress, *.token, *.accessToken, *.refreshToken,
*.password, *.clientSecret, *.privateKey, *.keyMaterial, *.entries, *.content, *.fhirBundle
```
- Request and response bodies of ABDM calls are not logged at all. Only method, path template, status, latency and correlationId are logged.
- A unit test asserts that a log line built from a fixture containing an OTP, Aadhaar, ABHA number and token contains none of them.
- Error handlers return safe error codes to the client. Stack traces are never sent in responses.

## Authentication and authorization
- App auth is separate from ABDM gateway auth.
- The shell in `server/src/shared/password.js` hashes passwords with bcrypt, cost 12. Argon2id is the target when auth is rebuilt, and it is not what the code does today. Staff access tokens are JWTs of 15 minutes. A separate refresh token lasts 7 days, is stored only as a SHA-256 hash in `refresh_tokens`, and is sent only as the httpOnly cookie `chip_refresh`. `POST /auth/refresh` rotates that cookie and returns a new access token. A reused refresh token revokes every active refresh token for that staff user. Logout clears the cookie and revokes the user's active refresh tokens. The raw refresh token is not a JSON field and is not written to the audit log.
- RBAC plus facility scope on every query. Client-supplied patient or facility IDs are never trusted without a scope check.
- No health data in JWT claims.
- Helmet, CORS allow-list, body size limits and rate limiting on login and OTP routes.

## Consent enforcement (single choke point)
`hip/consentGuard.js` runs before any data leaves the HIP and checks:
1. The artefact exists, was received from the CM, and has `GRANTED` status.
2. Now is within its validity, and it is not revoked or expired.
3. The requested HI types, date range and care contexts are a subset of the artefact.
4. The patient matches.

Any failure → reject, audit with a reason code, no data. Unit tests cover each rule.

## Callbacks and cryptography
- M2 callbacks require an `Authorization: Bearer` header and, when `X-HIP-ID` is present, that it equals `ABDM_HIP_ID`. The M2 skill says the keys that would verify that bearer are not in the published gateway calls, so no extra signature scheme is applied.
- Answer callbacks must carry `response.requestId` for a request this process sent. A duplicate `(route, dedupKey)` is acknowledged and not processed again.
- HTTPS only. The callback base is `ABDM_CALLBACK_BASE_URL`.
- Link tokens, FHIR bundles, and mobiles are AES-GCM at rest. Health-information push uses Curve25519, HKDF-SHA256, and AES-256-GCM as described in the M2 skill. Private keys stay in memory.
- Cryptography follows the official algorithm and sample code only. It is reviewed manually, and the review is recorded in `docs/ai-usage.md`.

## Audit
Append-only `AuditLog`: actor, facility, action, resource type and ID, outcome, human-readable `message`, correlationId, timestamp. Covers logins, patient registration, ABHA operations, permission denials, and later link requests, consent changes, data release or receipt, and registry linking. Facility staff can read their facility trail via `GET /audit`. No secrets or clinical payloads in audit rows. Rule: `.cursor/rules/audit-logs.mdc`.

## Supply chain and testing
- `npm audit` / `osv-scanner` in CI, lockfiles committed.
- Test fixtures use synthetic, obviously fake values (e.g. `TEST-OTP-000000`). Never real identifiers.
- Screenshots are reviewed before committing: identifiers masked, no tokens visible in DevTools.
