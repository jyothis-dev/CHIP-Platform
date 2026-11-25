import { useQuery } from '@tanstack/react-query';
import { PAGE_SIZE } from '@/shared/ui/index.js';
import * as patientsApi from '../api/patientsApi.js';

export function usePatients(q = '', page = 1) {
  return useQuery({
    queryKey: ['patients', { q, page, pageSize: PAGE_SIZE }],
    queryFn: () => patientsApi.listPatients({ q: q || undefined, page, pageSize: PAGE_SIZE }),
  });
}
