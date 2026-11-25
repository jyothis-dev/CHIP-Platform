import { abhaAddressRules, communicationMobileNeedsOtp } from './abhaFlow.js';

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
