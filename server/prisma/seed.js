import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/shared/password.js';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || 'Demo Staff';
  // M3: raising consent requests and viewing received records needs CLINICIAN or ADMIN.
  const role = ['ADMIN', 'CLINICIAN', 'STAFF'].includes(process.env.SEED_ADMIN_ROLE)
    ? process.env.SEED_ADMIN_ROLE
    : 'STAFF';
  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
  }

  const passwordHash = await hashPassword(password);
  const facilityName = 'Cyber Hospital';
  let facility = await prisma.facility.findFirst({ where: { name: facilityName } });
  if (!facility) {
    // Earlier seeds named the same facility 'Sahyadri Hospital' or 'Demo Facility'; rename it in place.
    facility = await prisma.facility.findFirst({ where: { name: { in: ['Sahyadri Hospital', 'Demo Facility'] } } });
    facility = facility
      ? await prisma.facility.update({ where: { id: facility.id }, data: { name: facilityName } })
      : await prisma.facility.create({ data: { name: facilityName } });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role, facilityId: facility.id },
    create: { name, email, passwordHash, role, facilityId: facility.id },
  });

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
