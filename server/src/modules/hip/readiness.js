import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { getContract } from '../../integrations/abdm/contracts.js';
import { abdmRequest } from '../../integrations/abdm/client.js';
import { CLAIMED_HI_TYPES } from '../../integrations/abdm/fhir/profiles.js';

function hipService(body) {
  const services = body?.services || body?.bridge?.services || [];
  if (!Array.isArray(services)) return null;
  return services.find((service) => {
    const types = service.types || service.type || [];
    const list = Array.isArray(types) ? types : [types];
    return list.map((item) => String(item).toUpperCase()).includes('HIP');
  }) || null;
}

export async function readiness({ http } = {}) {
  const callbackBase = env.abdmCallbackBaseUrl;
  const report = {
    hipIdConfigured: Boolean(env.abdmHipId),
    callbackBaseConfigured: Boolean(callbackBase),
    claimedHiTypes: CLAIMED_HI_TYPES,
    bridge: null,
    blockers: [],
    warnings: [],
  };
  if (!env.abdmHipId) {
    report.blockers.push('ABDM_HIP_ID is not configured. Linking calls are refused until bridge-services returns a HIP id.');
  }
  if (!callbackBase) {
    report.warnings.push('ABDM_CALLBACK_BASE_URL is not set. A call can still be sent, and the answer will have nowhere to arrive.');
  }
  if (!env.abdmClientId || !env.abdmGatewayBaseUrl) {
    report.warnings.push('Gateway credentials are not configured, so bridge-services was not called.');
    return report;
  }
  try {
    const result = await abdmRequest({
      contract: getContract('bridgeServices'),
      http,
    });
    const service = hipService(result.body);
    const bridgeUrl = result.body?.bridge?.url || result.body?.url || null;
    report.bridge = {
      httpStatus: result.status,
      active: result.body?.bridge?.active ?? null,
      url: bridgeUrl,
      hipServiceId: service?.id || null,
      servicesEmpty: !service,
    };
    if (!service) {
      report.blockers.push('bridge-services returned no service whose types include HIP.');
    } else if (env.abdmHipId && service.id !== env.abdmHipId) {
      report.warnings.push('ABDM_HIP_ID does not match the HIP service id on the bridge.');
    }
    if (callbackBase && bridgeUrl && bridgeUrl.replace(/\/$/, '') !== callbackBase.replace(/\/$/, '')) {
      report.warnings.push('The registered bridge URL is not the configured callback base.');
    }
  } catch (err) {
    report.warnings.push(err.message || 'bridge-services could not be called');
  }
  return report;
}

export async function registerCallback({ confirm, http } = {}) {
  if (!confirm) {
    throw new AppError(400, 'BRIDGE_URL_UNCONFIRMED', 'Confirm the current callback base before it is registered');
  }
  if (!env.abdmCallbackBaseUrl) {
    throw new AppError(409, 'CALLBACK_URL_MISSING', 'ABDM_CALLBACK_BASE_URL is not configured');
  }
  const result = await abdmRequest({
    contract: getContract('bridgeUrl'),
    http,
    body: { url: env.abdmCallbackBaseUrl },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new AppError(502, 'BRIDGE_URL_FAILED', 'ABDM did not accept the bridge URL');
  }
  return { requestId: result.requestId, status: result.status };
}
