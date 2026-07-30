// GET   /api/rules              查询规则列表
// POST  /api/rules              创建规则
// PATCH /api/rules?id=rule_01  修改规则（启用/禁用/修改阈值）
// DELETE /api/rules?id=rule_01 删除规则

import { autoRules }       from '../../../lib/db';
import { ok, err, paginate } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';
import type { AutoRule }     from '../../../types/index';

export const GET: RouteHandler = (req, res) => {
  const { brand, enabled, metric } = req.query;
  let filtered = autoRules.filter(r => r.tenantId === req.session?.tenantId);
  if (brand)   filtered = filtered.filter(r => r.brand === brand || r.brand === 'all');
  if (enabled) filtered = filtered.filter(r => String(r.enabled) === enabled);
  if (metric)  filtered = filtered.filter(r => r.metric === metric);

  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};

export const POST: RouteHandler = (req, res) => {
  const body = req.body as Partial<AutoRule> & { createdBy?: string };

  if (!body.name || !body.metric || !body.operator || body.threshold === undefined || !body.action) {
    return err(res, 'name, metric, operator, threshold, action 为必填项');
  }
  if (!req.session) return err(res, '未登录', 401);

  const rule: AutoRule = {
    id:               `rule_${Date.now()}`,
    name:             body.name,
    enabled:          body.enabled ?? true,
    brand:            body.brand ?? 'all',
    metric:           body.metric,
    operator:         body.operator,
    threshold:        body.threshold,
    action:           body.action,
    actionValue:      body.actionValue,
    cooldownMinutes:  body.cooldownMinutes ?? 60,
    createdBy:        body.createdBy ?? 'u1',
    createdAt:        new Date().toISOString(),
    tenantId:         req.session.tenantId,
  };
  autoRules.push(rule);
  ok(res, rule);
};

export const PATCH: RouteHandler = (req, res) => {
  const { id } = req.query;
  const idx = autoRules.findIndex(r => r.id === id && r.tenantId === req.session?.tenantId);
  if (idx === -1) return err(res, '规则不存在', 404);

  const allowed = ['name', 'enabled', 'threshold', 'actionValue', 'cooldownMinutes', 'brand'];
  const body = req.body as Partial<AutoRule>;
  for (const key of allowed) {
    if (key in (body as object)) {
      (autoRules[idx] as Record<string, unknown>)[key] = (body as Record<string, unknown>)[key];
    }
  }
  ok(res, autoRules[idx]);
};

export const DELETE: RouteHandler = (req, res) => {
  const { id } = req.query;
  const idx = autoRules.findIndex(r => r.id === id && r.tenantId === req.session?.tenantId);
  if (idx === -1) return err(res, '规则不存在', 404);
  autoRules.splice(idx, 1);
  ok(res, { id, deleted: true });
};
