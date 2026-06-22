// GET /api/ai/decisions — 查询 AI 决策列表
// POST /api/ai/decisions — 审批 { id, action: 'approve'|'reject', approvedBy? }
import type { RouteHandler } from '../../../../lib/api';
import { aiDecisions, adCampaigns, operationLogs, accounts } from '../../../../lib/db';
import { adAdapter } from '../../../../lib/adapters/index';

export const GET: RouteHandler = (req, res) => {
  const { status, campaignId } = req.query;

  let list = [...aiDecisions];
  if (status) list = list.filter(d => d.status === status);
  if (campaignId) list = list.filter(d => d.campaignId === campaignId);
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pending = aiDecisions.filter(d => d.status === 'pending').length;
  res.json({ data: { decisions: list, pending, total: list.length } });
};

export const POST: RouteHandler = async (req, res) => {
  const body = (req.body ?? {}) as { id?: string; action?: 'approve' | 'reject'; approvedBy?: string };
  const { id, action, approvedBy } = body;

  if (!id || !action) return res.json({ error: 'id 和 action 必填' }, 400);

  const decision = aiDecisions.find(d => d.id === id);
  if (!decision) return res.json({ error: '决策不存在' }, 404);
  if (decision.status !== 'pending') return res.json({ error: `决策已是 ${decision.status} 状态` }, 409);

  if (action === 'reject') {
    decision.status = 'rejected';
    decision.approvedBy = approvedBy ?? 'unknown';
    return res.json({ data: decision });
  }

  // approve → execute
  decision.status = 'approved';
  decision.approvedBy = approvedBy ?? 'unknown';

  const campaign = adCampaigns.find(c => c.id === decision.campaignId);
  if (!campaign) {
    decision.status = 'failed';
    decision.errorMsg = '计划不存在';
    return res.json({ error: '计划不存在' }, 404);
  }

  try {
    const account = accounts.find(a => a.id === campaign.account || a.externalId === campaign.account);
    const externalId = campaign.externalId ?? '';
    const advertiserId = account?.externalId ?? '';

    if (decision.action === 'pause') {
      await adAdapter.pauseCampaign(externalId, advertiserId);
      campaign.status = 'paused';
    } else if (decision.action === 'resume') {
      await adAdapter.resumeCampaign(externalId, advertiserId);
      campaign.status = 'active';
    } else if (decision.action === 'increase_budget' || decision.action === 'decrease_budget') {
      const pct = (decision.value ?? 20) / 100;
      const delta = decision.action === 'increase_budget' ? pct : -pct;
      const newBudget = Math.round(campaign.budget * (1 + delta));
      await adAdapter.adjustBudget(externalId, advertiserId, newBudget);
      campaign.budget = newBudget;
    }

    decision.status = 'executed';
    decision.executedAt = new Date().toISOString();

    operationLogs.unshift({
      id: `log_ai_exec_${Date.now()}`,
      source: 'ai_agent',
      level: 'success',
      campaignId: campaign.id,
      campaignName: campaign.name,
      action: `AI决策执行：${decision.action}${decision.value ? ` ${decision.value}%` : ''}`,
      success: true,
      aiReason: decision.reason,
      approvedBy: decision.approvedBy,
      createdAt: new Date().toISOString(),
    });

    res.json({ data: decision });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    decision.status = 'failed';
    decision.errorMsg = msg;
    res.json({ error: '执行失败: ' + msg }, 500);
  }
};
