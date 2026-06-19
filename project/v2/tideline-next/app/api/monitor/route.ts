// GET /api/monitor?category=美妆&threat=high
import { competitors } from '../../../lib/db';
import { ok, paginate } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';

export const GET: RouteHandler = (req, res) => {
  const { category, threat } = req.query;
  let filtered = competitors.slice();
  if (category) filtered = filtered.filter(c => c.category === category);
  if (threat)   filtered = filtered.filter(c => c.threat === threat);
  filtered.sort((a, b) => b.followers - a.followers);
  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};
