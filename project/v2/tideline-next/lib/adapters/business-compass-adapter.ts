// 抖音生活服务「生意经」(Business Compass) 数据接口
// 鉴权通过环境变量（不提交 Git）：
//   BUSINESS_COMPASS_COOKIE    — 生意经后台 Cookie
//   BUSINESS_COMPASS_API_BASE  — 生意经后台域名，例如 https://www.life-data.cn
//   BUSINESS_FLOW_TRADE_SPLIT_URL  — 流量成交拆分接口完整 URL（可选覆盖）
//   BUSINESS_FLOW_EXPOSURE_URL     — 流量曝光拆分接口完整 URL（可选覆盖）
//   BUSINESS_FLOW_INSIGHTS_URL     — data_conclusion/explain 接口完整 URL（可选覆盖）
//
// 全部方法 try/catch：未配置/失败/解析失败 → 返回 null，日报继续生成。

export interface BusinessTradeSplit {
  liveGmv: number;            // 直播渠道 GMV（生意经口径，非达播）
  videoGmv: number;           // 视频渠道 GMV
  leadCardGmv: number;        // 获客卡 GMV
  searchResultCardGmv: number;// 搜索结果卡 GMV
  searchSceneGmv: number;     // 抖音搜索场景 GMV
  recommendSceneGmv: number;  // 推荐分享场景 GMV
  groupbuySceneGmv: number;   // 团购商城场景 GMV
  totalGmv: number;
  rows: Array<{ name: string; scene: string; order: string; gmv: number }>;
  fetchedAt: string;
}

export interface BusinessExposureSplit {
  rows: Array<{ scene: string; showCnt: number | null; rate: number | null }>;
  totalShow: number;
  fetchedAt: string;
}

export interface BusinessInsightResult {
  conclusion: string;
  startDate: string;
  endDate: string;
}

function cookie(): string { return process.env.BUSINESS_COMPASS_COOKIE ?? ''; }
function base(): string { return (process.env.BUSINESS_COMPASS_API_BASE ?? '').replace(/\/$/, ''); }

/** 从 BUSINESS_COMPASS_LIFE_ACCOUNT_MAP 环境变量读取品牌 lifeAccountId 映射
 *  格式（JSON）：{"<laikePoi或externalId>": "<lifeAccountId>,<isSingle>"}
 *  例：{"1745303406415880": "7034394621161506847,0", "xxx": "7576836870521292852,1"}
 */
function resolveLifeAccountId(poiId: string, overrideId?: string): { lifeAccountId: string; isSingle: number; mapped: boolean } {
  // 1) 最高优先级：BUSINESS_COMPASS_LIFE_ACCOUNT_MAP（poiId → "lifeAccountId,isSingle"）
  try {
    const raw = process.env.BUSINESS_COMPASS_LIFE_ACCOUNT_MAP;
    if (raw) {
      const map = JSON.parse(raw) as Record<string, string>;
      const val = map[poiId];
      if (val) {
        const [id, single] = String(val).split(',');
        return { lifeAccountId: id ?? '', isSingle: Number(single ?? 0), mapped: true };
      }
    }
  } catch (e) { console.error(`[BusinessSourceSplit] map 解析失败（检查 JSON 格式）:`, String(e)); }
  // 2) 次级：account 级 override（也支持「id,single」形式）—— 视为已映射
  if (overrideId) {
    const [id, single] = String(overrideId).split(',');
    return { lifeAccountId: id ?? '', isSingle: Number(single ?? 0), mapped: true };
  }
  // 3) map 未命中且无 override：尝试全局 BUSINESS_COMPASS_LIFE_ACCOUNT_ID 作为兜底
  //    适用场景：仅运营单一品牌，或临时调试时尚未配置完整 map。
  //    多品牌运营时应尽快配置 BUSINESS_COMPASS_LIFE_ACCOUNT_MAP 避免串品牌数据。
  const globalId = process.env.BUSINESS_COMPASS_LIFE_ACCOUNT_ID;
  if (globalId) {
    console.warn(`[BusinessSourceSplit] map miss poiId=${poiId} — 回落全局 BUSINESS_COMPASS_LIFE_ACCOUNT_ID=${globalId}（建议配置 BUSINESS_COMPASS_LIFE_ACCOUNT_MAP 避免串品牌）`);
    const [id, single] = String(globalId).split(',');
    return { lifeAccountId: id ?? '', isSingle: Number(single ?? 0), mapped: true };
  }
  console.warn(`[BusinessSourceSplit] map miss poiId=${poiId} — 无映射且无全局 ID，跳过生意经请求（日报留空）。请在 Railway 配置 BUSINESS_COMPASS_LIFE_ACCOUNT_MAP={"${poiId}":"lifeAccountId,1"}`);
  return { lifeAccountId: '', isSingle: 0, mapped: false };
}

function headers(lifeAccountId?: string): Record<string, string> {
  const id = lifeAccountId || (process.env.BUSINESS_COMPASS_LIFE_ACCOUNT_ID ?? '');
  // 额外 headers，从 env JSON 解析（如 x-secsdk-csrf-token / x-tt-ls-session-id 等）
  let extraHeaders: Record<string, string> = {};
  try {
    const raw = process.env.BUSINESS_COMPASS_EXTRA_HEADERS_JSON;
    if (raw) extraHeaders = JSON.parse(raw) as Record<string, string>;
  } catch { /* 忽略解析错误 */ }
  // 防护：禁止 EXTRA_HEADERS 写死 life-account-id / root-life-account-id（否则会串品牌）
  for (const k of Object.keys(extraHeaders)) {
    if (/^(root-)?life-account-id$/i.test(k)) {
      console.warn(`[BusinessSourceSplit] 已忽略 EXTRA_HEADERS 中的 ${k}（life-account-id 只能由 map 解析）`);
      delete extraHeaders[k];
    }
  }

  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en,zh-CN;q=0.9,zh;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Cookie': cookie(),
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'Referer': base() + '/flow/content/my/overview',
    'Origin': base(),
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    ...extraHeaders,
    ...(id ? { 'life-account-id': id, 'root-life-account-id': id } : {}),
  };
}

function tryParse<T>(text: string): T | null {
  try { return JSON.parse(text) as T; } catch { return null; }
}

async function postJson<T>(url: string, body: unknown, lifeAccountId?: string): Promise<T | null> {
  try {
    const res = await fetch(url, { method: 'POST', headers: headers(lifeAccountId), body: JSON.stringify(body) });
    const text = await res.text();
    const json = tryParse<T>(text);
    if (!json) { console.error(`[BusinessCompass] 响应非 JSON (HTTP ${res.status}) ${url}: ${text.slice(0, 200)}`); return null; }
    return json;
  } catch (e) {
    console.error(`[BusinessCompass] 请求失败 ${url}:`, String(e));
    return null;
  }
}

const fen2yuan = (n: unknown) => Math.round(Number(n ?? 0)) / 100;

// ── 解析：流量成交拆分 ─────────────────────────────────────────────────────────
interface TradeRow {
  first_enter_order_source_name?: string;
  first_enter_source?: string;
  first_order_source?: string;
  pay_amount_1d?: number;
}
export function parseTradeSplit(data: TradeRow[]): Omit<BusinessTradeSplit, 'fetchedAt'> {
  const sumBy = (pred: (r: TradeRow) => boolean) =>
    data.filter(pred).reduce((s, r) => s + Number(r.pay_amount_1d ?? 0), 0);

  const liveGmv            = sumBy(r => r.first_order_source === '直播');
  const videoGmv           = sumBy(r => r.first_order_source === '视频');
  const leadCardGmv        = sumBy(r => r.first_order_source === '获客卡');
  const searchResultCardGmv= sumBy(r => r.first_order_source === '搜索结果卡');
  const searchSceneGmv     = sumBy(r => r.first_enter_source === '抖音搜索场景');
  const recommendSceneGmv  = sumBy(r => r.first_enter_source === '推荐分享场景');
  const groupbuySceneGmv   = sumBy(r => r.first_enter_source === '团购商城场景');
  const totalGmv           = data.reduce((s, r) => s + Number(r.pay_amount_1d ?? 0), 0);

  return {
    liveGmv: fen2yuan(liveGmv),
    videoGmv: fen2yuan(videoGmv),
    leadCardGmv: fen2yuan(leadCardGmv),
    searchResultCardGmv: fen2yuan(searchResultCardGmv),
    searchSceneGmv: fen2yuan(searchSceneGmv),
    recommendSceneGmv: fen2yuan(recommendSceneGmv),
    groupbuySceneGmv: fen2yuan(groupbuySceneGmv),
    totalGmv: fen2yuan(totalGmv),
    rows: data
      .map(r => ({
        name: r.first_enter_order_source_name ?? `${r.first_enter_source ?? ''}_${r.first_order_source ?? ''}`,
        scene: r.first_enter_source ?? '',
        order: r.first_order_source ?? '',
        gmv: fen2yuan(r.pay_amount_1d),
      }))
      .filter(r => r.gmv > 0)
      .sort((a, b) => b.gmv - a.gmv),
  };
}

// ── 解析：曝光拆分 ─────────────────────────────────────────────────────────────
interface ExposureRow {
  first_enter_source_name?: string;
  show_cnt_1d?: number | null;
  show_cnt_1d_rate?: number | null;
}
export function parseExposureSplit(data: ExposureRow[]): Omit<BusinessExposureSplit, 'fetchedAt'> {
  const rows = data.map(r => ({
    scene: r.first_enter_source_name ?? '',
    showCnt: r.show_cnt_1d == null ? null : Number(r.show_cnt_1d),
    rate: r.show_cnt_1d_rate == null ? null : Number(r.show_cnt_1d_rate),
  })).filter(r => r.scene);
  const totalShow = rows.reduce((s, r) => s + (r.showCnt ?? 0), 0);
  return { rows, totalShow };
}

export class BusinessCompassAdapter {
  /** 流量成交拆分（pay_amount_1d × first_enter_source × first_order_source） */
  static async fetchTradeSplit(poiId: string, startDate: string, endDate: string): Promise<BusinessTradeSplit | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.BUSINESS_FLOW_TRADE_SPLIT_URL || (base() + '/api/compass/flow/trade_split');
    if (!url.startsWith('http')) { console.warn('[BusinessCompass] 未配置流量成交拆分 URL，跳过'); return null; }

    const json = await postJson<{ code?: number; data?: TradeRow[]; responseData?: { data?: TradeRow[] } }>(url, {
      poi_id: poiId, start_date: startDate, end_date: endDate,
    });
    const data = json?.data ?? json?.responseData?.data;
    if (!Array.isArray(data) || !data.length) { console.log(`[BusinessCompass] 流量成交拆分无数据 poi=${poiId}`); return null; }
    return { ...parseTradeSplit(data), fetchedAt: new Date().toISOString() };
  }

  /** 曝光拆分（show_cnt_1d × first_enter_source） */
  static async fetchExposureSplit(poiId: string, startDate: string, endDate: string): Promise<BusinessExposureSplit | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.BUSINESS_FLOW_EXPOSURE_URL || (base() + '/api/compass/flow/exposure_split');
    if (!url.startsWith('http')) { console.warn('[BusinessCompass] 未配置曝光拆分 URL，跳过'); return null; }

    const json = await postJson<{ code?: number; data?: ExposureRow[]; responseData?: { data?: ExposureRow[] } }>(url, {
      poi_id: poiId, start_date: startDate, end_date: endDate,
    });
    const data = json?.data ?? json?.responseData?.data;
    if (!Array.isArray(data) || !data.length) { console.log(`[BusinessCompass] 曝光拆分无数据 poi=${poiId}`); return null; }
    return { ...parseExposureSplit(data), fetchedAt: new Date().toISOString() };
  }

  /** 营销概览（coupon_pay_gmv / pay_ord_plat_amt / pay_ord_mer_amt + DeriveData 环比） */
  static async fetchMarketingOverview(poiId: string, startDate: string, endDate: string): Promise<{
    couponPayGmv: number; platAmt: number; merAmt: number;
    compare?: { value: number; diff: number; ratio: number };
    fetchedAt: string;
  } | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.BUSINESS_FLOW_MARKETING_OVERVIEW_URL || (base() + '/api/compass/marketing/overview');
    if (!url.startsWith('http')) { console.warn('[BusinessCompass] 未配置营销概览 URL，跳过'); return null; }

    const json = await postJson<{
      code?: number;
      data?: Array<{
        coupon_pay_gmv?: number;
        pay_ord_plat_amt?: number;
        pay_ord_mer_amt?: number;
        coupon_pay_gmvDeriveData?: { hb_value?: number; hb_diff?: number; hb_ratio?: number };
      }>;
      responseData?: { data?: unknown[] };
    }>(url, { poi_id: poiId, start_date: startDate, end_date: endDate });

    const rows = json?.data ?? (json?.responseData?.data as typeof json['data']);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) { console.log(`[BusinessCompass] 营销概览无数据 poi=${poiId}`); return null; }

    const dd = row.coupon_pay_gmvDeriveData;
    return {
      couponPayGmv: fen2yuan(row.coupon_pay_gmv),
      platAmt: fen2yuan(row.pay_ord_plat_amt),
      merAmt: fen2yuan(row.pay_ord_mer_amt),
      ...(dd ? { compare: {
        value: fen2yuan(dd.hb_value),
        diff: fen2yuan(dd.hb_diff),
        ratio: Number(dd.hb_ratio ?? 0),
      }} : {}),
      fetchedAt: new Date().toISOString(),
    };
  }

  /** 营销成交趋势（date × coupon_pay_gmv 时间序列） */
  static async fetchMarketingTrend(poiId: string, startDate: string, endDate: string): Promise<Array<{ date: string; gmv: number }> | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.BUSINESS_FLOW_MARKETING_TREND_URL || (base() + '/api/compass/marketing/trend');
    if (!url.startsWith('http')) { console.warn('[BusinessCompass] 未配置营销趋势 URL，跳过'); return null; }

    const json = await postJson<{
      code?: number;
      data?: Array<{ date?: string; coupon_pay_gmv?: number }>;
      responseData?: { data?: unknown[] };
    }>(url, { poi_id: poiId, start_date: startDate, end_date: endDate });

    const rows = json?.data ?? (json?.responseData?.data as typeof json['data']);
    if (!Array.isArray(rows) || !rows.length) { console.log(`[BusinessCompass] 营销趋势无数据 poi=${poiId}`); return null; }
    return rows
      .filter(r => r.date)
      .map(r => ({ date: r.date!, gmv: fen2yuan(r.coupon_pay_gmv) }))
      .sort((a, b) => a.date < b.date ? -1 : 1);
  }

  /** 生意经经营概览 — 按来源（官号/达人）拆分 GMV
   *  自播 = officialLiveGmv（官号直播），达播 = daboGmv（达人直播）
   *  金额单位：分 → 元（÷100）
   *  接口：dito/query + path=/flow/trade/overview，节点 PayOrderSourceAnalysis
   *  可通过 BUSINESS_FLOW_TRADE_OVERVIEW_URL 覆盖完整 URL
   */
  static async fetchPayOrderSourceSplit(poiId: string, startDate: string, endDate: string, overrideLifeAccountId?: string): Promise<{
    liveTotalGmv: number;
    daboGmv: number;
    officialLiveGmv: number;
    videoTotalGmv: number;
    videoTalentGmv: number;
    videoOfficialGmv: number;
    leadCardGmv: number;        // 获客卡
    searchResultCardGmv: number;// 搜索结果卡
    otherGmv: number;           // 其他
    poiGmv: number;             // POI = 获客卡 + 搜索结果卡 + 其他
  } | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.BUSINESS_FLOW_TRADE_OVERVIEW_URL || (base() + '/api/dito/query');
    if (!url.startsWith('http')) {
      console.warn(`[BusinessSourceSplit] 未配置 URL，跳过 poiId=${poiId}`);
      return null;
    }
    const { lifeAccountId, isSingle, mapped } = resolveLifeAccountId(poiId, overrideLifeAccountId);
    console.log(`[BusinessSourceSplit] poiId=${poiId} lifeAccountId=${lifeAccountId} isSingle=${isSingle} mapped=${mapped}`);
    // 未映射的品牌：直接返回 null，避免用快乐蜂 Cookie 默认账号拉到串品牌数据
    if (!mapped || !lifeAccountId) {
      console.warn(`[BusinessSourceSplit] poiId=${poiId} 无生意经映射，跳过成交数据请求（日报留空）`);
      return null;
    }

    const payload = {
      biz_params: {
        path: '/dito/pc/business/page',
        query: {},
        first_render: false,
        common_params: {
          is_single: isSingle,
          start_date: startDate,
          end_date: endDate,
          date_type: 'custom',
        },
        module_params: {
          BaseInfoModule: {},
          ProductOverviewBaseInfo: {},
          CoreIndicatorAndTrend: { business_tab: 'all' },
          BusinessOverviewTab: {},
          IndicatorLayout: {},
          PayOrderSourceAnalysis: {},
        },
      },
      dito_params: {
        is_event: true,
        node_update_map: [
          { type: 'refresh', node: 'PcBusinessPayOrderSourceAnalysis' },
        ],
      },
    };

    let rawText = '';
    try {
      const res = await fetch(url, { method: 'POST', headers: headers(lifeAccountId), body: JSON.stringify(payload) });
      rawText = await res.text();
      console.log(`[BusinessSourceSplit] HTTP ${res.status} len=${rawText.length} ${startDate}~${endDate}`);
      if (!res.ok) { console.error(`[BusinessSourceSplit] HTTP error body=${rawText.slice(0, 300)}`); return null; }
    } catch (e) {
      console.error(`[BusinessSourceSplit] 请求异常:`, String(e));
      return null;
    }

    let json: Record<string, unknown> | null = null;
    try { json = JSON.parse(rawText) as Record<string, unknown>; }
    catch { console.error(`[BusinessSourceSplit] 非 JSON: ${rawText.slice(0, 200)}`); return null; }

    // 路径：json.data.layout[i].data.data?.PayOrderSourceAnalysis?.Detail?.data
    //    或：json.data.layout[i].data?.PayOrderSourceAnalysis?.Detail?.data
    interface SourceRow {
      first_order_source_name?: string;
      second_order_source_name?: string;
      levelPid?: number | null;
      levelId?: number;
      name?: string;
      pay_gmv_1d?: number;
    }
    const dataObj = (json?.data ?? json) as Record<string, unknown>;
    const layout = (Array.isArray(dataObj?.layout) ? dataObj.layout : []) as Array<{ id?: string; data?: Record<string, unknown> }>;

    let rows: SourceRow[] = [];
    for (const node of layout) {
      const d = (node?.data ?? {}) as Record<string, unknown>;
      // 真实结构：node.data.PayOrderSourceAnalysisDetail.data[]
      const key = Object.keys(d).find(k => k.toLowerCase() === 'payordersourceanalysisdetail');
      if (key) {
        const detail = d[key] as { data?: SourceRow[] } | undefined;
        if (Array.isArray(detail?.data)) { rows = detail!.data!; break; }
      }
    }

    if (!rows.length) {
      console.log(`[BusinessSourceSplit] rows 为空，node ids = ${layout.map(n => n.id ?? '?').join(',')}; raw=${rawText.slice(0, 300)}`);
    }

    // 体裁类型（一级行，levelPid == null 且无二级来源）：直播 / 短视频 / 获客卡 / 搜索结果卡 / 其他
    const isTopLevel = (r: SourceRow) => r.levelPid == null && !r.second_order_source_name;
    const genre = (label: string) =>
      rows.find(r => isTopLevel(r) && (r.name === label || r.first_order_source_name === label));

    const liveTotal  = genre('直播');
    const dabo       = rows.find(r => r.first_order_source_name === '直播' && (r.second_order_source_name === '达人' || r.name === '达人' || r.levelId === 103));
    const official   = rows.find(r => r.first_order_source_name === '直播' && (r.second_order_source_name === '官号' || r.name === '官号' || r.levelId === 101));
    const videoTotal = genre('短视频');
    const videoTalent  = rows.find(r => r.first_order_source_name === '短视频' && (r.second_order_source_name === '达人' || r.name === '达人' || r.levelId === 203));
    const videoOfficial= rows.find(r => r.first_order_source_name === '短视频' && (r.second_order_source_name === '官号' || r.name === '官号' || r.levelId === 201));
    const leadCard   = genre('获客卡');
    const searchCard = genre('搜索结果卡');
    const other      = genre('其他');

    // 调试：打印全部一级行（体裁类型）名称 + GMV（元），便于核对平台数值
    const topRows = rows.filter(isTopLevel)
      .map(r => `${r.name ?? r.first_order_source_name ?? '?'}=${(Number(r.pay_gmv_1d || 0) / 100).toFixed(2)}`)
      .join(' | ');
    console.log(`[BusinessSourceSplit] 体裁一级行: ${topRows}`);

    const leadCardGmv         = Number(leadCard?.pay_gmv_1d   || 0) / 100;
    const searchResultCardGmv = Number(searchCard?.pay_gmv_1d || 0) / 100;
    const otherGmv            = Number(other?.pay_gmv_1d      || 0) / 100;

    const result = {
      liveTotalGmv:    Number(liveTotal?.pay_gmv_1d   || 0) / 100,
      daboGmv:         Number(dabo?.pay_gmv_1d         || 0) / 100,
      officialLiveGmv: Number(official?.pay_gmv_1d     || 0) / 100,
      videoTotalGmv:   Number(videoTotal?.pay_gmv_1d   || 0) / 100,
      videoTalentGmv:  Number(videoTalent?.pay_gmv_1d  || 0) / 100,
      videoOfficialGmv:Number(videoOfficial?.pay_gmv_1d|| 0) / 100,
      leadCardGmv,
      searchResultCardGmv,
      otherGmv,
      poiGmv: leadCardGmv + searchResultCardGmv + otherGmv,
    };
    console.log(`[BusinessSourceSplit] parsed live=${result.liveTotalGmv} video=${result.videoTotalGmv} 获客卡=${leadCardGmv} 搜索结果卡=${searchResultCardGmv} 其他=${otherGmv} POI=${result.poiGmv}`);
    return result;
  }

  /** 生意经直播分析（场次 / 时长 / 达人数量）
   *  GMV 来源已改为 fetchPayOrderSourceSplit，此处只取 measureDataV2 的 cnt/duration/authorCnt
   *  payload：dito/query + path=/flow/content/analysis/live
   */
  static async fetchLiveAnalysis(poiId: string, startDate: string, endDate: string): Promise<{
    daboCnt: number; daboDurationSec: number; authorCnt: number;
    rooms: Array<{ roomTypeTag: string; gmv: number; durationSec: number; verifyOrderAmt: number; verifyCertNum: number; payCertNum: number; payUser: number }>;
    dailyTrend: Array<{ date: string; gmv: number; durationSec: number; liveCnt: number; authorCnt: number; verifyAmount: number }>;
    fetchedAt: string;
  } | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.BUSINESS_FLOW_LIVE_URL || (base() + '/api/dito/query');
    if (!url.startsWith('http')) return null;
    const { lifeAccountId, mapped } = resolveLifeAccountId(poiId);
    if (!mapped || !lifeAccountId) {
      console.warn(`[BusinessLiveAnalysis] poiId=${poiId} 无生意经映射，跳过直播分析请求`);
      return null;
    }

    const payload = {
      biz_params: {
        path: '/flow/content/analysis/live',
        query: {},
        first_render: false,
        common_params: {
          is_sub_account: false,
          poi_id: poiId,
          start_date: startDate,
          end_date: endDate,
          date_type: 'custom',
          time_type: 'trade_date',
          is_gray_live_trade_date: true,
          room_type_filter: 'TALENT',
          author_id: [],
        },
        module_params: {
          RoomParam:    { limit: 10, offset: 0, search_keywords: '' },
          FlowSourceV2: { group: 'date' },
          ProductRank:  {},
          RoomRank:     { limit: 10, offset: 0, order_type: 'desc', order_field: '' },
          UserFeature:  {},
        },
      },
      dito_params: {
        is_event: true,
        node_update_map: [
          { type: 'refresh', node: 'LiveSelect_2' },
          { type: 'refresh', node: 'VideoCoreDataCard_1' },
          { type: 'refresh', node: 'LiveDealGoodsCard_1' },
          { type: 'refresh', node: 'LiveListTable_1' },
        ],
      },
    };

    let rawText = '';
    try {
      const res = await fetch(url, { method: 'POST', headers: headers(lifeAccountId), body: JSON.stringify(payload) });
      rawText = await res.text();
      if (!res.ok) return null;
    } catch { return null; }

    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(rawText) as Record<string, unknown>; } catch { return null; }

    const dataObj = (parsed?.data ?? parsed) as Record<string, unknown>;
    const layout = (Array.isArray(dataObj?.layout) ? dataObj.layout : []) as Array<{ id?: string; data?: Record<string, unknown> }>;

    interface MeasureRow { live_cnt?: number; room_cnt?: number; duration?: number; author_cnt?: number; verify_amount?: number; verify_cert_cnt?: number; gmv?: number; }
    const rooms: Array<{ roomTypeTag: string; gmv: number; durationSec: number; verifyOrderAmt: number; verifyCertNum: number; payCertNum: number; payUser: number }> = [];
    const dailyTrend: Array<{ date: string; gmv: number; durationSec: number; liveCnt: number; authorCnt: number; verifyAmount: number }> = [];
    let measure: MeasureRow | null = null;

    for (const section of layout) {
      const d = section?.data ?? {};

      // measureDataV2（VideoCoreDataCard_1）— 区间汇总 cnt/duration/authorCnt
      const mdv2Key = Object.keys(d).find(k => k.toLowerCase() === 'measuredatav2');
      if (!measure && mdv2Key) {
        const mdv2 = d[mdv2Key] as { data?: MeasureRow[] } | undefined;
        if (mdv2?.data?.[0]) measure = mdv2.data[0];
      }

      // FlowSourceV2 每日趋势
      const flowKey = Object.keys(d).find(k => k.toLowerCase() === 'flowsourcev2');
      if (flowKey) {
        const flow = d[flowKey] as { data?: Array<{ date?: string; gmv?: number; duration?: number; live_cnt?: number; author_cnt?: number; verify_amount?: number }> } | undefined;
        for (const r of flow?.data ?? []) {
          if (r.date) dailyTrend.push({
            date: r.date,
            gmv: fen2yuan(r.gmv),
            durationSec: Number(r.duration ?? 0),
            liveCnt: Number(r.live_cnt ?? 0),
            authorCnt: Number(r.author_cnt ?? 0),
            verifyAmount: fen2yuan(r.verify_amount),
          });
        }
      }

      // roomRank — 直播间明细
      const rrKey = Object.keys(d).find(k => k.toLowerCase() === 'roomrank');
      if (rrKey) {
        const rr = d[rrKey] as { data?: Array<{ room_type_tag?: string; gmv?: number; duration?: number; room_verify_order_amt_td?: number; room_verify_cert_num_td?: number; room_pay_cert_num_td?: number; room_pay_user_td?: number }> } | undefined;
        for (const r of rr?.data ?? []) {
          rooms.push({
            roomTypeTag: r.room_type_tag ?? '',
            gmv: fen2yuan(r.gmv),
            durationSec: Number(r.duration ?? 0),
            verifyOrderAmt: fen2yuan(r.room_verify_order_amt_td),
            verifyCertNum: Number(r.room_verify_cert_num_td ?? 0),
            payCertNum: Number(r.room_pay_cert_num_td ?? 0),
            payUser: Number(r.room_pay_user_td ?? 0),
          });
        }
      }
    }

    const daboCnt       = Number(measure?.live_cnt ?? measure?.room_cnt ?? 0);
    const daboDurationSec = Number(measure?.duration ?? 0);
    const authorCnt     = Number(measure?.author_cnt ?? 0);
    console.log(`[BusinessLive] parsed ${startDate}~${endDate}: cnt=${daboCnt} dur=${daboDurationSec}s authorCnt=${authorCnt}`);

    return {
      daboCnt,
      daboDurationSec,
      authorCnt,
      rooms,
      dailyTrend: dailyTrend.sort((a, b) => a.date < b.date ? -1 : 1),
      fetchedAt: new Date().toISOString(),
    };
  }

  /** 生意经核销来源拆分（VerifyOrderSourceAnalysis）
   *  与 fetchPayOrderSourceSplit 同接口，节点改为 PcBusinessVerifyOrderSourceAnalysis
   *  字段预期：verify_gmv_1d（待日志确认），分→元 ÷100
   */
  static async fetchVerifyOrderSourceSplit(poiId: string, startDate: string, endDate: string, overrideLifeAccountId?: string): Promise<{
    liveTotalGmv: number;
    daboGmv: number;
    officialLiveGmv: number;
    videoTotalGmv: number;
    leadCardGmv: number;
    searchResultCardGmv: number;
    otherGmv: number;
    poiGmv: number;
  } | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.BUSINESS_FLOW_TRADE_OVERVIEW_URL || (base() + '/api/dito/query');
    if (!url.startsWith('http')) return null;
    const { lifeAccountId, isSingle, mapped } = resolveLifeAccountId(poiId, overrideLifeAccountId);
    console.log(`[BusinessVerifySplit] poiId=${poiId} lifeAccountId=${lifeAccountId} isSingle=${isSingle} mapped=${mapped}`);
    // 未映射的品牌：跳过核销数据请求，避免串品牌
    if (!mapped || !lifeAccountId) {
      console.warn(`[BusinessVerifySplit] poiId=${poiId} 无生意经映射，跳过核销数据请求（日报留空）`);
      return null;
    }

    const payload = {
      biz_params: {
        path: '/dito/pc/business/page',
        query: {},
        first_render: false,
        common_params: {
          is_single: isSingle,
          start_date: startDate,
          end_date: endDate,
          date_type: 'custom',
        },
        module_params: {
          BaseInfoModule: {},
          ProductOverviewBaseInfo: {},
          CoreIndicatorAndTrend: { business_tab: 'all' },
          BusinessOverviewTab: {},
          IndicatorLayout: {},
          VerifyOrderSourceAnalysis: {},
        },
      },
      dito_params: {
        is_event: true,
        node_update_map: [
          { type: 'refresh', node: 'PcBusinessVerifyOrderSourceAnalysis' },
        ],
      },
    };

    let rawText = '';
    try {
      const res = await fetch(url, { method: 'POST', headers: headers(lifeAccountId), body: JSON.stringify(payload) });
      rawText = await res.text();
      console.log(`[BusinessVerifySplit] HTTP ${res.status} len=${rawText.length} ${startDate}~${endDate}`);
      if (!res.ok) { console.error(`[BusinessVerifySplit] HTTP error body=${rawText.slice(0, 300)}`); return null; }
    } catch (e) {
      console.error(`[BusinessVerifySplit] 请求异常:`, String(e));
      return null;
    }

    let json: Record<string, unknown> | null = null;
    try { json = JSON.parse(rawText) as Record<string, unknown>; }
    catch { console.error(`[BusinessVerifySplit] 非 JSON: ${rawText.slice(0, 200)}`); return null; }

    interface VerifyRow {
      first_order_source_name?: string;
      second_order_source_name?: string;
      levelPid?: number | null;
      levelId?: number;
      name?: string;
      verify_gmv_1d?: number;
      [k: string]: unknown;
    }
    const dataObj = (json?.data ?? json) as Record<string, unknown>;
    const layout = (Array.isArray(dataObj?.layout) ? dataObj.layout : []) as Array<{ id?: string; data?: Record<string, unknown> }>;

    let rows: VerifyRow[] = [];
    for (const node of layout) {
      const d = (node?.data ?? {}) as Record<string, unknown>;
      // 真实结构：node.data.VerifyDetail.data[]（明细），VerifyOverview 为汇总
      const key = Object.keys(d).find(k => /^(verifydetail|verifyordersourceanalysisdetail)$/.test(k.toLowerCase()));
      if (key) {
        const detail = d[key] as { data?: VerifyRow[] } | VerifyRow[] | undefined;
        const arr = Array.isArray(detail) ? detail : detail?.data;
        if (Array.isArray(arr) && arr.length) { rows = arr; break; }
      }
    }

    if (!rows.length) {
      // 打印所有 node.data 键名 + VerifyDetail 结构样本帮助定位
      const allKeys = layout.flatMap(n => Object.keys(n?.data ?? {}));
      const vd = layout.map(n => (n?.data as Record<string, unknown>)?.VerifyDetail).find(Boolean);
      console.log(`[BusinessVerifySplit] rows 为空，data keys=${allKeys.join(',')}; VerifyDetail=${JSON.stringify(vd).slice(0, 400)}`);
      return null;
    }

    // 尝试 verify_gmv_1d；如为 undefined 则找第一个数值字段（调试用）
    const sample = rows[0];
    const gmvField = 'verify_gmv_1d' in sample ? 'verify_gmv_1d'
      : Object.keys(sample).find(k => k.includes('gmv') || k.includes('amount') || k.includes('pay'));
    const gmv = (r: VerifyRow) => Number((gmvField ? r[gmvField] : 0) ?? 0) / 100;

    const isTopLevel = (r: VerifyRow) => r.levelPid == null && !r.second_order_source_name;
    const genre = (label: string) =>
      rows.find(r => isTopLevel(r) && (r.name === label || r.first_order_source_name === label));

    const dabo     = rows.find(r => r.first_order_source_name === '直播' && (r.second_order_source_name === '达人' || r.name === '达人' || r.levelId === 103));
    const official = rows.find(r => r.first_order_source_name === '直播' && (r.second_order_source_name === '官号' || r.name === '官号' || r.levelId === 101));

    // 调试：打印体裁一级行 + gmvField 确认字段名
    const topRows = rows.filter(isTopLevel)
      .map(r => `${r.name ?? r.first_order_source_name ?? '?'}=${gmv(r).toFixed(2)}`)
      .join(' | ');
    console.log(`[BusinessVerifySplit] gmvField=${gmvField} 体裁一级行: ${topRows}`);

    const leadCardGmv         = gmv(genre('获客卡')      ?? {});
    const searchResultCardGmv = gmv(genre('搜索结果卡')  ?? {});
    const otherGmv            = gmv(genre('其他')         ?? {});
    const result = {
      liveTotalGmv:    gmv(genre('直播')   ?? {}),
      daboGmv:         gmv(dabo           ?? {}),
      officialLiveGmv: gmv(official       ?? {}),
      videoTotalGmv:   gmv(genre('短视频') ?? {}),
      leadCardGmv, searchResultCardGmv, otherGmv,
      poiGmv: leadCardGmv + searchResultCardGmv + otherGmv,
    };
    console.log(`[BusinessVerifySplit] live=${result.liveTotalGmv} video=${result.videoTotalGmv} POI=${result.poiGmv}`);
    return result;
  }

  /** 生意经经营洞察（data_conclusion / data_explain） */
  static async fetchInsights(poiId: string, startDate: string, endDate: string): Promise<BusinessInsightResult | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.BUSINESS_FLOW_INSIGHTS_URL || (base() + '/api/compass/flow/insights');
    if (!url.startsWith('http')) { console.warn('[BusinessCompass] 未配置洞察 URL，跳过'); return null; }

    const json = await postJson<{
      code?: number;
      data?: {
        data_conclusion?: string | { text?: string; content?: string };
        extra_info?: { compare_start_date?: string; compare_end_date?: string };
      };
    }>(url, { poi_id: poiId, start_date: startDate, end_date: endDate });

    const dc = json?.data?.data_conclusion;
    const conclusion = typeof dc === 'string' ? dc : (dc?.text || dc?.content || '');
    if (!conclusion) { console.log(`[BusinessCompass] data_conclusion 无文本 poi=${poiId}`); return null; }
    const ex = json?.data?.extra_info;
    return {
      conclusion,
      startDate: ex?.compare_start_date ?? startDate,
      endDate: ex?.compare_end_date ?? endDate,
    };
  }
}
