import prisma from '../../shared/prisma.js';
import { logger } from '../../shared/logger.js';

export async function log(entry) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        hospitalId: entry.hospitalId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        outcome: entry.outcome,
        requestId: entry.requestId ?? null,
        ip: entry.ip ?? null,
        method: entry.method ?? null,
        path: entry.path ?? null,
        statusCode: entry.statusCode ?? null,
        durationMs: entry.durationMs ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, component: 'audit', requestId: entry.requestId }, 'audit log failed');
  }
}

export async function listForHospital(hospitalId) {
  return prisma.auditLog.findMany({
    where: { hospitalId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
