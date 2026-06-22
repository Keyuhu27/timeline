// 潮线 Tideline · 调控规则引擎
// 核心逻辑：按规则检查每个活跃计划，条件满足时自动执行动作并写日志

import type { AutoRule, AdCampaign, OperationLog } from '../../types/index';
import type { CampaignStats }                       from '../adapters/ad-adapter';
import { adAdapter, alertService }                  from '../adapters/index';
import { autoRules, adCampaigns, operationLogs, accounts } from '../db';

// ─── 运算符比较 ───────────────────────────────────────────────────────────
function compare(value: number, operator: AutoRule['operator'], threshold: number): boolean {
  switch (operator) {
    case 'lt':  return value <  threshold;
    case 'gt':  return value >  threshold;
    case 'lte': return value <= threshold;
    case 'gte': return value >= threshold;
  }
}

// ─── 从 stats 取指标值 ────────────────────────────────────────────────────
function getMetric(stats: CampaignStats, campaign: AdCampaign, metric: AutoRule['metric']): number {
  switch (metric) {
    case 'store_visits':  return stats.storeVisits ?? 0;
    case 'leads':         return stats.leads ?? 0;
    case 'cost_per_lead': return stats.leads > 0 ? stats.spent / stats.leads : 0;
    case 'ctr':           return stats.ctr;
    case 'cpm':           return stats.cpm;
    case 'spent_pct':     return campaign.budget > 0 ? stats.spent / campaign.budget : 0;
    case 'roas':          return stats.roas;
    case 'cvr':           return stats.cvr;
    case 'gmv':           return stats.gmv;
  }
}

// ─── 执行单条规则对单个计划的动作 ────────────────────────────────────────
async function executeAction(
  rule: AutoRule,
  campaign: AdCampaign,
  stats:    CampaignStats,
  metricValue: number,
): Promise<void> {
  const account = campaign.account;
  const externalId = campaign.externalId ?? campaign.id;
  const before: Record<string, unknown> = {
    status: campaign.status,
    budget: campaign.budget,
    [rule.metric]: metricValue,
  };
  let success = false;
  let after: Record<string, unknown> = {};
  let errorMsg: string | undefined;

  try {
    switch (rule.action) {
      case 'pause': {
        success = await adAdapter.pauseCampaign(externalId, account);
        if (success) {
          campaign.status = 'paused';
          after = { status: 'paused' };
        }
        break;
      }
      case 'resume': {
        success = await adAdapter.resumeCampaign(externalId, account);
        if (success) {
          campaign.status = 'active';
          after = { status: 'active' };
        }
        break;
      }
      case 'increase_budget': {
        const pct = (rule.actionValue ?? 20) / 100;
        const newBudget = Math.round(campaign.budget * (1 + pct));
        success = await adAdapter.adjustBudget(externalId, account, newBudget);
        if (success) {
          campaign.budget = newBudget;
          after = { budget: newBudget };
        }
        break;
      }
      case 'decrease_budget': {
        const pct = (rule.actionValue ?? 20) / 100;
        const newBudget = Math.round(campaign.budget * (1 - pct));
        success = await adAdapter.adjustBudget(externalId, account, newBudget);
        if (success) {
          campaign.budget = newBudget;
          after = { budget: newBudget };
        }
        break;
      }
      case 'alert': {
        // 纯告警，不修改计划
        success = true;
        after = {};
        break;
      }
    }
  } catch (e) {
    success = false;
    errorMsg = String(e);
  }

  // ─── 写操作日志 ─────────────────────────────────────────────────────────
  const actionDesc = buildActionDesc(rule, campaign, metricValue);
  const log: OperationLog = {
    id:           `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    source:       'auto_rule',
    level:        success ? 'success' : 'error',
    campaignId:   campaign.id,
    campaignName: campaign.name,
    ruleId:       rule.id,
    ruleName:     rule.name,
    action:       actionDesc,
    before,
    after,
    success,
    errorMsg,
    createdAt:    new Date().toISOString(),
  };
  operationLogs.push(log);

  // ─── 发告警 ─────────────────────────────────────────────────────────────
  await alertService.send('rule_triggered', {
    规则:   rule.name,
    计划:   campaign.name,
    指标:   `${rule.metric} = ${metricValue.toFixed(3)}`,
    阈值:   `${rule.operator} ${rule.threshold}`,
    动作:   actionDesc,
    结果:   success ? '✅ 成功' : `❌ 失败: ${errorMsg}`,
  });

  // ─── 更新规则最近触发时间 ────────────────────────────────────────────────
  rule.lastTriggeredAt = new Date().toISOString();
}

function buildActionDesc(rule: AutoRule, campaign: AdCampaign, value: number): string {
  const cond = `${rule.metric} ${rule.operator} ${rule.threshold}（实际 ${value.toFixed(3)}）`;
  switch (rule.action) {
    case 'pause':           return `暂停计划 · ${cond}`;
    case 'resume':          return `恢复计划 · ${cond}`;
    case 'increase_budget': return `提升预算 +${rule.actionValue ?? 20}% · ${cond}`;
    case 'decrease_budget': return `降低预算 -${rule.actionValue ?? 20}% · ${cond}`;
    case 'alert':           return `告警通知 · ${cond}`;
  }
}

// ─── 冷却检查（防止同一计划被频繁调控）──────────────────────────────────
function isInCooldown(rule: AutoRule, campaignId: string): boolean {
  if (!rule.lastTriggeredAt) return false;
  // 查最近一条该规则+该计划的日志
  const last = operationLogs
    .filter(l => l.ruleId === rule.id && l.campaignId === campaignId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!last) return false;
  const elapsed = (Date.now() - new Date(last.createdAt).getTime()) / 60000;
  return elapsed < rule.cooldownMinutes;
}

// ─── 主入口：对所有活跃计划跑一轮规则 ────────────────────────────────────
export async function runRulesOnce(): Promise<{
  checked: number;
  triggered: number;
  errors: number;
}> {
  const enabledRules    = autoRules.filter(r => r.enabled);
  const activeCampaigns = adCampaigns.filter(c => c.status === 'active');

  let triggered = 0;
  let errors    = 0;

  console.log(`[RuleEngine] 开始巡检: ${enabledRules.length} 条规则 × ${activeCampaigns.length} 个活跃计划`);

  // 按账户分组批量拉取，避免逐计划高频请求（40110 限流）
  const byAccount = new Map<string, { acctExternalId: string; campaigns: typeof activeCampaigns }>();
  for (const campaign of activeCampaigns) {
    const acct = accounts.find(a => a.id === campaign.account);
    const externalAccountId = acct?.externalId ?? '';
    // 校验：巨量引擎 local_account_id 必须是纯数字（16-19 位雪花 ID）
    if (!/^\d{10,}$/.test(externalAccountId)) {
      console.warn(`[RuleEngine] 跳过 ${campaign.id}（${campaign.name}）: 账户 ${campaign.account} 无有效外部 ID（当前="${externalAccountId}"）`);
      errors++;
      continue;
    }
    const group = byAccount.get(externalAccountId) ?? { acctExternalId: externalAccountId, campaigns: [] };
    group.campaigns.push(campaign);
    byAccount.set(externalAccountId, group);
  }

  // 逐账户批量拉统计，账户间加 1 秒间隔防限流
  const statsMap = new Map<string, CampaignStats>();
  let accountIdx = 0;
  for (const [acctExtId, group] of byAccount) {
    if (accountIdx++ > 0) await new Promise(r => setTimeout(r, 1000));
    try {
      const externalIds = group.campaigns.map(c => c.externalId ?? c.id);
      const batchStats  = await adAdapter.fetchBatchStats(externalIds, acctExtId);
      for (const st of batchStats) {
        statsMap.set(st.externalId, st);
      }
      console.log(`[RuleEngine] 账户 ${acctExtId}: 拉取 ${batchStats.length}/${group.campaigns.length} 个计划数据`);
    } catch (e) {
      console.error(`[RuleEngine] 账户 ${acctExtId} 批量拉取失败:`, e);
      errors += group.campaigns.length;
    }
  }

  // 用批量拉到的数据评估规则
  for (const campaign of activeCampaigns) {
    const stats = statsMap.get(campaign.externalId ?? campaign.id);
    if (!stats) continue;

    // 同步到内存 DB
    campaign.roas  = stats.roas;
    campaign.ctr   = stats.ctr;
    campaign.cvr   = stats.cvr;
    campaign.cpm   = stats.cpm;
    campaign.spent = stats.spent;
    campaign.gmv   = stats.gmv;
    campaign.lastSyncAt = Date.now();

    // 评估每条规则
    for (const rule of enabledRules) {
      if (rule.brand !== 'all' && rule.brand !== campaign.brand) continue;
      if (isInCooldown(rule, campaign.id)) continue;

      const value   = getMetric(stats, campaign, rule.metric);
      const matches = compare(value, rule.operator, rule.threshold);

      if (matches) {
        triggered++;
        console.log(`[RuleEngine] 规则触发: ${rule.name} → ${campaign.name}`);
        await executeAction(rule, campaign, stats, value);
      }
    }
  }

  console.log(`[RuleEngine] 巡检完成: 触发 ${triggered}，错误 ${errors}`);

  // 硬边界规则跑完后，非阻塞触发 AI 软优化（生成 pending 决策供人工审批）
  if (process.env.ANTHROPIC_API_KEY && process.env.AI_OPTIMIZATION_ENABLED === 'true') {
    import('../ai/ai-orchestrator').then(({ runAiBatchOptimization }) => {
      runAiBatchOptimization()
        .then(n => n > 0 && console.log(`[AiAgent] 批量分析完成，生成 ${n} 条待审批决策`))
        .catch(e => console.error('[AiAgent] 批量分析失败:', e));
    });
  }

  return { checked: activeCampaigns.length, triggered, errors };
}
