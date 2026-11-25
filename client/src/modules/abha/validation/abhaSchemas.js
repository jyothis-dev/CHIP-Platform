import { z } from 'zod';
import {
  AADHAAR_INVALID_MESSAGE,
  abhaAddressRules,
} from '../consentCopy.js';

function mustBe(expected, message) {
  return z.boolean().refine((value) => value === expected, { message });
}

export const consentStepSchema = z.object({
  termsAgreed: mustBe(true, 'Agree to the terms before enrolment'),
  shareAadhaar: mustBe(true, 'This declaration is required'),
  otherDocument: mustBe(false, 'Aadhaar enrolment leaves the other-document declaration unchecked'),
  linkRecords: mustBe(true, 'This declaration is required'),
  shareRecords: mustBe(true, 'This declaration is required'),
  anonymize: mustBe(true, 'This declaration is required'),
  workerConfirmed: mustBe(true, 'The staff confirmation is required'),
  beneficiaryConfirmed: mustBe(true, 'The beneficiary confirmation is required'),
  patientId: z.string().uuid('Select a registered patient'),
});

export const aadhaarStepSchema = z.object({
  aadhaar: z.string().regex(/^\d{12}$/, AADHAAR_INVALID_MESSAGE),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile must be 10 digits'),
});

export const otpStepSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const addressStepSchema = z.object({
  abhaAddress: z.string().trim().min(1, 'ABHA address is required'),
}).superRefine((value, ctx) => {
  if (abhaAddressRules(value.abhaAddress).valid) return;
  ctx.addIssue({
    code: 'custom',
    path: ['abhaAddress'],
    message: 'ABHA address does not meet the address rules',
  });
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

export { abhaAddressRules, AADHAAR_INVALID_MESSAGE };
