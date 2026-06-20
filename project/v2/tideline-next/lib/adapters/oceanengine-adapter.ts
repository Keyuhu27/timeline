import type { IAdAdapter, CampaignStats, CreateCampaignParams, UpdateCampaignParams } from './ad-adapter';

const BASE = 'https://ad.oceanengine.com/open_api/2/';
const ADVERTISER_LIST_URL = 'https://open.oceanengine.com/open_api/oauth2/advertiser/get/';

// ─── 本地推指标列表 ───────────────────────────────────────────────────────────
// 巨量本地推专属指标（非千川电商指标）
const LOCAL_PROMO_METRICS = [
  'stat_cost',
  'show_cnt',
  'click_cnt',
  'ctr',
  'cpm_platform',
  'store_visit_cnt',
  'phone_confirm_cnt',
  'map_search_cnt',
  'coupon_send_cnt',
];

// ─── 大整数安全 JSON 解析 ─────────────────────────────────────────────────────
// 巨量引擎 advertiser_id / campaign_id 是 19 位雪花 ID，超过 JS 安全整数上限
// (Number.MAX_SAFE_INTEGER ≈ 9e15)，直接 JSON.parse 会丢精度（末尾被四舍五入成 0）。
// 解决：解析前把 16 位以上的裸整数字面量包成字符串，保住完整 ID。
export function safeJsonParse<T>(text: string): T {
  const wrapped = text.replace(/([:\[,]\s*)(\d{16,})(?=\s*[,\]}])/g, '$1"$2"');
  return JSON.parse(wrapped) as T;
}

// ─── HTTP 辅助函数 ────────────────────────────────────────────────────────────

async function oeRequest<T>(
  url: string,
  token: string,
  options: { method: 'GET' | 'POST'; body?: Record<string, unknown>; params?: Record<string, string> },
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
    fetchInit = { method: 'POST', headers, body: JSON.stringify(options.body ?? {}) };
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
  const storeVisits   = Number(row.store_visit_cnt   ?? 0);
  const phoneCalls    = Number(row.phone_confirm_cnt  ?? 0);
  const mapSearches   = Number(row.map_search_cnt     ?? 0);
  const coupons       = Number(row.coupon_send_cnt    ?? 0);
  const leads         = storeVisits + phoneCalls + coupons;

  return {
    externalId,
    spent:       Number(row.stat_cost      ?? 0),
    impressions: Number(row.show_cnt       ?? 0),
    clicks:      Number(row.click_cnt      ?? 0),
    ctr:         Number(row.ctr            ?? 0) / 100,
    cpm:         Number(row.cpm_platform   ?? 0),
    // 本地推暂无电商转化字段，置 0 待接口更新后填充
    gmv:    0,
    orders: 0,
    roas:   0,
    cvr:    0,
    // 本地推专属字段（CampaignStats 接口将补充这些字段）
    storeVisits,
    phoneCalls,
    mapSearches,
    coupons,
    leads,
  } as CampaignStats;
}

// ─── 主适配器类 ───────────────────────────────────────────────────────────────

export class OceanEngineAdapter implements IAdAdapter {
  constructor(private getAccessToken: (advertiserId: string) => Promise<string>) {}

  // ── 账户列表（静态方法，不需要 advertiserId）────────────────────────────────

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
   * 拉取某广告主下所有广告计划。
   * 文档：GET https://ad.oceanengine.com/open_api/2/campaign/get/
   * 注意：巨量引擎 campaign/get 是 GET 接口，参数走 query string。
   */
  async fetchCampaignList(advertiserId: string): Promise<Array<{
    campaign_id: string;
    campaign_name: string;
    status: string;
    budget: number;
    budget_mode: string;
  }>> {
    const token = await this.getAccessToken(advertiserId);
    const data = await oeRequest<{
      list: Array<{
        campaign_id: string;
        campaign_name: string;
        status: string;
        budget: number;
        budget_mode: string;
      }>;
      page_info: { total_number: number; page: number; page_size: number };
    }>(`${BASE}campaign/get/`, token, {
      method: 'GET',
      params: {
        advertiser_id: advertiserId,
        page: '1',
        page_size: '100',
      },
    });

    return data.list ?? [];
  }

  // ── 统计数据 ────────────────────────────────────────────────────────────────

  async fetchCampaignStats(externalId: string, advertiserId: string): Promise<CampaignStats> {
    const token = await this.getAccessToken(advertiserId);
    const today = new Date().toISOString().slice(0, 10);

    const data = await oeRequest<{ list: Array<Record<string, unknown>> }>(
      `${BASE}report/integrated/get/`,
      token,
      {
        method: 'POST',
        body: {
          advertiser_id: advertiserId,
          report_type: 'CAMPAIGN',
          dimensions: ['campaign_id'],
          metrics: LOCAL_PROMO_METRICS,
          filters: [{ field: 'campaign_id', type: 'IN', values: [externalId] }],
          start_date: today,
          end_date: today,
          page: 1,
          page_size: 1,
        },
      },
    );

    const row = data.list?.[0];
    if (!row) throw new Error(`找不到本地推计划数据: ${externalId}`);

    const id = String(row.campaign_id ?? externalId);
    return mapLocalPromoRow(row, id);
  }

  async fetchBatchStats(externalIds: string[], advertiserId: string): Promise<CampaignStats[]> {
    const token = await this.getAccessToken(advertiserId);
    const today = new Date().toISOString().slice(0, 10);

    const data = await oeRequest<{ list: Array<Record<string, unknown>> }>(
      `${BASE}report/integrated/get/`,
      token,
      {
        method: 'POST',
        body: {
          advertiser_id: advertiserId,
          report_type: 'CAMPAIGN',
          dimensions: ['campaign_id'],
          metrics: LOCAL_PROMO_METRICS,
          filters: [{ field: 'campaign_id', type: 'IN', values: externalIds }],
          start_date: today,
          end_date: today,
          page: 1,
          page_size: externalIds.length,
        },
      },
    );

    return (data.list ?? []).map(row => {
      const id = String(row.campaign_id ?? '');
      return mapLocalPromoRow(row, id);
    });
  }

  // ── 计划管理 ────────────────────────────────────────────────────────────────

  /**
   * 创建本地推广告计划。
   * landing_type 使用 STORE_VISIT（到店推广），适用于巨量本地推场景。
   */
  async createCampaign(params: CreateCampaignParams): Promise<{ externalId: string }> {
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
    const body: Record<string, unknown> = {
      advertiser_id: params.advertiserId,
      campaign_id: params.externalId,
    };

    if (params.budget !== undefined) {
      body.budget = params.budget;
      body.budget_mode = 'BUDGET_MODE_DAY';
    }
    if (params.status !== undefined) {
      body.opt_status = params.status === 'enable' ? 'ENABLE' : 'DISABLE';
    }

    await oeRequest(`${BASE}campaign/update/`, token, { method: 'POST', body });
    return true;
  }

  async pauseCampaign(externalId: string, advertiserId: string): Promise<boolean> {
    return this.updateCampaign({ externalId, advertiserId, status: 'disable' });
  }

  async resumeCampaign(externalId: string, advertiserId: string): Promise<boolean> {
    return this.updateCampaign({ externalId, advertiserId, status: 'enable' });
  }

  async adjustBudget(externalId: string, advertiserId: string, newBudget: number): Promise<boolean> {
    return this.updateCampaign({ externalId, advertiserId, budget: newBudget });
  }
}
