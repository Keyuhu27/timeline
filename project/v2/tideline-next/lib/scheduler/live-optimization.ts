// 潮线 Tideline · 直播间优化投流 V1（计划级只读巡检，ROI 红线进人工审批）
// 每 5 分钟读取每个活跃计划的全域成交汇总（getOrderStatsData，只读 Cookie），
// 用确定性规则判断异常/可放大：
//   · ROI 红线命中（关停 LIVE_LOW_ROI / 追投 LIVE_GOOD_PERF）→ 进 aiDecisions 待审批，
//     人工点「批准」后才会调用真实 OpenAPI；是否真实执行还受 OCEANENGINE_EXECUTE_WRITES 闸控制
//     （未开闸时批准也只标记 dry-run，双重保险）。
//   · 其余控损规则（空烧/订单成本）暂仍只写 operationLogs，不生成待审批项。
// 护栏：缺数据/null 不触发；同 ruleCode+计划 30min 冷却不重复；新计划 30min 冷启动只观察不控损。

import { adCampaigns, operationLogs, aiDecisions, normalizeOceanEngineAccountId, brandById } from '../db';
import { OceanEngineAdapter } from '../adapters/oceanengine-adapter';
import type { OperationLog, AiDecision } from '../../types/index';

const COOLDOWN_MIN   = 30;   // 同 ruleCode+计划 冷却
const COLD_START_MIN = 30;   // 新计划冷启动：只观察不控损
const TH = {
  spendControl: 100, spendScale: 50,
  roiStop: 6.5,              // 全域支付ROI < 6.5 → 关停
  roiBoost: 7.0,             // 全域支付ROI > 7.0 → 追加预算
  boostBudgetAbsolute: 10000, // 追加预算固定金额（元）
  orderCostHigh: 30,
};

// 计划首见时间（冷启动判定，进程内存）
const firstSeen = new Map<string, number>();

export interface LiveOptHit {
  brandId: string; brandName: string; advertiserId: string;
  campaignId: string; projectId: string; materialName: string;
  spent: number | null; globalGmv: number | null; globalOrderCount: number | null;
  globalPayRoi: number | null; globalOrderCost: number | null;
  ruleCode: string; ruleName: string; kind: 'control' | 'scale';
  suggestedAction: string; evidence: string; dryRun: boolean; requiresApproval: boolean; createdAt: string;
}

let lastScan: { at: string | null; status: 'idle' | 'running' | 'ok' | 'error'; checked: number; hits: LiveOptHit[]; error?: string } = {
  at: null, status: 'idle', checked: 0, hits: [],
};

export function getLastLiveOptScan() {
  const pending = aiDecisions.filter(d => d.status === 'pending' && d.id.startsWith('liveopt_'));
  return { ...lastScan, pending };
}

function bjToday(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

function inCooldown(ruleCode: string, projectId: string): boolean {
  const last = operationLogs
    .filter(l => l.ruleCode === ruleCode && l.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!last) return false;
  return (Date.now() - new Date(last.createdAt).getTime()) / 60000 < COOLDOWN_MIN;
}

interface Stats { spent: number | null; globalGmv: number | null; globalOrderCount: number | null; globalPayRoi: number | null; globalOrderCost: number | null }

// 规则表：requiresApproval=true → 命中后进 aiDecisions 待审批（人工点批准才可能真实执行）；
//         否则沿用旧行为，只写 operationLogs（dry-run，无法从界面直接操作）。
const RULES: Array<{
  code: string; name: string; kind: 'control' | 'scale'; action: string;
  test: (s: Stats) => boolean; text: string; requiresApproval?: boolean;
}> = [
  {
    code: 'LIVE_EMPTY_BURN', name: '直播间空烧控损', kind: 'control', action: 'pause',
    test: s => s.spent != null && s.globalOrderCount != null && s.spent > TH.spendControl && s.globalOrderCount === 0,
    text: '该计划已有明显消耗但暂无全域成交订单，建议检查直播间承接、主播话术、商品机制，并考虑降低低效投放。',
  },
  {
    code: 'LIVE_LOW_ROI', name: '直播间 ROI 低于红线', kind: 'control', action: 'pause', requiresApproval: true,
    test: s => s.spent != null && s.globalPayRoi != null && s.spent > TH.spendControl && s.globalPayRoi < TH.roiStop,
    text: `该计划全域支付 ROI 低于关停红线 ${TH.roiStop}，建议关停投放计划。`,
  },
  {
    code: 'LIVE_HIGH_ORDER_COST', name: '订单成本偏高', kind: 'control', action: 'decrease_budget',
    test: s => s.spent != null && s.globalOrderCost != null && s.spent > TH.spendControl && s.globalOrderCost > TH.orderCostHigh,
    text: '该计划全域成交订单成本偏高，建议检查投放人群、讲品节奏和商品转化。',
  },
  {
    code: 'LIVE_GOOD_PERF', name: '直播间表现优于红线', kind: 'scale', action: 'increase_budget', requiresApproval: true,
    test: s => s.spent != null && s.globalPayRoi != null && s.spent > TH.spendScale && s.globalPayRoi > TH.roiBoost,
    text: `该计划全域支付 ROI 高于追投红线 ${TH.roiBoost}，建议追加日预算 ¥${TH.boostBudgetAbsolute}。`,
  },
];

function evidenceOf(s: Stats): string {
  const y = (v: number | null) => (v == null ? '—' : `¥${v}`);
  const n = (v: number | null) => (v == null ? '—' : String(v));
  return `消耗 ${y(s.spent)} · 全域成交金额 ${y(s.globalGmv)} · 全域订单 ${n(s.globalOrderCount)} · 支付ROI ${n(s.globalPayRoi)} · 订单成本 ${y(s.globalOrderCost)}`;
}

export async function runLiveOptimizationOnce(): Promise<{ checked: number; hits: number }> {
  lastScan = { at: new Date().toISOString(), status: 'running', checked: lastScan.checked, hits: lastScan.hits };
  const date = bjToday();
  const active = adCampaigns.filter(c => c.status === 'active' && c.externalId);
  const hits: LiveOptHit[] = [];
  let checked = 0;

  try {
    for (const c of active) {
      let advid: string;
      try { advid = normalizeOceanEngineAccountId(c.account); } catch { continue; }
      const projectId = c.externalId!;
      const raw = await OceanEngineAdapter.fetchOrderStatsForProject(advid, projectId, date);
      if (!raw) continue; // 未配 cookie / 风控 / 拉取失败 → 跳过，不触发
      checked++;
      const s: Stats = {
        spent: raw.spent, globalGmv: raw.globalGmv, globalOrderCount: raw.globalOrderCount,
        globalPayRoi: raw.globalPayRoi, globalOrderCost: raw.globalOrderCost,
      };

      // 冷启动：首见计划记录时间，30min 内只观察不控损
      if (!firstSeen.has(projectId)) firstSeen.set(projectId, Date.now());
      const isColdStart = (Date.now() - (firstSeen.get(projectId) ?? 0)) / 60000 < COLD_START_MIN;

      const brand = brandById(c.brand);
      for (const rule of RULES) {
        if (!rule.test(s)) continue;
        if (rule.kind === 'control' && isColdStart) continue;      // 冷启动不控损
        if (inCooldown(rule.code, projectId)) continue;            // 冷却内不重复

        const evidence = evidenceOf(s);
        const createdAt = new Date().toISOString();
        const needsApproval = !!rule.requiresApproval;
        const hit: LiveOptHit = {
          brandId: c.brand, brandName: brand?.name ?? c.brand, advertiserId: advid,
          campaignId: c.id, projectId, materialName: c.name,
          spent: s.spent, globalGmv: s.globalGmv, globalOrderCount: s.globalOrderCount,
          globalPayRoi: s.globalPayRoi, globalOrderCost: s.globalOrderCost,
          ruleCode: rule.code, ruleName: rule.name, kind: rule.kind,
          suggestedAction: rule.action, evidence, dryRun: true, requiresApproval: needsApproval, createdAt,
        };
        hits.push(hit);

        // 操作日志：始终记录一条，标注是否已转入待审批
        const log: OperationLog = {
          id: `log_liveopt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          source: 'ai_agent',
          level: rule.kind === 'control' ? 'warn' : 'info',
          campaignId: c.id, campaignName: c.name,
          action: needsApproval
            ? `[直播间优化·待审批] ${rule.name} → ${rule.action}｜${rule.text}`
            : `[直播间优化·dry-run] ${rule.name} → ${rule.action}｜${rule.text}`,
          success: true, createdAt,
          brandId: c.brand, advertiserId: advid, projectId, ruleCode: rule.code,
          evidence, suggestedAction: rule.action, dryRun: !needsApproval,
        };
        operationLogs.unshift(log);

        // ROI 红线命中（关停 / 追投）→ 生成待审批决策；批准后按 OCEANENGINE_EXECUTE_WRITES 闸决定是否真实执行
        if (needsApproval) {
          const recommendation =
            rule.action === 'increase_budget'
              ? { priority: 'medium' as const, action: 'increase_budget' as const, budgetDeltaAbsolute: TH.boostBudgetAbsolute,
                  reason: `${rule.name}｜${evidence}`, riskLevel: 'medium' as const, requiresApproval: true }
              : { priority: 'high' as const, action: 'pause' as const,
                  reason: `${rule.name}｜${evidence}`, riskLevel: 'medium' as const, requiresApproval: true };

          const decision: AiDecision = {
            id: `liveopt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            campaignId: c.id, campaignName: c.name, accountId: advid,
            status: 'pending',
            analysis: { summary: rule.text, performanceStatus: rule.action === 'pause' ? 'bad' : 'good', problems: [], rootCauses: [], confidence: 0.6 },
            recommendations: [recommendation],
            metricsSnapshot: {
              spent: s.spent ?? 0, budget: c.budget ?? 0, ctr: 0, leads: 0,
              costPerLead: 0, roas: s.globalPayRoi ?? 0, storeVisits: 0, phoneCalls: 0,
            },
            createdAt,
          };
          aiDecisions.unshift(decision);
        }
      }
    }
    lastScan = { at: new Date().toISOString(), status: 'ok', checked, hits };
  } catch (e) {
    lastScan = { at: new Date().toISOString(), status: 'error', checked, hits, error: String(e) };
  }
  console.log(`[LiveOpt] 巡检完成: checked=${checked} hits=${hits.length}`);
  return { checked, hits: hits.length };
}
