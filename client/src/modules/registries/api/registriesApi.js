import { http } from '@/shared/api/http.js';

export function getOptions() {
  return http.get('/registries/options');
}

export function getReadiness() {
  return http.get('/registries/readiness');
}

export function getOwnFacility() {
  return http.get('/registries/facility');
}

export function getMasters(kind, parentCode) {
  return http.get(`/registries/hfr/masters/${kind}`, { params: parentCode ? { parentCode } : {} });
}

export function searchFacilities(body) {
  return http.post('/registries/hfr/search', body);
}

export function hprExists(hprId) {
  return http.get(`/registries/hpr/exists/${encodeURIComponent(hprId)}`);
}

export function hprSearchById(hprId) {
  return http.get(`/registries/hpr/${encodeURIComponent(hprId)}`);
}

export function hprSearchByMobile(mobile) {
  return http.post('/registries/hpr/search-by-mobile', { mobile });
}

export function professionalInfo(practitioner) {
  return http.post('/registries/hpr/professional-info', { practitioner });
}

export function attachFacilityHfr(facilityId, hfrId) {
  return http.post(`/registries/facilities/${facilityId}/hfr-link`, { hfrId });
}

export function getBridgeStatus(facilityId) {
  return http.get(`/registries/facilities/${facilityId}/bridge-status`);
}

export function linkBridge(facilityId, body) {
  return http.post(`/registries/facilities/${facilityId}/bridge-link`, body);
}
