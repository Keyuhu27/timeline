// GET  /api/team?dept=内容&status=online
// POST /api/team  邀请成员
import { team } from '../../../lib/db';
import { ok, err, paginate } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';
import type { TeamMember } from '../../../types/index';

export const GET: RouteHandler = (req, res) => {
  const { dept, status, q } = req.query;
  let filtered = team.slice();
  if (dept)   filtered = filtered.filter(m => m.dept === dept);
  if (status) filtered = filtered.filter(m => m.status === status);
  if (q)      filtered = filtered.filter(m => m.name.includes(q) || m.role.includes(q));
  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};

export const POST: RouteHandler = async (req, res) => {
  const body = req.body as Partial<TeamMember>;
  if (!body.name || !body.email) return err(res, 'name 和 email 为必填项');
  const m: TeamMember = {
    id: `u${Date.now()}`,
    name: body.name,
    email: body.email,
    role: body.role ?? '成员',
    dept: body.dept ?? '其他',
    brands: body.brands ?? [],
    status: 'offline',
    last: '刚刚邀请',
    initial: body.name[0] ?? '?',
  };
  team.push(m);
  ok(res, m);
};
