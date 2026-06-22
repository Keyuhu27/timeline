// 巨量本地推报表接口探测——不硬编码字段，完整透传原始响应
import { IncomingMessage, ServerResponse } from 'http';
import { tokenManager } from '../../../../lib/adapters/index';
import { safeJsonParse } from '../../../../lib/adapters/oceanengine-adapter';

const LOCAL_BASE = 'https://api.oceanengine.com/open_api/v3.0/local/';

function ok(res: ServerResponse, data: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}
function err(res: ServerResponse, msg: string, status = 400) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: msg }));
}

function todayBeijing() {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

async function probeReport(
  res: ServerResponse,
  req: IncomingMessage,
  reportPath: string, // e.g. 'report/account/get/'
  extraParams: Record<string, string> = {},
) {
  const url = new URL('http://x' + req.url!);
  const localAccountId = url.searchParams.get('local_account_id');
  if (!localAccountId) return err(res, '缺少 local_account_id 参数');

  const startDate = url.searchParams.get('start_date') ?? todayBeijing();
  const endDate   = url.searchParams.get('end_date')   ?? todayBeijing();

  let token: string;
  try {
    token = await tokenManager.getAnyToken('oceanengine');
  } catch (e) {
    return err(res, `获取 token 失败: ${String(e)}`, 500);
  }

  const params: Record<string, string> = {
    local_account_id: localAccountId,
    start_date: startDate,
    end_date:   endDate,
    time_granularity: 'TIME_GRANULARITY_TOTAL',
    page: '1',
    page_size: '5',
    ...extraParams,
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
    return err(res, `网络请求失败: ${String(e)}`, 500);
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = safeJsonParse<Record<string, unknown>>(rawText);
  } catch {
    // not JSON
  }

  // 提取第一行数据的所有 key（用于字段发现）
  const data = parsed?.data as Record<string, unknown> | undefined;
  const list: unknown[] = (data?.list ?? data?.data ?? []) as unknown[];
  const firstRow = list[0] as Record<string, unknown> | undefined;
  const totals   = data?.total  as Record<string, unknown> | undefined;
  const summary  = data?.summary as Record<string, unknown> | undefined;

  ok(res, {
    probe: reportPath,
    request: { url: fullUrl, params },
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
  await probeReport(res, req, 'report/project/get/', {
    fields: JSON.stringify([
      'stat_cost','show_cnt','click_cnt','ctr','cpm_platform',
      'convert_cnt','conversion_cost','poi_recommend_count',
      'phone_confirm_cnt','form_cnt','clue_pay_order_cnt',
      'oto_pay_order_count','oto_pay_order_amount','oto_pay_order_roi',
    ]),
  });
}

export async function promotionReport(req: IncomingMessage, res: ServerResponse) {
  await probeReport(res, req, 'report/promotion/get/', {
    fields: JSON.stringify([
      'stat_cost','show_cnt','click_cnt','ctr','cpm_platform',
      'convert_cnt','conversion_cost','poi_recommend_count',
      'phone_confirm_cnt','form_cnt','clue_pay_order_cnt',
      'oto_pay_order_count','oto_pay_order_amount','oto_pay_order_roi',
    ]),
  });
}
