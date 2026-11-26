import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './hiu.controller.js';
import {
  createConsentRequestSchema,
  healthInformationSchema,
  idParamSchema,
  listConsentRequestsSchema,
} from './hiu.schema.js';

const router = Router();
const clinical = authorize('CLINICIAN', 'ADMIN');

router.use(authenticate);
router.get('/options', asyncHandler(controller.options));
router.get('/readiness', asyncHandler(controller.readiness));
router.get('/consent-requests', validate(listConsentRequestsSchema), asyncHandler(controller.listConsentRequests));
router.post('/consent-requests', clinical, validate(createConsentRequestSchema), asyncHandler(controller.createConsentRequest));
router.get('/consent-requests/:id', validate(idParamSchema), asyncHandler(controller.getConsentRequest));
router.post('/consent-requests/:id/status', validate(idParamSchema), asyncHandler(controller.refreshStatus));
router.post('/artefacts/:id/fetch', clinical, validate(idParamSchema), asyncHandler(controller.fetchArtefact));
router.post('/artefacts/:id/health-information', clinical, validate(healthInformationSchema), asyncHandler(controller.requestHealthInformation));
router.get('/artefacts/:id/records', clinical, validate(idParamSchema), asyncHandler(controller.artefactRecords));
router.get('/health-information/:id/status', validate(idParamSchema), asyncHandler(controller.healthInformationStatus));

export default router;
