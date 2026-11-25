import { z } from 'zod';

export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const pageQueryShape = {
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(PAGE_SIZE),
};

export function pageSlice(page, pageSize) {
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function pageBody(items, page, pageSize, total) {
  return { items, page, pageSize, total };
}
