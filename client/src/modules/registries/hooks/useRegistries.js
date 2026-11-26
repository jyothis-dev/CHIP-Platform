import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/registriesApi.js';

export function useRegistryOptions() {
  return useQuery({ queryKey: ['registry-options'], queryFn: api.getOptions, staleTime: Infinity });
}

export function useRegistryReadiness() {
  return useQuery({ queryKey: ['registry-readiness'], queryFn: api.getReadiness, retry: false });
}

export function useOwnFacility() {
  return useQuery({ queryKey: ['registry-facility'], queryFn: api.getOwnFacility, retry: false });
}

/** LGD master data. Districts and sub-districts wait for their parent code. */
export function useMasters(kind, parentCode) {
  const needsParent = kind !== 'states';
  return useQuery({
    queryKey: ['registry-masters', kind, parentCode || null],
    queryFn: () => api.getMasters(kind, parentCode),
    enabled: !needsParent || Boolean(parentCode),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useFacilitySearch() {
  return useMutation({ mutationFn: api.searchFacilities });
}

export function useAttachFacilityHfr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ facilityId, hfrId }) => api.attachFacilityHfr(facilityId, hfrId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry-facility'] });
      queryClient.invalidateQueries({ queryKey: ['registry-readiness'] });
    },
  });
}

export function useHprLookup() {
  return {
    exists: useMutation({ mutationFn: api.hprExists }),
    byId: useMutation({ mutationFn: api.hprSearchById }),
    byMobile: useMutation({ mutationFn: api.hprSearchByMobile }),
    info: useMutation({ mutationFn: api.professionalInfo }),
  };
}

export function useBridgeStatus(facilityId) {
  return useQuery({
    queryKey: ['registry-bridge-status', facilityId],
    queryFn: () => api.getBridgeStatus(facilityId),
    enabled: Boolean(facilityId),
    retry: false,
  });
}

export function useLinkBridge(facilityId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.linkBridge(facilityId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry-bridge-status', facilityId] });
      queryClient.invalidateQueries({ queryKey: ['registry-facility'] });
      queryClient.invalidateQueries({ queryKey: ['registry-readiness'] });
    },
  });
}
