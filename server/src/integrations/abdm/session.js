import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { getContract } from './contracts.js';

let cached = null;

function utcTimestamp() {
  return new Date().toISOString();
}

export function clearGatewayTokenCache() {
  cached = null;
}

export async function getGatewayToken({ http = axios } = {}) {
  const now = Date.now();
  if (cached && cached.expiresAt > now + 30_000) {
    return { accessToken: cached.accessToken, expiresIn: cached.expiresIn };
  }

  if (!env.abdmClientId || !env.abdmClientSecret) {
    throw new AppError(503, 'ABDM_CREDENTIALS_MISSING', 'ABDM client credentials are not configured');
  }
  if (!env.abdmGatewayBaseUrl) {
    throw new AppError(503, 'ABDM_GATEWAY_UNCONFIGURED', 'ABDM gateway base URL is not configured');
  }

  const contract = getContract('session');
  const requestId = randomUUID();
  const url = new URL(contract.path, env.abdmGatewayBaseUrl).toString();

  logger.info({
    component: 'abdm.session',
    method: contract.method,
    path: contract.path,
    requestId,
  }, 'requesting gateway session');

  let response;
  try {
    response = await http.request({
      method: contract.method,
      url,
      headers: {
        'REQUEST-ID': requestId,
        TIMESTAMP: utcTimestamp(),
        'X-CM-ID': env.abdmCmId,
        'Content-Type': 'application/json',
      },
      data: {
        clientId: env.abdmClientId,
        clientSecret: env.abdmClientSecret,
        grantType: 'client_credentials',
      },
      timeout: 15_000,
      validateStatus: () => true,
    });
  } catch (err) {
    throw new AppError(502, 'ABDM_SESSION_FAILED', 'Gateway session request failed', { cause: err });
  }

  if (response.status < 200 || response.status >= 300 || !response.data?.accessToken) {
    throw new AppError(502, 'ABDM_SESSION_FAILED', 'Gateway session was refused');
  }

  const expiresIn = Number(response.data.expiresIn) || 1200;
  cached = {
    accessToken: response.data.accessToken,
    expiresIn,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return { accessToken: cached.accessToken, expiresIn };
}
