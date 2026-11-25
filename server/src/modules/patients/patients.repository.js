import prisma from '../../shared/prisma.js';

const managedBySelect = {
  id: true,
  name: true,
  role: true,
};

const patientInclude = {
  registeredBy: { select: managedBySelect },
  abhaIdentity: {
    select: {
      verificationStatus: true,
      abhaNumberMasked: true,
      abhaAddress: true,
      verifiedAt: true,
    },
  },
};

export async function listPatients({ facilityId, q, take = 100 }) {
  return prisma.patient.findMany({
    where: {
      facilityId,
      ...(q
        ? { name: { contains: q, mode: 'insensitive' } }
        : {}),
    },
    include: patientInclude,
    orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
    take,
  });
}

export async function findPatientById(id) {
  return prisma.patient.findUnique({
    where: { id },
    include: patientInclude,
  });
}

export async function createPatient(data) {
  return prisma.patient.create({
    data,
    include: patientInclude,
  });
}

export async function findUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: managedBySelect,
  });
}
