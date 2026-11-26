# Setup and Deployment

## Prerequisites
- Node.js 20 LTS, npm
- PostgreSQL 15+ (or Docker)
- Java 17+ (for the HL7 FHIR Validator CLI)
- A public HTTPS tunnel for callbacks (ngrok / Cloudflare Tunnel), if the sandbox permits it
- ABDM sandbox credentials (provided separately, never committed)

## Environment (`.env.example`, placeholders only)
```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/wombto18

# ABDM sandbox (values from the secure channel; do not commit)
ABDM_CLIENT_ID=
ABDM_CLIENT_SECRET=
ABDM_CM_ID=
ABDM_HIP_ID=
ABDM_HIU_ID=
ABDM_GATEWAY_BASE_URL=        # sandbox URL from docs
ABDM_ABHA_BASE_URL=           # sandbox URL from docs
ABDM_HFR_BASE_URL=
ABDM_HPR_BASE_URL=
ABDM_SANDBOX_HOST_ALLOWLIST=  # comma-separated; app refuses other hosts
ABDM_CALLBACK_BASE_URL=       # public HTTPS callback ingress URL registered as required
ABDM_HIU_DATA_PUSH_BASE_URL=   # HIU data-push destination; confirm exact role/contract requirement

# App security
JWT_SECRET=
ABHA_ENC_KEY=                 # 32-byte base64, AES-256-GCM
ABHA_HASH_KEY=                # HMAC key

# FHIR
FHIR_VALIDATOR_JAR=./tools/validator_cli.jar
ABDM_FHIR_IG_PACKAGE=         # pinned NRCeS IG package id#version

LOG_LEVEL=info
```

## Local run

The commands below are the **target** layout. They are not all true of this repo today. There is no Docker Compose file, no `npm run seed`, no `npm run callback:fixture`, no `npm run test:sandbox`, and no Swagger route. The API listens on port 8000 (`PORT` in `server/.env`, default in `server/src/config/env.js`). Vite proxies `/api` to that port and strips the `/api` prefix. Express routes are mounted without `/api` (`/health`, `/auth`). Swagger UI for the routes that exist is `http://localhost:8000/api-docs`. The raw document is `http://localhost:8000/api-docs/openapi.json`.

What works now, from `server/`:

```bash
npm test
npm run dev
```

From `client/`: `npm run dev` (port 5173) and `npm run build`.

ABHA traffic (`/abha-traffic` in the client, `GET /abha/traces`) records each ABHA request and redacted response while `NODE_ENV=development`. Set `ABDM_TRACE=false` to turn it off, or `ABDM_TRACE=true` to keep it on outside development. Aadhaar numbers, OTPs, and tokens are not stored.

Target, after the Core schema and scripts exist:

```bash
git clone <repo> && cd <repo>
cp server/.env.example server/.env   # fill from the secure channel
cd server && npm ci && npx prisma migrate deploy && npm run db:seed && npm run dev
cd ../client && npm ci && npm run dev
```

Swagger UI for implemented routes: `http://localhost:8000/api-docs`.

## Callbacks
1. Start the tunnel against the Express port (`8080` unless `PORT` says otherwise): `ngrok http 8080` → set `ABDM_CALLBACK_BASE_URL`. On Health records, use **Register callback URL** only after the callback routes exist. That button sends the configured base to `PATCH /api/hiecm/gateway/v3/bridge/url`. `ABDM_HIP_ID` comes from `GET /api/hiecm/gateway/v3/bridge-services`, not from the client-credentials screen and not from gateway v1.
2. Register or update the callback URL with the sandbox as documented.
3. Verify with a doc-example fixture: `npm run callback:fixture -- <name>`.

## Tests

```bash
cd server && npm test
```

That command runs the shell Jest suite (health, login, wrong password, error handler, rate limit) with Prisma mocked. It is not a sandbox run. `npm run test:sandbox` and `npm run callback:fixture` do not exist. Add them only when those tests exist, and record the real command in `docs/testing-evidence.md`.

## Deployment (prototype)
- Single container for the API (multi-stage Dockerfile, non-root user) and a static client build behind the same reverse proxy, or Render/Railway/Fly.io with managed Postgres.
- Secrets come from the platform's secret store. No `.env` in images.
- Run `prisma migrate deploy` on release. `/health` is used for platform health checks.
- Sandbox endpoints only. The config guard blocks anything else.


## MCP and documentation setup
Use the current official Build with AI portal instructions:
- https://docs.abdm.gov.in/docs/hiecm/v3/getting-started/build-with-ai
- https://docs.abdm.gov.in/agent-setup/prompt.md

Copy the MCP configuration exactly from the portal for the selected IDE/client. This documentation package intentionally does not fabricate a `.cursor/mcp.json` schema or server command. Keep credentials out of committed configuration. Record the connected server name, skills loaded and verification date in `docs/ai-usage.md`.

## Facility and bridge prerequisites
One bridge serves every facility. `ABDM_CLIENT_ID`, `ABDM_CLIENT_SECRET`, and `ABDM_CALLBACK_BASE_URL` are single environment values, not per-facility fields. Confirm a Facility ID separately if M2 needs one. M4 lookup does not create it. Confirm `ABDM_HIU_DATA_PUSH_BASE_URL` separately from the callback URL. Whether `ABDM_HIP_ID` is per facility is `UNVERIFIED`.

## Version pinning
Pin the exact NRCeS ABDM FHIR Implementation Guide package version used by the validator. Do not leave a floating/latest version in environment configuration or build scripts. Record the package version and validator CLI version in the test evidence.
