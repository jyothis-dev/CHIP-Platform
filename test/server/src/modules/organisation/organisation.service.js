import { AppError } from '../../shared/errors.js';
import prisma from '../../shared/prisma.js';
import bcrypt from 'bcrypt';
import * as audit from '../audit/audit.service.js';

function assertHospital(auth, hospitalId) {
  if (auth.hospitalId !== hospitalId) {
    throw new AppError(403, 'HOSPITAL_FORBIDDEN', 'This hospital is outside your session');
  }
}

function staffDto(membership) {
  return {
    id: membership.user.id,
    email: membership.user.email,
    status: membership.user.status,
    profile: membership.user.profile,
    role: { id: membership.role.id, name: membership.role.name },
    department: membership.department
      ? { id: membership.department.id, name: membership.department.name, code: membership.department.code }
      : null,
  };
}

export async function listHospitals(auth) {
  const memberships = await prisma.membership.findMany({
    where: { userId: auth.userId, status: 'active' },
    include: { hospital: true, role: true },
    orderBy: { hospital: { name: 'asc' } },
  });
  return memberships.map((membership) => ({
    ...membership.hospital,
    role: { id: membership.role.id, name: membership.role.name },
    active: membership.hospitalId === auth.hospitalId,
  }));
}

export async function createHospital(auth, input, ctx) {
  const code = input.code.trim().toUpperCase();
  const existing = await prisma.hospital.findUnique({ where: { code } });
  if (existing) {
    throw new AppError(409, 'HOSPITAL_DUPLICATE', 'A hospital with this code already exists');
  }

  const permissions = await prisma.permission.findMany();
  const hospital = await prisma.$transaction(async (tx) => {
    const created = await tx.hospital.create({
      data: {
        name: input.name.trim(),
        code,
        address: input.address,
        city: input.city,
        phone: input.phone,
      },
    });
    const role = await tx.role.create({
      data: {
        hospitalId: created.id,
        name: 'Hospital Admin',
        description: 'Full access for this hospital',
      },
    });
    if (permissions.length > 0) {
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
      });
    }
    await tx.membership.create({
      data: {
        userId: auth.userId,
        hospitalId: created.id,
        roleId: role.id,
      },
    });
    return created;
  });

  await audit.log({
    actorId: auth.userId,
    hospitalId: hospital.id,
    action: 'hospital.created',
    entityType: 'hospital',
    entityId: hospital.id,
    outcome: 'success',
    requestId: ctx.requestId,
    ip: ctx.ip,
  });
  return hospital;
}

export async function getHospital(auth, hospitalId) {
  assertHospital(auth, hospitalId);
  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) throw new AppError(404, 'HOSPITAL_NOT_FOUND', 'Hospital not found');
  return hospital;
}

export async function listDepartments(auth, hospitalId) {
  assertHospital(auth, hospitalId);
  return prisma.department.findMany({
    where: { hospitalId },
    orderBy: { name: 'asc' },
  });
}

export async function createDepartment(auth, hospitalId, input, ctx) {
  assertHospital(auth, hospitalId);
  const code = input.code.trim().toUpperCase();
  const existing = await prisma.department.findUnique({
    where: { hospitalId_code: { hospitalId, code } },
  });
  if (existing) throw new AppError(409, 'DEPARTMENT_DUPLICATE', 'Department code already exists');

  const department = await prisma.department.create({
    data: { hospitalId, name: input.name.trim(), code },
  });
  await audit.log({
    actorId: auth.userId,
    hospitalId,
    action: 'department.created',
    entityType: 'department',
    entityId: department.id,
    outcome: 'success',
    requestId: ctx.requestId,
    ip: ctx.ip,
  });
  return department;
}

export async function listRoles(auth, hospitalId) {
  assertHospital(auth, hospitalId);
  const roles = await prisma.role.findMany({
    where: { hospitalId },
    include: { permissions: { include: { permission: true } } },
    orderBy: { name: 'asc' },
  });
  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions.map((item) => item.permission.key),
  }));
}

export async function createRole(auth, hospitalId, input, ctx) {
  assertHospital(auth, hospitalId);
  const existing = await prisma.role.findUnique({
    where: { hospitalId_name: { hospitalId, name: input.name.trim() } },
  });
  if (existing) throw new AppError(409, 'ROLE_DUPLICATE', 'Role name already exists');

  const role = await prisma.role.create({
    data: {
      hospitalId,
      name: input.name.trim(),
      description: input.description,
    },
  });
  await audit.log({
    actorId: auth.userId,
    hospitalId,
    action: 'role.created',
    entityType: 'role',
    entityId: role.id,
    outcome: 'success',
    requestId: ctx.requestId,
    ip: ctx.ip,
  });
  return { id: role.id, name: role.name, description: role.description, permissions: [] };
}

export async function setRolePermissions(auth, hospitalId, roleId, permissionKeys, ctx) {
  assertHospital(auth, hospitalId);
  const role = await prisma.role.findFirst({ where: { id: roleId, hospitalId } });
  if (!role) throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');

  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
  });
  if (permissions.length !== new Set(permissionKeys).size) {
    throw new AppError(400, 'UNKNOWN_PERMISSION', 'One or more permissions are unknown');
  }

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
    });
  });

  await audit.log({
    actorId: auth.userId,
    hospitalId,
    action: 'role.permissions_updated',
    entityType: 'role',
    entityId: roleId,
    outcome: 'success',
    requestId: ctx.requestId,
    ip: ctx.ip,
  });
  return { id: role.id, name: role.name, permissions: permissions.map((item) => item.key) };
}

export async function listPermissions() {
  const permissions = await prisma.permission.findMany({ orderBy: { key: 'asc' } });
  return permissions.map((permission) => ({
    key: permission.key,
    description: permission.description,
  }));
}

export async function listStaff(auth, hospitalId) {
  assertHospital(auth, hospitalId);
  const memberships = await prisma.membership.findMany({
    where: { hospitalId, status: 'active' },
    include: {
      user: { include: { profile: true } },
      role: true,
      department: true,
    },
    orderBy: { user: { email: 'asc' } },
  });
  return memberships.map(staffDto);
}

export async function createStaff(auth, hospitalId, input, ctx) {
  assertHospital(auth, hospitalId);
  const role = await prisma.role.findFirst({ where: { id: input.roleId, hospitalId } });
  if (!role) throw new AppError(400, 'ROLE_NOT_FOUND', 'Role not found in this hospital');

  if (input.departmentId) {
    const department = await prisma.department.findFirst({
      where: { id: input.departmentId, hospitalId },
    });
    if (!department) {
      throw new AppError(400, 'DEPARTMENT_NOT_FOUND', 'Department not found in this hospital');
    }
  }

  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const membership = await prisma.membership.findUnique({
      where: { userId_hospitalId: { userId: existing.id, hospitalId } },
    });
    if (membership) throw new AppError(409, 'STAFF_DUPLICATE', 'This person is already on the hospital staff');
  }

  const passwordHash = existing ? null : await bcrypt.hash(input.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? existing
      : await tx.user.create({
          data: {
            email,
            passwordHash,
            profile: {
              create: {
                firstName: input.firstName.trim(),
                lastName: input.lastName.trim(),
                phone: input.phone,
                designation: input.designation,
              },
            },
          },
        });
    await tx.membership.create({
      data: {
        userId: saved.id,
        hospitalId,
        roleId: input.roleId,
        departmentId: input.departmentId,
      },
    });
    return saved;
  });

  await audit.log({
    actorId: auth.userId,
    hospitalId,
    action: 'user.created',
    entityType: 'user',
    entityId: user.id,
    outcome: 'success',
    requestId: ctx.requestId,
    ip: ctx.ip,
  });

  const membership = await prisma.membership.findUnique({
    where: { userId_hospitalId: { userId: user.id, hospitalId } },
    include: { user: { include: { profile: true } }, role: true, department: true },
  });
  return staffDto(membership);
}
