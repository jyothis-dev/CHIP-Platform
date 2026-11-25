import { z } from 'zod';

const hiTypeEnum = z.enum([
  'Prescription',
  'DiagnosticReport',
  'OPConsultation',
  'DischargeSummary',
  'ImmunizationRecord',
  'HealthDocumentRecord',
  'WellnessRecord',
  'Invoice',
]);

const empty = {
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
};

export const patientParamSchema = z.object({
  ...empty,
  params: z.object({ id: z.string().uuid() }),
});

export const inspectSchema = z.object({
  ...empty,
  body: z.object({
    hiType: hiTypeEnum,
    patientId: z.string().uuid(),
    patientName: z.string().trim().min(1).max(120),
    gender: z.enum(['M', 'F', 'O']),
    birthDate: z.string().date().optional().nullable(),
    occurredAt: z.string().min(10),
    facilityName: z.string().trim().max(160).optional(),
    title: z.string().trim().max(160).optional(),
    code: z.string().trim().min(1).max(40),
    codeDisplay: z.string().trim().min(1).max(160),
    codeSystem: z.enum(['http://snomed.info/sct', 'http://loinc.org']).optional(),
  }),
});

export const saveRecordSchema = z.object({
  ...empty,
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    hiType: hiTypeEnum,
    occurredAt: z.string().min(10),
    title: z.string().trim().max(160).optional(),
    code: z.string().trim().min(1).max(40),
    codeDisplay: z.string().trim().min(1).max(160),
    codeSystem: z.enum(['http://snomed.info/sct', 'http://loinc.org']).optional(),
  }),
});

export const bridgeUrlSchema = z.object({
  ...empty,
  body: z.object({ confirm: z.literal(true) }),
});
