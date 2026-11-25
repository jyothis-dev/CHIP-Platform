import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { callback } from './hip.controller.js';

const router = Router();

const paths = [
  '/api/v3/hip/token/on-generate-token',
  '/api/v3/link/on_carecontext',
  '/api/v3/links/context/on-notify',
  '/api/v3/patients/sms/on-notify',
  '/api/v3/hip/patient/care-context/discover',
  '/api/v3/hip/link/care-context/init',
  '/api/v3/hip/link/care-context/confirm',
  '/api/v3/consent/request/hip/notify',
  '/api/v3/hip/health-information/request',
];

for (const path of paths) {
  router.post(path, asyncHandler(callback));
}

export default router;
