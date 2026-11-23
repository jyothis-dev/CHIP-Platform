import { AppError } from '../../shared/errors.js';
import prisma from '../../shared/prisma.js';
import * as audit from '../audit/audit.service.js';
import { enqueueMessages, messagesForContact } from '../notifications/notifications.service.js';
import { calculateNextDue } from './schedule.js';

async function findChild(auth, childId) {
  const child = await prisma.child.findFirst({
    where: { id: childId, hospitalId: auth.hospitalId },
    include: { guardians: true },
  });
  if (!child) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
  return child;
}

function primaryGuardian(child) {
  return child.guardians.find((guardian) => guardian.isPrimary) ?? child.guardians[0] ?? null;
}

export async function listHistory(auth, childId) {
  await findChild(auth, childId);
  const records = await prisma.vaccinationRecord.findMany({
    where: { childId },
    orderBy: { administeredAt: 'asc' },
  });
  const schedule = await prisma.vaccineSchedule.findMany();
  const names = new Map(schedule.map((item) => [`${item.vaccineCode}:${item.doseNumber}`, item.vaccineName]));
  return records.map((record) => ({
    id: record.id,
    vaccineCode: record.vaccineCode,
    vaccineName: names.get(`${record.vaccineCode}:${record.doseNumber}`) ?? record.vaccineCode,
    doseNumber: record.doseNumber,
    administeredAt: record.administeredAt,
    batchNumber: record.batchNumber,
    notes: record.notes,
  }));
}

export async function nextDue(auth, childId, today = new Date()) {
  const child = await findChild(auth, childId);
  const [schedule, records] = await Promise.all([
    prisma.vaccineSchedule.findMany(),
    prisma.vaccinationRecord.findMany({ where: { childId } }),
  ]);
  return calculateNextDue(schedule, records, child.dateOfBirth, today);
}

export async function recordDose(auth, childId, input, ctx) {
  const child = await findChild(auth, childId);
  const vaccineCode = input.vaccineCode.trim().toUpperCase();
  const schedule = await prisma.vaccineSchedule.findUnique({
    where: { vaccineCode_doseNumber: { vaccineCode, doseNumber: input.doseNumber } },
  });
  if (!schedule) throw new AppError(400, 'UNKNOWN_VACCINE', 'That dose is not on the schedule');

  const existing = await prisma.vaccinationRecord.findUnique({
    where: {
      childId_vaccineCode_doseNumber: { childId, vaccineCode, doseNumber: input.doseNumber },
    },
  });
  if (existing) {
    throw new AppError(409, 'VACCINATION_DUPLICATE', 'This vaccination dose is already recorded');
  }

  const administeredAt = input.administeredAt ? new Date(input.administeredAt) : new Date();
  if (Number.isNaN(administeredAt.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'administeredAt is not a valid date');
  }
  if (administeredAt > new Date()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A dose cannot be recorded in the future');
  }
  if (administeredAt < new Date(child.dateOfBirth)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A dose cannot be recorded before the date of birth');
  }

  let record;
  try {
    record = await prisma.$transaction(async (tx) => {
      const created = await tx.vaccinationRecord.create({
        data: {
          childId,
          vaccineCode,
          doseNumber: input.doseNumber,
          administeredAt,
          administeredById: auth.userId,
          batchNumber: input.batchNumber,
          notes: input.notes,
        },
      });
      const records = await tx.vaccinationRecord.findMany({ where: { childId } });
      const fullSchedule = await tx.vaccineSchedule.findMany();
      const upcoming = calculateNextDue(fullSchedule, records, child.dateOfBirth, administeredAt);
      const nextText = upcoming
        ? ` Next due: ${upcoming.vaccineName} dose ${upcoming.doseNumber} on ${upcoming.dueDate}.`
        : ' The schedule is complete.';
      await enqueueMessages(
        tx,
        messagesForContact(
          primaryGuardian(child),
          `${schedule.vaccineName} dose ${input.doseNumber} was recorded for ${child.firstName}.${nextText}`,
        ),
      );
      return created;
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new AppError(409, 'VACCINATION_DUPLICATE', 'This vaccination dose is already recorded');
    }
    throw err;
  }

  await audit.log({
    actorId: auth.userId,
    hospitalId: auth.hospitalId,
    action: 'vaccination.recorded',
    entityType: 'vaccination',
    entityId: record.id,
    outcome: 'success',
    requestId: ctx.requestId,
    ip: ctx.ip,
  });

  return {
    id: record.id,
    vaccineCode: record.vaccineCode,
    vaccineName: schedule.vaccineName,
    doseNumber: record.doseNumber,
    administeredAt: record.administeredAt,
    batchNumber: record.batchNumber,
    notes: record.notes,
  };
}
