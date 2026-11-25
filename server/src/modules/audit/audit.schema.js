import { z } from 'zod';
import { pageQueryShape } from '../../shared/pagination.js';

export const listAuditSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    action: z.string().trim().max(80).optional(),
    resourceType: z.string().trim().max(80).optional(),
    resourceId: z.string().uuid().optional(),
    actorId: z.string().uuid().optional(),
    outcome: z.enum(['success', 'denied', 'failure']).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    ...pageQueryShape,
  }).optional().default({}),
});
