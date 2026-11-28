import { abhaAddressRules, communicationMobileNeedsOtp, demographicsFromProfile } from './abhaFlow.js';

describe('abha address rules', () => {
  it('rejects a leading dot and a 7-character handle', () => {
    expect(abhaAddressRules('.name@sbx').valid).toBe(false);
    expect(abhaAddressRules('.name@sbx').specialsOk).toBe(false);
    expect(abhaAddressRules('abc@sbx').valid).toBe(false);
    expect(abhaAddressRules('abc@sbx').lengthOk).toBe(false);
  });

  it('accepts a handle that meets the length, character, and special rules', () => {
    const rules = abhaAddressRules('asha.dev_1@sbx');
    expect(rules.valid).toBe(true);
    expect(rules.wire).toBe('asha.dev_1');
  });
});

describe('communication mobile branch', () => {
  it('skips a second OTP when the profile mobile ends with the same four digits', () => {
    const body = { ABHAProfile: { mobile: '******1234' } };
    expect(communicationMobileNeedsOtp(body, '9999991234')).toBe(false);
  });

  it('asks for a mobile OTP when the last four digits differ', () => {
    const body = { ABHAProfile: { mobile: '******9999' } };
    expect(communicationMobileNeedsOtp(body, '9999991234')).toBe(true);
  });
});

describe('demographics from the ABHA profile', () => {
  it('joins the name parts, maps gender and reads a day-first birth date', () => {
    expect(demographicsFromProfile({
      ABHAProfile: { firstName: 'Jyothi', middleName: '', lastName: 'Swarup', gender: 'M', dob: '14-01-1999' },
    })).toEqual({ name: 'Jyothi Swarup', gender: 'M', dateOfBirth: new Date('1999-01-14T00:00:00.000Z') });
  });

  it('reads an ISO date, split date fields and gender words', () => {
    expect(demographicsFromProfile({ ABHAProfile: { firstName: 'Asha', gender: 'FEMALE', dob: '1995-02-03' } }))
      .toEqual({ name: 'Asha', gender: 'F', dateOfBirth: new Date('1995-02-03T00:00:00.000Z') });
    expect(demographicsFromProfile({ ABHAProfile: { firstName: 'Asha', dayOfBirth: '3', monthOfBirth: '2', yearOfBirth: '1995' } }).dateOfBirth)
      .toEqual(new Date('1995-02-03T00:00:00.000Z'));
  });

  it('leaves out anything ABDM did not return or that cannot be read', () => {
    expect(demographicsFromProfile({})).toEqual({});
    expect(demographicsFromProfile({ ABHAProfile: { firstName: 'Asha', gender: 'X', dob: '31-02-1999' } })).toEqual({ name: 'Asha' });
  });
});
