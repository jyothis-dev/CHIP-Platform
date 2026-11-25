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

const createPatientBodySchema = z.object({
  patientType: patientTypeEnum,
  name: z.string().trim().min(1).max(120),
  gender: genderEnum,
  dateOfBirth: z.string().date().optional().nullable(),
  mobile: z.string().regex(/^\d{10}$/).optional().nullable(),
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

export const createPatientSchema = z.object({
  body: createPatientBodySchema,
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
