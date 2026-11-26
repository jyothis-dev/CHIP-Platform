import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import { redactDeep } from '../../shared/redact.js';
import prisma from '../../shared/prisma.js';

/**
 * Role-neutral ABDM callback inbox (catalogue atom hiecm.concept.callback-authenticity):
 * 1. a bearer token is present, before any work;
 * 2. the facility header names our own service id;
 * 3. an answer callback answers a REQUEST-ID we sent;
 * then the body is stored once per (route, dedupKey) and dispatched.
 *
 * Options:
 * - answerRoutes: Set of routes that answer one of our calls (correlated by response.requestId)
 * - facilityHeaders: header names to read the facility id from, in order
 * - expectedId: our service id; when set, a header naming another facility is refused
 * - requireHeaderOnUnsolicited: unsolicited callbacks must carry the matching header
 * - auditAction, label: audit wording
 * - dispatch(route, req): the handler
 */
export async function acceptAbdmCallback(req, {
  answerRoutes,
  facilityHeaders,
  expectedId,
  requireHeaderOnUnsolicited = true,
  auditAction,
  label,
  mismatchCode,
  mismatchMessage,
  unknownMessage,
  dispatch,
}) {
  const route = req.path;
  const bearer = req.get('authorization') || '';
  if (!bearer.startsWith('Bearer ') || bearer.length < 8) {
    await logAudit({
      action: auditAction,
      resourceType: 'callback',
      outcome: 'denied',
      correlationId: req.id,
      message: 'Callback rejected: bearer token missing.',
    });
    throw new AppError(401, 'CALLBACK_UNAUTHENTICATED', 'Callback bearer token is required');
  }

  const headerId = facilityHeaders.map((name) => req.get(name)).find(Boolean) || '';
  const answersUs = answerRoutes.has(route);
  const mismatch = (headerId && expectedId && headerId !== expectedId)
    || (!answersUs && requireHeaderOnUnsolicited && expectedId && headerId !== expectedId);
  if (mismatch) {
    await logAudit({
      action: auditAction,
      resourceType: 'callback',
      outcome: 'denied',
      correlationId: req.id,
      message: mismatchMessage || `Callback dropped: facility header is not this ${label}.`,
    });
    throw new AppError(401, mismatchCode, 'Callback is for a different facility');
  }

  const inboundRequestId = req.get('request-id') || '';
  const responseRequestId = req.body?.response?.requestId || '';
  const dedupKey = answersUs ? (responseRequestId || inboundRequestId) : (inboundRequestId || responseRequestId);
  if (!dedupKey) {
    throw new AppError(400, 'CALLBACK_REQUEST_ID_MISSING', 'Callback has no request id');
  }

  let transaction = null;
  if (answersUs) {
    transaction = await prisma.aBDMTransaction.findUnique({ where: { requestId: responseRequestId } });
    if (!transaction) {
      await logAudit({
        action: auditAction,
        resourceType: 'callback',
        outcome: 'denied',
        correlationId: req.id,
        message: unknownMessage || `Callback dropped: it does not answer a request this ${label} sent.`,
      });
      throw new AppError(404, 'CALLBACK_UNKNOWN', `Callback does not match a request from this ${label}`);
    }
  }

  let row;
  try {
    row = await prisma.callbackEvent.create({
      data: {
        route,
        dedupKey,
        transactionId: transaction?.id || null,
        processingStatus: 'RECEIVED',
        payloadRedacted: redactDeep(req.body || {}),
      },
    });
  } catch (err) {
    if (err.code === 'P2002') return { duplicate: true };
    throw err;
  }

  try {
    await dispatch(route, req, { transaction, callback: row });
    await prisma.callbackEvent.update({ where: { id: row.id }, data: { processingStatus: 'PROCESSED' } });
  } catch (err) {
    await prisma.callbackEvent.update({ where: { id: row.id }, data: { processingStatus: 'DEAD' } });
    throw err;
  }
  return { duplicate: false };
}
