import prisma from '../../shared/prisma.js';

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

export function listCareContexts(patientId) {
  return prisma.careContext.findMany({
    where: { patientId },
    include: { healthRecord: true, encounter: true },
    orderBy: { createdAt: 'desc' },
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
  return prisma.patient.findFirst({
    where: { abhaIdentity: { abhaAddress } },
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

export function findConsentByExternalId(externalArtefactId) {
  return prisma.consentArtefact.findUnique({
    where: { role_externalArtefactId: { role: 'HIP', externalArtefactId } },
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

export function listExchanges(facilityId) {
  return prisma.aBDMTransaction.findMany({
    where: { milestone: 'M2' },
    orderBy: { createdAt: 'desc' },
    take: 50,
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
