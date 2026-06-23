// GET  /api/accounts         — 返回当前账户列表
// POST /api/accounts/sync    — 从巨量引擎 API 自动发现并同步所有授权广告主

import { accounts, brands, adCampaigns, normalizeOceanEngineAccountId } from '../../../lib/db';
import { ok, err, paginate }             from '../../../lib/api';
import { OceanEngineAdapter }            from '../../../lib/adapters/oceanengine-adapter';
import { tokenManager, adAdapter }       from '../../../lib/adapters/index';
import { saveSnapshot }                  from '../../../lib/persist';
import type { RouteHandler }             from '../../../lib/api';
import type { Account, Brand, AdCampaign } from '../../../types/index';

// 已授权本地推账户白名单（兜底）——确保这些账户始终被同步发现，
// 不依赖 .env / EBP / 代理商接口是否覆盖。新增已授权账户时在此登记。
const KNOWN_LOCAL_ACCOUNT_IDS = [
  '1770545948162062',  // 半日懒竹林漂流
  '1851121699721292',  // 亿滋本地推
];
// 已知账户名（接口未回填 poi_name 时的兜底显示名）
const KNOWN_LOCAL_ACCOUNT_NAMES: Record<string, string> = {
  '1851121699721292': '亿滋本地推',
};

export const GET: RouteHandler = (req, res) => {
  const { brand } = req.query;
  let filtered = accounts.slice();
  if (brand) filtered = filtered.filter(a => a.brand === brand);
  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};

/**
 * 巨量引擎项目状态 → 内部统一 status
 * 覆盖所有已知状态枚举：中文/英文/带前缀的完整字符串
 */
export function normalizeProjectStatus(raw: unknown): AdCampaign['status'] {
  const v = String(raw ?? '').toUpperCase().trim();
  if (!v) return 'active';   // 空值 → 默认投放中

  // ── 数字型 opt_status（巨量本地推项目列表返回整数而非枚举字符串）────────
  // 经实测（对比今日有花费的在投项目与刚被 PAUSED 的项目），规律为：
  //   1  →  ENABLE（开启/投放中）
  //   0  →  PAUSED（暂停）
  // 注意：2 可能代表 DELETE，但未确认，先归 unknown。
  if (v === '1') { console.log(`[normalizeProjectStatus] 数字 opt_status=1 → active`); return 'active'; }
  if (v === '0') { console.log(`[normalizeProjectStatus] 数字 opt_status=0 → paused`); return 'paused'; }
  if (v === '2') { console.log(`[normalizeProjectStatus] 数字 opt_status=2 → deleted`); return 'deleted'; }

  // 已删除
  if (/DELETE/.test(v) || v.includes('已删除')) return 'deleted';

  // 投放中 / 已启用 —— 优先于 DONE/ended（opt_status=ENABLE 即开关打开，即便 project_status=DONE 也是在投）
  if (/ENABLE|ACTIVE|RUNNING|START/.test(v) ||
      v.includes('投放中') || v.includes('已启用') || v.includes('启用'))
    return 'active';

  // 已结束（DONE = 今日完成/已结束，非暂停；用普通子串匹配，不用 \b 以覆盖 PROJECT_STATUS_DONE）
  if (/DONE|FINISH|ENDED|EXPIR|COMPLET/.test(v) ||
      v.includes('已完成') || v.includes('已结束')) return 'ended';

  // 已暂停 / 未投放 / 被禁用
  if (/PAUSE|DISABLE/.test(v) || v.includes('暂停') || v.includes('未投放') || v.includes('已禁用'))
    return 'paused';

  // 未知：不默认成 paused，避免把投放中的项目误标为已暂停
  console.warn(`[normalizeProjectStatus] ⚠️ 未知状态枚举: "${raw}" — 暂标为 unknown`);
  return 'unknown';
}

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
    const seedName = nameById?.get(lid)?.trim() || KNOWN_LOCAL_ACCOUNT_NAMES[lid] || `本地推账户 ${lid}`;
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
        let normalizedStatus = normalizeProjectStatus(camp.status);

        // 花费安全网：仅当状态「无法识别」(unknown) 且今日有实际花费时，才兜底为 active。
        // 注意：opt_status=0 给出的 paused 是权威信号（项目可能中午被暂停、今日仍有花费），
        // 不能用花费覆盖确定的 paused，否则会把已暂停项目错误显示为投放中。
        const todaySpent = st?.spent ?? 0;
        if (todaySpent > 0 && normalizedStatus === 'unknown') {
          console.warn(
            `[AccountSync] ⚠️ 花费安全网触发 ${camp.campaign_name}:` +
            ` status="${normalizedStatus}" 但今日花费 ¥${todaySpent}，强制设为 active。` +
            ` rawOptStatus="${camp.rawOptStatus}" rawProjectStatus="${camp.rawProjectStatus}"` +
            ` selectedField="${camp.selectedField}"`
          );
          normalizedStatus = 'active';
        }

        const existing = adCampaigns.find(c => c.externalId === String(camp.campaign_id));
        if (existing) {
          const prevStatus = existing.status;
          existing.status    = normalizedStatus;
          existing.rawStatus = camp.rawStatus || camp.status;
          existing.lastSyncAt = now;
          if (prevStatus !== normalizedStatus) {
            console.log(`[AccountSync] 状态变更 ${camp.campaign_name}: ${prevStatus} → ${normalizedStatus} (raw="${camp.rawStatus}")`);
          }
          if (st) Object.assign(existing, {
            spent: st.spent, cpm: st.cpm, ctr: st.ctr, roas: st.roas, gmv: st.gmv,
            impressions: st.impressions, clicks: st.clicks,
            storeVisits: st.storeVisits, phoneCalls: st.phoneCalls,
            mapSearches: st.mapSearches, coupons: st.coupons, leads: st.leads,
            costPerLead: st.leads > 0 ? st.spent / st.leads : 0,
            lastSyncAt: now,
          });
          else Object.assign(existing, {
            // 今日报表无此项目 → 今日无消耗，清零今日指标（防止保留历史累计值）
            spent: 0, cpm: 0, ctr: 0, roas: 0, gmv: 0, impressions: 0, clicks: 0,
            storeVisits: 0, phoneCalls: 0, mapSearches: 0, coupons: 0, leads: 0,
            costPerLead: 0, lastSyncAt: now,
          });
          continue;
        }
        const newCamp: AdCampaign = {
          id:         `c_${camp.campaign_id}`,
          name:       camp.campaign_name,
          brand:      account.brand,
          account:    account.id,
          externalId: String(camp.campaign_id),
          rawStatus:  camp.rawStatus || camp.status,
          budget:     camp.budget ?? 0,
          spent:      st?.spent ?? 0,
          cpm:        st?.cpm   ?? 0,
          ctr:        st?.ctr   ?? 0,
          impressions: st?.impressions ?? 0,
          clicks:      st?.clicks      ?? 0,
          roas:       st?.roas  ?? 0,
          gmv:        st?.gmv   ?? 0,
          cvr:        0,
          storeVisits: st?.storeVisits ?? 0,
          phoneCalls:  st?.phoneCalls  ?? 0,
          mapSearches: st?.mapSearches ?? 0,
          coupons:     st?.coupons     ?? 0,
          leads:       st?.leads       ?? 0,
          costPerLead: st && st.leads > 0 ? st.spent / st.leads : 0,
          status:     normalizedStatus,
          startDate:  new Date().toISOString().slice(0, 10),
          lastSyncAt: now,
        };
        adCampaigns.push(newCamp);
        campaignsSynced++;
        console.log(`[AccountSync] 新增项目: ${camp.campaign_name} status=${normalizedStatus} (raw="${camp.rawStatus}")`);
      }
      console.log(`[AccountSync] ${account.name}: 同步 ${campList.length} 个计划（含报表）`);

      // 后台首页 statQuery——优先级最高的今日消耗来源（全域投放口径）
      if (!process.env.OCEANENGINE_LOCALADS_COOKIE) {
        delete account.statQueryReport;   // 没鉴权就别留旧值冒充
        console.warn(`[AccountSync] ⚠️ 后台 statQuery 未配置鉴权（OCEANENGINE_LOCALADS_COOKIE），跳过全域消耗拉取（${account.name}）`);
      } else {
        try {
          const today8 = new Date(Date.now() + 8 * 3600_000);
          const todayStr = today8.toISOString().slice(0, 10);
          const startTime = `${todayStr} 00:00:00`;
          const endTime   = today8.toISOString().replace('T', ' ').slice(0, 19);
          const sq = await OceanEngineAdapter.fetchHomeRoi2StatQuery(account.externalId!, startTime, endTime);
          account.statQueryReport = {
            spent: sq.spent, liveSpent: sq.liveSpent, videoSpent: sq.videoSpent,
            liveGmv: sq.liveGmv, videoGmv: sq.videoGmv, gmv: sq.gmv,
            liveRoi: sq.liveRoi, videoRoi: sq.videoRoi, roi: sq.roi,
            orders: sq.orders, orderCost: sq.orderCost,
            syncedAt: now, source: 'statQuery_pc_home_roi2',
          };
          console.log(`[AccountSync] ${account.name} statQuery: 消耗¥${sq.spent} 直播¥${sq.liveSpent} 视频¥${sq.videoSpent} 成交¥${sq.gmv}`);
        } catch (e) {
          // 失败：清掉旧的 statQueryReport，避免前端显示陈旧的 0 并误标 source=statQuery
          delete account.statQueryReport;
          console.error(`[AccountSync] ❌ statQuery 失败 ${account.name}: ${String(e)}`);
          errors.push(`statQuery失败 ${account.name}: ${String(e)}`);
        }
      }

      // 账户级（全域投放）报表：全域消耗不进项目报表，单独拉一份缓存到账户上，
      // 供品牌详情页顶部「今日消耗/全域成交金额/订单数/ROI」展示。即使全 0 也保留，
      // 以便 UI 标注数据来源为 account_report，而非误判接口失败。
      try {
        const ar = await oe.fetchAccountReport(account.externalId);
        if (ar) {
          account.globalReport = {
            spent: ar.spent, gmv: ar.gmv, orders: ar.orders, roi: ar.roi,
            orderCost: ar.orderCost, impressions: ar.impressions, clicks: ar.clicks,
            ctr: ar.ctr, cpm: ar.cpm, syncedAt: now, source: 'account_report',
          };
          console.log(`[AccountSync] ${account.name} 全域报表: 消耗¥${ar.spent} 成交¥${ar.gmv} 订单${ar.orders} ROI${ar.roi}`);
        } else {
          delete account.globalReport;
          console.log(`[AccountSync] ${account.name} 全域报表无数据（无 data_list）`);
        }
      } catch (e) {
        console.error(`[AccountSync] ⚠️ 拉取账户全域报表失败 ${account.name} (${account.externalId}): ${String(e)}`);
      }
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

  // 已授权本地推账户兜底白名单——即使 .env / EBP / 代理商接口未覆盖，也必须同步进来，
  // 避免「本地 accounts 没有该账户就跳过」导致漏拉（如亿滋本地推）。
  for (const known of KNOWN_LOCAL_ACCOUNT_IDS) {
    if (!localIds.includes(known)) {
      localIds.push(known);
      console.log(`[AccountSync] 兜底白名单补入本地推账户: ${known}`);
    }
  }

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

// ── GET /api/accounts/sync-diagnosis ─────────────────────────────────────────
// 实时对比「本地状态」vs「巨量官方项目状态」，输出完整诊断报告。
// 对每个有效 local_account_id 调用项目列表接口，逐条比对。
export const syncDiagnosis: RouteHandler = async (req, res) => {
  let accessToken: string;
  try {
    accessToken = await tokenManager.getAnyToken('oceanengine');
    void accessToken; // suppress unused warning; used inside oe calls
  } catch (e) {
    return err(res, `无法获取 Access Token: ${String(e)}`);
  }

  const oe = adAdapter as OceanEngineAdapter;
  const validAccounts = accounts.filter(a => a.externalId && /^\d{10,}$/.test(a.externalId));

  const diagAccounts = await Promise.all(validAccounts.map(async account => {
    const localCampaigns = adCampaigns.filter(c => c.account === account.id);

    let officialProjects: Awaited<ReturnType<typeof oe.fetchCampaignList>> = [];
    let fetchError: string | null = null;
    try {
      officialProjects = await oe.fetchCampaignList(account.externalId!);
    } catch (e) {
      fetchError = String(e);
    }

    const officialById = new Map(officialProjects.map(p => [p.campaign_id, p]));
    const localById    = new Map(localCampaigns.map(c => [c.externalId ?? '', c]));

    const campaigns: Array<Record<string, unknown>> = [];
    let mismatch = 0;

    for (const [pid, official] of officialById) {
      const local = localById.get(pid);
      const officialNorm = normalizeProjectStatus(official.status);
      const todaySpent = local?.spent ?? 0;
      const hasSpendToday = todaySpent > 0;
      const entry: Record<string, unknown> = {
        project_id:           pid,
        name:                 official.campaign_name,
        // 状态字段原始值（用于人工核对映射规则）
        raw_opt_status:       official.rawOptStatus,
        raw_project_status:   official.rawProjectStatus,
        selected_field:       official.selectedField,
        selected_value:       official.status,
        all_status_fields:    official.allStatusFields,
        // 归一化结果
        official_norm:        officialNorm,
        local_status:         local?.status ?? null,
        local_raw:            local?.rawStatus ?? null,
        // 报表数据（用于花费安全网验证）
        today_spent:          todaySpent,
        has_spend_today:      hasSpendToday,
        today_impressions:    local?.impressions ?? 0,
        today_clicks:         local?.clicks ?? 0,
        today_leads:          local?.leads ?? 0,
      };
      if (!local) {
        entry.consistent = false; entry.issue = 'local_missing'; mismatch++;
      } else if (local.status !== officialNorm) {
        entry.consistent = false; entry.issue = 'status_mismatch'; mismatch++;
      } else {
        entry.consistent = true; entry.issue = null;
      }
      campaigns.push(entry);
    }

    // 本地有但官方查不到的
    let officialMissing = 0;
    for (const [eid] of localById) {
      if (eid && !officialById.has(eid)) officialMissing++;
    }

    return {
      account_id:          account.id,
      account_name:        account.name,
      local_account_id:    account.externalId,
      brand_id:            account.brand,
      has_token:           true,
      last_sync_at:        localCampaigns.reduce((m, c) => Math.max(m, c.lastSyncAt ?? 0), 0) || null,
      local_campaigns:     localCampaigns.length,
      official_campaigns:  officialProjects.length,
      mismatch_count:      mismatch,
      official_missing:    officialMissing,
      fetch_error:         fetchError,
      campaigns,
    };
  }));

  const totalMismatch      = diagAccounts.reduce((s, a) => s + a.mismatch_count, 0);
  const totalOfficialMiss  = diagAccounts.reduce((s, a) => s + a.official_missing, 0);
  const errAccounts        = diagAccounts.filter(a => a.fetch_error).length;

  ok(res, {
    generated_at:           new Date().toISOString(),
    total_accounts:         validAccounts.length,
    accounts_with_error:    errAccounts,
    total_mismatch:         totalMismatch,
    total_official_missing: totalOfficialMiss,
    summary: diagAccounts.map(a => ({
      account: a.account_name,
      local_account_id: a.local_account_id,
      local: a.local_campaigns,
      official: a.official_campaigns,
      mismatch: a.mismatch_count,
      error: a.fetch_error ?? null,
    })),
    accounts: diagAccounts,
  }, {});
};

// ── POST /api/accounts/sync-status ───────────────────────────────────────────
// 仅同步状态+报表数据，跳过账户发现阶段，比完整 POST /api/accounts 更快。
// 前端「刷新数据」按钮调用此接口。
export const syncStatus: RouteHandler = async (req, res) => {
  const validAccounts = accounts.filter(a => a.externalId && /^\d{10,}$/.test(a.externalId));
  if (!validAccounts.length) {
    return err(res, '内存中没有有效账户，请先执行「同步广告主」（POST /api/accounts）');
  }

  let accessToken: string;
  try {
    accessToken = await tokenManager.getAnyToken('oceanengine');
    void accessToken;
  } catch (e) {
    return err(res, `无法获取 Access Token: ${String(e)}`);
  }

  const oe = adAdapter as OceanEngineAdapter;
  let totalUpdated = 0;
  let totalAdded   = 0;
  const errors: string[] = [];
  const syncSummary: Array<Record<string, unknown>> = [];

  for (const account of validAccounts) {
    let updatedInAcc = 0;
    let addedInAcc   = 0;
    try {
      const campList = await oe.fetchCampaignList(account.externalId!);

      // 回填门店真实名称
      const poiName = campList.map(c => c.poi_name).find(Boolean);
      if (poiName && account.name.startsWith('本地推账户')) {
        account.name = poiName;
        const b = brands.find(br => br.id === account.brand);
        if (b) { b.name = poiName; b.logo = poiName.slice(0, 1); }
      }

      let statsById = new Map<string, Awaited<ReturnType<typeof oe.fetchProjectReport>>[number]>();
      try {
        const stats = await oe.fetchProjectReport(account.externalId!);
        statsById = new Map(stats.map(s => [s.externalId, s]));
      } catch (e) {
        errors.push(`报表拉取失败 ${account.name}: ${String(e)}`);
      }

      const now = Date.now();
      for (const camp of campList) {
        const st = statsById.get(String(camp.campaign_id));
        let normalizedStatus = normalizeProjectStatus(camp.status);

        // 花费安全网（同 syncLocalAccounts）：仅兜底 unknown，不覆盖权威的 paused
        const todaySpent = st?.spent ?? 0;
        if (todaySpent > 0 && normalizedStatus === 'unknown') {
          console.warn(
            `[SyncStatus] ⚠️ 花费安全网触发 ${camp.campaign_name}:` +
            ` status="${normalizedStatus}" 但今日花费 ¥${todaySpent}，强制设为 active。` +
            ` rawOptStatus="${camp.rawOptStatus}" rawProjectStatus="${camp.rawProjectStatus}"` +
            ` selectedField="${camp.selectedField}"`
          );
          normalizedStatus = 'active';
        }

        const existing = adCampaigns.find(c => c.externalId === String(camp.campaign_id));
        if (existing) {
          const prev = existing.status;
          existing.status    = normalizedStatus;
          existing.rawStatus = camp.rawStatus || camp.status;
          existing.lastSyncAt = now;
          if (prev !== normalizedStatus) {
            updatedInAcc++;
            console.log(`[SyncStatus] 状态变更 ${camp.campaign_name}: ${prev} → ${normalizedStatus} (raw="${camp.rawStatus}")`);
          }
          if (st) Object.assign(existing, {
            spent: st.spent, cpm: st.cpm, ctr: st.ctr, roas: st.roas, gmv: st.gmv,
            impressions: st.impressions, clicks: st.clicks,
            storeVisits: st.storeVisits, phoneCalls: st.phoneCalls,
            mapSearches: st.mapSearches, coupons: st.coupons, leads: st.leads,
            costPerLead: st.leads > 0 ? st.spent / st.leads : 0,
            lastSyncAt: now,
          });
          else Object.assign(existing, {
            // 今日报表无此项目 → 今日无消耗，清零今日指标（防止保留历史累计值）
            spent: 0, cpm: 0, ctr: 0, roas: 0, gmv: 0, impressions: 0, clicks: 0,
            storeVisits: 0, phoneCalls: 0, mapSearches: 0, coupons: 0, leads: 0,
            costPerLead: 0, lastSyncAt: now,
          });
        } else {
          // 新项目：直接加入
          const newCamp: AdCampaign = {
            id: `c_${camp.campaign_id}`,
            name: camp.campaign_name,
            brand: account.brand,
            account: account.id,
            externalId: String(camp.campaign_id),
            rawStatus: camp.rawStatus || camp.status,
            budget: camp.budget ?? 0,
            spent: st?.spent ?? 0, cpm: st?.cpm ?? 0, ctr: st?.ctr ?? 0,
            impressions: st?.impressions ?? 0, clicks: st?.clicks ?? 0,
            roas: st?.roas ?? 0, gmv: st?.gmv ?? 0, cvr: 0,
            storeVisits: st?.storeVisits ?? 0, phoneCalls: st?.phoneCalls ?? 0,
            mapSearches: st?.mapSearches ?? 0, coupons: st?.coupons ?? 0,
            leads: st?.leads ?? 0,
            costPerLead: st && st.leads > 0 ? st.spent / st.leads : 0,
            status: normalizedStatus,
            startDate: new Date().toISOString().slice(0, 10),
            lastSyncAt: now,
          };
          adCampaigns.push(newCamp);
          addedInAcc++;
        }
      }
      // 后台首页 statQuery——优先级最高的今日消耗来源（全域投放口径）
      if (!process.env.OCEANENGINE_LOCALADS_COOKIE) {
        delete account.statQueryReport;   // 没鉴权就别留旧值冒充
        console.warn(`[SyncStatus] ⚠️ 后台 statQuery 未配置鉴权（OCEANENGINE_LOCALADS_COOKIE），跳过全域消耗拉取（${account.name}）`);
      } else {
        try {
          const today8 = new Date(Date.now() + 8 * 3600_000);
          const todayStr = today8.toISOString().slice(0, 10);
          const startTime = `${todayStr} 00:00:00`;
          const endTime   = today8.toISOString().replace('T', ' ').slice(0, 19);
          const sq = await OceanEngineAdapter.fetchHomeRoi2StatQuery(account.externalId!, startTime, endTime);
          account.statQueryReport = {
            spent: sq.spent, liveSpent: sq.liveSpent, videoSpent: sq.videoSpent,
            liveGmv: sq.liveGmv, videoGmv: sq.videoGmv, gmv: sq.gmv,
            liveRoi: sq.liveRoi, videoRoi: sq.videoRoi, roi: sq.roi,
            orders: sq.orders, orderCost: sq.orderCost,
            syncedAt: now, source: 'statQuery_pc_home_roi2',
          };
          console.log(`[SyncStatus] ${account.name} statQuery: 消耗¥${sq.spent} 直播¥${sq.liveSpent} 视频¥${sq.videoSpent} 成交¥${sq.gmv}`);
        } catch (e) {
          // 失败：清掉旧的 statQueryReport，避免前端显示陈旧的 0 并误标 source=statQuery
          delete account.statQueryReport;
          console.error(`[SyncStatus] ❌ statQuery 失败 ${account.name}: ${String(e)}`);
          errors.push(`statQuery失败 ${account.name}: ${String(e)}`);
        }
      }

      // 账户级（全域投放）报表——同 syncLocalAccounts，刷新时一并更新
      try {
        const ar = await oe.fetchAccountReport(account.externalId!);
        if (ar) {
          account.globalReport = {
            spent: ar.spent, gmv: ar.gmv, orders: ar.orders, roi: ar.roi,
            orderCost: ar.orderCost, impressions: ar.impressions, clicks: ar.clicks,
            ctr: ar.ctr, cpm: ar.cpm, syncedAt: now, source: 'account_report',
          };
        } else {
          delete account.globalReport;
        }
      } catch (e) {
        console.error(`[SyncStatus] ⚠️ 拉取账户全域报表失败 ${account.name}: ${String(e)}`);
      }

      totalUpdated += updatedInAcc;
      totalAdded   += addedInAcc;
      syncSummary.push({ account: account.name, campaigns: campList.length, updated: updatedInAcc, added: addedInAcc });
    } catch (e) {
      const msg = `${account.name}: ${String(e)}`;
      errors.push(msg);
      syncSummary.push({ account: account.name, error: msg });
    }
  }

  saveSnapshot();
  ok(res, {
    synced_accounts: validAccounts.length,
    total_campaigns: adCampaigns.length,
    status_updated:  totalUpdated,
    new_campaigns:   totalAdded,
    failed_accounts: errors.length,
    errors,
    summary: syncSummary,
  }, {});
};
