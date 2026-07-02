// GET  /api/live-optimization        → 最近一次巡检结果 + 待审批放大建议
// POST /api/live-optimization {action:'scan'} → 手动触发一次 dry-run 巡检
// 审批走现有 /api/ai/decisions（approve/reject）。
import { ok, err }                     from '../../../lib/api';
import type { RouteHandler }           from '../../../lib/api';
import { getLastLiveOptScan, runLiveOptimizationOnce } from '../../../lib/scheduler/live-optimization';

export const GET: RouteHandler = (_req, res) => {
  ok(res, getLastLiveOptScan());
};

export const POST: RouteHandler = async (req, res) => {
  const body = (req.body ?? {}) as { action?: string };
  if (body.action && body.action !== 'scan') return err(res, `未知 action: ${body.action}`);
  const r = await runLiveOptimizationOnce();
  ok(res, { ...getLastLiveOptScan(), triggered: r });
};
