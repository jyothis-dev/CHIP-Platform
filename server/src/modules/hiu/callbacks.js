import { env } from '../../config/env.js';
import { acceptAbdmCallback } from '../../integrations/abdm/callbackInbox.js';
import { ANSWER_ROUTES, NOTIFY_ROUTE } from './constants.js';
import { handleNotify, onFetch, onInit, onStatus } from './consent.js';
import { onRequest } from './dataflow.js';

/**
 * HIU callbacks. Every one carries X-HIU-ID, which must name our HIU service.
 * With no ABDM_HIU_ID configured nothing can be verified, so every HIU
 * callback is refused (hiecm.concept.callback-authenticity: fail closed).
 */
export async function acceptHiuCallback(req) {
  return acceptAbdmCallback(req, {
    answerRoutes: ANSWER_ROUTES,
    facilityHeaders: ['x-hiu-id'],
    expectedId: env.abdmHiuId || '\u0000unset',
    auditAction: 'hiu.callback',
    label: 'HIU',
    mismatchCode: 'CALLBACK_HIU_MISMATCH',
    mismatchMessage: 'Callback dropped: X-HIU-ID is not this HIU.',
    dispatch: (route, request, { transaction }) => dispatch(route, request, transaction),
  });
}

async function dispatch(route, req, transaction) {
  const body = req.body || {};
  if (route === '/api/v3/hiu/consent/request/on-init') return onInit(transaction, body);
  if (route === '/api/v3/hiu/consent/request/on-status') return onStatus(transaction, body);
  if (route === '/api/v3/hiu/consent/on-fetch') return onFetch(transaction, body);
  if (route === '/api/v3/hiu/health-information/on-request') return onRequest(transaction, body);
  if (route === NOTIFY_ROUTE) {
    return handleNotify({ body, requestId: req.get('request-id'), correlationId: req.id });
  }
  return null;
}
