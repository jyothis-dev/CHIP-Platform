import { z } from 'zod';

// Mirrors the server and the M4 specification. Not stricter than the platform.
export const FACILITY_ID_PATTERN = /^IN.{10}$/;
export const FACILITY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_.(),/]*( [A-Za-z0-9\-_.(),/]+)*$/;
export const HIP_NAME_PATTERN = /^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/;
export const HIP_NAME_MAX = 15;

const blank = (value) => (typeof value === 'string' ? value.trim() : value);
const optionalText = z.preprocess((value) => (blank(value) === '' ? undefined : blank(value)), z.string().optional());

export const facilitySearchSchema = z.object({
  facilityId: optionalText.pipe(z.string().regex(FACILITY_ID_PATTERN, 'Facility ID is 12 characters and starts with IN').optional()),
  facilityName: optionalText.pipe(z.string().max(200).regex(FACILITY_NAME_PATTERN, 'Use letters, digits and -_.(),/ with single spaces').optional()),
  ownershipCode: optionalText,
  stateLGDCode: optionalText,
  districtLGDCode: optionalText,
  subDistrictLGDCode: optionalText,
  pincode: optionalText.pipe(z.string().regex(/^\d{6}$/, 'Pincode is 6 digits').optional()),
}).superRefine((value, ctx) => {
  if (value.facilityId) return;
  const labels = { facilityName: 'Facility name', ownershipCode: 'Ownership', stateLGDCode: 'State' };
  for (const [key, label] of Object.entries(labels)) {
    if (!value[key]) {
      ctx.addIssue({ code: 'custom', path: [key], message: `${label} is required unless a facility ID is given` });
    }
  }
});

/** Drops empty fields. Page size is not sent: the server fixes it at 10. */
export function toSearchBody(values, page = 1) {
  const parsed = facilitySearchSchema.parse(values);
  return { ...Object.fromEntries(Object.entries(parsed).filter(([, value]) => value)), page };
}

export const hipNameSchema = z.string().trim()
  .min(1, 'HIP name is required')
  .max(HIP_NAME_MAX, `HIP name is ${HIP_NAME_MAX} characters or fewer`)
  .regex(HIP_NAME_PATTERN, 'HIP name has no special characters');

export const mobileSchema = z.string().trim().regex(/^\d{10}$/, 'Mobile number is 10 digits');

export function fieldErrors(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ?? 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function maskMobile(value) {
  const text = String(value || '');
  return text.length > 4 ? `${'*'.repeat(text.length - 4)}${text.slice(-4)}` : text;
}
