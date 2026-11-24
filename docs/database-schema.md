# Minimal Database Models — WombTo18

`server/prisma/schema.prisma` and migration `20261124000000_wombto18_mvp` match this list. The tables are empty of clinical rows. Seed creates one staff user only. An existing local database that still has the old hospital tables must be reset before `npm run db:migrate`.

Keep the schema small for the 8-hour MVP.

- `User`: id, name, email, passwordHash, role.
- `Facility`: id, name, optional verified HFR reference.
- `Patient`: id, facilityId, patientType (MOTHER/CHILD), name, dateOfBirth, minimal synthetic demo fields.
- `MotherChildRelationship`: motherPatientId, childPatientId, relationshipType.
- `Pregnancy`: motherPatientId, estimatedDueDate, status, optional deliveryDate.
- `Encounter`: patientId, facilityId, type (ANTENATAL/DELIVERY/CHILD_FOLLOW_UP), date, minimal demo notes.
- `ABHAIdentity`: patientId, protected/masked identifier reference, verification status.
- `HealthRecord`: patientId, encounterId, FHIR profile/type, controlled document reference.
- `ConsentRequest`: patient reference, workflow reference, status, scope/validity metadata required by selected contract.
- `ABDMTransaction`: unique internal requestId, external transactionId if supplied, type, internal status, external status, correlationId, timestamps, safe metadata.
- `CallbackEvent`: documented callback event identity or deduplication fingerprint, transaction reference, receivedAt, processing status, minimized/redacted payload metadata.
- `AuditLog`: actor, action, resource, facility, timestamp, outcome, correlationId.

Never store OTPs, access tokens, client secrets, or private keys. Do not store raw sensitive callback bodies without a documented need and appropriate protection. Add only fields required by the selected official API workflow. Enforce patient/facility scope in backend queries.
