import dotenv from 'dotenv';
import { z } from 'zod';
import { abdmBaseUrlConfig, validateAbdmBaseUrls } from './abdmHosts.js';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  LOG_LEVEL: z.string().default('info'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  ABDM_GATEWAY_BASE_URL: z.string().optional(),
  ABDM_ABHA_BASE_URL: z.string().optional(),
  ABDM_HFR_BASE_URL: z.string().optional(),
  ABDM_HPR_BASE_URL: z.string().optional(),
  ABDM_SANDBOX_HOST_ALLOWLIST: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid environment: ${fields}`);
}

const hostErrors = validateAbdmBaseUrls(parsed.data);
if (hostErrors.length > 0) {
  throw new Error(`Invalid environment: ${hostErrors.join('; ')}`);
}

const abdm = abdmBaseUrlConfig(parsed.data);

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  jwtAccessSecret: parsed.data.JWT_ACCESS_SECRET,
  corsOrigin: parsed.data.CORS_ORIGIN,
  logLevel: parsed.data.LOG_LEVEL,
  accessTokenTtl: parsed.data.ACCESS_TOKEN_TTL,
  abdmGatewayBaseUrl: abdm.abdmGatewayBaseUrl,
  abdmAbhaBaseUrl: abdm.abdmAbhaBaseUrl,
  abdmHfrBaseUrl: abdm.abdmHfrBaseUrl,
  abdmHprBaseUrl: abdm.abdmHprBaseUrl,
  abdmSandboxHostAllowlist: abdm.abdmSandboxHostAllowlist,
};
