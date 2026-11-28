import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/shared/password.js';

const prisma = new PrismaClient();

async function main() {
  // First account: SEED_ADMIN_* (its role is SEED_ADMIN_ROLE). Second account: SEED_SECOND_*, an ADMIN by default,
  // so one seed run gives an admin and a clinician. The second password falls back to SEED_ADMIN_PASSWORD.
  const roles = ['ADMIN', 'CLINICIAN', 'STAFF'];
  const accounts = [{
    email: process.env.SEED_ADMIN_EMAIL?.toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD,
    name: process.env.SEED_ADMIN_NAME || 'Demo Staff',
    // M3: raising consent requests and viewing received records needs CLINICIAN or ADMIN.
    role: roles.includes(process.env.SEED_ADMIN_ROLE) ? process.env.SEED_ADMIN_ROLE : 'STAFF',
  }];
  if (process.env.SEED_SECOND_EMAIL) {
    accounts.push({
      email: process.env.SEED_SECOND_EMAIL.toLowerCase(),
      password: process.env.SEED_SECOND_PASSWORD || process.env.SEED_ADMIN_PASSWORD,
      name: process.env.SEED_SECOND_NAME || 'Demo Admin',
      role: roles.includes(process.env.SEED_SECOND_ROLE) ? process.env.SEED_SECOND_ROLE : 'ADMIN',
    });
  }
  if (!accounts[0].email || !accounts[0].password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
  }

  const facilityName = 'Cyber Hospital';
  let facility = await prisma.facility.findFirst({ where: { name: facilityName } });
  if (!facility) {
    // Earlier seeds named the same facility 'Sahyadri Hospital' or 'Demo Facility'; rename it in place.
    facility = await prisma.facility.findFirst({ where: { name: { in: ['Sahyadri Hospital', 'Demo Facility'] } } });
    facility = facility
      ? await prisma.facility.update({ where: { id: facility.id }, data: { name: facilityName } })
      : await prisma.facility.create({ data: { name: facilityName } });
  }

  let user = null;
  for (const account of accounts) {
    const passwordHash = await hashPassword(account.password);
    const row = await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, passwordHash, role: account.role, facilityId: facility.id },
      create: {
        name: account.name, email: account.email, passwordHash, role: account.role, facilityId: facility.id,
      },
    });
    user = user || row;
    console.log(`Seeded ${account.role} ${account.email}`);
  }

  if (process.env.SEED_DEMO_PATIENT === 'false') return;

  const demoPatientId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  await prisma.patient.upsert({
    where: { id: demoPatientId },
    update: {
      facilityId: facility.id,
      name: 'Demo Mother',
      registeredByUserId: user.id,
    },
    create: {
      id: demoPatientId,
      facilityId: facility.id,
      patientType: 'MOTHER',
      name: 'Demo Mother',
      gender: 'F',
      dateOfBirth: new Date('1995-01-15'),
      mobileLast4: '0000',
      registeredByUserId: user.id,
    },
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
