import prisma from './prisma.js';
import { logger } from './logger.js';

export async function logAudit(entry) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        resourceType: entry.resourceType ?? null,
        resourceId: entry.resourceId ?? null,
        facilityId: entry.facilityId ?? null,
        outcome: entry.outcome,
        message: entry.message,
        correlationId: entry.correlationId ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, component: 'audit', correlationId: entry.correlationId }, 'audit log failed');
  }
}
