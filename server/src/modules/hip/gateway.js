import { abdmRequest } from '../../integrations/abdm/client.js';
import { getContract } from '../../integrations/abdm/contracts.js';
import { AppError } from '../../shared/errors.js';
import * as repo from './hip.repository.js';

export function upstreamCode(body) {
  const raw = body?.error?.code || body?.code || body?.[0]?.error?.code || body?.[0]?.code || '';
  const text = String(raw).trim();
  if (!text) return null;
  return text.split(':')[0].trim() || null;
}

/** ABDM's own error message, carried through verbatim (never translated locally). */
export function upstreamMessage(body) {
  const first = Array.isArray(body) ? body[0] : body;
  const raw = first?.error?.message || first?.message || first?.description || '';
  const text = String(raw).trim();
  return text || null;
}

export async function callGateway({
  name,
  body,
  linkToken,
  hiuId,
  workflow,
  correlationId,
  milestone = 'M2',
  pathParams,
  throwOnFailure = true,
  http,
}) {
  const contract = getContract(name);
  const result = await abdmRequest({
    contract, body, linkToken, hiuId, pathParams, ...(http ? { http } : {}),
  });
  const failed = result.status < 200 || result.status >= 300;
  const waiting = result.status === 202 || contract.requiresCallback;
  const transaction = await repo.createTransaction({
    requestId: result.requestId,
    milestone,
    workflow,
    direction: 'OUTBOUND',
    status: failed ? 'FAILED' : (waiting ? 'WAITING_FOR_CALLBACK' : 'ACCEPTED'),
    correlationId: correlationId || result.requestId,
    lastErrorCode: failed ? upstreamCode(result.body) : null,
    safeMetadata: { httpStatus: result.status, path: contract.path },
    evidenceLabel: workflow,
  });
  if (failed && throwOnFailure) {
    throw new AppError(
      502,
      upstreamCode(result.body) || 'ABDM_UPSTREAM',
      upstreamMessage(result.body) || 'ABDM refused the request',
      { details: { abdmCode: upstreamCode(result.body), abdmMessage: upstreamMessage(result.body) } },
    );
  }
  return { result, transaction };
}
