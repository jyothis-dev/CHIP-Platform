import { useQuery } from '@tanstack/react-query';
import * as tracesApi from '../api/tracesApi.js';

export function useAbhaTraces() {
  return useQuery({
    queryKey: ['abha-traces'],
    queryFn: () => tracesApi.listTraces(),
  });
}
