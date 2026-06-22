// POST /api/ai/analyze — 触发单计划 4层 AI 分析 pipeline
import type { RouteHandler } from '../../../../lib/api';
import { adCampaigns } from '../../../../lib/db';
import { analyzeAndRecommend } from '../../../../lib/ai/ai-orchestrator';

export const POST: RouteHandler = async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ error: 'ANTHROPIC_API_KEY 未配置' }, 503);
  }

  const { campaignId } = (req.body ?? {}) as { campaignId?: string };
  if (!campaignId) return res.json({ error: 'campaignId 必填' }, 400);

  const campaign = adCampaigns.find(c => c.id === campaignId);
  if (!campaign) return res.json({ error: '计划不存在' }, 404);

  try {
    const decision = await analyzeAndRecommend(campaign);
    res.json({ data: decision });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ error: '分析失败: ' + msg }, 500);
  }
};
