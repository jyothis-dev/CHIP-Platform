export const RESEND_LIMIT_MESSAGE = 'Maximum OTP resend attempts reached. Please try again after 30 mins';
export const ADDRESS_EXISTS_MESSAGE = 'ABHA address already exists.';
export const AADHAAR_INVALID_MESSAGE = 'Aadhaar Number is not valid';
export const MAX_OTP_RESENDS = 2;
export const OTP_VALID_MS = 10 * 60 * 1000;

function abdmBody(body) {
  if (body && typeof body === 'object') return body;
  if (typeof body !== 'string') return null;
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function abdmMessage(body) {
  const source = abdmBody(body);
  const raw = source?.message
    || source?.error?.message
    || source?.description
    || source?.error?.description
    || (typeof source?.error === 'string' ? source.error : null);
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text || text.length > 400) return null;
  const compact = text.replace(/[\s-]/g, '');
  if (/\d{12,}/.test(compact)) return null;
  return text;
}

export function addressTaken(body) {
  const message = `${abdmMessage(body) || ''} ${body?.error?.code || body?.code || ''}`;
  return /already exist/i.test(message);
}

function last4(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}

/**
 * CRT_ABHA_108 / CRT_ABHA_109.
 * The enrol response carries the Aadhaar-linked mobile on ABHAProfile.mobile,
 * masked. Same last four: no second OTP. A different last four: verify it.
 * No comparable mobile on the response: do not start a second OTP.
 */
export function communicationMobileNeedsOtp(body, mobile) {
  if (!mobile) return false;
  const profileMobile = body?.ABHAProfile?.mobile || null;
  const profileLast4 = last4(profileMobile);
  const enteredLast4 = last4(mobile);
  if (!profileLast4 || !enteredLast4) return false;
  return profileLast4 !== enteredLast4;
}

export function displayAbhaNumber(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (text.includes('-')) return text;
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 14) return text;
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
}

export function profileFromEnrolment(body) {
  const profile = body?.ABHAProfile || {};
  const abhaNumber = displayAbhaNumber(
    profile.ABHANumber || body?.healthIdNumber || body?.ABHANumber || null,
  );
  const name = [profile.firstName, profile.middleName, profile.lastName]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ');
  const phr = profile.phrAddress || body?.preferredAbhaAddress || null;
  return {
    abhaNumber,
    name: name || null,
    dateOfBirth: profile.dob || profile.dateOfBirth || null,
    gender: profile.gender || null,
    mobile: typeof profile.mobile === 'string' ? profile.mobile : null,
    address: typeof profile.address === 'string' ? profile.address : null,
    phrAddress: Array.isArray(phr) ? phr.filter(Boolean) : (phr ? [phr] : []),
  };
}

/**
 * The M2 and M3 APIs want the full ABHA address, `name@sbx` or `name@abdm`
 * (^[a-zA-Z0-9][a-zA-Z0-9_.]+[a-zA-Z0-9]@(abdm|sbx)$). Enrolment works with the bare local part, so a stored
 * address can lack the suffix. Add the consent manager suffix only when there is none.
 */
export function fullAbhaAddress(value, suffix = 'sbx') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.includes('@') ? raw : `${raw}@${suffix}`;
}

export function abhaAddressRules(value) {
  const raw = String(value || '').trim();
  const at = raw.lastIndexOf('@');
  const suffix = at >= 0 ? raw.slice(at).toLowerCase() : '';
  const hasKnownSuffix = suffix === '@sbx' || suffix === '@abdm';
  const local = hasKnownSuffix ? raw.slice(0, at) : raw;
  const full = hasKnownSuffix ? raw : `${raw}@sbx`;
  const lengthOk = full.length >= 8 && full.length <= 18 && local.length > 0;
  const charsetOk = /^[A-Za-z0-9._]+$/.test(local);
  const dotCount = (local.match(/\./g) || []).length;
  const underscoreCount = (local.match(/_/g) || []).length;
  const specialsOk = charsetOk
    && dotCount <= 1
    && underscoreCount <= 1
    && !local.startsWith('.')
    && !local.endsWith('.')
    && !local.startsWith('_')
    && !local.endsWith('_');
  return {
    lengthOk,
    charsetOk,
    specialsOk,
    valid: Boolean(lengthOk && charsetOk && specialsOk),
    wire: local,
  };
}

function profileDate(profile) {
  const raw = profile.dob || profile.dateOfBirth;
  let year; let month; let day;
  if (typeof raw === 'string') {
    const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dmy = raw.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (iso) [, year, month, day] = iso;
    else if (dmy) [, day, month, year] = dmy;
  } else {
    year = profile.yearOfBirth;
    month = profile.monthOfBirth;
    day = profile.dayOfBirth;
  }
  const [y, m, d] = [Number(year), Number(month), Number(day)];
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  const sound = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return sound && y >= 1900 ? date : null;
}

const GENDER_WORDS = { MALE: 'M', FEMALE: 'F', OTHER: 'O', OTHERS: 'O' };

/**
 * The demographics ABDM holds for this ABHA (from the enrolment response). M2 link-token requests are compared
 * with the Aadhaar record, so these values, not what staff typed, are what must be sent.
 * A field ABDM did not return, or returned in a shape we cannot read, is left out.
 */
export function demographicsFromProfile(body) {
  const profile = body?.ABHAProfile || {};
  const name = [profile.firstName, profile.middleName, profile.lastName]
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim())
    .join(' ');
  const rawGender = String(profile.gender || '').trim().toUpperCase();
  const gender = ['M', 'F', 'O'].includes(rawGender) ? rawGender : (GENDER_WORDS[rawGender] || null);
  const result = {};
  if (name) result.name = name.slice(0, 120);
  if (gender) result.gender = gender;
  const dateOfBirth = profileDate(profile);
  if (dateOfBirth) result.dateOfBirth = dateOfBirth;
  return result;
}
