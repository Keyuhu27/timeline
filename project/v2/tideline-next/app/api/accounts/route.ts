// GET /api/accounts?brand=b1
import { accounts } from '../../../lib/db';
import { ok, paginate } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';

export const GET: RouteHandler = (req, res) => {
  const { brand } = req.query;
  let filtered = accounts.slice();
  if (brand) filtered = filtered.filter(a => a.brand === brand);
  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};
