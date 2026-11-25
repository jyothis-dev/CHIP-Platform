import { abdmRequest } from '../../integrations/abdm/client.js';
import { getContract } from '../../integrations/abdm/contracts.js';
import { AppError } from '../../shared/errors.js';
import * as repo from './hip.repository.js';

export function upstreamCode(body) {
  const raw = body?.error?.code || body?.code || body?.[0]?.code || '';
  const text = String(raw).trim();
  if (!text) return null;
  return text.split(':')[0].trim() || null;
}

export async function callGateway({
  name,
  body,
  linkToken,
  hiuId,
  workflow,
  correlationId,
}) {
  const contract = getContract(name);
  const result = await abdmRequest({ contract, body, linkToken, hiuId });
  const failed = result.status < 200 || result.status >= 300;
  const waiting = result.status === 202 || contract.requiresCallback;
  const transaction = await repo.createTransaction({
    requestId: result.requestId,
    milestone: 'M2',
    workflow,
    direction: 'OUTBOUND',
    status: failed ? 'FAILED' : (waiting ? 'WAITING_FOR_CALLBACK' : 'ACCEPTED'),
    correlationId: correlationId || result.requestId,
    lastErrorCode: failed ? upstreamCode(result.body) : null,
    safeMetadata: { httpStatus: result.status, path: contract.path },
    evidenceLabel: workflow,
  });
  if (failed) {
    throw new AppError(
      502,
      upstreamCode(result.body) || 'ABDM_UPSTREAM',
      'ABDM refused the request',
    );
  }
  return { result, transaction };
}
