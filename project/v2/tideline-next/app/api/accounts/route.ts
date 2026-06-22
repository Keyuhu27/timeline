// GET  /api/accounts         — 返回当前账户列表
// POST /api/accounts/sync    — 从巨量引擎 API 自动发现并同步所有授权广告主

import { accounts, brands, adCampaigns, normalizeOceanEngineAccountId } from '../../../lib/db';
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
  nameById?: Map<string, string>,
): Promise<{ synced: number; campaignsSynced: number; accounts: Account[]; errors: string[] }> {
  let synced = 0;
  let campaignsSynced = 0;
  const result: Account[] = [];
  const errors: string[] = [];

  for (const lid of localIds) {
    const existed = accounts.find(a => a.externalId === lid);
    if (existed) {
      if (!result.includes(existed)) result.push(existed);
      continue;
    }
    const brandId = `b_${lid}`;
    const accountId = `a_${lid}`;
    const colorIdx = (accounts.length % 10) + 1;
    const seedName = nameById?.get(lid)?.trim() || `本地推账户 ${lid}`;
    const newBrand: Brand = { id: brandId, name: seedName, cat: '本地推', logo: seedName.slice(0, 1) };
    const newAccount: Account = {
      id: accountId, name: seedName, externalId: lid,
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
        const msg = `⚠️ 拉取报表失败 ${account.name} (${account.externalId}): ${String(e)}`;
        console.error(`[AccountSync] ${msg}`);
        errors.push(msg);
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
      const msg = `❌ 拉取计划失败 ${account.name} (${account.externalId}): ${String(e)}`;
      console.error(`[AccountSync] ${msg}`);
      errors.push(msg);
    }
  }

  saveSnapshot();
  return { synced, campaignsSynced, accounts: result, errors };
}

// GET /api/accounts/ebp-orgs[?advertiser_id=XXX]
// 诊断：拉工作台层级关系，从返回里读 enterprise_organization_id。
// /2/ebp/level/get/ 需要 advertiser_id；不传时列出 OAuth 已授权的候选ID供挑选。
export const ebpOrgs: RouteHandler = async (req, res) => {
  let accessToken: string;
  try {
    accessToken = await tokenManager.getAnyToken('oceanengine');
  } catch (e) {
    return err(res, `无法获取 Access Token: ${String(e)}`);
  }

  const advertiserId = (req.query.advertiser_id ?? '').trim();
  if (!advertiserId) {
    // 列出已授权账户ID，让用户挑一个再带 ?advertiser_id= 重试
    const candidates = Array.from(new Set(
      tokenManager.getAllCredentials()
        .flatMap(c => [c.advertiserId, c.accountId])
        .filter((x): x is string => !!x),
    ));
    return ok(res, {
      hint: '请带上 ?advertiser_id=<下面某个ID> 重试，例如 /api/accounts/ebp-orgs?advertiser_id=' + (candidates[0] ?? 'XXX'),
      candidates,
    }, {});
  }

  try {
    const data = await OceanEngineAdapter.fetchEbpLevel(accessToken, advertiserId);
    ok(res, data, {});
  } catch (e) {
    err(res, `获取工作台层级失败: ${String(e)}`);
  }
};

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

  // 来源3：升级版巨量引擎工作台(EBP) —— 配 OCEANENGINE_EBP_ORG_ID 即可一次性发现名下全部本地推账户
  const nameById = new Map<string, string>();
  const ebpOrgId = (process.env.OCEANENGINE_EBP_ORG_ID ?? '').trim();
  if (ebpOrgId) {
    try {
      const list = await OceanEngineAdapter.fetchEbpLocalAccounts(ebpOrgId, accessToken);
      console.log(`[AccountSync] EBP 工作台 ${ebpOrgId} 名下本地推账户: ${list.length} 个`);
      for (const { id, name } of list) {
        if (name) nameById.set(id, name);
        if (!localIds.includes(id)) localIds.push(id);
      }
    } catch (e) {
      console.error(`[AccountSync] ❌ EBP 工作台账户列表失败:`, String(e));
    }
  }

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

  const r = await syncLocalAccounts(localIds, accessToken, nameById);
  ok(res, { synced: r.synced, total: localIds.length, campaignsSynced: r.campaignsSynced, accounts: r.accounts, errors: r.errors }, {});
};

// ── GET /api/accounts/debug — 诊断内存状态（孤儿计划、账户列表）─────────────
export const debug: RouteHandler = (req, res) => {
  const orphans = adCampaigns.filter(c => {
    const acct = accounts.find(a => a.id === c.account);
    return !acct?.externalId || !/^\d{10,}$/.test(acct.externalId);
  });
  ok(res, {
    accountCount:       accounts.length,
    campaignCount:      adCampaigns.length,
    orphanedCampaigns:  orphans.length,
    accounts: accounts.map(a => ({
      id: a.id, name: a.name, externalId: a.externalId,
      externalIdValid: /^\d{10,}$/.test(a.externalId ?? ''),
    })),
    orphanDetails: orphans.slice(0, 20).map(c => ({
      id: c.id, name: c.name, account: c.account, externalId: c.externalId,
    })),
  }, {});
};

// ── POST /api/accounts/test-fetch?local_account_id=1751180038902863 ──────────
// 只拉单个账户的项目列表和报表，不写数据库，仅返回原始结果供调试
export const testFetch: RouteHandler = async (req, res) => {
  const rawLid = String(req.query.local_account_id ?? '').trim();
  let lid: string;
  try {
    lid = normalizeOceanEngineAccountId(rawLid);   // 容忍 a_ 前缀，归一化成纯数字
  } catch (e) {
    return err(res, String(e));
  }
  try {
    const oe        = adAdapter as OceanEngineAdapter;
    const campList  = await oe.fetchCampaignList(lid);
    const stats     = await oe.fetchProjectReport(lid);
    ok(res, {
      local_account_id: lid,
      projectCount:  campList.length,
      statsCount:    stats.length,
      projects:      campList.slice(0, 5),
      firstStats:    stats[0] ?? null,
    }, {});
  } catch (e) {
    err(res, String(e));
  }
};
