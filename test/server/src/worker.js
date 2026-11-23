import prisma from './shared/prisma.js';
import { logger } from './shared/logger.js';
import { adapters } from './modules/notifications/adapters.js';

export async function processPending() {
  const jobs = await prisma.notificationJob.findMany({
    where: { status: 'PENDING' },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
  });

  for (const job of jobs) {
    const claimed = await prisma.notificationJob.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    const adapter = adapters[job.channel];
    try {
      if (!adapter) throw new Error(`Unknown channel ${job.channel}`);
      await adapter(job);
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: { status: 'SENT', sentAt: new Date(), lastError: null },
      });
    } catch (err) {
      logger.error({ err, component: 'worker', jobId: job.id, channel: job.channel }, 'notification failed');
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', lastError: 'Delivery failed' },
      });
    }
  }
}

if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    processPending().catch((err) => {
      logger.error({ err, component: 'worker' }, 'worker tick failed');
    });
  }, 5000).unref?.();

  processPending().catch((err) => {
    logger.error({ err, component: 'worker' }, 'worker tick failed');
  });
}
