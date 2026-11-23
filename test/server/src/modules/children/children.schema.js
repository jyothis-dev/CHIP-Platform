import { z } from 'zod';

const empty = z.object({}).optional().default({});
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const guardianInput = z.object({
  name: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(40),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().optional(),
  isPrimary: z.boolean().optional(),
});

export const createChildSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    dateOfBirth: dateOnly,
    sex: z.enum(['female', 'male', 'other']),
    mrn: z.string().trim().min(1).max(32),
    departmentId: z.string().uuid().optional(),
    guardian: guardianInput.optional(),
  }),
  params: empty,
  query: empty,
});

export const childParamsSchema = z.object({
  body: empty,
  params: z.object({ id: z.string().uuid() }),
  query: empty,
});

export const createGuardianSchema = z.object({
  body: guardianInput,
  params: z.object({ id: z.string().uuid() }),
  query: empty,
});
