import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import { callRegistry } from './registryGateway.js';
import { isOk, registryFailure } from './errors.js';
import { searchFacilities } from './hfr.js';
import { hprSearchById } from './hpr.js';
import * as repo from './registries.repository.js';
import {
  BRIDGE_ROLES, FACILITY_NAME_PATTERN, HIP_NAME_MAX, HIP_NAME_PATTERN,
} from './constants.js';

function typesOf(service) {
  const raw = service?.types || service?.type || [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((item) => String(item).trim().toUpperCase()).filter(Boolean);
}

/** bridge-services answers `{ bridge, services }`. Read it the way the HIP and HIU readiness do. */
export function summarizeBridge(body) {
  const rawServices = body?.services || body?.bridge?.services || [];
  const services = (Array.isArray(rawServices) ? rawServices : [])
    .filter((service) => service && service.id)
    .map((service) => ({ id: String(service.id), types: typesOf(service) }));
  return {
    url: body?.bridge?.url || body?.url || null,
    active: body?.bridge?.active ?? null,
    services,
  };
}

export function rolesFor(services, hfrId) {
  if (!hfrId) return [];
  const roles = new Set();
  for (const service of services) {
    if (service.id === hfrId) service.types.forEach((type) => roles.add(type));
  }
  return BRIDGE_ROLES.filter((role) => roles.has(role));
}

export async function readBridgeServices({ correlationId, http }) {
  const result = await callRegistry({
    name: 'bridgeServices', workflow: 'm4.bridge.services', correlationId, http,
  });
  if (!isOk(result)) throw registryFailure(result);
  return summarizeBridge(result.body);
}

async function facilityFor(auth, id) {
  if (id !== auth.facilityId) {
    throw new AppError(403, 'PERMISSION_DENIED', 'You can only manage your own facility');
  }
  const facility = await repo.findFacility(id);
  if (!facility) throw new AppError(404, 'FACILITY_NOT_FOUND', 'Facility not found');
  return facility;
}

/** The caller's own facility, so the screen knows which id to send. */
export async function ownFacility({ auth }) {
  if (!auth.facilityId) throw new AppError(404, 'FACILITY_NOT_FOUND', 'Your account has no facility');
  const facility = await repo.findFacility(auth.facilityId);
  if (!facility) throw new AppError(404, 'FACILITY_NOT_FOUND', 'Facility not found');
  return {
    id: facility.id,
    name: facility.name,
    hfrId: facility.hfrId,
    hfrStatus: facility.hfrStatus,
    hfrVerifiedAt: facility.hfrVerifiedAt,
    hipName: facility.hipName,
    roles: facility.hfrRoles || [],
    linkCheckedAt: facility.hfrLinkCheckedAt,
  };
}

function suggestedId(services, type, hfrId) {
  const ofType = services.filter((service) => service.types.includes(type));
  const match = ofType.find((service) => service.id === hfrId);
  if (match) return match.id;
  return ofType.length === 1 ? ofType[0].id : null;
}

/**
 * Live bridge-services, narrowed to this facility. The service id is what goes into
 * ABDM_HIP_ID / ABDM_HIU_ID, so it is shown for copying and never written to .env.
 */
export async function bridgeStatus({
  facilityId, auth, correlationId, http,
}) {
  const facility = await facilityFor(auth, facilityId);
  const bridge = await readBridgeServices({ correlationId, http });
  const roles = rolesFor(bridge.services, facility.hfrId);
  const checkedAt = new Date();
  await repo.updateFacility(facility.id, { hfrRoles: roles, hfrLinkCheckedAt: checkedAt });

  const warnings = [];
  if (!facility.hfrId) {
    warnings.push('This facility has no HFR id saved yet, so its roles cannot be matched. Attach the facility ID first.');
  }
  return {
    facility: {
      id: facility.id,
      name: facility.name,
      hfrId: facility.hfrId,
      hfrStatus: facility.hfrStatus,
      hipName: facility.hipName,
    },
    bridge: { url: bridge.url, active: bridge.active },
    services: bridge.services,
    roles,
    config: {
      hipIdConfigured: Boolean(env.abdmHipId),
      hiuIdConfigured: Boolean(env.abdmHiuId),
      bridgeIdConfigured: Boolean(env.abdmBridgeId),
    },
    suggested: {
      hipId: suggestedId(bridge.services, 'HIP', facility.hfrId),
      hiuId: suggestedId(bridge.services, 'HIU', facility.hfrId),
    },
    warnings,
    checkedAt,
  };
}

/** Save the HFR id only after the registry returns exactly that facility. */
export async function attachFacilityHfr({
  facilityId, hfrId, auth, correlationId, http,
}) {
  const facility = await facilityFor(auth, facilityId);
  const found = await searchFacilities({
    input: { facilityId: hfrId, page: 1 }, auth, correlationId, http, audit: false,
  });
  const match = found.facilities.find((item) => item.facilityId === hfrId);
  if (!match) {
    await logAudit({
      actorId: auth.userId, action: 'registry.facility.hfr_link', resourceType: 'facility', resourceId: facility.id, facilityId: facility.id,
      outcome: 'failure', message: `Attaching an HFR id to ${facility.name} failed: the registry returned no such facility.`, correlationId,
    });
    throw new AppError(404, 'REGISTRY_NOT_FOUND', 'The registry returned no facility with that ID. A facility still in Draft is not visible.');
  }
  const updated = await repo.updateFacility(facility.id, {
    hfrId,
    hfrStatus: match.facilityStatus,
    hfrVerifiedAt: new Date(),
  });
  await logAudit({
    actorId: auth.userId, action: 'registry.facility.hfr_link', resourceType: 'facility', resourceId: facility.id, facilityId: facility.id,
    outcome: 'success', message: `HFR id attached to ${facility.name} by ${auth.name || 'staff'} (status ${match.facilityStatus || 'unknown'}).`, correlationId,
  });
  return {
    id: updated.id, name: updated.name, hfrId: updated.hfrId, hfrStatus: updated.hfrStatus, hfrVerifiedAt: updated.hfrVerifiedAt,
  };
}

/** Save an HPR id on a local practitioner only after the registry confirms it. */
export async function attachPractitionerHpr({
  practitionerId, hprId, auth, correlationId, http,
}) {
  const practitioner = await repo.findPractitioner(practitionerId);
  if (!practitioner || practitioner.facilityId !== auth.facilityId) {
    throw new AppError(404, 'PRACTITIONER_NOT_FOUND', 'Practitioner not found');
  }
  const found = await hprSearchById({ hprId, auth, correlationId, http });
  const wanted = hprId.toLowerCase();
  const professional = found.professional;
  const confirmed = found.found && professional
    && [professional.hprId, professional.hprIdNumber].some((value) => value && value.toLowerCase() === wanted);
  if (!confirmed) {
    await logAudit({
      actorId: auth.userId, action: 'registry.practitioner.hpr_link', resourceType: 'practitioner', resourceId: practitioner.id, facilityId: auth.facilityId,
      outcome: 'failure', message: `Attaching an HPR id to ${practitioner.name} failed: the registry did not confirm it.`, correlationId,
    });
    throw new AppError(404, 'REGISTRY_NOT_FOUND', 'The registry did not confirm that HPR ID');
  }
  const updated = await repo.updatePractitioner(practitioner.id, { hprId, hprVerifiedAt: new Date() });
  await logAudit({
    actorId: auth.userId, action: 'registry.practitioner.hpr_link', resourceType: 'practitioner', resourceId: practitioner.id, facilityId: auth.facilityId,
    outcome: 'success', message: `HPR id attached to ${practitioner.name} by ${auth.name || 'staff'}.`, correlationId,
  });
  return { id: updated.id, name: updated.name, hprId: updated.hprId, hprVerifiedAt: updated.hprVerifiedAt };
}

/**
 * Link the facility to this bridge, one HRP entry per role (never one entry for both).
 * Success is declared only when bridge-services shows every requested role afterwards.
 */
export async function bridgeLink({
  facilityId, roles, hipName, auth, correlationId, http,
}) {
  const facility = await facilityFor(auth, facilityId);
  if (!env.abdmBridgeId) {
    throw new AppError(503, 'BRIDGE_ID_MISSING', 'ABDM_BRIDGE_ID is not configured. Use the bridge id from the sandbox registration.');
  }
  if (!facility.hfrId) {
    throw new AppError(409, 'HFR_ID_MISSING', 'Attach the facility HFR ID before linking it to the bridge.');
  }
  if (!FACILITY_NAME_PATTERN.test(facility.name)) {
    throw new AppError(400, 'FACILITY_NAME_INVALID', 'The facility name has characters the registry does not accept (letters, digits and -_.(),/ with single spaces only).');
  }
  if (hipName.length > HIP_NAME_MAX || !HIP_NAME_PATTERN.test(hipName)) {
    throw new AppError(400, 'HIP_NAME_INVALID', `The HIP name must be ${HIP_NAME_MAX} characters or fewer with no special characters.`);
  }

  const body = {
    facilityId: facility.hfrId,
    facilityName: facility.name,
    HRP: roles.map((type) => ({
      bridgeId: env.abdmBridgeId, hipName, type, active: true,
    })),
  };
  const result = await callRegistry({
    name: 'hfrBridgeLink', body, workflow: 'm4.bridge.link', correlationId, http,
  });
  if (!isOk(result)) {
    await logAudit({
      actorId: auth.userId, action: 'registry.bridge.link', resourceType: 'facility', resourceId: facility.id, facilityId: facility.id,
      outcome: 'failure', message: `Bridge link for ${facility.name} (${roles.join(', ')}) was refused (HTTP ${result.status}).`, correlationId,
    });
    throw registryFailure(result);
  }

  const warnings = [];
  let confirmedRoles = [];
  try {
    const bridge = await readBridgeServices({ correlationId, http });
    confirmedRoles = rolesFor(bridge.services, facility.hfrId);
  } catch (err) {
    warnings.push(`The link was accepted but bridge-services could not be read to confirm it (${err.code || 'error'}).`);
  }
  const missingRoles = roles.filter((role) => !confirmedRoles.includes(role));
  if (missingRoles.length > 0 && warnings.length === 0) {
    warnings.push(`bridge-services does not list ${missingRoles.join(' and ')} for this facility yet. Do not rely on the link until it does.`);
  }
  await repo.updateFacility(facility.id, { hfrRoles: confirmedRoles, hipName, hfrLinkCheckedAt: new Date() });
  await logAudit({
    actorId: auth.userId, action: 'registry.bridge.link', resourceType: 'facility', resourceId: facility.id, facilityId: facility.id,
    outcome: 'success',
    message: `Bridge link for ${facility.name} (${roles.join(', ')}) accepted by ABDM; confirmed on bridge-services: ${confirmedRoles.join(', ') || 'none'}.`,
    correlationId,
  });
  return {
    requestedRoles: roles,
    confirmedRoles,
    missingRoles,
    confirmed: missingRoles.length === 0,
    hipName,
    warnings,
  };
}
