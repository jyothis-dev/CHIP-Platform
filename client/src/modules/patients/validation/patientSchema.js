import { z } from 'zod';

export const createPatientSchema = z.object({
  patientType: z.enum(['MOTHER', 'CHILD']),
  name: z.string().trim().min(1, 'Name is required').max(120),
  gender: z.enum(['M', 'F', 'O']),
  dateOfBirth: z.string().optional().or(z.literal('')),
  mobile: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || /^\d{10}$/.test(value), {
      message: 'Mobile must be 10 digits',
    }),
});

export function parseCreatePatient(values) {
  return createPatientSchema.safeParse(values);
}
