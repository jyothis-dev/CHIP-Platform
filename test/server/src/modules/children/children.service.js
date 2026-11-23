import { AppError } from '../../shared/errors.js';
import prisma from '../../shared/prisma.js';
import * as audit from '../audit/audit.service.js';
import { enqueueMessages, messagesForContact } from '../notifications/notifications.service.js';

function childDto(child) {
  return {
    id: child.id,
    hospitalId: child.hospitalId,
    departmentId: child.departmentId,
    firstName: child.firstName,
    lastName: child.lastName,
    dateOfBirth: child.dateOfBirth,
    sex: child.sex,
    mrn: child.mrn,
    createdAt: child.createdAt,
    guardians: child.guardians ?? [],
  };
}

async function findChild(auth, childId) {
  const child = await prisma.child.findFirst({
    where: { id: childId, hospitalId: auth.hospitalId },
    include: { guardians: { orderBy: { createdAt: 'asc' } } },
  });
  if (!child) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
  return child;
}

export async function listChildren(auth) {
  const children = await prisma.child.findMany({
    where: { hospitalId: auth.hospitalId },
    include: { guardians: { where: { isPrimary: true }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  });
  return children.map(childDto);
}

export async function getChild(auth, childId) {
  return childDto(await findChild(auth, childId));
}

export async function createChild(auth, input, ctx) {
  if (input.departmentId) {
    const department = await prisma.department.findFirst({
      where: { id: input.departmentId, hospitalId: auth.hospitalId },
    });
    if (!department) {
      throw new AppError(400, 'DEPARTMENT_NOT_FOUND', 'Department not found in this hospital');
    }
  }

  const duplicate = await prisma.child.findUnique({
    where: { hospitalId_mrn: { hospitalId: auth.hospitalId, mrn: input.mrn.trim() } },
  });
  if (duplicate) throw new AppError(409, 'CHILD_DUPLICATE', 'A child with this MRN already exists');

  let child;
  try {
    child = await prisma.$transaction(async (tx) => {
      const created = await tx.child.create({
        data: {
          hospitalId: auth.hospitalId,
          departmentId: input.departmentId,
          registeredById: auth.userId,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
          sex: input.sex,
          mrn: input.mrn.trim(),
        },
      });
      let guardian = null;
      if (input.guardian) {
        guardian = await tx.guardian.create({
          data: {
            childId: created.id,
            name: input.guardian.name.trim(),
            relationship: input.guardian.relationship.trim(),
            phone: input.guardian.phone,
            email: input.guardian.email?.toLowerCase(),
            isPrimary: input.guardian.isPrimary ?? true,
          },
        });
        await enqueueMessages(
          tx,
          messagesForContact(guardian, `${created.firstName} was registered for vaccination follow-up.`),
        );
      }
      return { ...created, guardians: guardian ? [guardian] : [] };
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new AppError(409, 'CHILD_DUPLICATE', 'A child with this MRN already exists');
    }
    throw err;
  }

  await audit.log({
    actorId: auth.userId,
    hospitalId: auth.hospitalId,
    action: 'child.registered',
    entityType: 'child',
    entityId: child.id,
    outcome: 'success',
    requestId: ctx.requestId,
    ip: ctx.ip,
  });
  if (input.guardian) {
    await audit.log({
      actorId: auth.userId,
      hospitalId: auth.hospitalId,
      action: 'guardian.associated',
      entityType: 'guardian',
      entityId: child.guardians[0].id,
      outcome: 'success',
      requestId: ctx.requestId,
      ip: ctx.ip,
    });
  }
  return childDto(child);
}

export async function addGuardian(auth, childId, input, ctx) {
  await findChild(auth, childId);
  const guardian = await prisma.$transaction(async (tx) => {
    if (input.isPrimary ?? true) {
      await tx.guardian.updateMany({ where: { childId }, data: { isPrimary: false } });
    }
    const created = await tx.guardian.create({
      data: {
        childId,
        name: input.name.trim(),
        relationship: input.relationship.trim(),
        phone: input.phone,
        email: input.email?.toLowerCase(),
        isPrimary: input.isPrimary ?? true,
      },
    });
    const child = await tx.child.findUnique({ where: { id: childId } });
    await enqueueMessages(
      tx,
      messagesForContact(created, `${child.firstName} now lists you as a parent or guardian.`),
    );
    return created;
  });

  await audit.log({
    actorId: auth.userId,
    hospitalId: auth.hospitalId,
    action: 'guardian.associated',
    entityType: 'guardian',
    entityId: guardian.id,
    outcome: 'success',
    requestId: ctx.requestId,
    ip: ctx.ip,
  });
  return guardian;
}

export async function listGuardians(auth, childId) {
  const child = await findChild(auth, childId);
  return child.guardians;
}
