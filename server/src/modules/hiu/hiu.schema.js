import { z } from 'zod';
import { pageQueryShape } from '../../shared/pagination.js';
import { ACCESS_MODES, FREQUENCY_UNITS, HIU_HI_TYPES, PURPOSE_CODES } from './constants.js';

const isoDate = z.string().datetime({ offset: true });
const id = z.string().uuid();

export const createConsentRequestSchema = z.object({
  body: z.object({
    patientId: id,
    purposeCode: z.enum(PURPOSE_CODES),
    hiTypes: z.array(z.enum(HIU_HI_TYPES)).min(1).max(HIU_HI_TYPES.length)
      .refine((list) => new Set(list).size === list.length, 'HI types must not repeat'),
    dateFrom: isoDate,
    dateTo: isoDate,
    dataEraseAt: isoDate,
    accessMode: z.enum(ACCESS_MODES).default('VIEW'),
    frequency: z.object({
      unit: z.enum(FREQUENCY_UNITS),
      value: z.number().int().min(1),
      repeats: z.number().int().min(0),
    }).optional(),
  }).superRefine((value, ctx) => {
    const now = Date.now() + 60_000;
    if (new Date(value.dateFrom) > new Date(value.dateTo)) {
      ctx.addIssue({ code: 'custom', path: ['dateFrom'], message: 'Health info from must be on or before health info to' });
    }
    // ABDM: "Invalid from/to date. Date must be a present/before date".
    if (new Date(value.dateTo).getTime() > now) {
      ctx.addIssue({ code: 'custom', path: ['dateTo'], message: 'Health info to must not be in the future' });
    }
    if (new Date(value.dataEraseAt).getTime() <= Date.now()) {
      ctx.addIssue({ code: 'custom', path: ['dataEraseAt'], message: 'Consent expiry must be in the future' });
    }
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

export const listConsentRequestsSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
  query: z.object({
    ...pageQueryShape,
    patientId: id.optional(),
    status: z.enum(['INIT_SENT', 'INIT_FAILED', 'REQUESTED', 'GRANTED', 'DENIED', 'EXPIRED', 'REVOKED']).optional(),
  }),
});

export const idParamSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({ id }),
  query: z.object({}).passthrough(),
});

export const healthInformationSchema = z.object({
  body: z.object({
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
  }),
  params: z.object({ id }),
  query: z.object({}).passthrough(),
});
