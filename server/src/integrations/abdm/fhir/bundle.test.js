import { buildBundle, validateBundle } from './bundle.js';

const base = {
  hiType: 'ImmunizationRecord',
  patientId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  patientName: 'Asha Devi',
  gender: 'F',
  birthDate: '2020-01-02',
  occurredAt: '2026-03-01T10:00:00.000Z',
  facilityName: 'Demo Facility',
  title: 'Immunization visit on 01 Mar 2026',
  code: '111164008',
  codeDisplay: 'Poliomyelitis vaccine',
  codeSystem: 'http://snomed.info/sct',
};

describe('fhir bundles', () => {
  it('builds a valid immunization bundle against the fetched profile', () => {
    const built = buildBundle(base);
    expect(built.validationStatus).toBe('VALID');
    expect(built.fhirProfile).toBe('https://nrces.in/ndhm/fhir/r4/StructureDefinition/ImmunizationRecord');
    expect(built.igVersion).toBe('6.5.0');
    const check = validateBundle(built.bundle, 'ImmunizationRecord');
    expect(check.valid).toBe(true);
  });

  it('refuses a bundle whose reference points outside it', () => {
    const built = buildBundle(base);
    built.bundle.entry[0].resource.author[0].reference = 'Organization/missing';
    const check = validateBundle(built.bundle, 'ImmunizationRecord');
    expect(check.valid).toBe(false);
    expect(check.problems.join(' ')).toMatch(/outside the bundle/);
  });

  it('keeps an unfetched HI type unverified', () => {
    const built = buildBundle({ ...base, hiType: 'Prescription' });
    expect(built.validationStatus).toBe('UNVERIFIED');
    expect(built.fhirProfile).toBeNull();
  });
});
