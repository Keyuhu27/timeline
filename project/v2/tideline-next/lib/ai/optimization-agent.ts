// 潮线 Tideline · AI 优化 Agent（非阻塞，生成待审批决策）
import { analyzeCampaign } from './campaign-analyzer';
import { adCampaigns, operationLogs, aiDecisions } from '../db';
import type { AiDecision, AiDecisionAction } from '../../types/index';

export async function runAiOptimizationOnce(): Promise<number> {
  const active = adCampaigns.filter(c => c.status === 'active');
  let count = 0;

  for (const campaign of active) {
    try {
      const diagnosis = await analyzeCampaign(campaign);

      if (diagnosis.suggestedAction === 'hold') continue;

      const leads = campaign.leads ?? (campaign.storeVisits + campaign.phoneCalls + campaign.coupons);
      const decision: AiDecision = {
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: diagnosis.suggestedAction as AiDecisionAction,
        value: diagnosis.suggestedValue,
        reason: diagnosis.summary,
        metrics: {
          spent: campaign.spent,
          budget: campaign.budget,
          ctr: campaign.ctr,
          leads,
          costPerLead: leads > 0 ? campaign.spent / leads : 0,
          roas: campaign.roas,
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      aiDecisions.push(decision);

      operationLogs.unshift({
        id: `log_ai_${Date.now()}`,
        source: 'ai_agent',
        level: 'info',
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: `AI建议：${diagnosis.suggestedAction}${diagnosis.suggestedValue ? ` ${diagnosis.suggestedValue}%` : ''} · 待审批`,
        before: { status: campaign.status, budget: campaign.budget },
        success: true,
        aiReason: diagnosis.summary,
        createdAt: new Date().toISOString(),
      });

      count++;
    } catch {
      // skip individual campaign errors
    }
  }

  return count;
}
