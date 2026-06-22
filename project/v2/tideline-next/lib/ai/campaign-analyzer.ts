// 潮线 Tideline · 广告计划 AI 诊断
import { ask } from './claude-client';
import type { AdCampaign } from '../../types/index';

const SYSTEM = `你是一名专注本地推广告（到店/电话/发券线索）的投放优化专家。
请严格以 JSON 格式回复，不输出任何其他内容。`;

export interface AnalysisDiagnosis {
  summary: string;
  issues: Array<{ severity: 'high' | 'medium' | 'low'; desc: string }>;
  recommendations: Array<{ priority: number; action: string; reason: string }>;
  suggestedAction: 'pause' | 'increase_budget' | 'decrease_budget' | 'alert' | 'hold';
  suggestedValue?: number;  // 预算调整百分比
  confidence: 'high' | 'medium' | 'low';
}

export async function analyzeCampaign(campaign: AdCampaign): Promise<AnalysisDiagnosis> {
  const leads = campaign.leads ?? (campaign.storeVisits + campaign.phoneCalls + campaign.coupons);
  const costPerLead = leads > 0 ? (campaign.spent / leads).toFixed(1) : 'N/A';
  const budgetPct = campaign.budget > 0 ? ((campaign.spent / campaign.budget) * 100).toFixed(1) : 'N/A';

  const prompt = `分析以下本地推广告计划数据，输出诊断结论。

计划名称：${campaign.name}
状态：${campaign.status}
预算：¥${campaign.budget}（已花费 ¥${campaign.spent}，${budgetPct}%）
点击率 CTR：${campaign.ctr > 0 ? (campaign.ctr * 100).toFixed(2) + '%' : 'N/A'}
CPM：¥${campaign.cpm || 'N/A'}
到店量：${campaign.storeVisits || 0}
电话确认量：${campaign.phoneCalls || 0}
发券量：${campaign.coupons || 0}
总线索量：${leads}
线索成本：¥${costPerLead}
ROI：${campaign.roas || 'N/A'}

行业参考基准（本地推餐饮/零售）：
- 合理线索成本：¥30-80
- CTR 健康范围：1.5%-4%
- 预算消耗进度（当日）：白天 30-60%

请输出如下 JSON：
{
  "summary": "一句话总结计划现状",
  "issues": [
    { "severity": "high|medium|low", "desc": "问题描述" }
  ],
  "recommendations": [
    { "priority": 1, "action": "具体操作建议", "reason": "依据" }
  ],
  "suggestedAction": "pause|increase_budget|decrease_budget|alert|hold",
  "suggestedValue": 20,
  "confidence": "high|medium|low"
}`;

  const raw = await ask(prompt, SYSTEM);
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('Claude 返回格式不符');
  return JSON.parse(json) as AnalysisDiagnosis;
}
