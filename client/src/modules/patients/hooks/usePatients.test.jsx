import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/shared/lib/queryClient.js';
import { usePatients } from './usePatients.js';

vi.mock('../api/patientsApi.js', () => ({
  listPatients: vi.fn(async () => ({
    items: [{ id: 'p1', name: 'Demo Mother', patientType: 'MOTHER' }],
    page: 1,
    pageSize: 20,
    total: 1,
  })),
  createPatient: vi.fn(),
  getPatient: vi.fn(),
}));

function wrapper({ children }) {
  const client = createQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePatients', () => {
  it('loads the patient list', async () => {
    const { result } = renderHook(() => usePatients(''), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data.items).toHaveLength(1);
    expect(result.current.data.items[0].name).toBe('Demo Mother');
  });
});
