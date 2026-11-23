import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './immunization.controller.js';
import { createVaccinationSchema, vaccinationParamsSchema } from './immunization.schema.js';

const router = Router();

router.use(authenticate);
router.get(
  '/:id/vaccinations/next-due',
  authorize('vaccination.read'),
  validate(vaccinationParamsSchema),
  asyncHandler(controller.nextDue),
);
router.get(
  '/:id/vaccinations',
  authorize('vaccination.read'),
  validate(vaccinationParamsSchema),
  asyncHandler(controller.list),
);
router.post(
  '/:id/vaccinations',
  authorize('vaccination.create'),
  validate(createVaccinationSchema),
  asyncHandler(controller.create),
);

export default router;
