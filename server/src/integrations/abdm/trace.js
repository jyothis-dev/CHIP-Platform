import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import prisma from '../../shared/prisma.js';
import { pageBody, pageSlice } from '../../shared/pagination.js';
import { redactDeep } from '../../shared/redact.js';

function jsonBody(value) {
  if (value == null) return null;
  if (typeof value === 'string') return { text: value.slice(0, 4000) };
  if (Buffer.isBuffer(value) || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return { omitted: 'binary response', byteLength: value.byteLength ?? value.length ?? null };
  }
  return redactDeep(value);
}

export async function recordAbdmTrace(entry) {
  if (!env.abdmTraceEnabled) return;
  try {
    await prisma.abdmTrace.create({
      data: {
        method: entry.method,
        path: entry.path,
        requestId: entry.requestId,
        status: entry.status ?? null,
        latencyMs: entry.latencyMs ?? null,
        requestBody: jsonBody(entry.requestBody),
        responseBody: jsonBody(entry.responseBody),
        errorMessage: entry.errorMessage ? String(entry.errorMessage).slice(0, 500) : null,
      },
    });
  } catch (err) {
    logger.error({ err, component: 'abdm.trace' }, 'abdm trace failed');
  }
}

export async function listAbdmTraces({ page = 1, pageSize = 20 } = {}) {
  if (!env.abdmTraceEnabled) {
    throw new AppError(404, 'TRACE_DISABLED', 'ABHA traffic tracing is off');
  }
  const [total, items] = await Promise.all([
    prisma.abdmTrace.count(),
    prisma.abdmTrace.findMany({
      orderBy: { createdAt: 'desc' },
      ...pageSlice(page, pageSize),
    }),
  ]);
  return pageBody(items, page, pageSize, total);
}
