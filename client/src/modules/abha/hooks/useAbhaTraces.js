import { useQuery } from '@tanstack/react-query';
import * as tracesApi from '../api/tracesApi.js';

export function useAbhaTraces(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['abha-traces', page, pageSize],
    queryFn: () => tracesApi.listTraces({ page, pageSize }),
  });
}
