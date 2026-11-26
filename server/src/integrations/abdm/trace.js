import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import prisma from '../../shared/prisma.js';
import { pageBody, pageSlice } from '../../shared/pagination.js';
import { redactDeep } from '../../shared/redact.js';

const MESSAGE_LIMIT = 400;

function textOf(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function errorText(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const code = textOf(value.code);
  const message = textOf(value.message);
  if (code && message) return `${code}: ${message}`;
  return message || code;
}

function serviceLabel(service) {
  if (!service || typeof service !== 'object') return '';
  const id = textOf(service.id);
  const types = service.types || service.type;
  const list = Array.isArray(types) ? types : (types ? [types] : []);
  const typeText = list.map((item) => textOf(item)).filter(Boolean).join(', ');
  if (id && typeText) return `${id} (${typeText})`;
  return id || typeText;
}

function summarize(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => errorText(item) || summarize(item)).filter(Boolean).join('; ');
  }
  const direct = errorText(value) || errorText(value.error);
  if (direct) return direct;
  if (value.bridge || Array.isArray(value.services) || value.url) {
    const bridge = value.bridge && typeof value.bridge === 'object' ? value.bridge : {};
    const url = textOf(bridge.url) || textOf(value.url);
    const parts = [];
    if (url) parts.push(`url ${url}`);
    if (bridge.active === true) parts.push('bridge active');
    if (bridge.active === false) parts.push('bridge inactive');
    const services = Array.isArray(value.services) ? value.services : [];
    const labels = services.map(serviceLabel).filter(Boolean);
    parts.push(labels.length ? `services ${labels.join(', ')}` : 'services empty');
    return parts.join('. ');
  }
  if (Object.keys(value).length === 1 && Object.prototype.hasOwnProperty.call(value, 'text')) {
    return textOf(value.text);
  }
  const compact = JSON.stringify(value);
  return compact === '{}' ? '' : compact;
}

export function responseText(responseBody, errorMessage) {
  const failure = textOf(errorMessage);
  if (failure) return failure.slice(0, MESSAGE_LIMIT);
  return summarize(responseBody).slice(0, MESSAGE_LIMIT);
}

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
  return pageBody(items.map((item) => ({
    ...item,
    message: responseText(item.responseBody, item.errorMessage) || null,
  })), page, pageSize, total);
}
