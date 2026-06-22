// GET   /api/ads?brand=b4&status=active
// POST  /api/ads   { name, brand, account, budget, goal, productIds?, startDate }
// PATCH /api/ads?id=c1  { status?, budget?, name? }

import { adCampaigns, brands, accounts, resolveExternalAccountId } from '../../../lib/db';
import { ok, err, paginate }             from '../../../lib/api';
import { adAdapter }                     from '../../../lib/adapters/index';
import { saveSnapshot }                  from '../../../lib/persist';
import type { RouteHandler }             from '../../../lib/api';
import type { AdCampaign }              from '../../../types/index';

export const GET: RouteHandler = (req, res) => {
  const { brand, status } = req.query;
  let filtered = adCampaigns.slice();
  if (brand)  filtered = filtered.filter(c => c.brand  === brand);
  if (status) filtered = filtered.filter(c => c.status === status);

  const all = adCampaigns;
  const summary = {
    totalBudget:  all.reduce((s, c) => s + c.budget,      0),
    totalSpent:   all.reduce((s, c) => s + c.spent,       0),
    totalLeads:   all.reduce((s, c) => s + (c.leads ?? 0), 0),
    totalVisits:  all.reduce((s, c) => s + (c.storeVisits ?? 0), 0),
    totalCalls:   all.reduce((s, c) => s + (c.phoneCalls  ?? 0), 0),
    activeCnt:    all.filter(c => c.status === 'active').length,
    lastSyncAt:   all.length ? Math.max(...all.map(c => c.lastSyncAt ?? 0)) || null : null,
  };

  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, { campaigns: items, summary }, { total, page, pageSize });
};

export const POST: RouteHandler = async (req, res) => {
  const body = req.body as Partial<AdCampaign> & { goal?: string; productIds?: string[] };

  if (!body.name || !body.brand || !body.account || !body.budget) {
    return err(res, 'name, brand, account, budget 为必填项');
  }
  if (!brands.find(b => b.id === body.brand)) {
    return err(res, `brand ${body.brand} 不存在`);
  }
  const account = accounts.find(a => a.id === body.account);
  if (!account) {
    return err(res, `account ${body.account} 不存在`);
  }

  // 调用适配器（Mock 或真实 API）
  let externalId: string | undefined;
  try {
    const result = await adAdapter.createCampaign({
      name:         body.name,
      advertiserId: resolveExternalAccountId(body.account),
      budget:       body.budget,
      goal:         (body.goal ?? 'video_sales') as 'video_sales' | 'live_room' | 'product_card' | 'follow',
      productIds:   body.productIds,
      startDate:    body.startDate ?? new Date().toISOString().slice(0, 10),
    });
    externalId = result.externalId;
  } catch (e) {
    console.warn('[POST /api/ads] 适配器调用失败，使用本地 ID:', e);
  }

  const campaign: AdCampaign = {
    id:         `c${Date.now()}`,
    name:       body.name,
    brand:      body.brand,
    account:    body.account,
    budget:     body.budget,
    spent:      0,
    roas:       0,
    cpm:        0,
    ctr:        0,
    cvr:        0,
    gmv:        0,
    status:     'active',
    startDate:  body.startDate ?? new Date().toISOString().slice(0, 10),
    externalId,
  };
  adCampaigns.push(campaign);
  ok(res, campaign);
};

export const PATCH: RouteHandler = async (req, res) => {
  const { id } = req.query;
  const idx = adCampaigns.findIndex(c => c.id === id);
  if (idx === -1) return err(res, '计划不存在', 404);

  const campaign = adCampaigns[idx]!;
  const body = req.body as Partial<AdCampaign>;
  const externalId = campaign.externalId ?? campaign.id;
  let advertiserId: string;
  try {
    advertiserId = resolveExternalAccountId(campaign.account);
  } catch (e) {
    console.warn('[PATCH /api/ads] 无法解析账户外部 ID，跳过 OceanEngine 调用:', e);
    Object.assign(campaign, body);
    saveSnapshot();
    return ok(res, campaign);
  }

  // 状态变更 → 调用适配器
  if (body.status && body.status !== campaign.status) {
    try {
      if (body.status === 'paused') {
        await adAdapter.pauseCampaign(externalId, advertiserId);
      } else if (body.status === 'active') {
        await adAdapter.resumeCampaign(externalId, advertiserId);
      }
    } catch (e) {
      console.warn('[PATCH /api/ads] 状态变更适配器失败:', e);
    }
  }

  // 预算变更 → 调用适配器
  if (body.budget && body.budget !== campaign.budget) {
    try {
      await adAdapter.adjustBudget(externalId, advertiserId, body.budget);
    } catch (e) {
      console.warn('[PATCH /api/ads] 预算调整适配器失败:', e);
    }
  }

  Object.assign(campaign, body);
  saveSnapshot();
  ok(res, campaign);
};

// DELETE /api/ads?id=c1  → 结束计划
export const DELETE: RouteHandler = async (req, res) => {
  const { id } = req.query;
  const campaign = adCampaigns.find(c => c.id === id);
  if (!campaign) return err(res, '计划不存在', 404);

  const externalId = campaign.externalId ?? campaign.id;
  try {
    const advertiserId = resolveExternalAccountId(campaign.account);
    await adAdapter.pauseCampaign(externalId, advertiserId);
  } catch (e) {
    console.warn('[DELETE /api/ads] 适配器暂停失败:', e);
  }

  campaign.status = 'ended';
  saveSnapshot();
  ok(res, { id, status: 'ended' });
};
