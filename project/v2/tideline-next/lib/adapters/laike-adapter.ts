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

// ── coupon_verify_record（核销明细）──────────────────────────────────────────
// ⚠️ 字段名为抓包前的容错占位，覆盖常见命名；抓到真实接口后按 first_row_keys 收敛。

interface VerifyRow {
  // 核销金额（分）——多候选
  verify_amount?: number;
  verify_amount_info?: { verify_amount?: number; amount?: number };
  pay_amount_info?: { pay_amount?: number };
  amount?: number;
  // 核销时间——多候选
  verify_time?: string;
  write_off_time?: string;
  verify_info?: { verify_time?: string };
  // 核销订单数 / 张数——多候选
  verify_cnt?: number;
  cert_cnt?: number;
  item_num?: number;
  // 退款/撤销标记
  verify_status?: string;
  status?: string;
  // 渠道（自播/达播/搜索）
  order_source?: { sale_channel?: string };
  channel?: string;
  // 商品
  product_info?: { product_name?: string };
}

export interface LaikeVerifySummary {
  verifyAmount: number;     // 核销金额（元）
  verifyOrderCnt: number;   // 核销订单数
  verifyCertCnt: number;    // 核销券张数
  byChannel: Record<string, number>;
  startDate: string;
  endDate: string;
  fetchedAt: string;
}

// 在多候选字段里取第一个有值的数字
function pickNum(...vals: Array<number | undefined | null>): number {
  for (const v of vals) if (v != null && !Number.isNaN(Number(v))) return Number(v);
  return 0;
}

export function parseVerifyRecords(rows: VerifyRow[]): Omit<LaikeVerifySummary, 'startDate' | 'endDate' | 'fetchedAt'> {
  const byChannel: Record<string, number> = {};
  let verifyAmount = 0, verifyOrderCnt = 0, verifyCertCnt = 0;

  for (const row of rows) {
    const status = row.verify_status ?? row.status ?? '';
    if (/撤销|取消|退款|作废/.test(status)) continue;

    // 金额：分 → 元
    const rawAmt = pickNum(
      row.verify_amount,
      row.verify_amount_info?.verify_amount,
      row.verify_amount_info?.amount,
      row.pay_amount_info?.pay_amount,
      row.amount,
    );
    const amt = rawAmt / 100;
    verifyAmount += amt;
    verifyOrderCnt += 1;
    verifyCertCnt += pickNum(row.verify_cnt, row.cert_cnt, row.item_num) || 1;

    const channel = row.order_source?.sale_channel ?? row.channel ?? '其他';
    byChannel[channel] = (byChannel[channel] ?? 0) + amt;
  }

  return {
    verifyAmount: Math.round(verifyAmount),
    verifyOrderCnt,
    verifyCertCnt,
    byChannel: Object.fromEntries(Object.entries(byChannel).map(([k, v]) => [k, Math.round(v)])),
  };
}

// 用核销时间过滤指定日期范围（多候选时间字段）
function filterByVerifyDate(rows: VerifyRow[], startDate: string, endDate: string): VerifyRow[] {
  return rows.filter(row => {
    const vt = row.verify_time ?? row.write_off_time ?? row.verify_info?.verify_time;
    if (!vt) return true; // 时间字段缺失时不过滤，避免误删
    const d = String(vt).slice(0, 10);
    return d >= startDate && d <= endDate;
  });
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
   * 拉取来客核销明细（核销记录列表）并聚合。
   * ⚠️ 字段名为抓包前的容错占位：金额/核销时间/订单号做了多候选匹配，
   *    抓到真实接口后按 first_row_keys 收敛即可。
   * URL：LAIKE_VERIFY_RECORDS_URL 或 LAIKE_API_BASE + /api/node/flow/batch
   * 鉴权：LAIKE_COOKIE。失败返回 null（日报降级为手动填写）。
   */
  static async fetchVerifyRecords(
    poiId: string,
    startDate: string,
    endDate: string,
  ): Promise<LaikeVerifySummary | null> {
    if (!cookie() || !poiId) return null;
    const url = process.env.LAIKE_VERIFY_RECORDS_URL || (base() + '/api/node/flow/batch');
    if (!url.startsWith('http')) {
      console.warn('[LaikeAdapter] 未配置 LAIKE_API_BASE 或 LAIKE_VERIFY_RECORDS_URL，跳过来客核销明细');
      return null;
    }

    // 请求体也是占位：抓到真实 view_type/view_key 后替换即可
    const body = {
      view_type: 'coupon_verify_record',
      view_key: 'management_coupon_verify_record_list',
      main_data_key: 'common_verify_record',
      poi_id: poiId,
      start_date: startDate,
      end_date: endDate,
      page: 1,
      page_size: 200,
    };

    const json = await postJson<{
      code?: number; errno?: number;
      data?: { list?: VerifyRow[]; common_verify_record?: VerifyRow[]; records?: VerifyRow[]; verify_record?: VerifyRow[] };
    }>(url, body);

    if (!json) return null;
    const rows: VerifyRow[] =
      json.data?.list ?? json.data?.common_verify_record ?? json.data?.verify_record ?? json.data?.records ?? [];
    if (!rows.length) {
      console.log(`[LaikeAdapter] coupon_verify_record 无数据 poi=${poiId} ${startDate}~${endDate}`);
      return null;
    }

    const filtered = filterByVerifyDate(rows, startDate, endDate);
    const summary = parseVerifyRecords(filtered.length ? filtered : rows);
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
