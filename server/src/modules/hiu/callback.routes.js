import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { callback } from './hiu.controller.js';
import { CALLBACK_ROUTES } from './constants.js';

const router = Router();

for (const path of CALLBACK_ROUTES) {
  router.post(path, asyncHandler(callback));
}

export default router;
