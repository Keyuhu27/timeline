// 潮线 Tideline · Layer 1: Performance Analyzer Agent
// 职责：纯诊断，分析计划表现，不建议动作（那是 Recommender 的工作）
import { ask } from './claude-client';
import type { AdCampaign, PerformanceAnalysis } from '../../types/index';

const SYSTEM = `你是专注本地推广告（到店/电话/发券线索）的数据诊断专家。
只做诊断，不给操作建议。严格以 JSON 格式回复，不输出任何其他内容。`;

export interface AnalyzerContext {
  sameAccountAvgCpl?: number;
  sameAccountAvgCtr?: number;
  sevenDayTrend?: Array<{ date: string; spent: number; leads: number; ctr: number }>;
}

export async function performAnalysis(
  campaign: AdCampaign,
  ctx: AnalyzerContext = {},
): Promise<PerformanceAnalysis> {
  const leads = campaign.leads ?? (campaign.storeVisits + campaign.phoneCalls + campaign.coupons);
  const costPerLead = leads > 0 ? (campaign.spent / leads).toFixed(1) : 'N/A';
  const budgetPct = campaign.budget > 0 ? ((campaign.spent / campaign.budget) * 100).toFixed(1) : 'N/A';
  const ctrPct = campaign.ctr > 0 ? (campaign.ctr * 100).toFixed(2) + '%' : 'N/A';

  const ctxBlock = ctx.sameAccountAvgCpl
    ? `同账户其他计划均值：CPL ¥${ctx.sameAccountAvgCpl.toFixed(1)}，CTR ${ctx.sameAccountAvgCtr ? (ctx.sameAccountAvgCtr * 100).toFixed(2) + '%' : 'N/A'}`
    : '同账户对比数据：暂无';

  const trendBlock = ctx.sevenDayTrend?.length
    ? '近7日趋势：\n' + ctx.sevenDayTrend.map(d => `  ${d.date}: 花费¥${d.spent} 线索${d.leads} CTR${(d.ctr * 100).toFixed(2)}%`).join('\n')
    : '历史趋势：暂无';

  const prompt = `诊断以下本地推广告计划，找出问题并解释原因。

【计划数据】
计划名称：${campaign.name}
状态：${campaign.status}
预算：¥${campaign.budget}（已花费 ¥${campaign.spent}，消耗率 ${budgetPct}%）
展现量：${campaign.impressions ?? 'N/A'}
点击量：${campaign.clicks ?? 'N/A'}
点击率 CTR：${ctrPct}
CPM：¥${campaign.cpm || 'N/A'}
到店量：${campaign.storeVisits || 0}
电话确认量：${campaign.phoneCalls || 0}
发券量：${campaign.coupons || 0}
总线索量：${leads}
线索成本（CPL）：¥${costPerLead}
ROI：${campaign.roas || 'N/A'}
${ctxBlock}

${trendBlock}

【行业基准（本地推餐饮/零售/酒旅）】
CTR 健康范围：1.5%–4.0%
合理 CPL：¥30–¥80
合理预算消耗率（当日）：30%–80%
正常日均线索量：视预算，¥500 预算应达 8–20 条

【问题分类】只能使用以下 type：
- low_ctr：点击率低于行业基准
- low_cvr：点击高但转化差（线索少）
- high_cost：CPL 超出合理范围
- low_volume：线索量不足（曝光/流量不足）
- budget_limited：预算消耗过快或已耗尽
- budget_depleted：今日预算已耗完或接近耗完
- data_insufficient：数据量太少无法判断

请诊断并输出 JSON（不含注释）：
{
  "summary": "一句话总结计划现状和主要问题",
  "performanceStatus": "good|warning|bad|unknown",
  "problems": [
    {
      "type": "low_ctr|low_cvr|high_cost|low_volume|budget_limited|budget_depleted|data_insufficient",
      "description": "问题描述",
      "evidence": "具体数据依据，如 CTR 0.8% vs 基准 1.5%",
      "severity": "high|medium|low"
    }
  ],
  "rootCauses": ["根因1", "根因2"],
  "confidence": 0.85
}`;

  const raw = await ask(prompt, SYSTEM);
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('Performance Analyzer: Claude 返回格式不符');
  return JSON.parse(json) as PerformanceAnalysis;
}
