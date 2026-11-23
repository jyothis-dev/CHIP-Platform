import { z } from 'zod';

const empty = z.object({}).optional().default({});

export const vaccinationParamsSchema = z.object({
  body: empty,
  params: z.object({ id: z.string().uuid() }),
  query: empty,
});

export const createVaccinationSchema = z.object({
  body: z.object({
    vaccineCode: z.string().trim().min(2).max(20),
    doseNumber: z.number().int().min(0).max(20),
    administeredAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date').optional(),
    batchNumber: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(240).optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
  query: empty,
});
