import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import * as repo from './patients.repository.js';

function toManagedBy(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role,
  };
}

function toPatientView(patient) {
  const abha = patient.abhaIdentity;
  return {
    id: patient.id,
    patientType: patient.patientType,
    name: patient.name,
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth,
    mobileLast4: patient.mobileLast4,
    facilityId: patient.facilityId,
    createdAt: patient.createdAt,
    managedBy: toManagedBy(patient.registeredBy),
    abha: abha
      ? {
        verificationStatus: abha.verificationStatus,
        abhaNumberMasked: abha.abhaNumberMasked,
        abhaAddress: abha.abhaAddress,
        verifiedAt: abha.verifiedAt,
      }
      : {
        verificationStatus: 'NONE',
        abhaNumberMasked: null,
        abhaAddress: null,
        verifiedAt: null,
      },
  };
}

async function requireFacilityPatient(patientId, facilityId) {
  const patient = await repo.findPatientById(patientId);
  if (!patient) {
    throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found');
  }
  if (patient.facilityId !== facilityId) {
    throw new AppError(403, 'FORBIDDEN', 'Patient is outside your facility');
  }
  return patient;
}

export async function listPatients({ facilityId, q }) {
  const rows = await repo.listPatients({ facilityId, q });
  return rows.map(toPatientView);
}

export async function getPatient({ patientId, facilityId }) {
  const patient = await requireFacilityPatient(patientId, facilityId);
  return toPatientView(patient);
}

export async function createPatient({
  facilityId,
  actorId,
  actorName,
  patientType,
  name,
  gender,
  dateOfBirth,
  mobile,
  correlationId,
}) {
  const mobileLast4 = mobile ? mobile.slice(-4) : null;
  const patient = await repo.createPatient({
    facilityId,
    registeredByUserId: actorId,
    patientType,
    name,
    gender,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    mobileLast4,
  });

  await logAudit({
    actorId,
    facilityId,
    action: 'patient.create',
    resourceType: 'patient',
    resourceId: patient.id,
    outcome: 'success',
    correlationId,
    message: `Registered ${patientType} patient ${name} (managed by ${actorName || 'staff'}).`,
  });

  return toPatientView(patient);
}
