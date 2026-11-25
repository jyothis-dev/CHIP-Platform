import { useQuery } from '@tanstack/react-query';
import * as auditApi from '../api/auditApi.js';

export function useActivityLog(filters) {
  return useQuery({
    queryKey: ['audit', filters],
    queryFn: () => auditApi.listAudit(filters),
  });
}
