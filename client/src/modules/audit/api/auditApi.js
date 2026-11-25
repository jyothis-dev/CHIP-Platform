import { http } from '@/shared/api/http.js';

export function listAudit(filters = {}) {
  const params = {
    limit: filters.limit ?? 100,
  };
  if (filters.action) params.action = filters.action;
  if (filters.resourceType) params.resourceType = filters.resourceType;
  if (filters.outcome) params.outcome = filters.outcome;
  if (filters.resourceId) params.resourceId = filters.resourceId;
  if (filters.actorId) params.actorId = filters.actorId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  return http.get('/audit', { params });
}
