// 巨量本地推报表接口探测——不硬编码字段，完整透传原始响应
import { IncomingMessage, ServerResponse } from 'http';
import { tokenManager } from '../../../../lib/adapters/index';
import { safeJsonParse, OceanEngineAdapter } from '../../../../lib/adapters/oceanengine-adapter';

const LOCAL_BASE = 'https://api.oceanengine.com/open_api/v3.0/local/';

const DEFAULT_METRICS = [
  'stat_cost', 'show_cnt', 'click_cnt', 'ctr', 'cpm_platform',
  'convert_cnt', 'conversion_cost', 'poi_recommend_count',
  'phone_confirm_cnt', 'form_cnt', 'clue_pay_order_cnt',
  'oto_pay_order_count', 'oto_pay_order_amount', 'oto_pay_order_roi',
];

function ok(res: ServerResponse, data: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}
function sendErr(res: ServerResponse, msg: string, status = 400) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: msg }));
}

function todayBeijing() {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

async function probeReport(
  res: ServerResponse,
  req: IncomingMessage,
  reportPath: string,
) {
  const url = new URL('http://x' + req.url!);
  const localAccountId = url.searchParams.get('local_account_id');
  if (!localAccountId) return sendErr(res, '缺少 local_account_id 参数');

  const startDate  = url.searchParams.get('start_date') ?? todayBeijing();
  const endDate    = url.searchParams.get('end_date')   ?? todayBeijing();
  const pageSize   = url.searchParams.get('page_size')  ?? '100';

  // metrics 支持 query 覆盖（逗号分隔字符串），否则用默认集
  const metricsRaw = url.searchParams.get('metrics');
  const metrics = metricsRaw
    ? metricsRaw.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_METRICS;

  let token: string;
  try {
    token = await tokenManager.getAnyToken('oceanengine');
  } catch (e) {
    return sendErr(res, `获取 token 失败: ${String(e)}`, 500);
  }

  // 巨量报表接口要求 metrics 以 JSON 数组字符串形式放在 query 参数里
  const params: Record<string, string> = {
    local_account_id: localAccountId,
    start_date: startDate,
    end_date:   endDate,
    time_granularity: 'TIME_GRANULARITY_TOTAL',
    metrics: JSON.stringify(metrics),
    page: '1',
    page_size: pageSize,
  };

  const qs = new URLSearchParams(params).toString();
  const fullUrl = `${LOCAL_BASE}${reportPath}?${qs}`;

  let rawText = '';
  let httpStatus = 0;
  try {
    const r = await fetch(fullUrl, { headers: { 'Access-Token': token } });
    httpStatus = r.status;
    rawText = await r.text();
  } catch (e) {
    return sendErr(res, `网络请求失败: ${String(e)}`, 500);
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = safeJsonParse<Record<string, unknown>>(rawText);
  } catch {
    // not JSON
  }

  const data = parsed?.data as Record<string, unknown> | undefined;
  // 巨量本地推报表的数据路径因接口而异：
  //   account-report   → data.data_list
  //   project-report   → data.project_list
  //   promotion-report → data.promotion_list / data.data_list
  // 还兼容历史 StatsData.Rows / list 结构。
  const stats = (parsed?.StatsData ?? data?.StatsData) as Record<string, unknown> | undefined;
  const list: unknown[] = (
    data?.data_list ?? data?.project_list ?? data?.promotion_list ??
    data?.list ?? data?.data ?? stats?.Rows ?? []
  ) as unknown[];
  const firstRow = list[0] as Record<string, unknown> | undefined;
  const totals   = (data?.total ?? data?.summary ?? stats?.SumData) as Record<string, unknown> | undefined;
  const summary  = data?.summary as Record<string, unknown> | undefined;

  ok(res, {
    probe: reportPath,
    request: { url: fullUrl, params, metrics_sent: metrics },
    http_status: httpStatus,
    oe_code: (parsed as Record<string, unknown>)?.code,
    oe_message: (parsed as Record<string, unknown>)?.message,
    list_count: list.length,
    first_row: firstRow ?? null,
    first_row_keys: firstRow ? Object.keys(firstRow) : [],
    totals: totals ?? null,
    totals_keys: totals ? Object.keys(totals) : [],
    summary: summary ?? null,
    summary_keys: summary ? Object.keys(summary) : [],
    raw_response: rawText.slice(0, 8000),
  });
}

export async function accountReport(req: IncomingMessage, res: ServerResponse) {
  await probeReport(res, req, 'report/account/get/');
}

export async function projectReport(req: IncomingMessage, res: ServerResponse) {
  await probeReport(res, req, 'report/project/get/');
}

export async function promotionReport(req: IncomingMessage, res: ServerResponse) {
  await probeReport(res, req, 'report/promotion/get/');
}

export async function materialReport(req: IncomingMessage, res: ServerResponse) {
  await probeReport(res, req, 'report/material/get/');
}

// ─── GET /api/debug/oe/promotion-list?local_account_id=...[&project_id=...] ──
// 探测 v3.0/local/promotion/list/ 真实响应字段（Phase 5a 校准用，不硬编码字段）。
export async function promotionList(req: IncomingMessage, res: ServerResponse) {
  const url = new URL('http://x' + req.url!);
  const localAccountId = url.searchParams.get('local_account_id');
  if (!localAccountId) return sendErr(res, '缺少 local_account_id 参数');
  const projectId = url.searchParams.get('project_id');

  let token: string;
  try {
    token = await tokenManager.getAnyToken('oceanengine');
  } catch (e) {
    return sendErr(res, `获取 token 失败: ${String(e)}`, 500);
  }

  const params: Record<string, string> = {
    local_account_id: localAccountId,
    page: '1',
    page_size: url.searchParams.get('page_size') ?? '20',
  };
  if (projectId) params.filtering = JSON.stringify({ project_id: Number(projectId) });

  const qs = new URLSearchParams(params).toString();
  const fullUrl = `${LOCAL_BASE}promotion/list/?${qs}`;

  let rawText = '';
  let httpStatus = 0;
  try {
    const r = await fetch(fullUrl, { headers: { 'Access-Token': token } });
    httpStatus = r.status;
    rawText = await r.text();
  } catch (e) {
    return sendErr(res, `网络请求失败: ${String(e)}`, 500);
  }

  let parsed: Record<string, unknown> | null = null;
  try { parsed = safeJsonParse<Record<string, unknown>>(rawText); } catch { /* not JSON */ }

  const data = parsed?.data as Record<string, unknown> | undefined;
  const list = (data?.promotion_list ?? []) as unknown[];
  const firstRow = list[0] as Record<string, unknown> | undefined;

  ok(res, {
    probe: 'promotion/list/',
    request: { url: fullUrl, params },
    http_status: httpStatus,
    oe_code: parsed?.code,
    oe_message: parsed?.message,
    list_count: list.length,
    first_row: firstRow ?? null,
    first_row_keys: firstRow ? Object.keys(firstRow) : [],
    raw_response: rawText.slice(0, 8000),
  });
}

// ─── GET /api/debug/oe/promotion-detail?local_account_id=...&promotion_id=... ──
// 探测 v3.0/local/promotion/detail/ 真实响应（写操作前必读，用于确认
// customer_material_list 等字段结构，是 Phase 5d 写安全验证的前置步骤）。
export async function promotionDetail(req: IncomingMessage, res: ServerResponse) {
  const url = new URL('http://x' + req.url!);
  const localAccountId = url.searchParams.get('local_account_id');
  const promotionId = url.searchParams.get('promotion_id');
  if (!localAccountId || !promotionId) return sendErr(res, '缺少 local_account_id 或 promotion_id 参数');

  let token: string;
  try {
    token = await tokenManager.getAnyToken('oceanengine');
  } catch (e) {
    return sendErr(res, `获取 token 失败: ${String(e)}`, 500);
  }

  const params: Record<string, string> = { local_account_id: localAccountId, promotion_id: promotionId };
  const qs = new URLSearchParams(params).toString();
  const fullUrl = `${LOCAL_BASE}promotion/detail/?${qs}`;

  let rawText = '';
  let httpStatus = 0;
  try {
    const r = await fetch(fullUrl, { headers: { 'Access-Token': token } });
    httpStatus = r.status;
    rawText = await r.text();
  } catch (e) {
    return sendErr(res, `网络请求失败: ${String(e)}`, 500);
  }

  let parsed: Record<string, unknown> | null = null;
  try { parsed = safeJsonParse<Record<string, unknown>>(rawText); } catch { /* not JSON */ }

  const data = parsed?.data as Record<string, unknown> | undefined;

  ok(res, {
    probe: 'promotion/detail/',
    request: { url: fullUrl, params },
    http_status: httpStatus,
    oe_code: parsed?.code,
    oe_message: parsed?.message,
    data_keys: data ? Object.keys(data) : [],
    raw_response: rawText.slice(0, 8000),
  });
}

// ─── 后台首页 statQuery 抓包复现 ──────────────────────────────────────────────
// 开放平台 account/project/promotion 报表都拿不到「全域投放消耗」(实测全 0/空)，
// 只能复现本地推后台首页真实接口 statQuery 来理解字段口径。
// 鉴权用本地 .env 的 OCEANENGINE_LOCALADS_COOKIE（绝不在对话里粘贴 cookie），
// 额外头可选放 OCEANENGINE_LOCALADS_HEADERS（JSON）。
// 用法：把 F12 抓到的 Request Payload 原样 POST 到本接口，
//   POST /api/debug/oe/stat-query?aadvid=1851121699721292&expect=1203.49
//   body = 抓包的 JSON payload（StartTime/EndTime/DataSetKey/Dimensions/Metrics/...）
const STAT_QUERY_URL = 'https://localads.chengzijianzhan.cn/api/lamp/pc/v2/statistics/data/statQuery';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// 在任意嵌套对象里递归查找 Value === 目标值（如 1203.49），返回命中的字段路径
function findValuePaths(obj: unknown, target: number, path = ''): string[] {
  const hits: string[] = [];
  if (obj == null) return hits;
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const p = path ? `${path}.${k}` : k;
      if (typeof v === 'number' && Math.abs(v - target) < 0.01) hits.push(`${p}=${v}`);
      else if (typeof v === 'string' && Math.abs(Number(v) - target) < 0.01) hits.push(`${p}="${v}"`);
      else hits.push(...findValuePaths(v, target, p));
    }
  }
  return hits;
}

export async function statQuery(req: IncomingMessage, res: ServerResponse) {
  const url = new URL('http://x' + req.url!);
  const aadvid = url.searchParams.get('aadvid') ?? url.searchParams.get('local_account_id') ?? '';
  const expect = url.searchParams.get('expect');

  const cookie = process.env.OCEANENGINE_LOCALADS_COOKIE;
  if (!cookie) {
    return sendErr(res,
      '未配置 OCEANENGINE_LOCALADS_COOKIE。请在本地 .env 设置后台首页的 Cookie（不要粘贴到对话里），' +
      '可选 OCEANENGINE_LOCALADS_HEADERS（JSON）补充 csrf 等头。', 400);
  }

  let bodyText = '';
  try { bodyText = await readBody(req); } catch { /* ignore */ }
  if (!bodyText.trim()) {
    return sendErr(res, '请把 F12 抓到的 statQuery Request Payload 原样作为 POST body 发送。', 400);
  }

  // 额外头（csrf / agw 等）：从 env 读，允许覆盖默认头
  let extraHeaders: Record<string, string> = {};
  try {
    if (process.env.OCEANENGINE_LOCALADS_HEADERS)
      extraHeaders = JSON.parse(process.env.OCEANENGINE_LOCALADS_HEADERS) as Record<string, string>;
  } catch { /* ignore malformed */ }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cookie': cookie,
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://localads.chengzijianzhan.cn',
    'Referer': 'https://localads.chengzijianzhan.cn/',
    'User-Agent': 'Mozilla/5.0',
    ...extraHeaders,
  };

  // aadvid 通常作为 query 参数；附加到目标 URL
  const target = aadvid ? `${STAT_QUERY_URL}?aadvid=${encodeURIComponent(aadvid)}` : STAT_QUERY_URL;

  let rawText = '';
  let httpStatus = 0;
  try {
    const r = await fetch(target, { method: 'POST', headers, body: bodyText });
    httpStatus = r.status;
    rawText = await r.text();
  } catch (e) {
    return sendErr(res, `请求 statQuery 失败: ${String(e)}`, 500);
  }

  let parsed: Record<string, unknown> | null = null;
  try { parsed = safeJsonParse<Record<string, unknown>>(rawText); } catch { /* not JSON */ }

  const data = (parsed?.data ?? parsed) as Record<string, unknown> | undefined;
  const statsData = data?.StatsData as Record<string, unknown> | undefined;
  const rows   = (statsData?.Rows   ?? []) as unknown[];
  const totals = (statsData?.Totals ?? statsData?.Total) as Record<string, unknown> | undefined;
  const firstRow = rows[0] as Record<string, unknown> | undefined;

  const expectHits = expect ? findValuePaths(parsed, Number(expect)) : [];

  ok(res, {
    probe: 'statQuery',
    request: { url: target, aadvid, sent_payload: safeTryParse(bodyText) },
    http_status: httpStatus,
    rows_count: rows.length,
    first_row: firstRow ?? null,
    first_row_keys: firstRow ? Object.keys(firstRow) : [],
    totals: totals ?? null,
    totals_keys: totals ? Object.keys(totals) : [],
    expect_value: expect ? Number(expect) : null,
    expect_hits: expectHits,   // 命中目标消耗值的字段路径，定位真实口径字段
    raw_response: rawText.slice(0, 12000),
  });
}

function safeTryParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

// ─── GET /api/debug/oe/stat-query?advid=...&date=2026-06-23 ────────────────────
// 直接用适配器的 fetchHomeRoi2StatQuery 跑一遍，返回 parsed 字段 + 原始 Totals，
// 方便核对 Tideline 后端到底有没有拿到后台首页的真实全域消耗（如 2061.65）。
export async function statQueryAuto(req: IncomingMessage, res: ServerResponse) {
  const url = new URL('http://x' + req.url!);
  const advid = url.searchParams.get('advid') ?? url.searchParams.get('local_account_id') ?? '';
  if (!advid) return sendErr(res, '缺少 advid 参数');

  // date 默认今天（北京时间）；StartTime=00:00:00，EndTime=当前时刻
  const today8 = new Date(Date.now() + 8 * 3600_000);
  const dateStr = url.searchParams.get('date') ?? today8.toISOString().slice(0, 10);
  const startTime = `${dateStr} 00:00:00`;
  const endTime = url.searchParams.get('end_time')
    ?? (dateStr === today8.toISOString().slice(0, 10)
        ? today8.toISOString().replace('T', ' ').slice(0, 19)
        : `${dateStr} 23:59:59`);

  if (!process.env.OCEANENGINE_LOCALADS_COOKIE) {
    return ok(res, {
      probe: 'statQuery_pc_home_roi2',
      success: false,
      error: '未配置 OCEANENGINE_LOCALADS_COOKIE（请在本地 .env 设置后台 Cookie，勿提交）',
      request: { advid, startTime, endTime },
    });
  }

  try {
    const sq = await OceanEngineAdapter.fetchHomeRoi2StatQuery(advid, startTime, endTime);
    ok(res, {
      probe: 'statQuery_pc_home_roi2',
      success: true,
      request: { advid, startTime, endTime },
      http_status: sq.httpStatus,
      totals: sq.rawTotals,
      totals_keys: sq.totalsKeys,
      parsed: {
        spent: sq.spent, liveSpent: sq.liveSpent, videoSpent: sq.videoSpent,
        gmv: sq.gmv, liveGmv: sq.liveGmv, videoGmv: sq.videoGmv,
        roi: sq.roi, liveRoi: sq.liveRoi, videoRoi: sq.videoRoi,
        orders: sq.orders, orderCost: sq.orderCost,
      },
    });
  } catch (e) {
    ok(res, {
      probe: 'statQuery_pc_home_roi2',
      success: false,
      error: String(e),
      request: { advid, startTime, endTime },
    });
  }
}

// ─── GET /api/debug/oe/workbench-local-accounts?cc_account_id=...[&account_name=] ──
// 用旧版工作台账户列表接口发现名下本地推账户（仅账户发现/名称补全，非业务取数）。
export async function workbenchLocalAccounts(req: IncomingMessage, res: ServerResponse) {
  const url = new URL('http://x' + req.url!);
  const ccAccountId = (url.searchParams.get('cc_account_id') ?? '').trim();
  const accountName = (url.searchParams.get('account_name') ?? '').trim() || undefined;
  if (!ccAccountId) return sendErr(res, '缺少 cc_account_id 参数（工作台/纵横组织 ID）');

  let accessToken: string;
  try {
    accessToken = await tokenManager.getAnyToken('oceanengine');
  } catch (e) {
    return sendErr(res, `无法获取 Access Token: ${String(e)}`);
  }

  try {
    const r = await OceanEngineAdapter.fetchOldWorkbenchLocalAccounts(ccAccountId, accessToken, { accountName });
    ok(res, {
      request: { cc_account_id: ccAccountId, account_source: 'LOCAL', page_size: 100, account_name: accountName ?? null, url: r.requestUrl },
      list_count: r.accounts.length,
      first_row: r.firstRow,
      first_row_keys: r.firstRowKeys,
      accounts: r.accounts.map(a => ({ local_account_id: a.id, account_name: a.name, account_status: a.status })),
      raw_response: r.rawResponse,
    });
  } catch (e) {
    ok(res, {
      success: false,
      error: String(e),
      request: { cc_account_id: ccAccountId, account_source: 'LOCAL', account_name: accountName ?? null },
    });
  }
}
