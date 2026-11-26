import { z } from 'zod';

export const HI_TYPES = [
  'DiagnosticReport',
  'DischargeSummary',
  'HealthDocumentRecord',
  'ImmunizationRecord',
  'OPConsultation',
  'Prescription',
  'WellnessRecord',
  'Invoice',
];

/** Values come from <input type="datetime-local">, in the browser's local time. */
export const consentRequestSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  purposeCode: z.string().min(1, 'Select a purpose'),
  hiTypes: z.array(z.enum(HI_TYPES)).min(1, 'Select at least one health information type'),
  dateFrom: z.string().min(1, 'Health info from is required'),
  dateTo: z.string().min(1, 'Health info to is required'),
  dataEraseAt: z.string().min(1, 'Consent expiry is required'),
}).superRefine((value, ctx) => {
  const from = new Date(value.dateFrom);
  const to = new Date(value.dateTo);
  const expiry = new Date(value.dataEraseAt);
  if (value.dateFrom && value.dateTo && from > to) {
    ctx.addIssue({ code: 'custom', path: ['dateFrom'], message: 'Health info from must be on or before health info to' });
  }
  if (value.dateTo && to.getTime() > Date.now() + 60_000) {
    ctx.addIssue({ code: 'custom', path: ['dateTo'], message: 'Health info to must not be in the future' });
  }
  if (value.dataEraseAt && expiry.getTime() <= Date.now()) {
    ctx.addIssue({ code: 'custom', path: ['dataEraseAt'], message: 'Consent expiry must be in the future' });
  }
});

export function toRequestBody(values) {
  return {
    patientId: values.patientId,
    purposeCode: values.purposeCode,
    hiTypes: values.hiTypes,
    dateFrom: new Date(values.dateFrom).toISOString(),
    dateTo: new Date(values.dateTo).toISOString(),
    dataEraseAt: new Date(values.dataEraseAt).toISOString(),
    accessMode: 'VIEW',
  };
}
