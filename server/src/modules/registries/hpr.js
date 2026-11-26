import { logAudit } from '../../shared/audit.js';
import { callRegistry } from './registryGateway.js';
import { isOk, registryFailure } from './errors.js';

function professionalView(item) {
  return {
    hprId: item.hprId || null,
    hprIdNumber: item.hprIdNumber || null,
    name: item.name || null,
    authMethods: Array.isArray(item.authMethods) ? item.authMethods : [],
    categoryId: item.categoryId ?? null,
    subCategoryId: item.subCategoryId ?? null,
  };
}

async function audit({
  auth, correlationId, action, outcome, message,
}) {
  await logAudit({
    actorId: auth.userId,
    action,
    resourceType: 'practitioner',
    facilityId: auth.facilityId,
    outcome,
    message,
    correlationId,
  });
}

/** Does an HPR id exist? A 404 reads as "no". */
export async function hprExists({
  hprId, auth, correlationId, http,
}) {
  const result = await callRegistry({
    name: 'hprExists', pathParams: { hprId }, workflow: 'm4.hpr.exists', correlationId, http,
  });
  if (result.status === 404) return { exists: false };
  if (!isOk(result)) throw registryFailure(result);
  const exists = result.body === true || result.body === 'true';
  await audit({
    auth,
    correlationId,
    action: 'registry.hpr.search',
    outcome: 'success',
    message: `HPR existence check by ${auth.name || 'staff'} answered ${exists ? 'found' : 'not found'}.`,
  });
  return { exists };
}

export async function hprSearchById({
  hprId, auth, correlationId, http,
}) {
  const result = await callRegistry({
    name: 'hprSearchById', pathParams: { hprId }, workflow: 'm4.hpr.search_by_id', correlationId, http,
  });
  if (result.status === 404) return { found: false, professional: null };
  if (!isOk(result)) throw registryFailure(result);
  await audit({
    auth,
    correlationId,
    action: 'registry.hpr.search',
    outcome: 'success',
    message: `HPR search by id by ${auth.name || 'staff'} found a professional.`,
  });
  return { found: true, professional: professionalView(result.body || {}) };
}

/** The mobile goes in the upstream path, so our route is a POST and the value stays out of our URLs. */
export async function hprSearchByMobile({
  mobile, auth, correlationId, http,
}) {
  const result = await callRegistry({
    name: 'hprSearchByMobile', pathParams: { mobile }, workflow: 'm4.hpr.search_by_mobile', correlationId, http,
  });
  if (result.status === 404) return { professionals: [] };
  if (!isOk(result)) throw registryFailure(result);
  const rows = Array.isArray(result.body) ? result.body : [];
  await audit({
    auth,
    correlationId,
    action: 'registry.hpr.search',
    outcome: 'success',
    message: `HPR search by mobile by ${auth.name || 'staff'} returned ${rows.length}.`,
  });
  return { professionals: rows.map(professionalView) };
}

/** The shape of `practitioners` is not documented (UNVERIFIED), so it is returned as ABDM sent it. */
export async function professionalInfo({
  practitioner, auth, correlationId, http,
}) {
  const result = await callRegistry({
    name: 'hprProfessionalInfo',
    body: { practitioner },
    workflow: 'm4.hpr.professional_info',
    correlationId,
    http,
  });
  if (result.status === 404) return { message: null, practitioners: null };
  if (!isOk(result)) throw registryFailure(result);
  await audit({
    auth,
    correlationId,
    action: 'registry.hpr.professional_info',
    outcome: 'success',
    message: `Professional information fetched by ${auth.name || 'staff'}.`,
  });
  return { message: result.body?.message || null, practitioners: result.body?.practitioners ?? null };
}
