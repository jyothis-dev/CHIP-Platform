import prisma from '../../shared/prisma.js';
import { pageSlice } from '../../shared/pagination.js';

export function findPatient(id) {
  return prisma.patient.findUnique({ where: { id }, include: { abhaIdentity: true } });
}

export function findFacility(id) {
  return prisma.facility.findUnique({ where: { id } });
}

export function createConsentRequest(data) {
  return prisma.consentRequest.create({ data });
}

export function updateConsentRequest(id, data) {
  return prisma.consentRequest.update({ where: { id }, data });
}

export function findConsentRequest(id) {
  return prisma.consentRequest.findUnique({
    where: { id },
    include: {
      patient: { include: { abhaIdentity: true } },
      transaction: true,
      artefacts: {
        where: { role: 'HIU' },
        orderBy: { createdAt: 'asc' },
        include: {
          informationRequests: {
            orderBy: { createdAt: 'desc' },
            include: { dataTransfers: { orderBy: { createdAt: 'asc' } } },
          },
        },
      },
    },
  });
}

export function findConsentRequestByTransaction(transactionId) {
  return prisma.consentRequest.findFirst({ where: { transactionId } });
}

export function findConsentRequestByExternalId(externalConsentRequestId) {
  return prisma.consentRequest.findUnique({ where: { externalConsentRequestId } });
}

function listWhere({ facilityId, patientId, status }) {
  return {
    ...(facilityId ? { facilityId } : {}),
    ...(patientId ? { patientId } : {}),
    ...(status ? { status } : {}),
  };
}

export function countConsentRequests(filter) {
  return prisma.consentRequest.count({ where: listWhere(filter) });
}

export function listConsentRequests(filter, page, pageSize) {
  return prisma.consentRequest.findMany({
    where: listWhere(filter),
    orderBy: { createdAt: 'desc' },
    include: {
      patient: { include: { abhaIdentity: true } },
      artefacts: { where: { role: 'HIU' }, select: { id: true, status: true } },
    },
    ...pageSlice(page, pageSize),
  });
}

export function listRequestsToPoll(now, staleBefore) {
  return prisma.consentRequest.findMany({
    where: { status: 'REQUESTED', expiresAt: { lte: now }, updatedAt: { lt: staleBefore } },
    take: 20,
  });
}

export function findArtefact(id) {
  return prisma.consentArtefact.findUnique({
    where: { id },
    include: { consentRequest: true },
  });
}

export function findArtefactByExternalId(externalArtefactId) {
  return prisma.consentArtefact.findUnique({
    where: { role_externalArtefactId: { role: 'HIU', externalArtefactId } },
  });
}

export function findArtefactByFetchRequestId(lastFetchRequestId) {
  return prisma.consentArtefact.findFirst({ where: { role: 'HIU', lastFetchRequestId } });
}

export function upsertArtefact(externalArtefactId, create, update) {
  return prisma.consentArtefact.upsert({
    where: { role_externalArtefactId: { role: 'HIU', externalArtefactId } },
    create: { role: 'HIU', externalArtefactId, ...create },
    update,
  });
}

export function updateArtefact(id, data) {
  return prisma.consentArtefact.update({ where: { id }, data });
}

export function listArtefactsForRequest(consentRequestId) {
  return prisma.consentArtefact.findMany({ where: { role: 'HIU', consentRequestId } });
}

export function listExpiredArtefacts(now) {
  return prisma.consentArtefact.findMany({
    where: { role: 'HIU', status: 'GRANTED', expiresAt: { lte: now } },
    take: 50,
  });
}

export function createInformationRequest(data) {
  return prisma.healthInformationRequest.create({ data });
}

export function updateInformationRequest(id, data) {
  return prisma.healthInformationRequest.update({ where: { id }, data });
}

export function findInformationRequestByRequestId(requestId) {
  return prisma.healthInformationRequest.findFirst({ where: { role: 'HIU', requestId } });
}

export function findInformationRequestByTransaction(externalTransactionId) {
  return prisma.healthInformationRequest.findFirst({
    where: { role: 'HIU', externalTransactionId },
    include: { consentArtefact: { include: { consentRequest: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export function findInformationRequest(id) {
  return prisma.healthInformationRequest.findUnique({ where: { id } });
}

export function wipeKeysForArtefact(consentArtefactId) {
  return prisma.healthInformationRequest.updateMany({
    where: { role: 'HIU', consentArtefactId, privateKeyEnc: { not: null } },
    data: { privateKeyEnc: null },
  });
}

export function wipeExpiredKeys(now) {
  return prisma.healthInformationRequest.updateMany({
    where: { role: 'HIU', keyExpiresAt: { lte: now }, privateKeyEnc: { not: null } },
    data: { privateKeyEnc: null },
  });
}

export function findTransferPage(healthInformationRequestId, pageNumber) {
  return prisma.dataTransfer.findFirst({
    where: { healthInformationRequestId, pageNumber, direction: 'RECEIVE' },
  });
}

export function createTransfer(data) {
  return prisma.dataTransfer.create({ data });
}

export function listReceivedTransfers(healthInformationRequestId) {
  return prisma.dataTransfer.findMany({
    where: { healthInformationRequestId, direction: 'RECEIVE' },
    orderBy: { createdAt: 'asc' },
  });
}

export function createReceivedRecord(data) {
  return prisma.receivedHealthRecord.create({ data });
}

export function listReceivedRecords(consentArtefactId) {
  return prisma.receivedHealthRecord.findMany({
    where: { consentArtefactId },
    orderBy: { receivedAt: 'desc' },
  });
}

export function purgeRecords(consentArtefactId, reason, now) {
  return prisma.receivedHealthRecord.updateMany({
    where: { consentArtefactId, purgedAt: null },
    data: { bundleEnc: null, purgedAt: now, purgeReason: reason },
  });
}

export function listTransactionsByIds(ids) {
  return prisma.aBDMTransaction.findMany({
    where: { id: { in: ids } },
    include: { callbackEvents: { orderBy: { receivedAt: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
}

export function listM3Transactions(correlationIds) {
  return prisma.aBDMTransaction.findMany({
    where: { milestone: 'M3', correlationId: { in: correlationIds } },
    include: { callbackEvents: { orderBy: { receivedAt: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
}
