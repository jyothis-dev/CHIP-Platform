import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as auditController from './audit.controller.js';
import { listAuditSchema } from './audit.schema.js';

const router = Router();

router.use(authenticate);
router.get('/', validate(listAuditSchema), asyncHandler(auditController.list));

export default router;
