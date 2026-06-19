// GET /api/schedule?brand=b4&type=live&status=approved&from=2026-05-12&to=2026-05-18
import { schedule } from '../../../lib/db';
import { ok, paginate } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';

export const GET: RouteHandler = (req, res) => {
  const { brand, type, status, from, to } = req.query;
  let filtered = schedule.slice();
  if (brand)  filtered = filtered.filter(s => s.brand === brand);
  if (type)   filtered = filtered.filter(s => s.type === type);
  if (status) filtered = filtered.filter(s => s.status === status);
  if (from)   filtered = filtered.filter(s => s.date >= from);
  if (to)     filtered = filtered.filter(s => s.date <= to);
  filtered.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};
