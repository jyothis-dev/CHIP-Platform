import { createHash } from 'node:crypto';
import prisma from '../../shared/prisma.js';
import { AppError } from '../../shared/errors.js';

export function bodyHash(body) {
  return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
}

export async function findPatientInFacility(patientId, facilityId) {
  return prisma.patient.findFirst({
    where: { id: patientId, facilityId },
  });
}

export async function findPatientById(patientId) {
  return prisma.patient.findUnique({ where: { id: patientId } });
}

export async function createTransaction(data) {
  return prisma.aBDMTransaction.create({ data });
}

export async function updateTransaction(id, data) {
  return prisma.aBDMTransaction.update({ where: { id }, data });
}

export async function findTransaction(id) {
  return prisma.aBDMTransaction.findUnique({ where: { id } });
}

export async function upsertAbhaIdentity(data) {
  return prisma.aBHAIdentity.upsert({
    where: { patientId: data.patientId },
    create: data,
    update: {
      abhaNumberEnc: data.abhaNumberEnc,
      encKeyVersion: data.encKeyVersion,
      abhaNumberHash: data.abhaNumberHash,
      hashKeyVersion: data.hashKeyVersion,
      abhaNumberMasked: data.abhaNumberMasked,
      abhaAddress: data.abhaAddress,
      verificationStatus: data.verificationStatus,
      verifiedAt: data.verifiedAt,
    },
  });
}

export async function findAbhaIdentity(patientId) {
  return prisma.aBHAIdentity.findUnique({ where: { patientId } });
}

export async function updateAbhaAddress(patientId, { abhaAddress, abhaNumberMasked }) {
  return prisma.aBHAIdentity.update({
    where: { patientId },
    data: {
      abhaAddress,
      ...(abhaNumberMasked ? { abhaNumberMasked } : {}),
    },
  });
}

export async function findIdempotency({ key, userId, route }) {
  return prisma.idempotencyKey.findUnique({
    where: { key_userId_route: { key, userId, route } },
  });
}

export async function saveIdempotency({ key, userId, route, requestBodyHash, responseRef }) {
  return prisma.idempotencyKey.create({
    data: {
      key,
      userId,
      route,
      requestBodyHash,
      responseRef,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

export async function assertIdempotency({ key, userId, route, body }) {
  if (!key) return null;
  const hash = bodyHash(body);
  const existing = await findIdempotency({ key, userId, route });
  if (!existing) {
    return { hash, existing: null };
  }
  if (existing.requestBodyHash !== hash) {
    throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key was reused with a different body');
  }
  return { hash, existing };
}
