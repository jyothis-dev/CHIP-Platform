import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { asyncHandler } from './shared/asyncHandler.js';
import { AppError } from './shared/errors.js';
import { checkDatabase } from './shared/database.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { requestAudit } from './middleware/requestAudit.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import organisationRoutes from './modules/organisation/organisation.routes.js';
import childrenRoutes from './modules/children/children.routes.js';
import immunizationRoutes from './modules/immunization/immunization.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';

const app = express();

app.set('trust proxy', 1);
app.use(requestId);
app.use(requestLogger);
app.use(requestAudit);
app.use(cors({ origin: env.corsOrigin, credentials: true }));
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
app.use('/hospitals', organisationRoutes);
app.use('/children', childrenRoutes);
app.use('/children', immunizationRoutes);
app.use('/audit-logs', auditRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
