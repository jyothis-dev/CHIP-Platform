/**
 * Profile URL fetched from the published NRCES ABDM IG on 2026-11-25.
 * Current published version on that page: 6.5.0.
 * https://www.nrces.in/ndhm/fhir/r4/StructureDefinition-ImmunizationRecord.html
 */
export const IG_VERSION = '6.5.0';

export const FETCHED_PROFILES = {
  ImmunizationRecord: {
    url: 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/ImmunizationRecord',
    version: IG_VERSION,
    compositionCode: '41000179103',
    compositionDisplay: 'Immunization record',
    entryType: 'Immunization',
  },
};

export const HI_TYPES = [
  'Prescription',
  'DiagnosticReport',
  'OPConsultation',
  'DischargeSummary',
  'ImmunizationRecord',
  'HealthDocumentRecord',
  'WellnessRecord',
  'Invoice',
];

export const CLAIMED_HI_TYPES = ['ImmunizationRecord'];

export const SNOMED = 'http://snomed.info/sct';
export const LOINC = 'http://loinc.org';
