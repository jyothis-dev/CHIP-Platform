# Minimal Internal API Inventory — WombTo18

These are internal app routes, not ABDM endpoints. Keep only routes used by the demo. External ABDM paths and callback contracts must be copied from current official documentation.

| Method | Internal route | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Staff login |
| GET | `/api/dashboard` | Basic counts and pending transactions |
| GET/POST | `/api/patients` | Find/register mother or child |
| POST | `/api/patients/:id/pregnancy` | Create pregnancy |
| POST | `/api/pregnancies/:id/visits` | Add antenatal visit |
| POST | `/api/pregnancies/:id/delivery` | Record delivery |
| POST | `/api/patients/:motherId/children` | Register newborn |
| POST | `/api/patients/:id/encounters` | Child follow-up/immunization |
| POST | `/api/abha/workflows` | Start one supported M1 path |
| GET | `/api/transactions/:id` | Show workflow status |
| POST | `/api/health-records` | Create selected record/FHIR bundle |
| POST | `/api/care-contexts/link` | Start selected M2 linking path |
| POST | `/api/consents` | Start selected M3 consent flow |
| GET | `/api/registries/hfr` | HFR lookup |
| GET | `/api/registries/hpr` | HPR lookup |
| POST | `/api/callbacks/abdm/<documented-callback>` | Exact callback route(s), per official contract |

Do not implement unused endpoints. Apply authentication, validation, and patient/facility access checks. Return an internal transaction ID and current state for asynchronous operations.
