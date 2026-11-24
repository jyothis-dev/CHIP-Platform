import { validateAbdmBaseUrls } from './abdmHosts.js';

describe('ABDM base URL allow-list', () => {
  it('fails validation when a base URL host is not on the allow-list', () => {
    const errors = validateAbdmBaseUrls({
      ABDM_GATEWAY_BASE_URL: 'https://not-allowed.example/gateway',
      ABDM_SANDBOX_HOST_ALLOWLIST: 'allowed.example',
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.includes('ABDM_GATEWAY_BASE_URL'))).toBe(true);
    expect(errors.join(' ')).not.toContain('not-allowed.example/gateway');
  });

  it('passes when a set base URL host is on the allow-list', () => {
    const errors = validateAbdmBaseUrls({
      ABDM_ABHA_BASE_URL: 'https://allowed.example/abha',
      ABDM_SANDBOX_HOST_ALLOWLIST: 'allowed.example',
    });

    expect(errors).toEqual([]);
  });

  it('passes when the ABDM base URLs are omitted', () => {
    expect(validateAbdmBaseUrls({})).toEqual([]);
    expect(validateAbdmBaseUrls({
      ABDM_GATEWAY_BASE_URL: '',
      ABDM_ABHA_BASE_URL: '   ',
      ABDM_HFR_BASE_URL: undefined,
      ABDM_HPR_BASE_URL: null,
    })).toEqual([]);
  });
});
