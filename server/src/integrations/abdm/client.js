import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { getGatewayToken, clearGatewayTokenCache } from './session.js';

function utcTimestamp() {
  return new Date().toISOString();
}

function baseUrlFor(contract) {
  if (contract.base === 'gateway') return env.abdmGatewayBaseUrl;
  if (contract.base === 'abha') return env.abdmAbhaBaseUrl;
  throw new AppError(500, 'ABDM_BASE_UNKNOWN', `Unknown ABDM base: ${contract.base}`);
}

function buildHeaders(contract, { requestId, accessToken, userToken, transactionId }) {
  const headers = {
    'REQUEST-ID': requestId,
    TIMESTAMP: utcTimestamp(),
  };

  if (contract.headers.includes('Content-Type')) {
    headers['Content-Type'] = 'application/json';
  }
  if (contract.headers.includes('Authorization') && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (contract.headers.includes('X-token') && userToken) {
    headers['X-token'] = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
  }
  if (contract.headers.includes('TRANSACTION_ID') && transactionId) {
    headers.TRANSACTION_ID = transactionId;
  }
  if (contract.headers.includes('BENEFIT_NAME') && contract.benefitName) {
    headers.BENEFIT_NAME = contract.benefitName;
  }
  if (contract.headers.includes('X-CM-ID')) {
    headers['X-CM-ID'] = env.abdmCmId;
  }

  return headers;
}

async function sendOnce(contract, { body, userToken, transactionId, http, accessToken }) {
  const baseUrl = baseUrlFor(contract);
  if (!baseUrl) {
    throw new AppError(503, 'ABDM_BASE_UNCONFIGURED', `ABDM ${contract.base} base URL is not configured`);
  }

  const requestId = randomUUID();
  const url = new URL(contract.path, baseUrl).toString();
  const headers = buildHeaders(contract, {
    requestId,
    accessToken,
    userToken,
    transactionId,
  });

  const started = Date.now();
  logger.info({
    component: 'abdm.client',
    method: contract.method,
    path: contract.path,
    requestId,
  }, 'abdm request');

  let response;
  try {
    response = await http.request({
      method: contract.method,
      url,
      headers,
      data: body,
      timeout: 30_000,
      validateStatus: () => true,
      responseType: contract.name === 'abhaCard' ? 'arraybuffer' : 'json',
    });
  } catch (err) {
    throw new AppError(502, 'ABDM_REQUEST_FAILED', 'ABDM request failed', { cause: err });
  }

  logger.info({
    component: 'abdm.client',
    method: contract.method,
    path: contract.path,
    requestId,
    status: response.status,
    latencyMs: Date.now() - started,
  }, 'abdm response');

  return {
    status: response.status,
    body: response.data,
    requestId,
    headers: response.headers,
  };
}

/**
 * @param {{ contract: object, body?: object, userToken?: string, transactionId?: string, http?: object }} options
 */
export async function abdmRequest({
  contract,
  body,
  userToken,
  transactionId,
  http = axios,
}) {
  let token = null;
  if (contract.auth !== 'none') {
    token = await getGatewayToken({ http });
  }

  let result = await sendOnce(contract, {
    body,
    userToken,
    transactionId,
    http,
    accessToken: token?.accessToken,
  });

  if (result.status === 401 && contract.auth !== 'none') {
    clearGatewayTokenCache();
    token = await getGatewayToken({ http });
    result = await sendOnce(contract, {
      body,
      userToken,
      transactionId,
      http,
      accessToken: token.accessToken,
    });
    if (result.status === 401) {
      throw new AppError(502, 'ABDM_UNAUTHORIZED', 'ABDM rejected the gateway token after refresh');
    }
  }

  return result;
}
