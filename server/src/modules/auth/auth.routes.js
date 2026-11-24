import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loginEmailLimiter, loginIpLimiter, sessionLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as authController from './auth.controller.js';
import { loginSchema } from './auth.schema.js';

const router = Router();

router.post(
  '/login',
  loginIpLimiter,
  loginEmailLimiter,
  validate(loginSchema),
  asyncHandler(authController.login),
);

router.post('/logout', sessionLimiter, authenticate, asyncHandler(authController.logout));
router.get('/me', authenticate, authController.me);

export default router;
