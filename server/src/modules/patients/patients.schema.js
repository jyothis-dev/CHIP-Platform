import { z } from 'zod';

const patientTypeEnum = z.enum(['MOTHER', 'CHILD']);
const genderEnum = z.enum(['M', 'F', 'O']);

export const listPatientsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    q: z.string().trim().max(120).optional(),
  }).optional().default({}),
});

export const createPatientSchema = z.object({
  body: z.object({
    patientType: patientTypeEnum,
    name: z.string().trim().min(1).max(120),
    gender: genderEnum,
    dateOfBirth: z.string().date().optional().nullable(),
    mobile: z.string().regex(/^\d{10}$/).optional().nullable(),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export const patientIdParamSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional().default({}),
});
