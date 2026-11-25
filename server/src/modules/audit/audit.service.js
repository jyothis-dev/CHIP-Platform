import prisma from '../../shared/prisma.js';
import { pageBody, pageSlice } from '../../shared/pagination.js';

export async function listAuditLogs({
  facilityId,
  action,
  resourceType,
  resourceId,
  actorId,
  outcome,
  from,
  to,
  page = 1,
  pageSize = 20,
}) {
  const where = {
    facilityId,
    ...(action ? { action } : {}),
    ...(resourceType ? { resourceType } : {}),
    ...(resourceId ? { resourceId } : {}),
    ...(actorId ? { actorId } : {}),
    ...(outcome ? { outcome } : {}),
    ...((from || to)
      ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...pageSlice(page, pageSize),
    }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    facilityId: row.facilityId,
    outcome: row.outcome,
    message: row.message,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
    actor: row.actor
      ? {
        id: row.actor.id,
        name: row.actor.name,
        role: row.actor.role,
      }
      : null,
  }));

  return pageBody(items, page, pageSize, total);
}
