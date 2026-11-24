# Minimum Tests and Evidence — WombTo18

## Shell checks, 2026-11-24

`npm test` in `server/` (Prisma mocked, no sandbox): 3 suites, 10 passed, 0 failed, 0 skipped. Jest then forced one worker to exit because a rate-limit timer was still open. The process exit code was 0.

Covered: health check up, database down (`DATABASE_UNAVAILABLE`), login success with an access token and no refresh cookie or password hash, wrong password (`INVALID_CREDENTIALS`), error-handler codes, and login rate limiting.

`npm run build` in `client/` completed.

Staff login is `IMPLEMENTED_NOT_TESTED` against a real database. Password hashing is still bcrypt. The mother-to-child journey and M1–M4 cases below are not implemented.

## Required local journey
- Staff login.
- Register mother.
- Add pregnancy and antenatal visit.
- Record delivery.
- Register newborn and link to mother.
- Add one child follow-up/immunization record.

## Focused integration tests
1. Outbound request receives acceptance but transaction remains pending.
2. Matching callback advances transaction to completed.
3. Duplicate callback is not processed twice.
4. Unknown transaction callback is safely handled.
5. Invalid callback payload is rejected according to contract.
6. Consent denied/expired/revoked blocks health-information sharing.
7. Sensitive values are redacted from logs.

## Evidence labels
Use one of:
- `SANDBOX_TESTED`
- `IMPLEMENTED_NOT_TESTED`
- `MOCKED`
- `BLOCKED`

For each workflow record test date/time, environment, operation, masked transaction reference, expected/actual result, and screenshot/video reference.

Use synthetic data only. Never capture Aadhaar, ABHA identifiers, OTPs, tokens, secrets, private keys, or raw clinical payloads.
