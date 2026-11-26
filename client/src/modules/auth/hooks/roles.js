/** True when the signed-in user has one of the given roles (STAFF, CLINICIAN, ADMIN). */
export function hasRole(user, roles) {
  return Boolean(user?.role) && roles.includes(user.role);
}

export const CLINICAL_ROLES = ['CLINICIAN', 'ADMIN'];
export const ADMIN_ROLES = ['ADMIN'];
