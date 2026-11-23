import { jest } from '@jest/globals';

function model() {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  };
}

export const prismaMock = {
  hospital: model(),
  department: model(),
  permission: model(),
  role: model(),
  rolePermission: model(),
  user: model(),
  profile: model(),
  membership: model(),
  refreshToken: model(),
  child: model(),
  guardian: model(),
  vaccineSchedule: model(),
  vaccinationRecord: model(),
  auditLog: model(),
  notificationJob: model(),
  $transaction: jest.fn(async (arg) => (typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg))),
};

export function resetPrisma() {
  for (const value of Object.values(prismaMock)) {
    if (typeof value === 'function' && value.mockReset) {
      value.mockReset();
      continue;
    }
    for (const method of Object.values(value)) {
      method.mockReset();
    }
  }
  prismaMock.$transaction.mockImplementation(async (arg) => (
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)
  ));
  prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  prismaMock.notificationJob.createMany.mockResolvedValue({ count: 1 });
}
