// GET /api/brands
import { brands } from '../../../lib/db';
import { ok } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';

export const GET: RouteHandler = (_req, res) => {
  ok(res, brands, { total: brands.length });
};
