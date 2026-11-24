import app from './app.js';
import { env } from './config/env.js';
import { checkDatabase } from './shared/database.js';
import { logger } from './shared/logger.js';

app.listen(env.port, () => {
  logger.info({ component: 'http', port: env.port }, 'server listening');
  checkDatabase()
    .then(() => logger.info({ component: 'database' }, 'database connected'))
    .catch((err) => logger.error({ err, component: 'database' }, 'database unreachable'));
});
