// GET /api/lives?brand=b4&status=live
import { lives } from '../../../lib/db';
import { ok, paginate } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';

export const GET: RouteHandler = (req, res) => {
  const { brand, status } = req.query;
  let filtered = lives.slice();
  if (brand)  filtered = filtered.filter(l => l.brand === brand);
  if (status) filtered = filtered.filter(l => l.status === status);
  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};
