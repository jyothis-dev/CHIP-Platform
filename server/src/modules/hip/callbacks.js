import { env } from '../../config/env.js';
import { acceptAbdmCallback } from '../../integrations/abdm/callbackInbox.js';
import { completeLinkToken, markLinkResult, markSmsResult } from './link.js';
import { answerConfirm, answerDiscover, answerInit } from './discover.js';
import { fulfilInformationRequest, storeConsent } from './share.js';

const ANSWER_ROUTES = new Set([
  '/api/v3/hip/token/on-generate-token',
  '/api/v3/link/on_carecontext',
  '/api/v3/links/context/on-notify',
  '/api/v3/patients/sms/on-notify',
]);

export async function acceptCallback(req) {
  return acceptAbdmCallback(req, {
    answerRoutes: ANSWER_ROUTES,
    facilityHeaders: ['x-hip-id', 'x-hiu-id'],
    expectedId: env.abdmHipId,
    auditAction: 'hip.callback',
    label: 'HIP',
    mismatchCode: 'CALLBACK_HIP_MISMATCH',
    mismatchMessage: 'Callback dropped: facility header is not this HIP.',
    dispatch: (route, request, { transaction, callback }) => {
      request.hipTransaction = transaction;
      request.hipCallback = callback;
      return dispatch(route, request);
    },
  });
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
