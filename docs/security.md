# Security Requirements

## Credentials

-   Keep sandbox credentials in environment variables or approved
    secrets manager.
-   Never commit `.env`, private keys, certificates, client secrets,
    tokens, OTPs, or passwords.
-   Never expose server secrets to frontend variables.
-   Separate sandbox and production configuration.
-   Prevent accidental production endpoint use during sandbox testing.

## Sensitive data

-   Use approved sandbox data only.
-   Do not log Aadhaar/ABHA identifiers, OTPs, tokens, patient
    identifiers, clinical records, keys, or raw payloads.
-   Minimize sensitive data retention.
-   Encrypt sensitive identifiers at application level when retention is
    required and approved.
-   Enforce facility, role, and patient-level access.
-   Do not put sensitive health data in JWT claims.

## Authentication and authorization

-   Keep application authentication separate from ABDM gateway
    authentication.
-   Use Argon2id for application password hashing.
-   Use short-lived access tokens and secure refresh-token handling if
    JWT is used.
-   Enforce RBAC and resource-level authorization.
-   Do not trust client-supplied patient/facility IDs without
    authorization checks.

## Callbacks and cryptography

-   Follow the exact callback authentication/verification contract.
-   Do not invent webhook signature rules.
-   Use HTTPS where required.
-   Persist and deduplicate callback events.
-   Implement encryption/decryption exactly as specified by ABDM; do not
    invent formats or algorithms.
-   Protect private keys and certificates.
-   Avoid plaintext clinical temporary files.

## Audit

Record actor, facility context, action, entity type/internal ID,
timestamp, request/correlation ID, and outcome. Do not include secrets
or clinical payloads.

## Testing

Use isolated sandbox/staging environments. Review AI-generated
cryptographic and security code manually. Run dependency scans, static
analysis, and authorization/callback replay tests.
