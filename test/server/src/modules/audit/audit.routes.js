import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './audit.controller.js';

const router = Router();

router.get('/', authenticate, authorize('audit.read'), asyncHandler(controller.list));

export default router;
