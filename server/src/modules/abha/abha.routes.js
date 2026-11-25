import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as abhaController from './abha.controller.js';
import {
  requestOtpSchema,
  verifyOtpSchema,
  verifyMobileSchema,
  createAddressSchema,
  transactionIdParamSchema,
} from './abha.schema.js';

const router = Router();

router.use(authenticate);

router.post('/enrolment/otp', validate(requestOtpSchema), asyncHandler(abhaController.requestOtp));
router.post('/enrolment/verify', validate(verifyOtpSchema), asyncHandler(abhaController.verifyOtp));
router.post('/enrolment/mobile/verify', validate(verifyMobileSchema), asyncHandler(abhaController.verifyMobile));
router.get(
  '/enrolment/:transactionId/address-suggestions',
  validate(transactionIdParamSchema),
  asyncHandler(abhaController.addressSuggestions),
);
router.post('/enrolment/address', validate(createAddressSchema), asyncHandler(abhaController.createAddress));
router.get(
  '/enrolment/:transactionId/card',
  validate(transactionIdParamSchema),
  asyncHandler(abhaController.getCard),
);

export default router;
