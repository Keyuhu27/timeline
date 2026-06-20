// GET  /api/accounts         — 返回当前账户列表
// POST /api/accounts/sync    — 从巨量引擎 API 自动发现并同步所有授权广告主

import { accounts, brands, adCampaigns } from '../../../lib/db';
import { ok, err, paginate }             from '../../../lib/api';
import { OceanEngineAdapter }            from '../../../lib/adapters/oceanengine-adapter';
import { tokenManager, adAdapter }       from '../../../lib/adapters/index';
import { saveSnapshot }                  from '../../../lib/persist';
import type { RouteHandler }             from '../../../lib/api';
import type { Account, Brand, AdCampaign } from '../../../types/index';

export const GET: RouteHandler = (req, res) => {
  const { brand } = req.query;
  let filtered = accounts.slice();
  if (brand) filtered = filtered.filter(a => a.brand === brand);
  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};

/**
 * 把一批本地推 local_account_id 同步进内存（账户/品牌 upsert），
 * 再逐账户拉项目列表 + 项目报表，最后落盘。供 sync 与 add-local 复用。
 */
export async function syncLocalAccounts(
  localIds: string[],
  accessToken: string,
): Promise<{ synced: number; campaignsSynced: number; accounts: Account[] }> {
  let synced = 0;
  let campaignsSynced = 0;
  const result: Account[] = [];

  for (const lid of localIds) {
    const existed = accounts.find(a => a.externalId === lid);
    if (existed) {
      if (!result.includes(existed)) result.push(existed);
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
    console.log(`[AccountSync] 新增本地推账户: ${lid}`);
  }

  for (const account of result) {
    if (!account.externalId) continue;
    try {
      const oe = adAdapter as OceanEngineAdapter;
      const campList = await oe.fetchCampaignList(account.externalId);
      // 用项目里的门店名（poi_name）回填账户/品牌真实名称
      const poiName = campList.map(c => c.poi_name).find(Boolean);
      if (poiName && account.name.startsWith('本地推账户')) {
        account.name = poiName;
        const b = brands.find(br => br.id === account.brand);
        if (b) { b.name = poiName; b.logo = poiName.slice(0, 1); }
      }

      let statsById = new Map<string, Awaited<ReturnType<typeof oe.fetchProjectReport>>[number]>();
      try {
        const stats = await oe.fetchProjectReport(account.externalId);
        statsById = new Map(stats.map(s => [s.externalId, s]));
      } catch (e) {
        console.error(`[AccountSync] ⚠️ 拉取报表失败 ${account.name} (${account.externalId}):`, String(e));
      }

      const now = Date.now();
      for (const camp of campList) {
        const st = statsById.get(String(camp.campaign_id));
        const existing = adCampaigns.find(c => c.externalId === String(camp.campaign_id));
        if (existing) {
          if (st) Object.assign(existing, {
            spent: st.spent, cpm: st.cpm, ctr: st.ctr, roas: st.roas, gmv: st.gmv,
            storeVisits: st.storeVisits, phoneCalls: st.phoneCalls,
            mapSearches: st.mapSearches, coupons: st.coupons, leads: st.leads,
            costPerLead: st.leads > 0 ? st.spent / st.leads : 0,
            lastSyncAt: now,
          });
          continue;
        }
        const newCamp: AdCampaign = {
          id:         `c_${camp.campaign_id}`,
          name:       camp.campaign_name,
          brand:      account.brand,
          account:    account.id,
          externalId: String(camp.campaign_id),
          budget:     camp.budget ?? 0,
          spent:      st?.spent ?? 0,
          cpm:        st?.cpm   ?? 0,
          ctr:        st?.ctr   ?? 0,
          roas:       st?.roas  ?? 0,
          gmv:        st?.gmv   ?? 0,
          cvr:        0,
          storeVisits: st?.storeVisits ?? 0,
          phoneCalls:  st?.phoneCalls  ?? 0,
          mapSearches: st?.mapSearches ?? 0,
          coupons:     st?.coupons     ?? 0,
          leads:       st?.leads       ?? 0,
          costPerLead: st && st.leads > 0 ? st.spent / st.leads : 0,
          status:     /DISABLE|DELETE|DONE/i.test(camp.status) ? 'paused' : 'active',
          startDate:  new Date().toISOString().slice(0, 10),
          lastSyncAt: now,
        };
        adCampaigns.push(newCamp);
        campaignsSynced++;
      }
      console.log(`[AccountSync] ${account.name}: 同步 ${campList.length} 个计划（含报表）`);
    } catch (e) {
      console.error(`[AccountSync] ❌ 拉取计划失败 ${account.name} (${account.externalId}):`, String(e));
    }
  }

  saveSnapshot();
  return { synced, campaignsSynced, accounts: result };
}

// POST /api/accounts/add-local  { local_account_id: "..." } 或 { local_account_ids: ["...","..."] }
// 运行时新增本地推账户，无需改 .env / rebuild；落 SQLite，重启不丢。
export const addLocal: RouteHandler = async (req, res) => {
  const body = (req.body ?? {}) as { local_account_id?: string | number; local_account_ids?: Array<string | number> };
  const ids = [
    ...(body.local_account_id != null ? [body.local_account_id] : []),
    ...(Array.isArray(body.local_account_ids) ? body.local_account_ids : []),
  ].map(x => String(x).trim()).filter(Boolean);

  if (!ids.length) {
    return err(res, '请在 body 提供 local_account_id（从本地推后台 URL 的 advid 取得）');
  }

  let accessToken: string;
  try {
    accessToken = await tokenManager.getAnyToken('oceanengine');
  } catch (e) {
    return err(res, `无法获取 Access Token: ${String(e)}`);
  }

  try {
    const r = await syncLocalAccounts(ids, accessToken);
    ok(res, { added: r.synced, campaignsSynced: r.campaignsSynced, accounts: r.accounts }, {});
  } catch (e) {
    err(res, `同步失败: ${String(e)}`);
  }
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

  const r = await syncLocalAccounts(localIds, accessToken);
  ok(res, { synced: r.synced, total: localIds.length, campaignsSynced: r.campaignsSynced, accounts: r.accounts, errors: [] }, {});
};
