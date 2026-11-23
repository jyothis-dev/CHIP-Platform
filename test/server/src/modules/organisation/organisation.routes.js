import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './organisation.controller.js';
import {
  createDepartmentSchema,
  createHospitalSchema,
  createRoleSchema,
  createStaffSchema,
  hospitalParamsSchema,
  setPermissionsSchema,
} from './organisation.schema.js';

const router = Router();

router.use(authenticate);
router.get('/', asyncHandler(controller.listHospitals));
router.post('/', authorize('hospital.manage'), validate(createHospitalSchema), asyncHandler(controller.createHospital));
router.get('/permissions', authorize('role.manage'), asyncHandler(controller.listPermissions));
router.get('/:id', validate(hospitalParamsSchema), asyncHandler(controller.getHospital));
router.get('/:id/departments', validate(hospitalParamsSchema), asyncHandler(controller.listDepartments));
router.post(
  '/:id/departments',
  authorize('department.manage'),
  validate(createDepartmentSchema),
  asyncHandler(controller.createDepartment),
);
router.get('/:id/roles', validate(hospitalParamsSchema), asyncHandler(controller.listRoles));
router.post('/:id/roles', authorize('role.manage'), validate(createRoleSchema), asyncHandler(controller.createRole));
router.put(
  '/:id/roles/:roleId/permissions',
  authorize('role.manage'),
  validate(setPermissionsSchema),
  asyncHandler(controller.setRolePermissions),
);
router.get('/:id/users', authorize('user.manage'), validate(hospitalParamsSchema), asyncHandler(controller.listStaff));
router.post('/:id/users', authorize('user.manage'), validate(createStaffSchema), asyncHandler(controller.createStaff));

export default router;
