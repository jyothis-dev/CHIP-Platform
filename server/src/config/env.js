import dotenv from 'dotenv';
import { z } from 'zod';
import { abdmBaseUrlConfig, validateAbdmBaseUrls } from './abdmHosts.js';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
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
  ABDM_CLIENT_ID: z.string().optional(),
  ABDM_CLIENT_SECRET: z.string().optional(),
  ABDM_CM_ID: z.string().optional().default('sbx'),
  ABDM_BENEFIT_NAME: z.string().optional(),
  ABHA_ENC_KEY: z.string().optional(),
  ABHA_HASH_KEY: z.string().optional(),
  ABHA_ENC_KEY_VERSION: z.coerce.number().int().positive().optional().default(1),
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

function blankToNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
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
  abdmClientId: blankToNull(parsed.data.ABDM_CLIENT_ID),
  abdmClientSecret: blankToNull(parsed.data.ABDM_CLIENT_SECRET),
  abdmCmId: blankToNull(parsed.data.ABDM_CM_ID) || 'sbx',
  abdmBenefitName: blankToNull(parsed.data.ABDM_BENEFIT_NAME),
  abhaEncKey: blankToNull(parsed.data.ABHA_ENC_KEY),
  abhaHashKey: blankToNull(parsed.data.ABHA_HASH_KEY),
  abhaEncKeyVersion: parsed.data.ABHA_ENC_KEY_VERSION,
};
