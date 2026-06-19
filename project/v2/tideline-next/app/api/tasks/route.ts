// GET  /api/tasks?brand=b1&stage=review&assignee=u2&page=1&pageSize=20
// POST /api/tasks  { title, brand, stage, assignee, due, priority, cover }
// PATCH /api/tasks/:id  { stage }  (任务状态流转)

import { tasks } from '../../../lib/db';
import { ok, err, paginate } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';
import type { Task } from '../../../types/index';

export const GET: RouteHandler = (req, res) => {
  const { brand, stage, assignee, priority } = req.query;
  let filtered = tasks.slice();
  if (brand)    filtered = filtered.filter(t => t.brand === brand);
  if (stage)    filtered = filtered.filter(t => t.stage === stage);
  if (assignee) filtered = filtered.filter(t => t.assignee === assignee);
  if (priority) filtered = filtered.filter(t => t.priority === priority);
  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};

export const POST: RouteHandler = async (req, res) => {
  const body = req.body as Partial<Task>;
  if (!body.title || !body.brand) {
    return err(res, 'title 和 brand 为必填项');
  }
  const newTask: Task = {
    id: `t${Date.now()}`,
    title: body.title,
    brand: body.brand,
    stage: body.stage ?? 'plan',
    assignee: body.assignee ?? 'u1',
    due: body.due ?? '待定',
    priority: body.priority ?? 'med',
    cover: body.cover ?? 'video',
    score: 0,
  };
  tasks.push(newTask);
  ok(res, newTask);
};

export const PATCH: RouteHandler = (req, res) => {
  // PATCH /api/tasks?id=t101
  const { id } = req.query;
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return err(res, '任务不存在', 404);
  const body = req.body as Partial<Task>;
  Object.assign(tasks[idx], body);
  ok(res, tasks[idx]);
};
