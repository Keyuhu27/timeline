// 潮线 Tideline · 定时任务调度器
// 零依赖，用 setInterval 驱动。
// 任务：
//   每 60 分钟  → 规则引擎巡检
//   每  5 分钟  → 排期执行器（检查是否有到期排期）
//   每 30 分钟  → Token 预刷新检查
//   每  1 分钟  → 预算低于 20% 预警

import { runRulesOnce }      from './rule-engine';
import { runSchedulerOnce }  from './publish-executor';
import { tokenManager, alertService } from '../adapters/index';
import { adCampaigns }       from '../db';

interface ScheduledJob {
  name:        string;
  intervalMs:  number;
  fn:          () => Promise<void>;
  lastRun?:    number;
  lastResult?: string;
  errorCount:  number;
}

const jobs: ScheduledJob[] = [
  {
    name:       '规则引擎巡检',
    intervalMs: 60 * 60 * 1000,   // 60分钟
    errorCount: 0,
    fn: async () => {
      const r = await runRulesOnce();
      return `checked=${r.checked} triggered=${r.triggered} errors=${r.errors}`;
    },
  },
  {
    name:       '排期执行器',
    intervalMs: 5 * 60 * 1000,    // 5分钟
    errorCount: 0,
    fn: async () => {
      const r = await runSchedulerOnce();
      return `published=${r.published} failed=${r.failed}`;
    },
  },
  {
    name:       'Token 预刷新',
    intervalMs: 30 * 60 * 1000,   // 30分钟
    errorCount: 0,
    fn: async () => {
      await tokenManager.checkAll();
      return 'ok';
    },
  },
  {
    name:       '预算低余额预警',
    intervalMs: 60 * 1000,        // 1分钟
    errorCount: 0,
    fn: async () => {
      const lowBudget = adCampaigns.filter(c => {
        if (c.status !== 'active') return false;
        return c.budget > 0 && c.spent / c.budget > 0.8;
      });
      for (const c of lowBudget) {
        const remain = c.budget - c.spent;
        await alertService.send('budget_low', {
          计划:       c.name,
          已花费:     `¥${c.spent.toLocaleString()}`,
          总预算:     `¥${c.budget.toLocaleString()}`,
          剩余:       `¥${remain.toLocaleString()}`,
          消耗比例:   `${((c.spent / c.budget) * 100).toFixed(1)}%`,
        });
      }
      return `checked ${adCampaigns.length} campaigns, ${lowBudget.length} low`;
    },
  },
] as ScheduledJob[];

// 记录 interval 句柄，供停止
const handles: ReturnType<typeof setInterval>[] = [];
let started = false;

async function runJob(job: ScheduledJob): Promise<void> {
  job.lastRun = Date.now();
  try {
    const result = await job.fn();
    job.lastResult = String(result ?? 'ok');
    job.errorCount = 0;
    console.log(`[Scheduler] ✅ ${job.name}: ${job.lastResult}`);
  } catch (e) {
    job.errorCount++;
    job.lastResult = `ERROR: ${String(e)}`;
    console.error(`[Scheduler] ❌ ${job.name} (#${job.errorCount}):`, e);
  }
}

export function startScheduler(): void {
  if (started) return;
  started = true;
  console.log('[Scheduler] 启动定时任务...');

  for (const job of jobs) {
    // 启动时立即跑一次（延迟 5 秒，让服务先完成初始化）
    setTimeout(() => runJob(job), 5000);

    const handle = setInterval(() => runJob(job), job.intervalMs);
    handles.push(handle);
    console.log(`[Scheduler] 注册: ${job.name}（每 ${job.intervalMs / 1000 / 60} 分钟）`);
  }
}

export function stopScheduler(): void {
  handles.forEach(clearInterval);
  handles.length = 0;
  started = false;
  console.log('[Scheduler] 已停止所有定时任务');
}

/** 获取所有任务状态（供 /api/automation 接口返回） */
export function getJobStatus(): Array<{
  name: string;
  intervalMinutes: number;
  lastRun: string | null;
  lastResult: string | null;
  errorCount: number;
  nextRun: string | null;
}> {
  return jobs.map(j => ({
    name:            j.name,
    intervalMinutes: j.intervalMs / 60000,
    lastRun:         j.lastRun ? new Date(j.lastRun).toISOString() : null,
    lastResult:      j.lastResult ?? null,
    errorCount:      j.errorCount,
    nextRun:         j.lastRun
      ? new Date(j.lastRun + j.intervalMs).toISOString()
      : null,
  }));
}
