import { z } from 'zod';
import { pageQueryShape } from '../../shared/pagination.js';
import {
  AADHAAR_INVALID_MESSAGE,
  abhaAddressRules,
} from './abhaFlow.js';

const empty = z.object({}).optional().default({});

const otpValue = z.string().regex(/^\d{6}$/, 'OTP must be 6 digits');

export const requestOtpSchema = z.object({
  body: z.object({
    patientId: z.string().uuid().optional(),
    aadhaar: z.string().optional(),
    consentAccepted: z.literal(true).optional(),
    transactionId: z.string().uuid().optional(),
    channel: z.enum(['aadhaar', 'mobile']).optional(),
    resend: z.boolean().optional(),
  }).superRefine((value, ctx) => {
    if (value.resend) {
      if (!value.transactionId) {
        ctx.addIssue({
          code: 'custom',
          path: ['transactionId'],
          message: 'Transaction is required to resend an OTP',
        });
      }
      if (!value.channel) {
        ctx.addIssue({
          code: 'custom',
          path: ['channel'],
          message: 'OTP channel is required to resend',
        });
      }
      return;
    }
    if (!value.patientId) {
      ctx.addIssue({
        code: 'custom',
        path: ['patientId'],
        message: 'Patient is required',
      });
    }
    if (!value.consentAccepted) {
      ctx.addIssue({
        code: 'custom',
        path: ['consentAccepted'],
        message: 'ABHA enrolment consent is required',
      });
    }
    if (!/^\d{12}$/.test(value.aadhaar || '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['aadhaar'],
        message: AADHAAR_INVALID_MESSAGE,
      });
    }
  }),
  params: empty,
  query: empty,
});

export const verifyOtpSchema = z.object({
  body: z.object({
    transactionId: z.string().uuid(),
    otp: otpValue,
    mobile: z.string().regex(/^\d{10}$/, 'Mobile must be 10 digits'),
    consentAccepted: z.literal(true),
  }),
  params: empty,
  query: empty,
});

export const verifyMobileSchema = z.object({
  body: z.object({
    transactionId: z.string().uuid(),
    otp: otpValue,
  }),
  params: empty,
  query: empty,
});

export const createAddressSchema = z.object({
  body: z.object({
    transactionId: z.string().uuid(),
    abhaAddress: z.string().trim().min(1).max(32),
    useExisting: z.boolean().optional(),
  }).superRefine((value, ctx) => {
    if (value.useExisting) return;
    if (!abhaAddressRules(value.abhaAddress).valid) {
      ctx.addIssue({
        code: 'custom',
        path: ['abhaAddress'],
        message: 'ABHA address does not meet the address rules',
      });
    }
  }),
  params: empty,
  query: empty,
});

export const listTracesSchema = z.object({
  body: empty,
  params: empty,
  query: z.object(pageQueryShape).optional().default({}),
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
