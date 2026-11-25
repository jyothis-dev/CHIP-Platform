import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import { redactDeep } from '../../shared/redact.js';
import * as repo from './hip.repository.js';
import { completeLinkToken, markLinkResult, markSmsResult } from './link.js';
import { answerConfirm, answerDiscover, answerInit } from './discover.js';
import { fulfilInformationRequest, storeConsent } from './share.js';

const ANSWER_ROUTES = new Set([
  '/api/v3/hip/token/on-generate-token',
  '/api/v3/link/on_carecontext',
  '/api/v3/links/context/on-notify',
  '/api/v3/patients/sms/on-notify',
]);

function hipHeader(req) {
  return req.get('x-hip-id') || req.get('x-hiu-id') || '';
}

export async function acceptCallback(req) {
  const route = req.path;
  const bearer = req.get('authorization') || '';
  if (!bearer.startsWith('Bearer ') || bearer.length < 8) {
    await logAudit({
      action: 'hip.callback',
      resourceType: 'callback',
      outcome: 'denied',
      correlationId: req.id,
      message: 'Callback rejected: bearer token missing.',
    });
    throw new AppError(401, 'CALLBACK_UNAUTHENTICATED', 'Callback bearer token is required');
  }

  const headerHip = hipHeader(req);
  const answersUs = ANSWER_ROUTES.has(route);
  if (headerHip && env.abdmHipId && headerHip !== env.abdmHipId) {
    await logAudit({
      action: 'hip.callback',
      resourceType: 'callback',
      outcome: 'denied',
      correlationId: req.id,
      message: 'Callback dropped: facility header is not this HIP.',
    });
    throw new AppError(401, 'CALLBACK_HIP_MISMATCH', 'Callback is for a different facility');
  }
  if (!answersUs && env.abdmHipId && headerHip !== env.abdmHipId) {
    await logAudit({
      action: 'hip.callback',
      resourceType: 'callback',
      outcome: 'denied',
      correlationId: req.id,
      message: 'Callback rejected: X-HIP-ID does not match ABDM_HIP_ID.',
    });
    throw new AppError(401, 'CALLBACK_HIP_MISMATCH', 'Callback is for a different facility');
  }

  const inboundRequestId = req.get('request-id') || '';
  const responseRequestId = req.body?.response?.requestId || '';
  const dedupKey = answersUs ? (responseRequestId || inboundRequestId) : (inboundRequestId || responseRequestId);
  if (!dedupKey) {
    throw new AppError(400, 'CALLBACK_REQUEST_ID_MISSING', 'Callback has no request id');
  }

  if (answersUs) {
    const transaction = await repo.findTransactionByRequestId(responseRequestId);
    if (!transaction) {
      await logAudit({
        action: 'hip.callback',
        resourceType: 'callback',
        outcome: 'denied',
        correlationId: req.id,
        message: 'Callback dropped: it does not answer a request this HIP sent.',
      });
      throw new AppError(404, 'CALLBACK_UNKNOWN', 'Callback does not match a request from this HIP');
    }
    req.hipTransaction = transaction;
  }

  try {
    const row = await repo.createCallback({
      route,
      dedupKey,
      transactionId: req.hipTransaction?.id || null,
      processingStatus: 'RECEIVED',
      payloadRedacted: redactDeep(req.body || {}),
    });
    req.hipCallback = row;
  } catch (err) {
    if (err.code === 'P2002') {
      return { duplicate: true };
    }
    throw err;
  }

  try {
    await dispatch(route, req);
    await repo.updateCallback(req.hipCallback.id, { processingStatus: 'PROCESSED' });
  } catch (err) {
    await repo.updateCallback(req.hipCallback.id, { processingStatus: 'DEAD' });
    throw err;
  }
  return { duplicate: false };
}

async function dispatch(route, req) {
  const body = req.body || {};
  const requestId = req.get('request-id');
  if (route === '/api/v3/hip/token/on-generate-token') {
    await completeLinkToken(req.hipTransaction, body);
    return;
  }
  if (route === '/api/v3/link/on_carecontext' || route === '/api/v3/links/context/on-notify') {
    await markLinkResult(req.hipTransaction, body);
    return;
  }
  if (route === '/api/v3/patients/sms/on-notify') {
    await markSmsResult(req.hipTransaction, body);
    return;
  }
  if (route === '/api/v3/hip/patient/care-context/discover') {
    await answerDiscover({
      body,
      requestId,
      hiuId: req.get('x-hiu-id') || undefined,
      correlationId: req.id,
    });
    return;
  }
  if (route === '/api/v3/hip/link/care-context/init') {
    await answerInit({ body, requestId, correlationId: req.id });
    return;
  }
  if (route === '/api/v3/hip/link/care-context/confirm') {
    await answerConfirm({ body, requestId, correlationId: req.id });
    return;
  }
  if (route === '/api/v3/consent/request/hip/notify') {
    await storeConsent(body, requestId);
    return;
  }
  if (route === '/api/v3/hip/health-information/request') {
    await fulfilInformationRequest({ body, requestId, correlationId: req.id });
  }
}
