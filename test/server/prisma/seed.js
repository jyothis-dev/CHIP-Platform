import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  ['hospital.manage', 'Onboard a hospital'],
  ['department.manage', 'Create departments'],
  ['role.manage', 'Create roles and assign permissions'],
  ['user.manage', 'Create staff profiles'],
  ['child.register', 'Register a child'],
  ['child.read', 'View children'],
  ['guardian.manage', 'Associate a parent or guardian'],
  ['vaccination.create', 'Record a vaccination'],
  ['vaccination.read', 'View vaccination history and the next due dose'],
  ['audit.read', 'Read the audit log'],
];

const doctorKeys = [
  'child.register',
  'child.read',
  'guardian.manage',
  'vaccination.create',
  'vaccination.read',
];

const schedule = [
  ['BCG', 'BCG', 1, 0, 'At birth'],
  ['HEPB', 'Hepatitis B', 0, 0, 'At birth'],
  ['OPV', 'Oral polio', 0, 0, 'At birth'],
  ['OPV', 'Oral polio', 1, 42, '6 weeks'],
  ['PENTA', 'Pentavalent', 1, 42, '6 weeks'],
  ['ROTA', 'Rotavirus', 1, 42, '6 weeks'],
  ['PCV', 'Pneumococcal', 1, 42, '6 weeks'],
  ['OPV', 'Oral polio', 2, 70, '10 weeks'],
  ['PENTA', 'Pentavalent', 2, 70, '10 weeks'],
  ['ROTA', 'Rotavirus', 2, 70, '10 weeks'],
  ['OPV', 'Oral polio', 3, 98, '14 weeks'],
  ['PENTA', 'Pentavalent', 3, 98, '14 weeks'],
  ['ROTA', 'Rotavirus', 3, 98, '14 weeks'],
  ['PCV', 'Pneumococcal', 2, 98, '14 weeks'],
  ['MR', 'Measles rubella', 1, 274, '9 months'],
  ['DPT', 'DPT booster', 1, 487, '16 months'],
  ['OPV', 'Oral polio', 4, 487, '16 months'],
  ['MR', 'Measles rubella', 2, 487, '16 months'],
];

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const doctorEmail = process.env.SEED_DOCTOR_EMAIL;
  const doctorPassword = process.env.SEED_DOCTOR_PASSWORD;
  if (!adminEmail || !adminPassword || !doctorEmail || !doctorPassword) {
    throw new Error('Seed email and password environment variables are required');
  }

  for (const [key, description] of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }

  for (const [vaccineCode, vaccineName, doseNumber, dueAgeDays, description] of schedule) {
    await prisma.vaccineSchedule.upsert({
      where: { vaccineCode_doseNumber: { vaccineCode, doseNumber } },
      update: { vaccineName, dueAgeDays, description },
      create: { vaccineCode, vaccineName, doseNumber, dueAgeDays, description },
    });
  }

  const hospital = await prisma.hospital.upsert({
    where: { code: 'CITY' },
    update: { name: 'City General', city: 'Hyderabad' },
    create: { name: 'City General', code: 'CITY', city: 'Hyderabad' },
  });

  const department = await prisma.department.upsert({
    where: { hospitalId_code: { hospitalId: hospital.id, code: 'GYN' } },
    update: { name: 'Gynaecology' },
    create: { hospitalId: hospital.id, name: 'Gynaecology', code: 'GYN' },
  });

  const adminRole = await prisma.role.upsert({
    where: { hospitalId_name: { hospitalId: hospital.id, name: 'Hospital Admin' } },
    update: { description: 'Full access for this hospital' },
    create: {
      hospitalId: hospital.id,
      name: 'Hospital Admin',
      description: 'Full access for this hospital',
    },
  });

  const doctorRole = await prisma.role.upsert({
    where: { hospitalId_name: { hospitalId: hospital.id, name: 'Doctor' } },
    update: { description: 'Registers children and records vaccinations' },
    create: {
      hospitalId: hospital.id,
      name: 'Doctor',
      description: 'Registers children and records vaccinations',
    },
  });

  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: [adminRole.id, doctorRole.id] } } });
  await prisma.rolePermission.createMany({
    data: [
      ...allPermissions.map((permission) => ({ roleId: adminRole.id, permissionId: permission.id })),
      ...allPermissions
        .filter((permission) => doctorKeys.includes(permission.key))
        .map((permission) => ({ roleId: doctorRole.id, permissionId: permission.id })),
    ],
  });

  await upsertStaff({
    email: adminEmail.toLowerCase(),
    password: adminPassword,
    firstName: 'Hospital',
    lastName: 'Admin',
    designation: 'Administrator',
    hospitalId: hospital.id,
    departmentId: department.id,
    roleId: adminRole.id,
  });

  await upsertStaff({
    email: doctorEmail.toLowerCase(),
    password: doctorPassword,
    firstName: 'Gynaecology',
    lastName: 'Doctor',
    designation: 'Doctor',
    hospitalId: hospital.id,
    departmentId: department.id,
    roleId: doctorRole.id,
  });
}

async function upsertStaff({ email, password, firstName, lastName, designation, hospitalId, departmentId, roleId }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, status: 'active' },
    create: { email, passwordHash, status: 'active' },
  });
  await prisma.profile.upsert({
    where: { userId: user.id },
    update: { firstName, lastName, designation },
    create: { userId: user.id, firstName, lastName, designation },
  });
  await prisma.membership.upsert({
    where: { userId_hospitalId: { userId: user.id, hospitalId } },
    update: { roleId, departmentId, status: 'active' },
    create: { userId: user.id, hospitalId, roleId, departmentId, status: 'active' },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
