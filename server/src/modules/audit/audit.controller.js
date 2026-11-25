import * as auditService from './audit.service.js';

export async function list(req, res) {
  const query = req.validated.query || {};
  const data = await auditService.listAuditLogs({
    facilityId: req.auth.facilityId,
    action: query.action,
    resourceType: query.resourceType,
    resourceId: query.resourceId,
    actorId: query.actorId,
    outcome: query.outcome,
    from: query.from,
    to: query.to,
    limit: query.limit,
  });
  res.status(200).json({ success: true, data });
}
