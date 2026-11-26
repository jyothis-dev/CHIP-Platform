import { abdmRequest } from '../../integrations/abdm/client.js';
import { getContract } from '../../integrations/abdm/contracts.js';
import { isOk } from './errors.js';
import * as repo from './registries.repository.js';

/**
 * One registry call with its ABDMTransaction row. Registry reads are synchronous, so the
 * transaction ends COMPLETED or FAILED. The caller decides what a non-2xx means
 * (a 404 on a search is "no match", not an error).
 */
export async function callRegistry({
  name,
  body,
  pathParams,
  query,
  workflow,
  correlationId,
  http,
}) {
  const contract = getContract(name);
  const result = await abdmRequest({
    contract,
    body,
    pathParams,
    query,
    ...(http ? { http } : {}),
  });
  await repo.createTransaction({
    requestId: result.requestId,
    milestone: 'M4',
    workflow,
    direction: 'OUTBOUND',
    status: isOk(result) ? 'COMPLETED' : 'FAILED',
    correlationId: correlationId || result.requestId,
    lastErrorCode: isOk(result) ? null : `HTTP_${result.status}`,
    safeMetadata: { httpStatus: result.status, path: contract.path },
    evidenceLabel: workflow,
  });
  return result;
}
