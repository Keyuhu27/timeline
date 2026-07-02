// GET /api/ai/decisions — 查询 AI 决策列表
// POST /api/ai/decisions — 审批 { id, action: 'approve'|'reject', recommendationIndex?, approvedBy? }
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
  const body = (req.body ?? {}) as {
    id?: string;
    action?: 'approve' | 'reject';
    recommendationIndex?: number;
    approvedBy?: string;
  };
  const { id, action, recommendationIndex = 0, approvedBy } = body;

  if (!id || !action) return res.json({ error: 'id 和 action 必填' }, 400);

  const decision = aiDecisions.find(d => d.id === id);
  if (!decision) return res.json({ error: '决策不存在' }, 404);
  if (decision.status !== 'pending') return res.json({ error: `决策已是 ${decision.status} 状态` }, 409);

  if (action === 'reject') {
    decision.status = 'rejected';
    decision.rejectedBy = approvedBy ?? 'unknown';
    decision.rejectedAt = new Date().toISOString();
    return res.json({ data: decision });
  }

  // approve → 选中建议 → execute
  const rec = decision.recommendations[recommendationIndex] ?? decision.recommendations[0];
  if (!rec) return res.json({ error: '没有可执行的建议' }, 400);

  decision.status = 'approved';
  decision.approvedBy = approvedBy ?? 'unknown';
  decision.approvedAt = new Date().toISOString();
  decision.selectedRecommendation = rec;

  // hold / manual_review 不调用 OceanEngine API
  if (rec.action === 'hold' || rec.action === 'manual_review') {
    decision.status = 'executed';
    decision.executedAt = new Date().toISOString();
    decision.executionResult = { success: true };
    operationLogs.unshift({
      id: `log_ai_exec_${Date.now()}`,
      source: 'ai_agent',
      level: 'info',
      campaignId: decision.campaignId,
      campaignName: decision.campaignName,
      action: `AI决策确认：${rec.action} · ${rec.reason.slice(0, 60)}`,
      success: true,
      aiReason: rec.reason,
      approvedBy: decision.approvedBy,
      createdAt: new Date().toISOString(),
    });
    return res.json({ data: decision });
  }

  // change_creative 也不调用 OceanEngine API，记录日志
  if (rec.action === 'change_creative') {
    decision.status = 'executed';
    decision.executedAt = new Date().toISOString();
    decision.executionResult = { success: true };
    operationLogs.unshift({
      id: `log_ai_exec_${Date.now()}`,
      source: 'ai_agent',
      level: 'success',
      campaignId: decision.campaignId,
      campaignName: decision.campaignName,
      action: `AI建议换素材 · 创意已生成${decision.creative ? '（含文案/脚本）' : ''} · 待投手操作`,
      success: true,
      aiReason: rec.reason,
      approvedBy: decision.approvedBy,
      createdAt: new Date().toISOString(),
    });
    return res.json({ data: decision });
  }

  // 写保护闸：未开 OCEANENGINE_EXECUTE_WRITES=true 时，批准也只标记为已确认，绝不真实调用 OpenAPI 写。
  if (process.env.OCEANENGINE_EXECUTE_WRITES !== 'true') {
    decision.status = 'executed';
    decision.executedAt = new Date().toISOString();
    decision.executionResult = { success: true };
    operationLogs.unshift({
      id: `log_ai_dryrun_${Date.now()}`,
      source: 'ai_agent',
      level: 'info',
      campaignId: decision.campaignId,
      campaignName: decision.campaignName,
      action: `[dry-run] AI决策已批准但未真实执行（OCEANENGINE_EXECUTE_WRITES 未开）：${rec.action}${rec.suggestedValue ? ` ${rec.suggestedValue}%` : ''}`,
      success: true,
      aiReason: rec.reason,
      approvedBy: decision.approvedBy,
      dryRun: true,
      suggestedAction: rec.action,
      createdAt: new Date().toISOString(),
    });
    return res.json({ data: decision });
  }

  // pause / increase_budget / decrease_budget → 调用真实 OceanEngine API
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

    const before = { status: campaign.status, budget: campaign.budget };

    if (rec.action === 'pause') {
      await adAdapter.pauseCampaign(externalId, advertiserId);
      campaign.status = 'paused';
    } else if (rec.action === 'increase_budget' || rec.action === 'decrease_budget') {
      const pct = (rec.suggestedValue ?? 20) / 100;
      const delta = rec.action === 'increase_budget' ? pct : -pct;
      const newBudget = Math.round(campaign.budget * (1 + delta));
      await adAdapter.adjustBudget(externalId, advertiserId, newBudget);
      campaign.budget = newBudget;
    }

    decision.status = 'executed';
    decision.executedAt = new Date().toISOString();
    decision.executionResult = {
      success: true,
      before,
      after: { status: campaign.status, budget: campaign.budget },
    };

    operationLogs.unshift({
      id: `log_ai_exec_${Date.now()}`,
      source: 'ai_agent',
      level: 'success',
      campaignId: campaign.id,
      campaignName: campaign.name,
      action: `AI决策执行：${rec.action}${rec.suggestedValue ? ` ${rec.suggestedValue}%` : ''}`,
      before,
      after: { status: campaign.status, budget: campaign.budget },
      success: true,
      aiReason: rec.reason,
      approvedBy: decision.approvedBy,
      createdAt: new Date().toISOString(),
    });

    res.json({ data: decision });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    decision.status = 'failed';
    decision.errorMsg = msg;
    decision.executionResult = { success: false, errorMsg: msg };
    res.json({ error: '执行失败: ' + msg }, 500);
  }
};
