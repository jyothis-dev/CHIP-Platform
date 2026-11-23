import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './children.controller.js';
import { childParamsSchema, createChildSchema, createGuardianSchema } from './children.schema.js';

const router = Router();

router.use(authenticate);
router.post('/', authorize('child.register'), validate(createChildSchema), asyncHandler(controller.create));
router.get('/', authorize('child.read'), asyncHandler(controller.list));
router.get('/:id', authorize('child.read'), validate(childParamsSchema), asyncHandler(controller.getOne));
router.get(
  '/:id/guardians',
  authorize('child.read'),
  validate(childParamsSchema),
  asyncHandler(controller.listGuardians),
);
router.post(
  '/:id/guardians',
  authorize('guardian.manage'),
  validate(createGuardianSchema),
  asyncHandler(controller.createGuardian),
);

export default router;
