import prisma from '../../shared/prisma.js';
import { pageSlice } from '../../shared/pagination.js';

export function createTransaction(data) {
  return prisma.aBDMTransaction.create({ data });
}

export function updateTransaction(id, data) {
  return prisma.aBDMTransaction.update({ where: { id }, data });
}

export function findTransactionByRequestId(requestId) {
  return prisma.aBDMTransaction.findUnique({ where: { requestId } });
}

export function findTransactionByExternalId(externalTxnId) {
  return prisma.aBDMTransaction.findFirst({
    where: { externalTxnId },
    orderBy: { createdAt: 'desc' },
  });
}

export function findValidLinkToken(patientId, hipId, abhaAddress, now) {
  return prisma.linkToken.findFirst({
    where: {
      patientId,
      hipId,
      abhaAddress,
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: 'desc' },
  });
}

export function createLinkToken(data) {
  return prisma.linkToken.create({ data });
}

export function createEncounter(data) {
  return prisma.encounter.create({ data });
}

export function createHealthRecord(data) {
  return prisma.healthRecord.create({ data });
}

export function createCareContext(data) {
  return prisma.careContext.create({ data });
}

export function updateCareContext(id, data) {
  return prisma.careContext.update({ where: { id }, data });
}

export function countCareContexts(patientId) {
  return prisma.careContext.count({ where: { patientId } });
}

export function countDocuments(patientId) {
  return prisma.careContext.count({
    where: { patientId, healthRecordId: { not: null } },
  });
}

export function countNotFindable(patientId) {
  return prisma.careContext.count({
    where: {
      patientId,
      linkStatus: { not: 'LINKED' },
      healthRecord: { validationStatus: 'VALID' },
    },
  });
}

export function listCareContexts(patientId) {
  return prisma.careContext.findMany({
    where: { patientId },
    include: { healthRecord: true, encounter: true, transaction: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function listCareContextPage(patientId, page = 1, pageSize = 20) {
  return prisma.careContext.findMany({
    where: { patientId },
    include: { healthRecord: true, encounter: true, transaction: true },
    orderBy: { createdAt: 'desc' },
    ...pageSlice(page, pageSize),
  });
}

export function findCareContextInFacility(id, facilityId) {
  return prisma.careContext.findFirst({
    where: { id, facilityId },
    include: { healthRecord: true, transaction: true },
  });
}

export function findCareContextByReferenceLoose(referenceNumber) {
  return prisma.careContext.findFirst({
    where: { referenceNumber },
    include: { healthRecord: true },
  });
}

export function findCareContextByReference(facilityId, referenceNumber) {
  return prisma.careContext.findUnique({
    where: { facilityId_referenceNumber: { facilityId, referenceNumber } },
    include: { healthRecord: true, patient: true },
  });
}

export function listUnlinkedForPatient(patientId) {
  return prisma.careContext.findMany({
    where: { patientId, linkStatus: { in: ['NOT_LINKED', 'LINK_REQUESTED'] } },
    include: { healthRecord: true },
  });
}

export function findPatientsByMobileHash(mobileHash) {
  return prisma.patient.findMany({
    where: { mobileHash },
    include: { abhaIdentity: true, careContexts: { include: { healthRecord: true } } },
  });
}

export function findPatientByAbhaAddress(abhaAddress) {
  // Older rows hold the bare local part; newer ones the full address.
  const at = String(abhaAddress || '').lastIndexOf('@');
  const forms = at > 0 ? [abhaAddress, abhaAddress.slice(0, at)] : [abhaAddress];
  return prisma.patient.findFirst({
    where: { abhaIdentity: { abhaAddress: { in: forms } } },
    include: { abhaIdentity: true, careContexts: { include: { healthRecord: true } } },
  });
}

export function createCallback(data) {
  return prisma.callbackEvent.create({ data });
}

export function updateCallback(id, data) {
  return prisma.callbackEvent.update({ where: { id }, data });
}

export function createConsentArtefact(data) {
  return prisma.consentArtefact.create({ data });
}

export function findConsentByExternalId(externalArtefactId, role = 'HIP') {
  return prisma.consentArtefact.findUnique({
    where: { role_externalArtefactId: { role, externalArtefactId } },
  });
}

export function updateConsent(id, data) {
  return prisma.consentArtefact.update({ where: { id }, data });
}

export function createInformationRequest(data) {
  return prisma.healthInformationRequest.create({ data });
}

export function createTransfer(data) {
  return prisma.dataTransfer.create({ data });
}

export function countExchanges() {
  return prisma.aBDMTransaction.count({ where: { milestone: 'M2' } });
}

export function listExchanges(facilityId, page = 1, pageSize = 20) {
  return prisma.aBDMTransaction.findMany({
    where: { milestone: 'M2' },
    orderBy: { createdAt: 'desc' },
    ...pageSlice(page, pageSize),
    include: {
      callbackEvents: { orderBy: { receivedAt: 'asc' } },
      careContexts: { where: { facilityId } },
    },
  });
}

export function countVisits(patientId) {
  return prisma.encounter.count({ where: { patientId } });
}

export function findFacility(id) {
  return prisma.facility.findUnique({ where: { id } });
}
