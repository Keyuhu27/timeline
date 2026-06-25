// GET   /api/ads?brand=b4&status=active
// POST  /api/ads   { name, brand, account, budget, goal, productIds?, startDate }
// PATCH /api/ads?id=c1  { status?, budget?, name? }

import { adCampaigns, brands, accounts, normalizeOceanEngineAccountId, visibleAccounts } from '../../../lib/db';
import { ok, err, paginate }             from '../../../lib/api';
import { adAdapter }                     from '../../../lib/adapters/index';
import { saveSnapshot }                  from '../../../lib/persist';
import type { RouteHandler }             from '../../../lib/api';
import type { AdCampaign }              from '../../../types/index';

export const GET: RouteHandler = (req, res) => {
  const { brand, status } = req.query;
  // 隐藏归档账户的计划（hidden 账户不在常规列表展示）
  const hiddenAccountIds = new Set(accounts.filter(a => a.hidden).map(a => a.id));
  let filtered = adCampaigns.filter(c => !hiddenAccountIds.has(c.account));
  if (brand) {
    // 通过 externalId 跨越种子/持久化 ID 边界匹配计划
    // 例：seed brand b10 的账户 externalId=1770545948162062，同步计划存为 brand=b_1770545948162062
    const seedAcct = accounts.find(a => a.brand === brand);
    const extId = seedAcct?.externalId;
    const allAccountIds = new Set<string>();
    accounts.forEach(a => {
      if (a.brand === brand) allAccountIds.add(a.id);
      if (extId && a.externalId === extId) allAccountIds.add(a.id);
    });
    // 同样收集所有与该 brand 同名的持久化 brand id
    const seedBrand = brands.find(b => b.id === brand);
    const brandIds = new Set<string>([brand as string]);
    if (seedBrand) {
      brands.forEach(b => { if (b.name === seedBrand.name) brandIds.add(b.id); });
    }
    filtered = filtered.filter(c => brandIds.has(c.brand) || allAccountIds.has(c.account));
  }
  if (status) filtered = filtered.filter(c => c.status === status);

  const all = filtered;
  const summary = {
    totalBudget:  all.reduce((s, c) => s + c.budget,      0),
    totalSpent:   all.reduce((s, c) => s + c.spent,       0),
    totalLeads:   all.reduce((s, c) => s + (c.leads ?? 0), 0),
    totalVisits:  all.reduce((s, c) => s + (c.storeVisits ?? 0), 0),
    totalCalls:   all.reduce((s, c) => s + (c.phoneCalls  ?? 0), 0),
    activeCnt:    all.filter(c => c.status === 'active').length,
    lastSyncAt:   all.length ? Math.max(...all.map(c => c.lastSyncAt ?? 0)) || null : null,
  };

  // 今日消耗：优先 statQuery（后台首页全域口径）> globalReport > null
  let statQueryReport: (NonNullable<import('../../../types/index').Account['statQueryReport']> & { localAccountId?: string }) | null = null;
  let accountReport: (NonNullable<import('../../../types/index').Account['globalReport']> & { localAccountId?: string }) | null = null;
  if (brand) {
    // 先找种子账户，再找持久化账户（externalId 匹配）
    const seedAcctForReport = accounts.find(a => a.brand === brand);
    const extIdForReport = seedAcctForReport?.externalId;
    const acct = seedAcctForReport ??
      (extIdForReport ? accounts.find(a => a.externalId === extIdForReport && (a.statQueryReport || a.globalReport)) : undefined);
    if (acct?.statQueryReport) statQueryReport = { ...acct.statQueryReport, localAccountId: acct.externalId };
    if (acct?.globalReport)    accountReport   = { ...acct.globalReport,   localAccountId: acct.externalId };
  }

  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, { campaigns: items, summary, statQueryReport, accountReport }, { total, page, pageSize });
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
      advertiserId: normalizeOceanEngineAccountId(body.account),
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
    advertiserId = normalizeOceanEngineAccountId(campaign.account);
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
    const advertiserId = normalizeOceanEngineAccountId(campaign.account);
    await adAdapter.pauseCampaign(externalId, advertiserId);
  } catch (e) {
    console.warn('[DELETE /api/ads] 适配器暂停失败:', e);
  }

  campaign.status = 'ended';
  saveSnapshot();
  ok(res, { id, status: 'ended' });
};
