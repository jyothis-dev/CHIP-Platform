import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './hip.controller.js';
import {
  bridgeUrlSchema,
  careContextParamSchema,
  inspectSchema,
  exchangesQuerySchema,
  patientParamSchema,
  saveRecordSchema,
} from './hip.schema.js';

const router = Router();

router.use(authenticate);
router.get('/readiness', asyncHandler(controller.getReadiness));
router.post('/bridge/url', validate(bridgeUrlSchema), asyncHandler(controller.registerBridge));
router.get('/exchanges', validate(exchangesQuerySchema), asyncHandler(controller.exchanges));
router.post('/bundles/inspect', validate(inspectSchema), asyncHandler(controller.inspect));
router.get('/patients/:id/records', validate(patientParamSchema), asyncHandler(controller.listRecords));
router.post('/care-contexts/:id/retry', validate(careContextParamSchema), asyncHandler(controller.retryLink));
router.post('/patients/:id/records', validate(saveRecordSchema), asyncHandler(controller.createRecord));

export default router;
