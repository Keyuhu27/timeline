// GET  /api/accounts         — 返回当前账户列表
// POST /api/accounts/sync    — 从巨量引擎 API 自动发现并同步所有授权广告主

import { accounts, brands, adCampaigns } from '../../../lib/db';
import { ok, err, paginate }             from '../../../lib/api';
import { OceanEngineAdapter }            from '../../../lib/adapters/oceanengine-adapter';
import { tokenManager, adAdapter }       from '../../../lib/adapters/index';
import type { RouteHandler }             from '../../../lib/api';
import type { Account, Brand, AdCampaign } from '../../../types/index';

export const GET: RouteHandler = (req, res) => {
  const { brand } = req.query;
  let filtered = accounts.slice();
  if (brand) filtered = filtered.filter(a => a.brand === brand);
  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};

export const POST: RouteHandler = async (req, res) => {
  const appId     = process.env.OCEANENGINE_APP_ID;
  const appSecret = process.env.OCEANENGINE_APP_SECRET;

  if (!appId || !appSecret) {
    return err(res, '缺少 OCEANENGINE_APP_ID 或 OCEANENGINE_APP_SECRET');
  }

  // 取一个可用的 access token（用默认凭证）
  let accessToken: string;
  try {
    accessToken = await tokenManager.getAnyToken('oceanengine');
  } catch (e) {
    return err(res, `无法获取 Access Token: ${String(e)}`);
  }

  let synced = 0;
  const result: Account[] = [];

  // 本地推账户体系用 local_account_id（16 位，从本地推后台 URL 的 advid 取得），
  // 与 oauth2/advertiser/get 返回的 19 位巨量广告 advertiser_id 是两套编号——
  // 后者对本地推接口会 40002，因此这里只同步 local_account_id，不再拉广告主列表。
  // 来源1：.env 手动配 OCEANENGINE_LOCAL_ACCOUNT_IDS（逗号分隔）
  // 来源2：服务商账户 OCEANENGINE_AGENT_ID（agent/advertiser/select，待权限放通后启用）
  const localIds = (process.env.OCEANENGINE_LOCAL_ACCOUNT_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const agentId = (process.env.OCEANENGINE_AGENT_ID ?? '').trim();
  if (agentId) {
    try {
      const childIds = await OceanEngineAdapter.fetchAgentAccounts(agentId, accessToken);
      console.log(`[AccountSync] 代理商 ${agentId} 名下账户: ${childIds.length} 个 → ${childIds.join(', ')}`);
      for (const cid of childIds) if (!localIds.includes(cid)) localIds.push(cid);
    } catch (e) {
      console.error(`[AccountSync] ❌ 查询代理商账户列表失败:`, String(e));
    }
  }

  if (!localIds.length) {
    return err(res, '未配置本地推账户：请在 .env 设置 OCEANENGINE_LOCAL_ACCOUNT_IDS（从本地推后台 URL 的 advid 取得）');
  }

  for (const lid of localIds) {
    if (accounts.find(a => a.externalId === lid)) {
      const ex = accounts.find(a => a.externalId === lid)!;
      if (!result.includes(ex)) result.push(ex);
      continue;
    }
    const brandId = `b_${lid}`;
    const accountId = `a_${lid}`;
    const colorIdx = (accounts.length % 10) + 1;
    const newBrand: Brand = { id: brandId, name: `本地推账户 ${lid}`, cat: '本地推', logo: '本' };
    const newAccount: Account = {
      id: accountId, name: `本地推账户 ${lid}`, externalId: lid,
      brand: brandId, color: `c${colorIdx}`,
      followers: 0, growth7d: 0, gmv7d: 0, live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0,
    };
    brands.push(newBrand);
    accounts.push(newAccount);
    result.push(newAccount);
    synced++;
    console.log(`[AccountSync] 新增本地推账户(手动配置): ${lid}`);
  }

  // 同步完账户后，立即拉取各账户下的项目列表
  let campaignsSynced = 0;
  for (const account of result) {
    if (!account.externalId) continue;
    try {
      const campList = await (adAdapter as OceanEngineAdapter).fetchCampaignList(account.externalId);
      // 用项目里的门店名（poi_name）回填账户/品牌真实名称
      const poiName = campList.map(c => c.poi_name).find(Boolean);
      if (poiName && account.name.startsWith('本地推账户')) {
        account.name = poiName;
        const b = brands.find(br => br.id === account.brand);
        if (b) { b.name = poiName; b.logo = poiName.slice(0, 1); }
      }
      for (const camp of campList) {
        const existing = adCampaigns.find(c => c.externalId === String(camp.campaign_id));
        if (existing) continue;
        const newCamp: AdCampaign = {
          id:         `c_${camp.campaign_id}`,
          name:       camp.campaign_name,
          brand:      account.brand,
          account:    account.id,
          externalId: String(camp.campaign_id),
          budget:     camp.budget ?? 0,
          spent:      0, roas: 0, cpm: 0, ctr: 0, cvr: 0, gmv: 0,
          status:     /DISABLE|DELETE|DONE/i.test(camp.status) ? 'paused' : 'active',
          startDate:  new Date().toISOString().slice(0, 10),
        };
        adCampaigns.push(newCamp);
        campaignsSynced++;
      }
      console.log(`[AccountSync] ${account.name}: 同步 ${campList.length} 个计划`);
    } catch (e) {
      console.error(`[AccountSync] ❌ 拉取计划失败 ${account.name} (${account.externalId}):`, String(e));
    }
  }

  const errors: string[] = [];
  ok(res, { synced, total: localIds.length, campaignsSynced, accounts: result, errors }, {});
};
