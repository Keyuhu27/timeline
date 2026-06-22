// POST /api/ai/analyze — 对单个广告计划进行 AI 诊断
import type { RouteHandler } from '../../../../lib/api';
import { adCampaigns, operationLogs, aiDecisions } from '../../../../lib/db';
import { analyzeCampaign } from '../../../../lib/ai/campaign-analyzer';
import type { AiDecision, AiDecisionAction } from '../../../../types/index';

export const POST: RouteHandler = async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ error: '未配置 ANTHROPIC_API_KEY' }, 503);
  }

  const body = (req.body ?? {}) as { campaignId?: string };
  const { campaignId } = body;
  if (!campaignId) return res.json({ error: 'campaignId 必填' }, 400);

  const campaign = adCampaigns.find(c => c.id === campaignId);
  if (!campaign) return res.json({ error: '计划不存在' }, 404);

  try {
    const diagnosis = await analyzeCampaign(campaign);

    let decision: AiDecision | undefined;
    if (diagnosis.suggestedAction !== 'hold') {
      const leads = campaign.leads ?? (campaign.storeVisits + campaign.phoneCalls + campaign.coupons);
      decision = {
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
    }

    operationLogs.unshift({
      id: `log_ai_${Date.now()}`,
      source: 'ai_analysis',
      level: 'info',
      campaignId: campaign.id,
      campaignName: campaign.name,
      action: `AI诊断：${diagnosis.summary.slice(0, 60)}`,
      success: true,
      aiReason: diagnosis.summary,
      createdAt: new Date().toISOString(),
    });

    res.json({
      data: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        diagnosis,
        decision,
        analysedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ error: 'AI 分析失败: ' + msg }, 500);
  }
};
