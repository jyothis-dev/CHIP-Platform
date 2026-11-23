import { z } from 'zod';

const empty = z.object({}).optional().default({});

export const createHospitalSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().min(2).max(20),
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().max(80).optional(),
    phone: z.string().trim().max(20).optional(),
  }),
  params: empty,
  query: empty,
});

export const hospitalParamsSchema = z.object({
  body: empty,
  params: z.object({ id: z.string().uuid() }),
  query: empty,
});

export const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    code: z.string().trim().min(2).max(20),
  }),
  params: z.object({ id: z.string().uuid() }),
  query: empty,
});

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(200).optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
  query: empty,
});

export const setPermissionsSchema = z.object({
  body: z.object({
    permissionKeys: z.array(z.string().trim().min(3)).min(1),
  }),
  params: z.object({
    id: z.string().uuid(),
    roleId: z.string().uuid(),
  }),
  query: empty,
});

export const createStaffSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    phone: z.string().trim().max(20).optional(),
    designation: z.string().trim().max(80).optional(),
    roleId: z.string().uuid(),
    departmentId: z.string().uuid().optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
  query: empty,
});
