// 抖音来客（Laike）经营数据接口
// 全部接口为私有抓包接口，鉴权通过环境变量（不提交 Git）：
//   LAIKE_COOKIE       — 来客后台 Cookie
//   LAIKE_API_BASE     — 来客后台域名，例如 https://business.douyin.com
//   LAIKE_SALE_RECORDS_URL  — coupon_sale_record 列表接口完整 URL（可选覆盖）
//   LAIKE_OVERVIEW_URL      — data_overview 接口完整 URL（可选覆盖）
//   LAIKE_INSIGHTS_URL      — data_conclusion/explain 接口完整 URL（可选覆盖）
//
// 所有方法均 try/catch：如果未配置、请求失败或解析失败，返回 null，
// 不抛异常，日报继续生成（降级为手动填写模式）。

import type { LaikeSaleSummary, LaikeOverviewData } from '../../types/index';

export interface LaikeInsightResult {
  conclusion: string;
  startDate: string;
  endDate: string;
}

function cookie(): string { return process.env.LAIKE_COOKIE ?? ''; }
function base(): string { return (process.env.LAIKE_API_BASE ?? '').replace(/\/$/, ''); }

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Cookie': cookie(),
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0',
    'Referer': base() + '/',
    'Origin': base(),
  };
}

// 安全 JSON 解析（来客 ID 不超长，直接 JSON.parse 即可）
function tryParse<T>(text: string): T | null {
  try { return JSON.parse(text) as T; } catch { return null; }
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const json = tryParse<T>(text);
    if (!json) {
      console.error(`[LaikeAdapter] 响应非 JSON (HTTP ${res.status}) ${url}: ${text.slice(0, 200)}`);
      return null;
    }
    return json;
  } catch (e) {
    console.error(`[LaikeAdapter] 请求失败 ${url}:`, String(e));
    return null;
  }
}

// ── coupon_sale_record ────────────────────────────────────────────────────────

interface SaleRow {
  order_info?: {
    create_time?: string;
    pay_time?: string;
    pay_amount?: number;
    item_num?: number;
    order_status?: string;
    order_status_enum?: string;
    after_sale_tag?: string;
  };
  pay_amount_info?: { pay_amount?: number };
  order_source?: {
    sale_channel?: string;
    sale_user_role?: string;
    sale_user_nickname?: string;
  };
  product_info?: { product_name?: string; product_actual_amount?: number };
}

export function parseSaleRecords(rows: SaleRow[]): LaikeSaleSummary {
  const byChannel: Record<string, number> = {};
  const byProductMap: Record<string, { gmv: number; orders: number }> = {};
  let totalGmv = 0, liveGmv = 0, searchGmv = 0, otherGmv = 0, refundGmv = 0;
  let validOrderCount = 0, refundOrderCount = 0;

  for (const row of rows) {
    const oi = row.order_info ?? {};
    const isRefund =
      /取消|退款|退单/.test(oi.order_status ?? '') ||
      /退款/.test(oi.after_sale_tag ?? '') ||
      oi.order_status_enum === 'CANCELLED';

    // 金额：优先 pay_amount_info（分 → 元除以100）
    const rawAmt = row.pay_amount_info?.pay_amount ?? oi.pay_amount ?? 0;
    const amt = rawAmt / 100;

    if (isRefund) {
      refundGmv += amt;
      refundOrderCount++;
      continue;
    }

    totalGmv += amt;
    validOrderCount++;

    const channel = row.order_source?.sale_channel ?? '其他';
    byChannel[channel] = (byChannel[channel] ?? 0) + amt;

    if (/直播/.test(channel)) liveGmv += amt;
    else if (/搜索/.test(channel)) searchGmv += amt;
    else otherGmv += amt;

    const pname = row.product_info?.product_name ?? '未知商品';
    if (!byProductMap[pname]) byProductMap[pname] = { gmv: 0, orders: 0 };
    byProductMap[pname].gmv += amt;
    byProductMap[pname].orders++;
  }

  const byProduct = Object.entries(byProductMap)
    .map(([name, v]) => ({ name, gmv: Math.round(v.gmv), orders: v.orders }))
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 10);

  return {
    totalGmv: Math.round(totalGmv),
    totalOrders: validOrderCount,
    liveGmv: Math.round(liveGmv),
    searchGmv: Math.round(searchGmv),
    otherGmv: Math.round(otherGmv),
    refundGmv: Math.round(refundGmv),
    validOrderCount,
    refundOrderCount,
    byChannel: Object.fromEntries(Object.entries(byChannel).map(([k, v]) => [k, Math.round(v)])),
    byProduct,
  };
}

// 用 pay_time 过滤指定日期范围内的订单（北京时间 YYYY-MM-DD）
function filterByPayDate(rows: SaleRow[], startDate: string, endDate: string): SaleRow[] {
  return rows.filter(row => {
    const pt = row.order_info?.pay_time;
    if (!pt) return false;
    const d = pt.slice(0, 10);
    return d >= startDate && d <= endDate;
  });
}

// ── verify_record_list（核销明细）──────────────────────────────────────────
// 真实接口：POST https://life.douyin.com/life/trade_view/v1/workbench/verify/query/verify_record_list
//   data.data = string[]（每个元素是 JSON string，需要二次 parse）
//   data.pagination.total_count = 总条数
//   金额字段（分）：verify_info_v2.verify_info.verify_amount_info.pay_amount（用户实付）
//                   verify_info_v2.verify_info.verify_amount_info.merchant_amount（商家实收）
//   核销时间：verify_info.verify_time（Unix 秒）
//   撤销标记：verify_info.is_cancel_verify === true

interface VerifyRowParsed {
  amount_info?: { merchant_amount?: number };
  verify_info?: {
    is_cancel_verify?: boolean;
    verify_time?: number;
    verify_time_str?: string;
  };
  verify_info_v2?: {
    verify_info?: {
      is_cancel_verify?: boolean;
      verify_time?: number;
      item_num?: number;
      verify_amount_info?: {
        merchant_amount?: number;
        pay_amount?: number;
        payment_total_amount?: number;
        bill_commissions_amount?: number;
      };
    };
  };
  order_info?: { pay_amount?: number };
  product_info?: { product_name?: string };
  status_info_v2?: { color_type?: string };
}

export interface LaikeVerifySummary {
  verifyAmount: number;      // 用户实付核销金额（元）= pay_amount ÷ 100
  merchantAmount: number;    // 商家实收（元）= merchant_amount ÷ 100（扣除平台佣金后）
  verifyOrderCnt: number;    // 核销订单数（去除撤销）
  verifyCertCnt: number;     // 核销券张数（item_num 之和）
  byProduct: Array<{ name: string; amount: number; cnt: number }>;
  startDate: string;
  endDate: string;
  fetchedAt: string;
}

export function parseVerifyRecords(rows: VerifyRowParsed[]): Omit<LaikeVerifySummary, 'startDate' | 'endDate' | 'fetchedAt'> {
  const byProductMap: Record<string, { amount: number; cnt: number }> = {};
  let verifyAmount = 0, merchantAmount = 0, verifyOrderCnt = 0, verifyCertCnt = 0;

  for (const row of rows) {
    // 撤销的核销记录不计入统计
    if (row.verify_info?.is_cancel_verify || row.verify_info_v2?.verify_info?.is_cancel_verify) continue;

    const vai = row.verify_info_v2?.verify_info?.verify_amount_info;
    const payAmt     = Number(vai?.pay_amount     ?? row.order_info?.pay_amount ?? 0);
    const merAmt     = Number(vai?.merchant_amount ?? row.amount_info?.merchant_amount ?? 0);
    const itemNum    = Number(row.verify_info_v2?.verify_info?.item_num ?? 1);
    const pname      = row.product_info?.product_name ?? '未知商品';

    verifyAmount   += payAmt / 100;
    merchantAmount += merAmt / 100;
    verifyOrderCnt += 1;
    verifyCertCnt  += itemNum;

    if (!byProductMap[pname]) byProductMap[pname] = { amount: 0, cnt: 0 };
    byProductMap[pname].amount += payAmt / 100;
    byProductMap[pname].cnt   += itemNum;
  }

  const byProduct = Object.entries(byProductMap)
    .map(([name, v]) => ({ name, amount: Math.round(v.amount), cnt: v.cnt }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return {
    verifyAmount:   Math.round(verifyAmount),
    merchantAmount: Math.round(merchantAmount),
    verifyOrderCnt,
    verifyCertCnt,
    byProduct,
  };
}

// YYYY-MM-DD → Unix 时间戳字符串（北京 UTC+8，当天 00:00:00 或 23:59:59）
function dateToTs(date: string, endOfDay = false): string {
  const suffix = endOfDay ? 'T23:59:59+08:00' : 'T00:00:00+08:00';
  return String(Math.floor(new Date(date + suffix).getTime() / 1000));
}

// Unix 秒 → 北京时间日期字符串 YYYY-MM-DD
function tsToDateStr(ts: number): string {
  return new Date(ts * 1000 + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export class LaikeAdapter {
  /**
   * 拉取来客成交明细（coupon_sale_record）并聚合。
   * URL：LAIKE_SALE_RECORDS_URL 或 LAIKE_API_BASE + /api/node/flow/batch
   * 鉴权：LAIKE_COOKIE
   * 失败返回 null（日报降级为手动填写）。
   */
  static async fetchCouponSaleRecords(
    poiId: string,
    startDate: string,
    endDate: string,
  ): Promise<(LaikeSaleSummary & { startDate: string; endDate: string; fetchedAt: string }) | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.LAIKE_SALE_RECORDS_URL || (base() + '/api/node/flow/batch');
    if (!url.startsWith('http')) {
      console.warn('[LaikeAdapter] 未配置 LAIKE_API_BASE 或 LAIKE_SALE_RECORDS_URL，跳过来客成交明细');
      return null;
    }

    const body = {
      view_type: 'coupon_sale_record',
      view_key: 'management_coupon_sale_record_list',
      main_data_key: 'common_sale_record',
      poi_id: poiId,
      start_date: startDate,
      end_date: endDate,
      page: 1,
      page_size: 200,
    };

    const json = await postJson<{
      code?: number; errno?: number;
      data?: { list?: SaleRow[]; common_sale_record?: SaleRow[]; records?: SaleRow[] };
    }>(url, body);

    if (!json) return null;
    const rows: SaleRow[] = json.data?.list ?? json.data?.common_sale_record ?? json.data?.records ?? [];
    if (!rows.length) {
      console.log(`[LaikeAdapter] coupon_sale_record 无数据 poi=${poiId} ${startDate}~${endDate}`);
    }

    // 过滤到指定日期范围（接口可能返回更宽范围）
    const filtered = filterByPayDate(rows, startDate, endDate);
    const summary = parseSaleRecords(filtered.length ? filtered : rows);
    return { ...summary, startDate, endDate, fetchedAt: new Date().toISOString() };
  }

  /**
   * 拉取来客核销明细（verify_record_list）并聚合。
   *
   * 真实接口：
   *   POST https://life.douyin.com/life/trade_view/v1/workbench/verify/query/verify_record_list
   *     ?page_index=N&page_size=100&root_life_account_id=<poiId>&life_biz_view_id=22&life_account_biz_ids=
   *   body: { condition:{ query_type:101, query_conditions:[{query_type:12,column_name:"verify_time",params:[startTs,endTs]}] }, is_app:false }
   *   时间：Unix 时间戳字符串（秒，北京时间）
   *
   * 配置：
   *   LAIKE_VERIFY_URL        — 完整域名（如 https://life.douyin.com），不含路径
   *   LAIKE_COOKIE            — 来客登录态 Cookie
   *   laikePoi（账户字段）     — 作为 root_life_account_id
   *
   * ⚠️ response 行字段名（verify_money/amount 等）为多候选猜测；
   *    跑 POST /api/debug/laike/replay 拿到 first_row_keys 后可收敛。
   * 失败返回 null（日报降级为手动填写）。
   */
  static async fetchVerifyRecords(
    poiId: string,
    startDate: string,
    endDate: string,
  ): Promise<LaikeVerifySummary | null> {
    if (!cookie() || !poiId) return null;

    // 域名：LAIKE_VERIFY_URL（如 https://life.douyin.com）或从 LAIKE_API_BASE 取 origin
    const verifyBase = (process.env.LAIKE_VERIFY_URL ?? base()).replace(/\/$/, '');
    const urlBase = verifyBase || 'https://life.douyin.com';
    if (!urlBase.startsWith('http')) {
      console.warn('[LaikeAdapter] 未配置 LAIKE_VERIFY_URL 或 LAIKE_API_BASE，跳过来客核销明细');
      return null;
    }

    const PATH = '/life/trade_view/v1/workbench/verify/query/verify_record_list';
    const PAGE_SIZE = 100;
    const startTs = dateToTs(startDate, false);
    const endTs   = dateToTs(endDate, true);

    const queryConditions = [{
      query_type: 12,
      column_name: 'verify_time',
      params: [startTs, endTs],
    }];
    const bodyBase = {
      condition: { query_type: 101, query_conditions: queryConditions },
      is_app: false,
      permission_common_param: {},
    };

    const allRows: VerifyRowParsed[] = [];
    for (let page = 1; page <= 20; page++) {
      const qs = new URLSearchParams({
        page_index: String(page),
        page_size: String(PAGE_SIZE),
        root_life_account_id: poiId,
        life_biz_view_id: '22',
        life_account_biz_ids: '',
      });
      const url = `${urlBase}${PATH}?${qs}`;
      const json = await postJson<{
        BaseResp?: { StatusCode?: number };
        status_code?: number;
        data?: {
          // data.data 是 JSON string 数组，每个元素需要二次 JSON.parse
          data?: (string | VerifyRowParsed)[];
          pagination?: { total_count?: number };
        };
      }>(url, bodyBase);

      if (!json) break;
      const rawItems = json.data?.data ?? [];
      const parsed: VerifyRowParsed[] = rawItems.map(item => {
        if (typeof item === 'string') { try { return JSON.parse(item) as VerifyRowParsed; } catch { return null; } }
        return item as VerifyRowParsed;
      }).filter((x): x is VerifyRowParsed => x != null);

      if (!parsed.length) { if (page === 1) console.log(`[LaikeAdapter] verify_record_list 无数据 poi=${poiId} ${startDate}~${endDate}`); break; }

      // 接口已用时间戳参数过滤，这里按核销时间做精确日期兜底
      const inRange = parsed.filter(row => {
        const ts = row.verify_info?.verify_time ?? row.verify_info_v2?.verify_info?.verify_time;
        if (!ts) return true;
        const d = tsToDateStr(ts);
        return d >= startDate && d <= endDate;
      });
      allRows.push(...inRange);

      const totalCount = json.data?.pagination?.total_count ?? 0;
      if (allRows.length >= totalCount || parsed.length < PAGE_SIZE) break;
    }

    if (!allRows.length) return null;
    const summary = parseVerifyRecords(allRows);
    return { ...summary, startDate, endDate, fetchedAt: new Date().toISOString() };
  }

  /**
   * 拉取来客经营概览（data_overview.measures）。
   * 注意：该接口通常返回当前周期数据，不一定对应昨日，UI 会标注说明。
   * URL：LAIKE_OVERVIEW_URL 或 LAIKE_API_BASE + /api/node/flow/batch
   */
  static async fetchDataOverview(
    poiId: string,
  ): Promise<(LaikeOverviewData & { fetchedAt: string; periodNote: string }) | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.LAIKE_OVERVIEW_URL || (base() + '/api/node/flow/batch');
    if (!url.startsWith('http')) {
      console.warn('[LaikeAdapter] 未配置 LAIKE_API_BASE 或 LAIKE_OVERVIEW_URL，跳过来客经营概览');
      return null;
    }

    const body = {
      nodes: ['data_overview'],
      poi_id: poiId,
    };

    const json = await postJson<{
      code?: number;
      data?: {
        nodes?: {
          data_overview?: {
            data?: { data?: { measures?: Record<string, unknown> } };
          };
        };
      };
    }>(url, body);

    const measures = json?.data?.nodes?.data_overview?.data?.data?.measures;
    if (!measures || typeof measures !== 'object') {
      console.log(`[LaikeAdapter] data_overview 无 measures 字段 poi=${poiId}`);
      return null;
    }

    const pick = (key: string) => Number((measures as Record<string, unknown>)[key] ?? 0);

    return {
      payAmount:     Math.round(pick('pay_amount') / 100),
      payCertCnt:    Math.round(pick('pay_cert_cnt')),
      verifyAmount:  Math.round(pick('verify_amount') / 100),
      verifyCertCnt: Math.round(pick('verify_cert_cnt')),
      refundAmount:  Math.round(pick('refund_amount') / 100),
      productViewUv: Math.round(pick('project_detail_product_show_uv')),
      fetchedAt: new Date().toISOString(),
      periodNote: '抖音来客当前展示周期（非指定昨日）',
    };
  }

  /**
   * 拉取来客经营洞察（data_conclusion / data_explain）。
   * URL：LAIKE_INSIGHTS_URL 或 LAIKE_API_BASE + /api/node/flow/batch
   */
  static async fetchInsights(
    poiId: string,
    startDate: string,
    endDate: string,
  ): Promise<LaikeInsightResult | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.LAIKE_INSIGHTS_URL || (base() + '/api/node/flow/batch');
    if (!url.startsWith('http')) {
      console.warn('[LaikeAdapter] 未配置 LAIKE_API_BASE 或 LAIKE_INSIGHTS_URL，跳过来客洞察');
      return null;
    }

    const body = {
      nodes: ['data_conclusion', 'data_explain'],
      poi_id: poiId,
      start_date: startDate,
      end_date: endDate,
    };

    const json = await postJson<{
      code?: number;
      data?: {
        nodes?: {
          data_conclusion?: { data?: { text?: string; content?: string } };
          data_explain?: {
            data?: {
              extra_info?: { compare_start_date?: string; compare_end_date?: string };
              text?: string; content?: string;
            };
          };
        };
        data_conclusion?: string;
        extra_info?: { compare_start_date?: string; compare_end_date?: string };
      };
    }>(url, body);

    if (!json) return null;

    const nodes = json.data?.nodes;
    const conclusion =
      nodes?.data_conclusion?.data?.text ||
      nodes?.data_conclusion?.data?.content ||
      json.data?.data_conclusion ||
      '';
    const extraInfo =
      nodes?.data_explain?.data?.extra_info ||
      json.data?.extra_info;

    if (!conclusion) {
      console.log(`[LaikeAdapter] data_conclusion 无文本内容 poi=${poiId}`);
      return null;
    }

    return {
      conclusion,
      startDate: extraInfo?.compare_start_date ?? startDate,
      endDate:   extraInfo?.compare_end_date   ?? endDate,
    };
  }

  /**
   * 拉取来客商品列表（product_id / title / origin_amount / image）。
   * 返回 productMap，供商品 ID/SKU 映射、TOP 商品图片展示。
   * URL：LAIKE_PRODUCT_LIST_URL 或 LAIKE_API_BASE + /api/node/flow/batch
   */
  static async fetchProductList(
    poiId: string,
  ): Promise<Record<string, { title: string; originAmount: number; image: string }> | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.LAIKE_PRODUCT_LIST_URL || (base() + '/api/node/flow/batch');
    if (!url.startsWith('http')) {
      console.warn('[LaikeAdapter] 未配置 LAIKE_API_BASE 或 LAIKE_PRODUCT_LIST_URL，跳过来客商品列表');
      return null;
    }

    const body = { view_type: 'product_list', poi_id: poiId, page: 1, page_size: 200 };
    const json = await postJson<{
      code?: number;
      data?: { list?: Array<{ product_id?: string | number; title?: string; origin_amount?: number; image?: string }>;
               products?: Array<{ product_id?: string | number; title?: string; origin_amount?: number; image?: string }> };
    }>(url, body);

    const rows = json?.data?.list ?? json?.data?.products ?? [];
    if (!rows.length) { console.log(`[LaikeAdapter] product_list 无数据 poi=${poiId}`); return null; }

    const map: Record<string, { title: string; originAmount: number; image: string }> = {};
    for (const p of rows) {
      if (p.product_id == null) continue;
      map[String(p.product_id)] = {
        title: p.title ?? '',
        originAmount: Math.round(Number(p.origin_amount ?? 0)) / 100,
        image: p.image ?? '',
      };
    }
    return map;
  }
}
