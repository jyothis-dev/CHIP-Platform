import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { asyncHandler } from './shared/asyncHandler.js';
import { AppError } from './shared/errors.js';
import { checkDatabase } from './shared/database.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import abhaRoutes from './modules/abha/abha.routes.js';
import patientsRoutes from './modules/patients/patients.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import hipRoutes from './modules/hip/hip.routes.js';
import callbackRoutes from './modules/hip/callback.routes.js';
import hiuRoutes from './modules/hiu/hiu.routes.js';
import hiuCallbackRoutes from './modules/hiu/callback.routes.js';
import registriesRoutes from './modules/registries/registries.routes.js';
import { dataPush } from './modules/hiu/hiu.controller.js';
import { DATA_PUSH_PATH } from './modules/hiu/constants.js';
import { mountSwagger } from './docs/swagger.js';

const app = express();

app.set('trust proxy', 1);
app.use(requestId);
app.use(requestLogger);
app.use(cors({ origin: env.corsOrigin, credentials: true }));
// The HIP posts encrypted records straight to the HIU data push URL; pages can exceed 1mb.
app.post(DATA_PUSH_PATH, express.json({ limit: env.hiuPushBodyLimit }), asyncHandler(dataPush));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/health', asyncHandler(async (_req, res) => {
  try {
    await checkDatabase();
  } catch (err) {
    throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is unreachable', { cause: err });
  }
  res.json({ success: true, message: 'OK', database: 'up' });
}));

app.use('/auth', authRoutes);
app.use('/abha', abhaRoutes);
app.use('/patients', patientsRoutes);
app.use('/audit', auditRoutes);
app.use('/hip', hipRoutes);
app.use('/hiu', hiuRoutes);
app.use('/registries', registriesRoutes);
app.use(callbackRoutes);
app.use(hiuCallbackRoutes);
mountSwagger(app);

app.use(notFound);
app.use(errorHandler);

export default app;
