# WombTo18 — Minimal User and ABDM Workflows

## Local maternity-to-child demo

The app only needs a compact flow:
1. Register one mother.
2. Add one pregnancy.
3. Add one antenatal visit.
4. Record one delivery.
5. Register one newborn and link to mother.
6. Add one child follow-up/immunization record.

This is a demo data journey, not a complete clinical workflow or a clinical decision-support product.

## M1 — ABHA create/verify/login

Target: implement one sandbox-supported path.

The supplied task notes suggest a flow involving Aadhaar encryption, OTP request/verification, ABHA number/address, and login. Before implementing, verify which of these operations are currently available in the assigned sandbox and their exact contracts.

Minimum UI:
- Start supported ABHA workflow for mother.
- Show `PENDING_VERIFICATION`.
- Enter approved sandbox OTP only if the documented flow requires it.
- Show verified result and masked ABHA reference.
- Display transaction state and safe error.

Do not implement every identity method or ABHA card design. Never log/store OTP or raw Aadhaar. Do not invent certificate URLs, RSA padding, encryption encoding, OTP flow, or address suffix; use the official documentation and approved sandbox data.

## M2 — HIP record and care-context linking

Target: one patient, one encounter, one health record, one FHIR example, one linking path.

1. Register mother locally and associate verified ABHA reference according to the supported workflow.
2. Create one antenatal or consultation encounter.
3. Create a minimal health record.
4. Build and validate the required FHIR bundle against the exact applicable ABDM/NRCeS profile.
5. Implement **one** care-context linking path:
   - HIP-initiated linking, if enabled and simpler in the sandbox; OR
   - Patient-initiated discover/init/confirm callbacks, if that is the required supported scenario.
6. Persist transaction state and process the matching callback.
7. Display final status only after the documented completion event/status.

Do not implement both paths in the 8-hour MVP unless one is already supplied by starter code.

## M3 — HIU consent and HIP response

Target: demonstrate consent state and the role separation. Full encrypted HIE transfer is optional only if time and sandbox readiness allow.

HIU minimum:
1. Enter ABHA address, purpose, health-information types, and date range required by the actual contract.
2. Initiate consent request.
3. Store `REQUESTED` as an internal display state if appropriate.
4. Receive consent notification callback.
5. Persist the consent status/artefact metadata.
6. On `GRANTED`, enable the next action only after validating the artefact and scope.
7. On denied/expired/revoked, block further requests.

HIP minimum:
1. Receive the documented health-information request.
2. Match patient and request.
3. Validate consent and requested scope.
4. If full transfer is not completed, return/record a clearly labelled mock result in the demo environment only; never pretend this is a real ABDM transfer.

The user's task notes mention ephemeral keys, ECDH, AES-GCM, encrypted FHIR push, and gateway notification. Implement these only from the exact current official specification and sample code. Do not improvise cryptography. For an 8-hour exercise, it is safer to document full transfer as blocked/mock than to implement insecure or incorrect encryption.

## M4 — HFR/HPR

Target: one lookup operation if available.
- Search HFR by ID/name and display returned facility details.
- Optionally search HPR by professional identifier/name if supported.
- Use verified registry data to populate facility/practitioner references where appropriate.
- If sandbox APIs are unavailable, use a small fixture and mark it `MOCKED`; do not claim registration/verification.

## Callback lifecycle

For each implemented callback:
1. Validate the exact documented request.
2. Persist event with received timestamp and correlation metadata.
3. Deduplicate using documented callback identity or safe fingerprint.
4. Find the matching transaction.
5. Apply allowed state transition.
6. Persist processing outcome.
7. Return the exact documented acknowledgement.

Do not assume all callback routes should return 202. Confirm each callback's response contract. Acknowledge only after durable persistence where allowed.

## Internal status labels

`INITIATED -> ACCEPTED -> WAITING_FOR_CALLBACK -> COMPLETED`

Possible outcomes: `FAILED`, `EXPIRED`, `REJECTED`.

These are internal labels only. Keep external ABDM status separately. Do not treat outbound HTTP 202 as business completion.
