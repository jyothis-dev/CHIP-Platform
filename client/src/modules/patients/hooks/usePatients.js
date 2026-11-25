import { useQuery } from '@tanstack/react-query';
import * as patientsApi from '../api/patientsApi.js';

export function usePatients(q = '') {
  return useQuery({
    queryKey: ['patients', { q }],
    queryFn: () => patientsApi.listPatients({ q: q || undefined }),
  });
}
