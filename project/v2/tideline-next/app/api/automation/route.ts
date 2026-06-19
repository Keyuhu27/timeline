// GET  /api/automation          查看调度器状态、Token 状态
// POST /api/automation          手动触发任务 { action: 'run_rules' | 'run_scheduler' | 'check_tokens' }

import { ok, err }           from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';
import { getJobStatus }      from '../../../lib/scheduler/cron';
import { runRulesOnce }      from '../../../lib/scheduler/rule-engine';
import { runSchedulerOnce }  from '../../../lib/scheduler/publish-executor';
import { tokenManager }      from '../../../lib/adapters/index';

export const GET: RouteHandler = (_req, res) => {
  ok(res, {
    scheduler: getJobStatus(),
    tokens:    tokenManager.getStatus(),
  });
};

export const POST: RouteHandler = async (req, res) => {
  const body = req.body as { action?: string };

  switch (body.action) {
    case 'run_rules': {
      const result = await runRulesOnce();
      ok(res, { action: 'run_rules', result });
      break;
    }
    case 'run_scheduler': {
      const result = await runSchedulerOnce();
      ok(res, { action: 'run_scheduler', result });
      break;
    }
    case 'check_tokens': {
      await tokenManager.checkAll();
      ok(res, { action: 'check_tokens', tokens: tokenManager.getStatus() });
      break;
    }
    default:
      err(res, `未知 action: ${body.action}。可选: run_rules, run_scheduler, check_tokens`);
  }
};
