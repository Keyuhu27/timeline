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

function headers(): Record<string, string> {
  const lifeAccountId = process.env.BUSINESS_COMPASS_LIFE_ACCOUNT_ID ?? '';
  // 额外 headers，从 env JSON 解析（如 x-secsdk-csrf-token / x-tt-ls-session-id 等）
  let extraHeaders: Record<string, string> = {};
  try {
    const raw = process.env.BUSINESS_COMPASS_EXTRA_HEADERS_JSON;
    if (raw) extraHeaders = JSON.parse(raw) as Record<string, string>;
  } catch { /* 忽略解析错误 */ }

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
    ...(lifeAccountId ? { 'life-account-id': lifeAccountId, 'root-life-account-id': lifeAccountId } : {}),
    ...extraHeaders,
  };
}

function tryParse<T>(text: string): T | null {
  try { return JSON.parse(text) as T; } catch { return null; }
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
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
  static async fetchPayOrderSourceSplit(poiId: string, startDate: string, endDate: string): Promise<{
    liveTotalGmv: number;
    daboGmv: number;
    officialLiveGmv: number;
    videoTotalGmv: number;
    videoTalentGmv: number;
    videoOfficialGmv: number;
  } | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.BUSINESS_FLOW_TRADE_OVERVIEW_URL || (base() + '/api/dito/query');
    if (!url.startsWith('http')) {
      console.warn(`[BusinessSourceSplit] 未配置 URL，跳过 poiId=${poiId}`);
      return null;
    }

    const payload = {
      biz_params: {
        path: '/dito/pc/business/page',
        query: {},
        first_render: false,
        common_params: {
          is_single: 0,
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
      const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
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

    const liveTotal  = rows.find(r => r.name === '直播'  && (r.levelPid == null));
    const dabo       = rows.find(r => r.first_order_source_name === '直播' && (r.second_order_source_name === '达人' || r.name === '达人' || r.levelId === 103));
    const official   = rows.find(r => r.first_order_source_name === '直播' && (r.second_order_source_name === '官号' || r.name === '官号' || r.levelId === 101));
    const videoTotal = rows.find(r => r.name === '短视频' && (r.levelPid == null));
    const videoTalent  = rows.find(r => r.first_order_source_name === '短视频' && (r.second_order_source_name === '达人' || r.name === '达人' || r.levelId === 203));
    const videoOfficial= rows.find(r => r.first_order_source_name === '短视频' && (r.second_order_source_name === '官号' || r.name === '官号' || r.levelId === 201));

    console.log(`[BusinessSourceSplit] liveTotal=${liveTotal?.pay_gmv_1d} dabo=${dabo?.pay_gmv_1d} official=${official?.pay_gmv_1d}`);

    const result = {
      liveTotalGmv:    Number(liveTotal?.pay_gmv_1d   || 0) / 100,
      daboGmv:         Number(dabo?.pay_gmv_1d         || 0) / 100,
      officialLiveGmv: Number(official?.pay_gmv_1d     || 0) / 100,
      videoTotalGmv:   Number(videoTotal?.pay_gmv_1d   || 0) / 100,
      videoTalentGmv:  Number(videoTalent?.pay_gmv_1d  || 0) / 100,
      videoOfficialGmv:Number(videoOfficial?.pay_gmv_1d|| 0) / 100,
    };
    console.log(`[BusinessSourceSplit] parsed officialLiveGmv=${result.officialLiveGmv} daboGmv=${result.daboGmv} liveTotalGmv=${result.liveTotalGmv} videoTotalGmv=${result.videoTotalGmv}`);
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
      const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
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
