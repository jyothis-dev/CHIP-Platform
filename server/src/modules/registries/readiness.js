import { env } from '../../config/env.js';
import * as repo from './registries.repository.js';
import { readBridgeServices, rolesFor } from './link.js';

/** Say what cannot work before anyone depends on it. Same shape as the HIP and HIU readiness. */
export async function registriesReadiness({ facilityId, correlationId, http } = {}) {
  const facility = facilityId ? await repo.findFacility(facilityId) : null;
  const report = {
    registryConfigured: { hfr: Boolean(env.abdmHfrBaseUrl), hpr: Boolean(env.abdmHprBaseUrl) },
    credentialsConfigured: Boolean(env.abdmClientId && env.abdmClientSecret),
    bridgeIdConfigured: Boolean(env.abdmBridgeId),
    hipIdConfigured: Boolean(env.abdmHipId),
    hiuIdConfigured: Boolean(env.abdmHiuId),
    facility: facility
      ? {
        id: facility.id,
        name: facility.name,
        hfrId: facility.hfrId,
        hfrStatus: facility.hfrStatus,
        hipName: facility.hipName,
        roles: facility.hfrRoles || [],
        linkCheckedAt: facility.hfrLinkCheckedAt,
      }
      : null,
    bridge: null,
    blockers: [],
    warnings: [],
  };

  if (!env.abdmHfrBaseUrl) {
    report.blockers.push('ABDM_HFR_BASE_URL is not set. Facility search and the bridge link are refused.');
  }
  if (!env.abdmHprBaseUrl) {
    report.blockers.push('ABDM_HPR_BASE_URL is not set. Professional lookups are refused.');
  }
  if (!report.credentialsConfigured) {
    report.blockers.push('ABDM_CLIENT_ID and ABDM_CLIENT_SECRET are not both set, so no registry call can be made.');
  }
  if (!env.abdmBridgeId) {
    report.warnings.push('ABDM_BRIDGE_ID is not set. Lookups work, but the bridge link is refused until it is.');
  }
  if (facility && !facility.hfrId) {
    report.warnings.push('This facility has no HFR ID saved. Search for it and attach it before linking.');
  }

  if (!report.credentialsConfigured || !env.abdmGatewayBaseUrl) return report;
  try {
    const bridge = await readBridgeServices({ correlationId, http });
    const roles = facility ? rolesFor(bridge.services, facility.hfrId) : [];
    report.bridge = {
      url: bridge.url,
      active: bridge.active,
      services: bridge.services,
      facilityRoles: roles,
    };
    if (facility?.hfrId) {
      for (const role of ['HIP', 'HIU']) {
        if (!roles.includes(role)) {
          report.warnings.push(`bridge-services does not list ${role} for this facility. ${role === 'HIP' ? 'M2' : 'M3'} calls are refused until it does.`);
        }
      }
      const configured = { HIP: env.abdmHipId, HIU: env.abdmHiuId };
      for (const role of roles) {
        if (!configured[role]) {
          report.warnings.push(`ABDM_${role}_ID is empty. Set it to ${facility.hfrId}.`);
        } else if (configured[role] !== facility.hfrId) {
          report.warnings.push(`ABDM_${role}_ID does not match this facility's service id on the bridge.`);
        }
      }
    }
  } catch (err) {
    report.warnings.push(err.message || 'bridge-services could not be called');
  }
  return report;
}
