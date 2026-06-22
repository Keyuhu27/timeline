// 潮线 Tideline · Layer 2: Optimization Recommender Agent
// 职责：把诊断结果转成可执行建议，标注风险和是否触发创意 Agent
// 注意：只生成 pending 建议，不直接执行
import { ask } from './claude-client';
import type { AdCampaign, PerformanceAnalysis, AiRecommendation } from '../../types/index';

const SYSTEM = `你是本地推广告优化策略专家。
根据诊断结果给出可执行建议，标注风险等级和是否需要人工确认。
严格以 JSON 格式回复，不输出任何其他内容。`;

export async function recommendActions(
  analysis: PerformanceAnalysis,
  campaign: AdCampaign,
): Promise<AiRecommendation[]> {
  const leads = campaign.leads ?? (campaign.storeVisits + campaign.phoneCalls + campaign.coupons);
  const costPerLead = leads > 0 ? (campaign.spent / leads).toFixed(1) : 'N/A';
  const budgetPct = campaign.budget > 0 ? ((campaign.spent / campaign.budget) * 100).toFixed(1) : 'N/A';

  const problemsSummary = analysis.problems
    .map(p => `- [${p.severity}] ${p.type}：${p.description}（${p.evidence}）`)
    .join('\n');

  const prompt = `根据以下诊断结果，为本地推广告计划生成优化建议。

【计划基本信息】
计划名：${campaign.name}
状态：${campaign.status}
预算：¥${campaign.budget}（消耗 ${budgetPct}%，已花费 ¥${campaign.spent}）
总线索：${leads}，CPL：¥${costPerLead}
CTR：${campaign.ctr > 0 ? (campaign.ctr * 100).toFixed(2) + '%' : 'N/A'}

【诊断结果】
总结：${analysis.summary}
表现状态：${analysis.performanceStatus}
问题列表：
${problemsSummary}
根因：${analysis.rootCauses.join('；')}
置信度：${analysis.confidence}

【可用动作类型】
- hold：维持现状，继续观察
- pause：暂停计划（高风险，需人工确认）
- increase_budget：提升预算（涉及花钱，需人工确认）
- decrease_budget：降低预算（涉及花钱，需人工确认）
- change_creative：更换素材/文案（需人工确认）
- manual_review：提交人工复审

【联动规则（触发 creative Agent）】
- 若诊断有 low_ctr 问题 → 建议 change_creative，triggerCreative: true，creativeContext: "low_ctr"
- 若诊断有 low_cvr 问题 → 建议 change_creative，triggerCreative: true，creativeContext: "low_cvr"
- 其他问题不触发 creative Agent

【风险等级规则】
- pause / increase_budget / decrease_budget → riskLevel: "high"，requiresApproval: true
- change_creative → riskLevel: "medium"，requiresApproval: true
- hold / manual_review → riskLevel: "low"，requiresApproval: false

输出 JSON（按 priority high→medium→low 排序，最多3条建议）：
{
  "recommendations": [
    {
      "priority": "high|medium|low",
      "action": "hold|pause|increase_budget|decrease_budget|change_creative|manual_review",
      "suggestedValue": 20,
      "reason": "建议理由",
      "riskLevel": "low|medium|high",
      "requiresApproval": true,
      "triggerCreative": false,
      "creativeContext": "low_ctr|low_cvr|standalone"
    }
  ]
}`;

  const raw = await ask(prompt, SYSTEM);
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('Optimization Recommender: Claude 返回格式不符');
  const parsed = JSON.parse(json) as { recommendations: AiRecommendation[] };
  return parsed.recommendations ?? [];
}
