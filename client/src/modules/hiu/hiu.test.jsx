import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/shared/lib/queryClient.js';
import { ApiError } from '@/shared/api/errors.js';
import { consentRequestSchema, toRequestBody } from './validation/consentRequestSchema.js';
import { RecordViewer } from './components/RecordViewer.jsx';

vi.mock('./api/hiuApi.js', () => ({
  getArtefactRecords: vi.fn(async () => {
    throw new ApiError({
      status: 410,
      code: 'CONSENT_REVOKED',
      message: 'The patient revoked this consent.',
      details: { at: '2026-11-20T10:00:00.000Z' },
    });
  }),
}));

const patientId = '55555555-5555-4555-8555-555555555555';

function local(offsetMs) {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

describe('consent request form rules', () => {
  const valid = {
    patientId,
    purposeCode: 'CAREMGT',
    hiTypes: ['ImmunizationRecord'],
    dateFrom: local(-86_400_000 * 30),
    dateTo: local(-120_000),
    dataEraseAt: local(86_400_000),
  };

  it('accepts a complete request and sends UTC ISO dates', () => {
    expect(consentRequestSchema.safeParse(valid).success).toBe(true);
    const body = toRequestBody(valid);
    expect(body.dataEraseAt).toMatch(/Z$/);
    expect(body.accessMode).toBe('VIEW');
  });

  it('requires at least one HI type and no silent date defaults', () => {
    const result = consentRequestSchema.safeParse({ ...valid, hiTypes: [], dataEraseAt: '' });
    expect(result.success).toBe(false);
    const paths = result.error.issues.map((issue) => issue.path[0]);
    expect(paths).toContain('hiTypes');
    expect(paths).toContain('dataEraseAt');
  });

  it('refuses a range that ends in the future', () => {
    const result = consentRequestSchema.safeParse({ ...valid, dateTo: local(86_400_000) });
    expect(result.success).toBe(false);
  });
});

describe('RecordViewer', () => {
  it('says the consent was revoked instead of showing an empty list', async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <RecordViewer artefactId="a1" />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Consent revoked on/));
    expect(screen.queryByText(/No records received/)).toBeNull();
  });
});
