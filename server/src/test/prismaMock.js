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
  user: model(),
  facility: model(),
  patient: model(),
  motherChildRelationship: model(),
  pregnancy: model(),
  encounter: model(),
  aBHAIdentity: model(),
  healthRecord: model(),
  consentRequest: model(),
  aBDMTransaction: model(),
  callbackEvent: model(),
  auditLog: model(),
  $transaction: jest.fn(async (arg) => (typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg))),
  $queryRaw: jest.fn(),
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
}
