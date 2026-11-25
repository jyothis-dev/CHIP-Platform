import prisma from '../../shared/prisma.js';

export async function listAuditLogs({
  facilityId,
  action,
  resourceType,
  resourceId,
  actorId,
  outcome,
  from,
  to,
  limit = 50,
}) {
  const rows = await prisma.auditLog.findMany({
    where: {
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
    },
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
    take: limit,
  });

  return rows.map((row) => ({
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
}
