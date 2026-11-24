# Database Schema — WombTo18 ABDM Prototype

This document matches `server/prisma/schema.prisma`. Migration `20261124000000_wombto18_mvp` created the first tables. Later migrations under `server/prisma/migrations/` add the columns and tables below. Do not edit a migration that has already been applied.

`User.passwordHash` stays bcrypt (cost 12). `Pregnancy` includes `lmpDate` and still has no routes. ABHA ciphertext and hash columns are a local shape only. This build does not implement a cipher, an ABDM HTTP client, or a callback handler.

PostgreSQL + Prisma. UUID primary keys. `createdAt` / `updatedAt` on every table except `AuditLog`, which is insert-only and has `createdAt` only. Enums for statuses. Every patient-scoped query filters by `facilityId`.

No `ABDMBridge`, `FacilityBridge`, or `FacilityBridgeRole` table. The current ABDM developer portal says one bridge serves every facility, and that the callback URL and the credentials are not facility settings. Bridge id, client credentials, and `ABDM_CALLBACK_BASE_URL` stay in server environment. A facility may store an HFR id. Whether a HIP id is per facility is `UNVERIFIED` until the M2 docs are fetched. Do not put client secrets or callback URLs on `Facility`.

## Domain

| Model | Key fields | Constraints / notes |
|---|---|---|
| `User` | id, name, email, passwordHash, role (`ADMIN` / `CLINICIAN` / `STAFF`), facilityId | email unique. facilityId required. Password hashes stay bcrypt (cost 12). |
| `Facility` | id, name, hfrId?, hfrVerifiedAt?, hfrStatus | hfrId unique when present. No callback URL and no client secret. |
| `Practitioner` | id, userId?, name, hprId?, hprVerifiedAt?, facilityId | hprId unique when present. One facility is enough for this demo. No join table. |
| `Patient` | id, facilityId, patientType (`MOTHER` / `CHILD`), name, gender, dateOfBirth, mobileLast4? | index (facilityId, name) |
| `MotherChildRelationship` | motherPatientId, childPatientId, relationshipType | unique (mother, child) |
| `Encounter` | id, patientId, facilityId, practitionerId?, type (`ANTENATAL` / `DELIVERY` / `CHILD_FOLLOW_UP` / `IMMUNIZATION`), occurredAt, notes | `IMMUNIZATION` is a local encounter type. The earlier three values remain. This is not a FHIR profile name. |
| `Pregnancy` | motherPatientId, lmpDate?, estimatedDueDate?, status, deliveryDate? | The table exists, including `lmpDate`. Pregnancy routes are not in this build. |

## ABDM — identity and records

| Model | Key fields | Constraints / notes |
|---|---|---|
| `ABHAIdentity` | patientId unique, abhaNumberEnc (ciphertext column, including room for a nonce and tag), encKeyVersion, abhaNumberHash, hashKeyVersion, abhaNumberMasked, abhaAddress?, verificationStatus, verifiedAt? | unique abhaNumberHash. The column shape is a local control, not a verified ABDM wire requirement, and no cipher is implemented. One address column is enough until fetched M1 docs require address history. No Aadhaar, OTP, or user token. |
| `HealthRecord` | patientId, encounterId, hiType, fhirProfile?, igVersion?, validationStatus (`VALID` / `INVALID` / `UNVERIFIED`), validationSummary?, sourceHash? | Profile name and IG version stay empty until fetched. `validationSummary` and `sourceHash` are optional while status is `UNVERIFIED`. No raw bundle stored. |
| `CareContext` | facilityId, patientId, healthRecordId, referenceNumber, display, linkStatus (`NOT_LINKED` / `LINK_REQUESTED` / `LINKED` / `FAILED`), linkedAt?, transactionId | unique (facilityId, referenceNumber) |

## ABDM — consent and exchange

| Model | Key fields | Constraints / notes |
|---|---|---|
| `ConsentRequest` | patientAbhaAddress, purposeCode, hiTypes[], dateFrom, dateTo, expiresAt, externalConsentRequestId?, status (`REQUESTED` / `GRANTED` / `DENIED` / `EXPIRED` / `REVOKED`), transactionId | index externalConsentRequestId. HIU-side request. |
| `ConsentArtefact` | role (`HIU` / `HIP`), externalArtefactId, consentRequestId?, patientRef, hipId, hiTypes[], careContextRefs[], dateFrom, dateTo, expiresAt, status, revokedAt? | unique (role, externalArtefactId). Many artefacts may point at one `ConsentRequest`. |
| `HealthInformationRequest` | role (`HIU` / `HIP`), consentArtefactId, externalTransactionId?, dataPushUrl?, status, keyExpiresAt? | Private keys are not columns. `keyExpiresAt` is the only key-related column. Keys stay in memory and are never logged. |
| `DataTransfer` | healthInformationRequestId, careContextId, direction (`PUSH` / `RECEIVE`), externalTransferRef?, correlationId?, status, receiptStatus?, receivedAt?, validatedAt?, failureCode?, attempts, nextAttemptAt?, bytes?, mocked | `mocked=true` is `MOCKED` in the UI. |

## Integration infrastructure

| Model | Key fields | Constraints / notes |
|---|---|---|
| `ABDMTransaction` | requestId, externalTxnId?, milestone (`M1`–`M4`), workflow, direction (`OUTBOUND` / `INBOUND`), status, externalStatus?, correlationId, attempts, nextAttemptAt?, callbackDeadlineAt?, lastErrorCode?, safeMetadata (JSONB), evidenceLabel | unique requestId. Index externalTxnId, correlationId, (status, nextAttemptAt). M1 may reach `COMPLETED` on a documented synchronous success. M2 and M3 do not. |
| `CallbackEvent` | route, dedupKey, transactionId?, receivedAt, processingStatus (`RECEIVED` / `PROCESSED` / `DUPLICATE` / `ORPHANED` / `RETRY` / `DEAD`), attempts, nextAttemptAt?, payloadMinimumEnc?, payloadRedacted (JSONB) | unique (route, dedupKey). `payloadMinimumEnc` holds only fields a later worker must read, encrypted. `payloadRedacted` is the safe copy for the monitor. |
| `IdempotencyKey` | key, userId, route, requestBodyHash, responseRef, expiresAt | unique (key, userId, route). The same key with a different `requestBodyHash` is a conflict and must not repeat the side effect. `responseRef` is a transaction or resource id, not a raw body. |
| `AuditLog` | actorId, facilityId, action, resourceType, resourceId, outcome, correlationId, ip?, createdAt | Append-only in application code. That is not tamper-proof. No update or delete path in the app. |

## Never stored

OTPs, Aadhaar numbers, gateway or user access tokens, client secrets, long-lived private keys, raw FHIR bundles, and raw callback bodies.

## Callback retention

A redacted JSON blob alone is not enough when a worker must read a field later. Persist the minimum normalized fields. Encrypt any sensitive field that must be retained, restrict access, and limit retention. Do not copy those fields into logs. Keep a raw payload only if a fetched contract requires it.
