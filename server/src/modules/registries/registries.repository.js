import prisma from '../../shared/prisma.js';

export function createTransaction(data) {
  return prisma.aBDMTransaction.create({ data });
}

export function findFacility(id) {
  return prisma.facility.findUnique({ where: { id } });
}

export function updateFacility(id, data) {
  return prisma.facility.update({ where: { id }, data });
}

export function findPractitioner(id) {
  return prisma.practitioner.findUnique({ where: { id } });
}

export function updatePractitioner(id, data) {
  return prisma.practitioner.update({ where: { id }, data });
}
