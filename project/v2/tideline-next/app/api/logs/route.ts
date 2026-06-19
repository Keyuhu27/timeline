// GET /api/logs?source=auto_rule&level=error&campaignId=c1&page=1&pageSize=50

import { operationLogs }     from '../../../lib/db';
import { ok, paginate }      from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';

export const GET: RouteHandler = (req, res) => {
  const { source, level, campaignId, ruleId, from, to } = req.query;
  let filtered = operationLogs.slice().reverse(); // 最新的在前

  if (source)     filtered = filtered.filter(l => l.source     === source);
  if (level)      filtered = filtered.filter(l => l.level      === level);
  if (campaignId) filtered = filtered.filter(l => l.campaignId === campaignId);
  if (ruleId)     filtered = filtered.filter(l => l.ruleId     === ruleId);
  if (from)       filtered = filtered.filter(l => l.createdAt  >= from);
  if (to)         filtered = filtered.filter(l => l.createdAt  <= to);

  const summary = {
    total:    operationLogs.length,
    success:  operationLogs.filter(l => l.success).length,
    errors:   operationLogs.filter(l => !l.success).length,
    bySource: {
      auto_rule: operationLogs.filter(l => l.source === 'auto_rule').length,
      scheduler: operationLogs.filter(l => l.source === 'scheduler').length,
      manual:    operationLogs.filter(l => l.source === 'manual').length,
      system:    operationLogs.filter(l => l.source === 'system').length,
    },
  };

  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, { logs: items, summary }, { total, page, pageSize });
};
