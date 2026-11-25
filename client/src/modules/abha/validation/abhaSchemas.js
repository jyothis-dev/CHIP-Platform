import { z } from 'zod';

export const consentStepSchema = z.object({
  consentAccepted: z
    .boolean()
    .refine((value) => value === true, { message: 'Consent is required before enrolment' }),
  patientId: z.string().uuid('Select a registered patient'),
});

export const aadhaarStepSchema = z.object({
  aadhaar: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits'),
  mobile: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || /^\d{10}$/.test(value), {
      message: 'Mobile must be 10 digits',
    }),
});

export const otpStepSchema = z.object({
  otp: z.string().min(4, 'OTP is required').max(8),
});

export const addressStepSchema = z.object({
  abhaAddress: z.string().trim().min(3, 'ABHA address is required').max(100),
});

export function parseConsentStep(values) {
  return consentStepSchema.safeParse(values);
}

export function parseAadhaarStep(values) {
  return aadhaarStepSchema.safeParse(values);
}

export function parseOtpStep(values) {
  return otpStepSchema.safeParse(values);
}

export function parseAddressStep(values) {
  return addressStepSchema.safeParse(values);
}
