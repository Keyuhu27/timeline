// 潮线 Tideline · AI Pipeline Orchestrator
// 串联 4 层 Agent：Analyzer → Recommender → (Creative) → AiDecision
// 只创建 pending 决策，不直接执行
import { performAnalysis, type AnalyzerContext } from './performance-analyzer';
import { recommendActions } from './optimization-recommender';
import { generateCreative } from './creative-generator';
import { adCampaigns, accounts, operationLogs, aiDecisions } from '../db';
import type { AdCampaign, AiDecision } from '../../types/index';

function buildContext(campaign: AdCampaign): AnalyzerContext {
  const sameAccountCampaigns = adCampaigns.filter(
    c => c.account === campaign.account && c.id !== campaign.id && c.status === 'active',
  );
  if (!sameAccountCampaigns.length) return {};

  const avgCpl = sameAccountCampaigns.reduce((s, c) => {
    const leads = c.leads ?? (c.storeVisits + c.phoneCalls + c.coupons);
    return s + (leads > 0 ? c.spent / leads : 0);
  }, 0) / sameAccountCampaigns.length;

  const avgCtr = sameAccountCampaigns.reduce((s, c) => s + c.ctr, 0) / sameAccountCampaigns.length;

  return { sameAccountAvgCpl: avgCpl, sameAccountAvgCtr: avgCtr };
}

export async function analyzeAndRecommend(campaign: AdCampaign): Promise<AiDecision> {
  const account = accounts.find(a => a.id === campaign.account || a.externalId === campaign.account);

  // Layer 1: Analyze
  const ctx = buildContext(campaign);
  const analysis = await performAnalysis(campaign, ctx);

  // Layer 2: Recommend
  const recommendations = await recommendActions(analysis, campaign);

  // Layer 3: Creative（如果最高优先级建议触发了 creative）
  let creative;
  const topRec = recommendations[0];
  if (topRec?.triggerCreative && topRec.creativeContext) {
    try {
      creative = await generateCreative({
        storeName: account?.name ?? campaign.name,
        product: campaign.name,
        trigger: topRec.creativeContext,
        diagnosisSummary: analysis.summary,
      });
    } catch {
      // creative 失败不阻断整个 pipeline
    }
  }

  // 组装 AiDecision（status: pending）
  const leads = campaign.leads ?? (campaign.storeVisits + campaign.phoneCalls + campaign.coupons);
  const decision: AiDecision = {
    id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    campaignId: campaign.id,
    campaignName: campaign.name,
    accountId: account?.id ?? campaign.account,
    status: 'pending',
    analysis,
    recommendations,
    creative,
    metricsSnapshot: {
      spent: campaign.spent,
      budget: campaign.budget,
      ctr: campaign.ctr,
      leads,
      costPerLead: leads > 0 ? campaign.spent / leads : 0,
      roas: campaign.roas,
      storeVisits: campaign.storeVisits,
      phoneCalls: campaign.phoneCalls,
    },
    createdAt: new Date().toISOString(),
    tenantId: campaign.tenantId,
  };

  aiDecisions.push(decision);

  operationLogs.unshift({
    id: `log_ai_${Date.now()}`,
    source: 'ai_agent',
    level: analysis.performanceStatus === 'bad' ? 'warn' : 'info',
    campaignId: campaign.id,
    campaignName: campaign.name,
    action: `AI诊断完成：${analysis.performanceStatus} · ${recommendations.length}条建议${creative ? ' · 已生成创意' : ''} · 待审批`,
    before: { status: campaign.status, budget: campaign.budget },
    success: true,
    aiReason: analysis.summary,
    createdAt: new Date().toISOString(),
    tenantId: campaign.tenantId,
  });

  return decision;
}

export async function runAiBatchOptimization(): Promise<number> {
  if (!process.env.ANTHROPIC_API_KEY) return 0;

  const active = adCampaigns.filter(c => c.status === 'active');
  let count = 0;

  for (const campaign of active) {
    // 跳过今日已有 pending 决策的计划，避免重复分析
    const alreadyPending = aiDecisions.some(
      d => d.campaignId === campaign.id && d.status === 'pending',
    );
    if (alreadyPending) continue;

    try {
      await analyzeAndRecommend(campaign);
      count++;
    } catch {
      // 单计划失败不阻断批量
    }
  }

  return count;
}
