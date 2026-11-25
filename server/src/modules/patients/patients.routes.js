import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as patientsController from './patients.controller.js';
import * as abhaController from '../abha/abha.controller.js';
import {
  createPatientSchema,
  listPatientsSchema,
  patientIdParamSchema,
} from './patients.schema.js';
import { patientIdParamSchema as abhaPatientIdParamSchema } from '../abha/abha.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', validate(listPatientsSchema), asyncHandler(patientsController.list));
router.post('/', validate(createPatientSchema), asyncHandler(patientsController.create));
router.get('/:id', validate(patientIdParamSchema), asyncHandler(patientsController.getById));
router.get(
  '/:id/abha',
  validate(abhaPatientIdParamSchema),
  asyncHandler(abhaController.getPatientAbha),
);

export default router;
