import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: [
      'password',
      'passwordHash',
      'refreshToken',
      'token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    remove: true,
  },
});
