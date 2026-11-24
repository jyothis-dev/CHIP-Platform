import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import swaggerUi from 'swagger-ui-express';

const openapiPath = new URL('./openapi.yaml', import.meta.url);
export const openApiSpec = parse(readFileSync(openapiPath, 'utf8'));

export function mountSwagger(app) {
  app.get('/api-docs/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
}
