const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'x-auth-token',
  'x-token',
  'otp',
  'otpvalue',
  'aadhaar',
  'aadhaarnumber',
  'loginid',
  'abhanumber',
  'healthidnumber',
  'abhaaddress',
  'token',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'password',
  'passwordhash',
  'clientsecret',
  'clientid',
  'privatekey',
  'keymaterial',
  'entries',
  'content',
  'fhirbundle',
  'linktoken',
  'x-link-token',
  'phoneno',
  'mobile',
  'mobileenc',
]);

function isSensitive(key) {
  return SENSITIVE_KEYS.has(String(key).toLowerCase());
}

export function redactDeep(value) {
  if (Array.isArray(value)) return value.map(redactDeep);
  if (!value || typeof value !== 'object') return value;
  if (Buffer.isBuffer(value) || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return { omitted: 'binary', byteLength: value.byteLength ?? value.length ?? null };
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = isSensitive(key) ? '[REDACTED]' : redactDeep(child);
  }
  return out;
}
