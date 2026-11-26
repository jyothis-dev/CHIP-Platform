import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';
import * as repo from './hiu.repository.js';
import { endArtefact, moveRequest, pollStatus } from './consent.js';

/**
 * Two timed jobs, each idempotent:
 * 1. Requests still REQUESTED past their expiry: ask ABDM for the status once a
 *    minute, so EXPIRED arrives without anyone clicking (HIU_FLOW_301).
 * 2. Granted artefacts past dataEraseAt: mark EXPIRED and purge their records.
 * Expired private keys are wiped as well.
 */
export async function runSweep(now = new Date()) {
  const summary = { polled: 0, expired: 0, keysWiped: 0 };
  if (env.abdmHiuId) {
    const stale = new Date(now.getTime() - 60_000);
    for (const request of await repo.listRequestsToPoll(now, stale)) {
      try {
        await pollStatus(request);
        summary.polled += 1;
      } catch (err) {
        logger.warn({ component: 'hiu.sweeper', code: err.code }, 'status poll failed');
      }
    }
  }
  for (const artefact of await repo.listExpiredArtefacts(now)) {
    try {
      await endArtefact(artefact, 'EXPIRED', now);
      summary.expired += 1;
      if (artefact.consentRequestId) {
        const siblings = await repo.listArtefactsForRequest(artefact.consentRequestId);
        if (!siblings.some((item) => item.status === 'GRANTED')) {
          const request = await repo.findConsentRequest(artefact.consentRequestId);
          await moveRequest(request, 'EXPIRED', {}, now);
        }
      }
    } catch (err) {
      logger.warn({ component: 'hiu.sweeper', code: err.code }, 'artefact expiry failed');
    }
  }
  const wiped = await repo.wipeExpiredKeys(now);
  summary.keysWiped = wiped?.count ?? 0;
  return summary;
}

let timer = null;

export function startSweeper(intervalMs = 60_000) {
  if (timer || !env.hiuSweeperEnabled) return null;
  timer = setInterval(() => {
    runSweep().catch((err) => logger.error({ component: 'hiu.sweeper', err }, 'sweep failed'));
  }, intervalMs);
  timer.unref?.();
  return timer;
}

export function stopSweeper() {
  if (timer) clearInterval(timer);
  timer = null;
}
