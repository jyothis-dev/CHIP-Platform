import { z } from 'zod';

function ageInYears(dateOfBirth, today = new Date()) {
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(dob.getTime())) return null;
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

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
}).superRefine((value, ctx) => {
  if (value.patientType !== 'CHILD') return;

  if (!value.dateOfBirth) {
    ctx.addIssue({
      code: 'custom',
      path: ['dateOfBirth'],
      message: 'Date of birth is required for a child patient',
    });
    return;
  }

  const age = ageInYears(value.dateOfBirth);
  if (age === null || age < 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['dateOfBirth'],
      message: 'Date of birth must be a valid past date',
    });
    return;
  }

  if (age >= 18) {
    ctx.addIssue({
      code: 'custom',
      path: ['dateOfBirth'],
      message: 'Child patient must be under 18 years old',
    });
  }
});

export function parseCreatePatient(values) {
  return createPatientSchema.safeParse(values);
}
