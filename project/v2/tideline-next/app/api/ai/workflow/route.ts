// GET /api/ai/workflow — 工作流首页聚合数据
import type { RouteHandler } from '../../../../lib/api';
import { adCampaigns, aiDecisions, operationLogs } from '../../../../lib/db';

export const GET: RouteHandler = (req, res) => {
  // 计划汇总（真实同步数据）
  const active = adCampaigns.filter(c => c.status === 'active');
  const totalSpent = adCampaigns.reduce((s, c) => s + c.spent, 0);
  const totalLeads = adCampaigns.reduce((s, c) => {
    const leads = c.leads ?? (c.storeVisits + c.phoneCalls + c.coupons);
    return s + leads;
  }, 0);
  const totalBudget = adCampaigns.reduce((s, c) => s + c.budget, 0);
  const avgCostPerLead = totalLeads > 0 ? totalSpent / totalLeads : 0;

  // 待确认的 AI 决策（最多5条，按 performanceStatus 排序：bad 优先）
  const pendingDecisions = aiDecisions
    .filter(d => d.status === 'pending')
    .sort((a, b) => {
      const order = { bad: 0, warning: 1, good: 2, unknown: 3 };
      return (order[a.analysis.performanceStatus] ?? 3) - (order[b.analysis.performanceStatus] ?? 3);
    })
    .slice(0, 5);

  // 近10条操作日志
  const recentLogs = [...operationLogs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);

  // AI 运行状态
  const today = new Date().toISOString().slice(0, 10);
  const todayDecisions = aiDecisions.filter(d => d.createdAt.startsWith(today));
  const lastAiLog = operationLogs.find(l => l.source === 'ai_agent' || l.source === 'ai_analysis');

  res.json({
    data: {
      campaignSummary: {
        totalSpent,
        totalLeads,
        totalBudget,
        activeCnt: active.length,
        totalCnt: adCampaigns.length,
        avgCostPerLead: Math.round(avgCostPerLead * 10) / 10,
      },
      pendingDecisions,
      recentLogs,
      aiStatus: {
        lastRunAt: lastAiLog?.createdAt ?? null,
        decisionsToday: todayDecisions.length,
        pendingCount: aiDecisions.filter(d => d.status === 'pending').length,
        executedToday: todayDecisions.filter(d => d.status === 'executed').length,
      },
    },
  });
};
