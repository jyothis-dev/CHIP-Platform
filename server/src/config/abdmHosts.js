const BASE_URL_KEYS = [
  'ABDM_GATEWAY_BASE_URL',
  'ABDM_ABHA_BASE_URL',
  'ABDM_HFR_BASE_URL',
  'ABDM_HPR_BASE_URL',
];

function blankToNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function allowlistFrom(value) {
  return String(value ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function validateAbdmBaseUrls(source) {
  const allowlist = allowlistFrom(source.ABDM_SANDBOX_HOST_ALLOWLIST);
  const errors = [];

  for (const key of BASE_URL_KEYS) {
    const raw = blankToNull(source[key]);
    if (!raw) continue;

    let url;
    try {
      url = new URL(raw);
    } catch {
      errors.push(`${key} is not a valid absolute URL`);
      continue;
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      errors.push(`${key} must use http or https`);
      continue;
    }

    const host = url.hostname.toLowerCase();
    if (!host || !allowlist.includes(host)) {
      errors.push(`${key} host is not on ABDM_SANDBOX_HOST_ALLOWLIST`);
    }
  }

  return errors;
}

export function abdmBaseUrlConfig(source) {
  return {
    abdmGatewayBaseUrl: blankToNull(source.ABDM_GATEWAY_BASE_URL),
    abdmAbhaBaseUrl: blankToNull(source.ABDM_ABHA_BASE_URL),
    abdmHfrBaseUrl: blankToNull(source.ABDM_HFR_BASE_URL),
    abdmHprBaseUrl: blankToNull(source.ABDM_HPR_BASE_URL),
    abdmSandboxHostAllowlist: allowlistFrom(source.ABDM_SANDBOX_HOST_ALLOWLIST),
  };
}
