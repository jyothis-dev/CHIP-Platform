import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
    hospitalId: z.string().uuid().optional(),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export const switchHospitalSchema = z.object({
  body: z.object({
    hospitalId: z.string().uuid(),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});
