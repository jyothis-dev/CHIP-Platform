import pino from 'pino';
import { env } from '../config/env.js';

const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'x-auth-token',
  'otp',
  'aadhaar',
  'aadhaarNumber',
  'abhaNumber',
  'healthIdNumber',
  'abhaAddress',
  'token',
  'accessToken',
  'refreshToken',
  'password',
  'passwordHash',
  'clientSecret',
  'privateKey',
  'keyMaterial',
  'entries',
  'content',
  'fhirBundle',
];

function pathSegment(key) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : `["${key}"]`;
}

function redactPaths(keys) {
  const paths = [];
  for (const key of keys) {
    const segment = pathSegment(key);
    const nested = segment.startsWith('[') ? segment : `.${segment}`;
    paths.push(segment);
    paths.push(`*${nested}`);
    paths.push(`*.*${nested}`);
    paths.push(`*.*.*${nested}`);
    paths.push(`*.*.*.*${nested}`);
    paths.push(`*.*.*.*.*${nested}`);
    paths.push(`[*]${nested}`);
    paths.push(`*[*]${nested}`);
    paths.push(`*.*[*]${nested}`);
  }
  return paths;
}

export const redact = {
  paths: redactPaths(SENSITIVE_KEYS),
  censor: '[REDACTED]',
};

export const logger = pino({
  level: env.logLevel,
  redact,
});
