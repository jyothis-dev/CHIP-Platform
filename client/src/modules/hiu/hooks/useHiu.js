import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/hiuApi.js';

const PENDING = new Set(['INIT_SENT', 'REQUESTED']);

export function useHiuOptions() {
  return useQuery({ queryKey: ['hiu-options'], queryFn: api.getOptions, staleTime: Infinity });
}

export function useHiuReadiness() {
  return useQuery({ queryKey: ['hiu-readiness'], queryFn: api.getReadiness });
}

export function useConsentRequests(filter) {
  return useQuery({
    queryKey: ['hiu-requests', filter],
    queryFn: () => api.listConsentRequests(filter),
    refetchInterval: (query) => {
      const items = query.state.data?.items || [];
      return items.some((item) => PENDING.has(item.status)) ? 5000 : false;
    },
  });
}

function transferPending(detail) {
  return (detail?.artefacts || []).some((artefact) => (
    artefact.status === 'GRANTED' && (!artefact.fetchedAt
      || artefact.informationRequests.some((hir) => ['REQUESTED', 'ACKNOWLEDGED', 'PARTIAL'].includes(hir.status)))
  ));
}

export function useConsentRequest(id) {
  return useQuery({
    queryKey: ['hiu-request', id],
    queryFn: () => api.getConsentRequest(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const detail = query.state.data;
      return detail && (PENDING.has(detail.status) || transferPending(detail)) ? 5000 : false;
    },
  });
}

export function useArtefactRecords(id, enabled) {
  return useQuery({
    queryKey: ['hiu-records', id],
    queryFn: () => api.getArtefactRecords(id),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export function useHiuAction(requestId) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hiu-request', requestId] });
    queryClient.invalidateQueries({ queryKey: ['hiu-requests'] });
    queryClient.invalidateQueries({ queryKey: ['hiu-records'] });
  };
  return {
    status: useMutation({ mutationFn: () => api.refreshStatus(requestId), onSuccess: invalidate }),
    fetch: useMutation({ mutationFn: (artefactId) => api.fetchArtefact(artefactId), onSuccess: invalidate }),
    request: useMutation({
      mutationFn: ({ artefactId, key }) => api.requestHealthInformation(artefactId, {}, key),
      onSuccess: invalidate,
    }),
  };
}

export function useCreateConsentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }) => api.createConsentRequest(body, key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hiu-requests'] }),
  });
}
