import type { IAdAdapter, CampaignStats, CreateCampaignParams, UpdateCampaignParams } from './ad-adapter';
import { normalizeOceanEngineAccountId } from '../db';

const BASE = 'https://ad.oceanengine.com/open_api/2/';
// 巨量本地推（升级版）走 v3.0 local 接口，账户是"项目/广告"结构，非经典版"计划"
const LOCAL_BASE = 'https://api.oceanengine.com/open_api/v3.0/local/';
const ADVERTISER_LIST_URL = 'https://open.oceanengine.com/open_api/oauth2/advertiser/get/';

// ─── 本地推指标列表 ───────────────────────────────────────────────────────────
// 巨量本地推数据报表「获取项目数据」支持的指标字段（非千川电商指标）
// 文档：GET /open_api/v3.0/local/report/project/get/
const LOCAL_PROMO_METRICS = [
  'stat_cost',            // 消耗(元)
  'show_cnt',             // 展示次数
  'click_cnt',            // 点击次数
  'ctr',                  // 点击率
  'cpm_platform',         // 平均千次展示费用
  'convert_cnt',          // 转化数
  'conversion_cost',      // 转化成本
  'poi_recommend_count',  // 浏览商户人数（到店引流）
  'phone_confirm_cnt',    // 电话拨打数
  'form_cnt',             // 表单提交数
  'clue_pay_order_cnt',   // 团购线索数
  'oto_pay_order_count',  // 总成交订单数
  'oto_pay_order_amount', // 总成交金额(元)
  'oto_pay_order_roi',    // 总支付ROI
];

// ─── 大整数安全 JSON 解析 ─────────────────────────────────────────────────────
// 巨量引擎 advertiser_id / campaign_id 是 19 位雪花 ID，超过 JS 安全整数上限
// (Number.MAX_SAFE_INTEGER ≈ 9e15)，直接 JSON.parse 会丢精度（末尾被四舍五入成 0）。
// 解决：解析前把 16 位以上的裸整数字面量包成字符串，保住完整 ID。
export function safeJsonParse<T>(text: string): T {
  const wrapped = text.replace(/([:\[,]\s*)(\d{16,})(?=\s*[,\]}])/g, '$1"$2"');
  return JSON.parse(wrapped) as T;
}

// 把指定字段的纯数字（字符串或字符串数组）序列化成 JSON 里的「原始整数」——
// 不加引号、不丢精度。用于巨量本地推写接口要求 integer 而 ID 又超过 JS 安全整数
// （>9e15）的场景：直接 Number() 会丢精度暂停错项目，必须按原始字面量发送。
const RAW_INT = '@@RAWINT@@';
function markRawInts(value: unknown, rawKeys: string[]): unknown {
  if (Array.isArray(value)) return value.map(v => markRawInts(v, rawKeys));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (rawKeys.includes(k) && v != null) {
        out[k] = Array.isArray(v)
          ? v.map(x => `${RAW_INT}${x}${RAW_INT}`)
          : `${RAW_INT}${v}${RAW_INT}`;
      } else {
        out[k] = markRawInts(v, rawKeys);
      }
    }
    return out;
  }
  return value;
}
function stringifyWithRawInts(obj: Record<string, unknown>, rawKeys: string[]): string {
  return JSON.stringify(markRawInts(obj, rawKeys))
    .replace(new RegExp(`"${RAW_INT}(\\d+)${RAW_INT}"`, 'g'), '$1');
}

// ─── HTTP 辅助函数 ────────────────────────────────────────────────────────────

async function oeRequest<T>(
  url: string,
  token: string,
  options: { method: 'GET' | 'POST'; body?: Record<string, unknown>; rawBody?: string; params?: Record<string, string> },
): Promise<T> {
  let finalUrl = url;
  const headers: Record<string, string> = { 'Access-Token': token };

  let fetchInit: RequestInit;

  if (options.method === 'GET') {
    if (options.params && Object.keys(options.params).length > 0) {
      const qs = new URLSearchParams(options.params).toString();
      finalUrl = `${url}?${qs}`;
    }
    fetchInit = { method: 'GET', headers };
  } else {
    headers['Content-Type'] = 'application/json';
    fetchInit = { method: 'POST', headers, body: options.rawBody ?? JSON.stringify(options.body ?? {}) };
  }

  console.log(`[OceanEngine] ${options.method} ${finalUrl}`, options.body ?? options.params ?? '');

  const res = await fetch(finalUrl, fetchInit);
  const text = await res.text();
  let json: { code: number; message: string; data: T };
  try {
    json = safeJsonParse<{ code: number; message: string; data: T }>(text);
  } catch {
    console.error(`[OceanEngine] 响应非 JSON ${options.method} ${finalUrl} (HTTP ${res.status}): ${text.slice(0, 300)}`);
    throw new Error(`巨量引擎响应解析失败 [${finalUrl}]: ${text.slice(0, 120)}`);
  }

  if (json.code !== 0) {
    console.error(`[OceanEngine] API 错误 ${options.method} ${finalUrl}: code=${json.code} message=${json.message}`);
    throw new Error(`巨量引擎 API [${finalUrl}]: ${json.message} (code=${json.code})`);
  }

  return json.data;
}

// ─── 行数据映射辅助 ───────────────────────────────────────────────────────────

function mapLocalPromoRow(row: Record<string, unknown>, externalId: string): CampaignStats {
  const storeVisits   = Number(row.poi_recommend_count ?? 0);  // 浏览商户人数 ≈ 到店量
  const phoneCalls    = Number(row.phone_confirm_cnt   ?? 0);  // 电话拨打数
  const forms         = Number(row.form_cnt            ?? 0);  // 表单提交数
  const coupons       = Number(row.clue_pay_order_cnt  ?? 0);  // 团购线索数
  // 总线索优先用接口的 convert_cnt（转化数），缺失时回退到各事件之和
  const convertCnt    = Number(row.convert_cnt ?? 0);
  const leads         = convertCnt > 0 ? convertCnt : (storeVisits + phoneCalls + forms + coupons);

  const spent  = Number(row.stat_cost ?? 0);
  const gmv    = Number(row.oto_pay_order_amount ?? 0);
  const orders = Number(row.oto_pay_order_count ?? 0);

  return {
    externalId,
    spent,
    impressions: Number(row.show_cnt     ?? 0),
    clicks:      Number(row.click_cnt    ?? 0),
    ctr:         Number(row.ctr          ?? 0) / 100,  // 接口返回百分数，转小数
    cpm:         Number(row.cpm_platform ?? 0),
    gmv,
    orders,
    roas:   Number(row.oto_pay_order_roi ?? 0),
    cvr:    0,
    // 本地推专属字段
    storeVisits,
    phoneCalls,
    mapSearches: 0,
    coupons,
    leads,
  } as CampaignStats;
}

// ─── 主适配器类 ───────────────────────────────────────────────────────────────

export class OceanEngineAdapter implements IAdAdapter {
  constructor(private getAccessToken: (advertiserId: string) => Promise<string>) {}

  // ── 账户列表（静态方法，不需要 advertiserId）────────────────────────────────

  /**
   * 查询服务商(代理商)名下的账户列表（本地推 local_account_id 来源）。
   * 文档：GET https://api.oceanengine.com/open_api/2/agent/advertiser/select/
   * 参数 advertiser_id = 服务商账户ID；返回 data.list = 名下账户ID数组。
   */
  static async fetchAgentAccounts(agentId: string, accessToken: string): Promise<string[]> {
    const url = `https://api.oceanengine.com/open_api/2/agent/advertiser/select/?advertiser_id=${encodeURIComponent(agentId)}&page=1&page_size=100`;
    console.log(`[OceanEngine] GET 代理商账户列表 agent=${agentId}`);
    const res = await fetch(url, { method: 'GET', headers: { 'Access-Token': accessToken } });
    const text = await res.text();
    const json = safeJsonParse<{ code: number; message: string; data: { list?: Array<string | number> } }>(text);
    if (json.code !== 0) {
      throw new Error(`巨量引擎 代理商账户列表: ${json.message} (code=${json.code})`);
    }
    return (json.data.list ?? []).map(String);
  }

  /**
   * 拉取升级版巨量引擎工作台/团队层级关系 —— 用来发现 enterprise_organization_id。
   * 文档：GET https://api.oceanengine.com/open_api/2/ebp/level/get/
   * 返回原始 JSON（结构含组织ID/名称），供运维 curl 后读取 org id。
   */
  static async fetchEbpLevel(accessToken: string, advertiserId: string): Promise<unknown> {
    const aid = String(advertiserId).replace(/[^0-9]/g, '');
    const url = `https://api.oceanengine.com/open_api/2/ebp/level/get/?advertiser_id=${aid}`;
    console.log(`[OceanEngine] GET EBP 工作台层级关系 advertiser_id=${aid}`);
    const res = await fetch(url, { method: 'GET', headers: { 'Access-Token': accessToken } });
    const json = safeJsonParse<{ code: number; message: string; data: unknown }>(await res.text());
    if (json.code !== 0) {
      throw new Error(`巨量引擎 EBP 层级关系: ${json.message} (code=${json.code})`);
    }
    return json.data;
  }

  /**
   * 获取升级版巨量引擎工作台(EBP)下的本地推账户列表 —— 多门店自动发现。
   * 文档：GET https://api.oceanengine.com/open_api/2/ebp/advertiser/list/
   * 入参 account_source=LOCAL；返回 data.account_list[].account_id 即 local_account_id。
   * 自动翻页拉全（page_size 上限 100）。
   */
  static async fetchEbpLocalAccounts(
    orgId: string,
    accessToken: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const out: Array<{ id: string; name: string }> = [];
    let page = 1;
    const pageSize = 100;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const args = {
        enterprise_organization_id: Number(orgId),
        account_source: 'LOCAL',
        page,
        page_size: pageSize,
      };
      const qs = Object.entries(args)
        .map(([k, v]) => `${k}=${encodeURIComponent(typeof v === 'string' ? v : String(v))}`)
        .join('&');
      const url = `https://api.oceanengine.com/open_api/2/ebp/advertiser/list/?${qs}`;
      console.log(`[OceanEngine] GET EBP 本地推账户列表 org=${orgId} page=${page}`);
      const res = await fetch(url, { method: 'GET', headers: { 'Access-Token': accessToken } });
      const json = safeJsonParse<{
        code: number; message: string;
        data: {
          account_list?: Array<{ account_id: string | number; account_type: string; account_name: string }>;
          page_info?: { total_page: number };
        };
      }>(await res.text());
      if (json.code !== 0) {
        throw new Error(`巨量引擎 EBP 账户列表: ${json.message} (code=${json.code})`);
      }
      for (const a of json.data.account_list ?? []) {
        // account_source=LOCAL 已过滤，account_type 兜底再校验一次
        if (!a.account_type || /LOCAL/i.test(a.account_type)) {
          out.push({ id: String(a.account_id), name: a.account_name ?? '' });
        }
      }
      const totalPage = json.data.page_info?.total_page ?? page;
      if (page >= totalPage) break;
      page++;
    }
    return out;
  }

  /**
   * 旧版巨量引擎工作台「账户列表」接口 —— 按 cc_account_id（工作台/纵横组织ID）发现
   * 名下本地推账户。仅用于账户发现 + 名称补全，不取 GMV/核销等业务数据。
   * 文档：GET https://api.oceanengine.com/open_api/2/cc/advertiser/list/
   * 入参 account_source=LOCAL、page_size=100、可选 filtering.account_name 过滤。
   * URL 可用 OCEANENGINE_WORKBENCH_LIST_URL 覆盖（不同租户路径可能不同）。
   * 自动翻页拉全；返回 normalize 后的 {id,name,status,raw} 数组 + 原始首行供 debug。
   */
  static async fetchOldWorkbenchLocalAccounts(
    ccAccountId: string,
    accessToken: string,
    opts: { accountName?: string } = {},
  ): Promise<{
    accounts: Array<{ id: string; name: string; status: string; raw: Record<string, unknown> }>;
    firstRow: Record<string, unknown> | null;
    firstRowKeys: string[];
    rawResponse: Record<string, unknown> | null;
    requestUrl: string;
  }> {
    const listUrl = (process.env.OCEANENGINE_WORKBENCH_LIST_URL ?? '').trim()
      || 'https://api.oceanengine.com/open_api/2/cc/advertiser/list/';

    const out: Array<{ id: string; name: string; status: string; raw: Record<string, unknown> }> = [];
    let firstRow: Record<string, unknown> | null = null;
    let rawResponse: Record<string, unknown> | null = null;
    let lastUrl = '';
    let page = 1;
    const pageSize = 100;

    // 各租户字段命名不一，逐一兜底取值
    const pick = (row: Record<string, unknown>, keys: string[]): string => {
      for (const k of keys) {
        const v = row[k];
        if (v != null && v !== '') return String(v);
      }
      return '';
    };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const params: Record<string, string> = {
        cc_account_id: String(ccAccountId).replace(/[^0-9]/g, ''),
        account_source: 'LOCAL',
        page: String(page),
        page_size: String(pageSize),
      };
      if (opts.accountName) {
        params.filtering = JSON.stringify({ account_name: opts.accountName });
      }
      const qs = Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
      lastUrl = `${listUrl}?${qs}`;
      console.log(`[OceanEngine] GET 旧版工作台本地推账户列表 cc=${ccAccountId} page=${page}`);
      const res = await fetch(lastUrl, { method: 'GET', headers: { 'Access-Token': accessToken } });
      const json = safeJsonParse<{
        code: number; message: string;
        data: {
          list?: Array<Record<string, unknown>>;
          account_list?: Array<Record<string, unknown>>;
          page_info?: { total_page?: number; total_number?: number; page?: number };
        };
      }>(await res.text());
      if (json.code !== 0) {
        throw new Error(`巨量引擎 旧版工作台账户列表: ${json.message} (code=${json.code})`);
      }
      if (page === 1) rawResponse = json as unknown as Record<string, unknown>;

      const rows = json.data.list ?? json.data.account_list ?? [];
      for (const row of rows) {
        if (!firstRow) firstRow = row;
        const id = pick(row, ['local_account_id', 'advertiser_id', 'account_id', 'id']);
        if (!id) continue;
        const name = pick(row, ['account_name', 'company_name', 'name', 'advertiser_name', 'company']);
        const status = pick(row, ['account_status', 'status', 'opt_status']);
        out.push({ id, name, status, raw: row });
      }

      const totalPage = json.data.page_info?.total_page;
      if (!totalPage || page >= totalPage || rows.length < pageSize) break;
      page++;
    }

    return {
      accounts: out,
      firstRow,
      firstRowKeys: firstRow ? Object.keys(firstRow) : [],
      rawResponse,
      requestUrl: lastUrl,
    };
  }

  /**
   * 拉取当前 AppId 下已授权的广告主列表。
   * 文档：GET https://open.oceanengine.com/open_api/oauth2/advertiser/get/
   */
  static async fetchAdvertiserList(
    appId: string,
    appSecret: string,
    accessToken: string,
  ): Promise<Array<{
    advertiser_id: string;
    advertiser_name: string;
    company: string;
    status: string;
  }>> {
    console.log(`[OceanEngine] GET ${ADVERTISER_LIST_URL} appId=${appId}`);

    const res = await fetch(
      `${ADVERTISER_LIST_URL}?app_id=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`,
      { method: 'GET', headers: { 'Access-Token': accessToken } },
    );

    const text = await res.text();
    const json = safeJsonParse<{
      code: number;
      message: string;
      data: {
        list: Array<{
          advertiser_id: string;
          advertiser_name: string;
          company: string;
          status: string;
        }>;
      };
    }>(text);

    if (json.code !== 0) {
      throw new Error(`巨量引擎 广告主列表: ${json.message} (code=${json.code})`);
    }

    return json.data.list ?? [];
  }

  // ── 计划列表 ────────────────────────────────────────────────────────────────

  /**
   * 拉取某本地推账户下的所有项目。
   * 本地推「获取项目列表」：GET v3.0/local/project/list/
   * 参数名为 local_account_id（不是 advertiser_id）。
   * 注：oauth2/advertiser/get 返回的本地推商家 ID 即作为 local_account_id。
   */
  async fetchCampaignList(advertiserId: string): Promise<Array<{
    campaign_id: string;
    campaign_name: string;
    status: string;          // 选中的状态值（已交给 normalizeProjectStatus）
    rawStatus: string;       // 同上，冗余保留供调试
    rawOptStatus: string;    // 原始 opt_status 字段值
    rawProjectStatus: string;// 原始 project_status 字段值
    selectedField: string;   // 最终选用的字段名
    allStatusFields: Record<string, unknown>; // 全部候选字段原始值
    budget: number;
    budget_mode: string;
    poi_name: string;
  }>> {
    advertiserId = normalizeOceanEngineAccountId(advertiserId);
    const token = await this.getAccessToken(advertiserId);

    const data = await oeRequest<{
      project_list?: Array<Record<string, unknown>>;
      page_info?: { total_number: number; page: number; page_size: number };
    }>(`${LOCAL_BASE}project/list/`, token, {
      method: 'GET',
      params: {
        local_account_id: advertiserId,
        page: '1',
        page_size: '100',
      },
    });

    const rows = data.project_list ?? [];
    if (rows.length > 0) {
      // 完整打印第一条原始数据，不截断，方便确认字段结构
      console.log(`[OceanEngine] 本地推项目列表首行 (账户 ${advertiserId}):`, JSON.stringify(rows[0]));
    } else {
      console.log(`[OceanEngine] 本地推账户 ${advertiserId} 暂无项目`);
    }
    return rows.map(raw => {
      const projectId   = raw.project_id ?? '';
      const projectName = raw.name ?? String(projectId);

      // 收集全部候选状态字段（便于诊断）
      const allStatusFields: Record<string, unknown> = {
        opt_status:       raw.opt_status,
        project_status:   raw.project_status,
        project_status_first: raw.project_status_first,
        status:           raw.status,
        delivery_status:  raw.delivery_status,
        marketing_status: raw.marketing_status,
        audit_status:     raw.audit_status,
        enable_status:    raw.enable_status,
        operation_status: raw.operation_status,
      };

      // opt_status 是用户主动开关（ENABLE/PAUSED/DELETE），与暂停写接口同字段，是最权威的开关状态。
      // project_status 是投放生命周期计算态（DONE/未达投放时间/超预算），即使今日有花费也可能是 DONE，
      // 不能用它判断开关状态。
      const rawOptStatus     = String(raw.opt_status      ?? '').trim();
      const rawProjectStatus = String(raw.project_status  ?? raw.project_status_first ?? raw.status ?? '').trim();

      let selectedField: string;
      let rawStatus: string;
      if (rawOptStatus !== '') {
        selectedField = 'opt_status';
        rawStatus     = rawOptStatus;
      } else if (rawProjectStatus !== '') {
        selectedField = 'project_status';
        rawStatus     = rawProjectStatus;
      } else {
        selectedField = '(none)';
        rawStatus     = '';
      }

      console.log(
        `[StatusDebug] project_id=${projectId} name=”${projectName}”` +
        ` selected=${selectedField} value=”${rawStatus}”` +
        ` keys=[${Object.keys(raw).join(',')}]` +
        ` allStatus=${JSON.stringify(allStatusFields)}`
      );
      if (!rawStatus) {
        console.warn(`[OceanEngine] ⚠️ 项目 ${projectId}（${projectName}）所有状态字段为空，原始 keys: ${Object.keys(raw).join(',')}`);
      }

      const poi = (raw.poi_info ?? {}) as Record<string, unknown>;
      return {
        campaign_id:      String(projectId),
        campaign_name:    String(projectName),
        status:           rawStatus,
        rawStatus,
        rawOptStatus,
        rawProjectStatus,
        selectedField,
        allStatusFields,
        budget:           Number(raw.project_budget ?? 0),
        budget_mode:      String(raw.project_budget_mode ?? ''),
        poi_name:         String(poi.poi_name ?? ''),
      };
    });
  }

  // ── 统计数据 ────────────────────────────────────────────────────────────────

  /**
   * 拉取本地推项目维度报表数据。
   * 文档：GET /open_api/v3.0/local/report/project/get/
   * 注意：metrics / filtering 等数组/对象参数需 JSON 字符串化后放进 query。
   * @param localAccountId 本地推账户 ID
   * @param projectIds 可选，按项目 ID 过滤；为空则拉账户下全部
   * @param startDate / endDate 查询区间（yyyy-mm-dd），默认近 90 天汇总
   */
  async fetchProjectReport(
    localAccountId: string,
    projectIds?: string[],
    startDate?: string,
    endDate?: string,
  ): Promise<CampaignStats[]> {
    const rawLocalAccountId = localAccountId;
    localAccountId = normalizeOceanEngineAccountId(localAccountId);
    console.log(`[OE] fetchProjectReport rawLocalAccountId=${rawLocalAccountId} normalizedLocalAccountId=${localAccountId}`);
    const token = await this.getAccessToken(localAccountId);
    // 默认只取「今日」数据（start=end=今天），与巨量后台「今日消耗」口径一致。
    // 之前默认取近 90 天累计，导致 UI 标注「今日」却显示 90 天总和，数据对不上后台。
    // 用北京时间（UTC+8）算「今天」，避免凌晨用 UTC 算成昨天。
    const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
    const end   = endDate   ?? today;
    const start = startDate ?? today;

    const params: Record<string, string> = {
      local_account_id: localAccountId,
      time_granularity: 'TIME_GRANULARITY_TOTAL',
      start_date: start,
      end_date: end,
      metrics: JSON.stringify(LOCAL_PROMO_METRICS),
      page: '1',
      page_size: '100',
    };
    if (projectIds && projectIds.length > 0) {
      // 项目ID 是 19 位大整数，经 Number() 会精度丢失（…266→…000）。
      // 手动拼 JSON，让 ID 以原始数字字面量输出，绕开 JS 大整数精度问题。
      const idLiterals = projectIds.map(id => String(id).replace(/[^0-9]/g, '')).filter(Boolean);
      params.filtering = `{"cdp_project_ids":[${idLiterals.join(',')}]}`;
    }

    const data = await oeRequest<{
      project_list?: Array<Record<string, unknown>>;
      page_info?: { total_number: number };
    }>(`${LOCAL_BASE}report/project/get/`, token, { method: 'GET', params });

    const rows = data.project_list ?? [];
    if (rows.length > 0) {
      console.log(`[OceanEngine] 本地推项目报表首行:`, JSON.stringify(rows[0]).slice(0, 300));
    }
    return rows.map(row => mapLocalPromoRow(row, String(row.project_id ?? '')));
  }

  /**
   * 拉取账户级（全域投放）报表 —— /local/report/account/get/。
   * 巨量本地推「全域投放」消耗只出现在账户级报表，不进项目报表的 stat_cost。
   * 返回 data.data_list[0]（单账户一行汇总）。即使全 0 也返回，由调用方判断是否有数据。
   */
  async fetchAccountReport(
    localAccountId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    localAccountId: string;
    spent: number;        // stat_cost 全域消耗
    gmv: number;          // oto_pay_order_amount 全域成交金额
    orders: number;       // oto_pay_order_count 全域成交订单数
    roi: number;          // oto_pay_order_roi 全域支付ROI
    orderCost: number;    // conversion_cost 成交订单成本/转化成本
    impressions: number;
    clicks: number;
    ctr: number;
    cpm: number;
    convertCnt: number;
    raw: Record<string, unknown>;
  } | null> {
    const rawLocalAccountId = localAccountId;
    localAccountId = normalizeOceanEngineAccountId(localAccountId);
    const token = await this.getAccessToken(localAccountId);
    const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
    const end   = endDate   ?? today;
    const start = startDate ?? today;

    const params: Record<string, string> = {
      local_account_id: localAccountId,
      time_granularity: 'TIME_GRANULARITY_TOTAL',
      start_date: start,
      end_date: end,
      metrics: JSON.stringify(LOCAL_PROMO_METRICS),
      page: '1',
      page_size: '5',
    };
    console.log(`[OE] fetchAccountReport rawLocalAccountId=${rawLocalAccountId} normalizedLocalAccountId=${localAccountId} ${start}~${end}`);

    const data = await oeRequest<{ data_list?: Array<Record<string, unknown>> }>(
      `${LOCAL_BASE}report/account/get/`, token, { method: 'GET', params },
    );

    const row = (data.data_list ?? [])[0];
    if (!row) {
      console.log(`[OceanEngine] 账户报表无 data_list（${localAccountId}）`);
      return null;
    }
    console.log(`[OceanEngine] 账户报表首行:`, JSON.stringify(row).slice(0, 300));

    return {
      localAccountId,
      spent:       Number(row.stat_cost            ?? 0),
      gmv:         Number(row.oto_pay_order_amount ?? 0),
      orders:      Number(row.oto_pay_order_count  ?? 0),
      roi:         Number(row.oto_pay_order_roi    ?? 0),
      orderCost:   Number(row.conversion_cost      ?? 0),
      impressions: Number(row.show_cnt             ?? 0),
      clicks:      Number(row.click_cnt            ?? 0),
      ctr:         Number(row.ctr                  ?? 0) / 100,
      cpm:         Number(row.cpm_platform         ?? 0),
      convertCnt:  Number(row.convert_cnt          ?? 0),
      raw: row,
    };
  }

  /**
   * 拉取巨量本地推后台首页「全域投放消耗」真实口径。
   * 开放平台 local/report/account|project|promotion 三个接口均不覆盖全域消耗；
   * 后台首页用的是私有 statQuery 接口（DataSetKey=pc_home_roi2）。
   * 鉴权 Cookie 从 process.env.OCEANENGINE_LOCALADS_COOKIE 读，不硬编码。
   * 如未配置直接抛出，让调用方打日志/记 errors，不要静默返回 0。
   */
  static async fetchHomeRoi2StatQuery(
    advid: string,
    startTime: string,  // 'YYYY-MM-DD HH:mm:ss'
    endTime:   string,
  ): Promise<{
    spent:      number;  // Totals.stat_cost.Value          全域总消耗
    liveSpent:  number;  // Totals.live_stat_cost_for_roi2.Value
    videoSpent: number;  // Totals.video_stat_cost_for_roi2.Value
    liveGmv:    number;  // Totals.live_oto_pay_order_stat_amount_for_roi2.Value
    videoGmv:   number;  // Totals.video_oto_pay_order_stat_amount_for_roi2.Value
    gmv:        number;  // liveGmv + videoGmv
    liveRoi:    number;  // Totals.live_oto_pay_order_roi2_new.Value
    videoRoi:   number;  // Totals.video_oto_pay_order_roi2_new.Value
    roi:        number;  // gmv / spent（前端展示用，避免后台加权 ROI 口径差异）
    orders:     number;  // 全域成交订单数（如该数据集返回则带出，否则 0）
    orderCost:  number;  // 全域成交订单成本（spent/orders，无订单则 0）
    rawTotals:  Record<string, unknown>;  // 原始 Totals，供 debug
    totalsKeys: string[];
    httpStatus: number;
    source: 'statQuery_pc_home_roi2';
  }> {
    // 按 advid 解析后台 Cookie：优先 OCEANENGINE_LOCALADS_COOKIE_MAP（JSON advid→cookie），
    // 回落到全局 OCEANENGINE_LOCALADS_COOKIE。不同登录会话的账户（如天鸿）用各自 cookie。
    let cookie = process.env.OCEANENGINE_LOCALADS_COOKIE;
    try {
      if (process.env.OCEANENGINE_LOCALADS_COOKIE_MAP) {
        const m = JSON.parse(process.env.OCEANENGINE_LOCALADS_COOKIE_MAP) as Record<string, string>;
        if (m[advid]) cookie = m[advid];
      }
    } catch { /* ignore malformed */ }
    if (!cookie) throw new Error('[statQuery] 未配置 OCEANENGINE_LOCALADS_COOKIE（或 _COOKIE_MAP），请在本地 .env 设置后台 Cookie');

    // 可选补充 csrf / agw 等风控头：优先 OCEANENGINE_LOCALADS_HEADERS_MAP（JSON advid→headers对象），
    // 回落到全局 OCEANENGINE_LOCALADS_HEADERS（JSON 字符串）。
    let extraHeaders: Record<string, string> = {};
    try {
      if (process.env.OCEANENGINE_LOCALADS_HEADERS)
        extraHeaders = JSON.parse(process.env.OCEANENGINE_LOCALADS_HEADERS) as Record<string, string>;
    } catch { /* ignore malformed */ }
    try {
      if (process.env.OCEANENGINE_LOCALADS_HEADERS_MAP) {
        const hm = JSON.parse(process.env.OCEANENGINE_LOCALADS_HEADERS_MAP) as Record<string, Record<string, string>>;
        if (hm[advid]) extraHeaders = { ...extraHeaders, ...hm[advid] };
      }
    } catch { /* ignore malformed */ }

    // 对比时段：startTime 前一天同时间段
    const prev = (ts: string) => {
      const d = new Date(ts.replace(' ', 'T') + '+08:00');
      d.setDate(d.getDate() - 1);
      return d.toISOString().replace('T', ' ').slice(0, 19);
    };

    // 支持按 advid 指定数据集：OCEANENGINE_LOCALADS_DATASET_MAP={"advid":"standard"}
    // "standard" → pc_home_standard_promotion（标准推广类账户，如天鸿；后台首页「标准推广」口径）
    // 默认 "roi2" → pc_home_roi2（本地推/门店全域投放类账户）
    let datasetAlias = 'roi2';
    try {
      if (process.env.OCEANENGINE_LOCALADS_DATASET_MAP) {
        const dm = JSON.parse(process.env.OCEANENGINE_LOCALADS_DATASET_MAP) as Record<string, string>;
        if (dm[advid]) datasetAlias = dm[advid];
      }
    } catch { /* ignore malformed */ }

    const isStandard = datasetAlias === 'standard';
    // 各数据集的 DataSetKey / ModuleId / Filters / Metrics 都不同——实测自浏览器真实请求
    const dataSetKey = isStandard ? 'pc_home_standard_promotion' : 'pc_home_roi2';
    const moduleId   = isStandard ? '7399754894837612581' : '7396885770868375562';
    const conditions = isStandard
      ? [
          { Field: 'advertiser_id', Operator: 7, Values: [advid] },
          { Field: 'platform_version', Operator: 8, Values: ['2'] },
          {
            ConditionRelationshipType: 1,
            Operator: 7,
            Conditions: [
              {
                ConditionRelationshipType: 2,
                Conditions: [
                  { Field: 'adlab_mode', Operator: 7, Values: ['0'] },
                  { Field: 'adlab_mode', Operator: 12 },
                ],
              },
              { Field: 'derivate_is_order', Operator: 7, Values: ['0'] },
            ],
          },
        ]
      : [
          { Field: 'advertiser_id', Operator: 7, Values: [advid] },
          { Field: 'adlab_mode',    Operator: 7, Values: ['1'] },
          { Field: 'create_channel', Operator: 7, Values: ['64'] },
        ];
    const metrics = isStandard
      ? ['stat_cost', 'show_cnt', 'click_cnt', 'oto_pay_order_count', 'oto_pay_order_amount', 'oto_pay_order_roi']
      : [
          'live_stat_cost_for_roi2',
          'video_stat_cost_for_roi2',
          'live_oto_pay_order_stat_amount_for_roi2',
          'live_oto_pay_order_roi2_new',
          'video_oto_pay_order_stat_amount_for_roi2',
          'video_oto_pay_order_roi2_new',
          'stat_cost',
        ];

    const payload = {
      StartTime: startTime,
      EndTime:   endTime,
      ComparisonParams: {
        RatioStartTime: prev(startTime),
        RatioEndTime:   prev(endTime),
      },
      DataSetKey: dataSetKey,
      Dimensions: ['stat_time_hour'],
      Filters: {
        ConditionRelationshipType: 1,
        Conditions: conditions,
      },
      FrameId:  '7289039319510155321',
      ModuleId: moduleId,
      Metrics:  metrics,
      OrderBy: [{ Field: 'stat_time_hour', Type: 1 }],
    };

    const url = `https://localads.chengzijianzhan.cn/api/lamp/pc/v2/statistics/data/statQuery?advid=${encodeURIComponent(advid)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en,zh-CN;q=0.9,zh;q=0.8',
      'Origin': 'https://localads.chengzijianzhan.cn',
      // referer 必须带 advid——通用 referer 会被风控判为「未登录」（实测）
      'Referer': `https://localads.chengzijianzhan.cn/lamp/pc/home?advid=${encodeURIComponent(advid)}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
      ...extraHeaders,
    };

    console.log(`[statQuery] 请求 advid=${advid} ${startTime} ~ ${endTime}`);
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = safeJsonParse<Record<string, unknown>>(text);
    } catch {
      // 非 JSON 多半是登录页/风控拦截（cookie 失效或缺 msToken/a_bogus）
      throw new Error(`[statQuery] 响应非 JSON (HTTP ${res.status})，疑似 cookie 失效/风控拦截: ${text.slice(0, 160)}`);
    }

    // 后台接口错误码非 0 表示鉴权失败或参数错误
    const code = json.code ?? (json.data as Record<string, unknown>)?.code;
    if (code !== 0 && code !== undefined) {
      throw new Error(`[statQuery] 接口错误 code=${code} message=${json.message ?? JSON.stringify(json).slice(0, 160)}`);
    }

    // 递归定位 Totals 对象（兼容 data.StatsData.Totals / StatsData.Totals / 其它包裹）
    const findTotals = (o: unknown): Record<string, unknown> | null => {
      if (!o || typeof o !== 'object') return null;
      const rec = o as Record<string, unknown>;
      for (const key of ['Totals', 'Total', 'totals']) {
        if (rec[key] && typeof rec[key] === 'object') return rec[key] as Record<string, unknown>;
      }
      for (const v of Object.values(rec)) {
        const f = findTotals(v);
        if (f) return f;
      }
      return null;
    };
    const totals = findTotals(json) ?? {};
    const totalsKeys = Object.keys(totals);

    if (totalsKeys.length === 0) {
      throw new Error(`[statQuery] 响应未找到 Totals（cookie 可能失效）: ${JSON.stringify(json).slice(0, 200)}`);
    }

    // 单字段取值：兼容 {Value: x} 包裹与裸值
    const tv = (key: string) => {
      const cell = (totals as Record<string, unknown>)[key];
      if (cell == null) return 0;
      if (typeof cell === 'object') return Number((cell as Record<string, unknown>).Value ?? 0);
      return Number(cell);
    };

    const liveSpent  = tv('live_stat_cost_for_roi2');
    const videoSpent = tv('video_stat_cost_for_roi2');
    const liveGmv    = tv('live_oto_pay_order_stat_amount_for_roi2');
    const videoGmv   = tv('video_oto_pay_order_stat_amount_for_roi2');
    // standard 数据集直接给 stat_cost / oto_pay_order_amount / oto_pay_order_roi（无直播/视频拆分）
    const spent      = tv('stat_cost') || (liveSpent + videoSpent);
    const gmv        = tv('oto_pay_order_amount') || (liveGmv + videoGmv);
    const orders = tv('oto_pay_order_count')
      || tv('live_oto_pay_order_count_for_roi2')
      || tv('video_oto_pay_order_count_for_roi2');
    const orderCost = orders > 0 ? spent / orders : 0;
    // standard 直接有 oto_pay_order_roi；roi2 用 gmv/spent 自算
    const directRoi = tv('oto_pay_order_roi');

    console.log(
      `[statQuery_${dataSetKey}] advid=${advid}\n` +
      `  spent=${spent}\n  liveSpent=${liveSpent}\n  videoSpent=${videoSpent}\n` +
      `  gmv=${gmv}  liveGmv=${liveGmv}  videoGmv=${videoGmv}\n` +
      `  orders=${orders}  orderCost=${orderCost}\n` +
      `  liveRoi=${tv('live_oto_pay_order_roi2_new')}  videoRoi=${tv('video_oto_pay_order_roi2_new')}\n` +
      `  rawTotalsKeys=[${totalsKeys.join(', ')}]`,
    );

    return {
      spent, liveSpent, videoSpent, liveGmv, videoGmv, gmv,
      liveRoi:  tv('live_oto_pay_order_roi2_new'),
      videoRoi: tv('video_oto_pay_order_roi2_new'),
      roi: directRoi || (spent > 0 ? gmv / spent : 0),
      orders, orderCost,
      rawTotals: totals,
      totalsKeys,
      httpStatus: res.status,
      source: 'statQuery_pc_home_roi2',
    };
  }

  async fetchCampaignStats(externalId: string, advertiserId: string): Promise<CampaignStats> {
    advertiserId = normalizeOceanEngineAccountId(advertiserId);
    const rows = await this.fetchProjectReport(advertiserId, [externalId]);
    const row = rows.find(r => r.externalId === externalId) ?? rows[0];
    if (!row) throw new Error(`找不到本地推项目报表数据: ${externalId}`);
    return row;
  }

  async fetchBatchStats(externalIds: string[], advertiserId: string): Promise<CampaignStats[]> {
    return this.fetchProjectReport(advertiserId, externalIds);
  }

  // ── 计划管理 ────────────────────────────────────────────────────────────────

  /**
   * 创建本地推广告计划。
   * landing_type 使用 STORE_VISIT（到店推广），适用于巨量本地推场景。
   */
  async createCampaign(params: CreateCampaignParams): Promise<{ externalId: string }> {
    params.advertiserId = normalizeOceanEngineAccountId(params.advertiserId);
    const token = await this.getAccessToken(params.advertiserId);

    const data = await oeRequest<{ campaign_id: string }>(
      `${BASE}campaign/create/`,
      token,
      {
        method: 'POST',
        body: {
          advertiser_id: params.advertiserId,
          campaign_name: params.name,
          campaign_type: 'FEED',
          budget: params.budget,
          budget_mode: 'BUDGET_MODE_DAY',
          // 本地推落地页类型：到店访问（非电商商品页）
          landing_type: 'STORE_VISIT',
        },
      },
    );

    return { externalId: data.campaign_id };
  }

  async updateCampaign(params: UpdateCampaignParams): Promise<boolean> {
    const token = await this.getAccessToken(params.advertiserId);

    if (params.status !== undefined && params.budget !== undefined) {
      // 同时改状态和预算时分两步
      await this._updateProjectStatus(params.externalId, params.advertiserId, params.status, token);
      await this._updateProjectBudget(params.externalId, params.advertiserId, params.budget, token);
      return true;
    }
    if (params.status !== undefined) {
      return this._updateProjectStatus(params.externalId, params.advertiserId, params.status, token);
    }
    if (params.budget !== undefined) {
      return this._updateProjectBudget(params.externalId, params.advertiserId, params.budget, token);
    }
    return true;
  }

  // 本地推项目改状态：v3.0/local/project/status/update/
  // 接口要求 local_account_id / project_ids 为 integer，且 project_id 超过 JS 安全整数，
  // 故用 stringifyWithRawInts 发送原始整数字面量（不加引号、不丢精度）。
  private async _updateProjectStatus(
    projectId: string, localAccountId: string, status: 'enable' | 'disable', token: string,
  ): Promise<boolean> {
    const body = {
      local_account_id: localAccountId,
      data: [
        {
          project_id: projectId,
          opt_status: status === 'enable' ? 'ENABLE' : 'PAUSED',
        },
      ],
    };
    const rawBody = stringifyWithRawInts(body, ['local_account_id', 'project_id']);
    console.log(`[OE] project/status/update body=${rawBody} typeof local_account_id=integer typeof project_id=integer`);
    await oeRequest(`${LOCAL_BASE}project/status/update/`, token, { method: 'POST', rawBody });
    return true;
  }

  // 本地推项目改预算：v3.0/local/project/update/（通用更新）
  private async _updateProjectBudget(
    projectId: string, localAccountId: string, budget: number, token: string,
  ): Promise<boolean> {
    const body = {
      local_account_id: localAccountId,
      data: {
        project_id: projectId,
        budget,
        budget_mode: 'BUDGET_MODE_DAY',
      },
    };
    const rawBody = stringifyWithRawInts(body, ['local_account_id', 'project_id']);
    console.log(`[OE] project/update body=${rawBody}`);
    await oeRequest(`${LOCAL_BASE}project/update/`, token, { method: 'POST', rawBody });
    return true;
  }

  async pauseCampaign(externalId: string, advertiserId: string): Promise<boolean> {
    advertiserId = normalizeOceanEngineAccountId(advertiserId);
    return this.updateCampaign({ externalId, advertiserId, status: 'disable' });
  }

  async resumeCampaign(externalId: string, advertiserId: string): Promise<boolean> {
    advertiserId = normalizeOceanEngineAccountId(advertiserId);
    return this.updateCampaign({ externalId, advertiserId, status: 'enable' });
  }

  async adjustBudget(externalId: string, advertiserId: string, newBudget: number): Promise<boolean> {
    advertiserId = normalizeOceanEngineAccountId(advertiserId);
    return this.updateCampaign({ externalId, advertiserId, budget: newBudget });
  }
}
