import { env } from '../../config/env.js';
import { getContract } from '../../integrations/abdm/contracts.js';
import { abdmRequest } from '../../integrations/abdm/client.js';
import { dataPushUrl } from './dataflow.js';
import { HIU_CLAIMED_HI_TYPES } from './constants.js';

function serviceOfType(body, type) {
  const services = body?.services || body?.bridge?.services || [];
  if (!Array.isArray(services)) return null;
  return services.find((service) => {
    const types = service.types || service.type || [];
    const list = Array.isArray(types) ? types : [types];
    return list.map((item) => String(item).toUpperCase()).includes(type);
  }) || null;
}

/** Say what cannot work before anyone depends on it (hiecm.concept.m3-refuse-to-guess). */
export async function hiuReadiness({ http } = {}) {
  const pushUrl = dataPushUrl();
  const report = {
    hiuIdConfigured: Boolean(env.abdmHiuId),
    callbackBase: env.abdmCallbackBaseUrl || null,
    dataPushUrl: pushUrl,
    claimedHiTypes: HIU_CLAIMED_HI_TYPES,
    crypto: {
      available: true,
      scheme: 'ECDH Curve25519 (Fidelius Weierstrass SPKI), HKDF-SHA256, AES-256-GCM',
      verifiedAgainst: 'Local BouncyCastle-style Weierstrass peer test only',
      note: 'Not yet observed decrypting a push from a sandbox HIP. Treat the first sandbox push as the interop check.',
    },
    sweeper: env.hiuSweeperEnabled,
    bridge: null,
    blockers: [],
    warnings: [],
  };
  if (!env.abdmHiuId) {
    report.blockers.push('ABDM_HIU_ID is not configured. Consent requests are refused until bridge-services returns an HIU service id.');
  }
  if (!env.abdmCallbackBaseUrl) {
    report.blockers.push('ABDM_CALLBACK_BASE_URL is not set. on-init, notify and on-fetch would have nowhere to arrive.');
  }
  if (!pushUrl || !pushUrl.startsWith('https://')) {
    report.blockers.push('The data push URL is not a public HTTPS URL. HIPs could not deliver records.');
  }
  report.warnings.push(report.crypto.note);
  if (!env.abdmClientId || !env.abdmGatewayBaseUrl) {
    report.warnings.push('Gateway credentials are not configured, so bridge-services was not called.');
    return report;
  }
  try {
    const result = await abdmRequest({ contract: getContract('bridgeServices'), http });
    const service = serviceOfType(result.body, 'HIU');
    report.bridge = {
      httpStatus: result.status,
      active: result.body?.bridge?.active ?? null,
      url: result.body?.bridge?.url || result.body?.url || null,
      hiuServiceId: service?.id || null,
    };
    if (!service) {
      report.blockers.push('bridge-services returned no service whose types include HIU.');
    } else if (env.abdmHiuId && service.id !== env.abdmHiuId) {
      report.warnings.push('ABDM_HIU_ID does not match the HIU service id on the bridge.');
    }
  } catch (err) {
    report.warnings.push(err.message || 'bridge-services could not be called');
  }
  return report;
}
