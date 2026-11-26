import { Router } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { buildLimiter } from '../../middleware/rateLimit.js';
import * as controller from './registries.controller.js';
import {
  attachFacilitySchema,
  attachPractitionerSchema,
  bridgeLinkSchema,
  facilitySearchSchema,
  hprIdParamSchema,
  hprMobileSchema,
  idParamSchema,
  mastersSchema,
  professionalInfoSchema,
} from './registries.schema.js';

const router = Router();
const clinical = authorize('CLINICIAN', 'ADMIN');
const admin = authorize('ADMIN');

// The registry host is a shared sandbox, so keep each user to a modest rate.
const registryLimiter = buildLimiter({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req) => (req.auth?.userId ? `registry:${req.auth.userId}` : ipKeyGenerator(req.ip)),
});

router.use(authenticate);
router.use(registryLimiter);

router.get('/options', asyncHandler(controller.options));
router.get('/readiness', asyncHandler(controller.readiness));
router.get('/facility', asyncHandler(controller.facility));

router.get('/hfr/masters/:kind', validate(mastersSchema), asyncHandler(controller.masters));
router.post('/hfr/search', validate(facilitySearchSchema), asyncHandler(controller.searchFacilities));

// The upstream mobile search carries the number in its path, so ours is a POST with a body.
router.post('/hpr/search-by-mobile', clinical, validate(hprMobileSchema), asyncHandler(controller.hprSearchByMobile));
router.post('/hpr/professional-info', clinical, validate(professionalInfoSchema), asyncHandler(controller.professionalInfo));
router.get('/hpr/exists/:hprId', validate(hprIdParamSchema), asyncHandler(controller.hprExists));
router.get('/hpr/:hprId', validate(hprIdParamSchema), asyncHandler(controller.hprSearchById));

router.get('/facilities/:id/bridge-status', validate(idParamSchema), asyncHandler(controller.bridgeStatus));
router.post('/facilities/:id/hfr-link', admin, validate(attachFacilitySchema), asyncHandler(controller.attachFacilityHfr));
router.post('/facilities/:id/bridge-link', admin, validate(bridgeLinkSchema), asyncHandler(controller.bridgeLink));
router.post('/practitioners/:id/hpr-link', admin, validate(attachPractitionerSchema), asyncHandler(controller.attachPractitionerHpr));

export default router;
