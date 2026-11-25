import { z } from 'zod';

const empty = z.object({}).optional().default({});

export const requestOtpSchema = z.object({
  body: z.object({
    patientId: z.string().uuid(),
    aadhaar: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits'),
  }),
  params: empty,
  query: empty,
});

export const verifyOtpSchema = z.object({
  body: z.object({
    transactionId: z.string().uuid(),
    otp: z.string().min(4).max(8),
    mobile: z.string().regex(/^\d{10}$/).optional(),
    consentAccepted: z.literal(true),
  }),
  params: empty,
  query: empty,
});

export const verifyMobileSchema = z.object({
  body: z.object({
    transactionId: z.string().uuid(),
    otp: z.string().min(4).max(8),
  }),
  params: empty,
  query: empty,
});

export const createAddressSchema = z.object({
  body: z.object({
    transactionId: z.string().uuid(),
    abhaAddress: z.string().min(3).max(100),
  }),
  params: empty,
  query: empty,
});

export const transactionIdParamSchema = z.object({
  body: empty,
  params: z.object({
    transactionId: z.string().uuid(),
  }),
  query: empty,
});

export const patientIdParamSchema = z.object({
  body: empty,
  params: z.object({
    id: z.string().uuid(),
  }),
  query: empty,
});
