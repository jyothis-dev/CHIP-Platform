import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/shared/lib/queryClient.js';
import { hasRole } from '@/modules/auth/hooks/roles.js';
import { RegistryReadiness } from './components/RegistryReadiness.jsx';
import {
  facilitySearchSchema, hipNameSchema, maskMobile, mobileSchema, toSearchBody,
} from './validation/registrySchemas.js';

vi.mock('./api/registriesApi.js', () => ({
  getReadiness: vi.fn(async () => ({
    blockers: ['ABDM_HFR_BASE_URL is not set. Facility search and the bridge link are refused.'],
    warnings: ['bridge-services does not list HIU for this facility. M3 calls are refused until it does.'],
  })),
}));

describe('facility search rules', () => {
  it('accepts a facility ID alone', () => {
    expect(facilitySearchSchema.safeParse({ facilityId: 'IN0000000001' }).success).toBe(true);
  });

  it('needs name, ownership and state when there is no facility ID', () => {
    const result = facilitySearchSchema.safeParse({ facilityName: 'Sahyadri' });
    expect(result.success).toBe(false);
    const paths = result.error.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['ownershipCode', 'stateLGDCode']));
  });

  it('refuses a facility ID that is not 12 characters starting IN', () => {
    expect(facilitySearchSchema.safeParse({ facilityId: 'XX0000000001' }).success).toBe(false);
    expect(facilitySearchSchema.safeParse({ facilityId: 'IN123' }).success).toBe(false);
  });

  it('sends only the filled fields and never a page size', () => {
    const body = toSearchBody({
      facilityName: 'Sahyadri Hospital', ownershipCode: 'P', stateLGDCode: '27', districtLGDCode: '', pincode: '',
    }, 2);
    expect(body).toEqual({
      facilityName: 'Sahyadri Hospital', ownershipCode: 'P', stateLGDCode: '27', page: 2,
    });
    expect(body).not.toHaveProperty('resultsPerPage');
  });
});

describe('bridge link rules', () => {
  it('limits the HIP name to 15 characters with no special characters', () => {
    expect(hipNameSchema.safeParse('Sahyadri Bridge').success).toBe(true);
    expect(hipNameSchema.safeParse('A very long hospital name').success).toBe(false);
    expect(hipNameSchema.safeParse('Bad$Name').success).toBe(false);
    expect(hipNameSchema.safeParse('').success).toBe(false);
  });
});

describe('mobile handling', () => {
  it('needs 10 digits and is masked on screen', () => {
    expect(mobileSchema.safeParse('9876501234').success).toBe(true);
    expect(mobileSchema.safeParse('98765').success).toBe(false);
    expect(maskMobile('9876501234')).toBe('******1234');
  });
});

describe('role helper', () => {
  it('matches only the listed roles', () => {
    expect(hasRole({ role: 'ADMIN' }, ['ADMIN'])).toBe(true);
    expect(hasRole({ role: 'CLINICIAN' }, ['ADMIN'])).toBe(false);
    expect(hasRole(null, ['ADMIN'])).toBe(false);
  });
});

describe('RegistryReadiness', () => {
  it('shows the blockers and warnings from the server', async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <RegistryReadiness />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(screen.getByText(/ABDM_HFR_BASE_URL is not set/)).toBeInTheDocument();
    expect(screen.getByText(/does not list HIU/)).toBeInTheDocument();
  });
});
