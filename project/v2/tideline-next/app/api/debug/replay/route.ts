// 接口回放/调试：把浏览器 F12 或 Console 抓到的请求粘贴进来，快速验证字段是否可用于日报。
// POST /api/debug/laike/replay     —— 默认注入 LAIKE_COOKIE / LAIKE_API_BASE
// POST /api/debug/business/replay  —— 默认注入 BUSINESS_COMPASS_COOKIE / BUSINESS_COMPASS_API_BASE
//
// 入参：{ url, method?, headers?, body?, expect? }
// - url 可为完整 URL 或以 / 开头的路径（自动拼对应 API_BASE）
// - 若 headers 未带 Cookie，自动注入对应平台的 .env Cookie（不回显 Cookie 明文）
// - expect 可为某个期望命中的数值（如真实消耗），用于在响应里定位字段路径

import { ok, err } from '../../../../lib/api';
import type { RouteHandler } from '../../../../lib/api';

function tryParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

// 递归收集非零数值字段路径（最多 200 条，避免爆量）
function collectNonZero(obj: unknown, path = '', out: Array<{ path: string; value: number }> = []): Array<{ path: string; value: number }> {
  if (out.length >= 200) return out;
  if (typeof obj === 'number' && obj !== 0) { out.push({ path, value: obj }); return out; }
  if (Array.isArray(obj)) { obj.forEach((v, i) => collectNonZero(v, `${path}[${i}]`, out)); return out; }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      collectNonZero(v, path ? `${path}.${k}` : k, out);
      if (out.length >= 200) break;
    }
  }
  return out;
}

// 在响应里查找等于 expect 的数值字段路径（容忍 ±1 与 ×100 分元换算）
function findExpect(obj: unknown, expect: number, path = '', out: string[] = []): string[] {
  if (out.length >= 50) return out;
  if (typeof obj === 'number') {
    if (Math.abs(obj - expect) < 1 || Math.abs(obj / 100 - expect) < 1 || Math.abs(obj * 100 - expect) < 1) out.push(path);
    return out;
  }
  if (Array.isArray(obj)) { obj.forEach((v, i) => findExpect(v, expect, `${path}[${i}]`, out)); return out; }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      findExpect(v, expect, path ? `${path}.${k}` : k, out);
      if (out.length >= 50) break;
    }
  }
  return out;
}

function firstRowOf(json: unknown): { row: Record<string, unknown> | null; keys: string[] } {
  const d = json as Record<string, unknown> | null;
  const candidates: unknown[] = [
    (d?.data as Record<string, unknown>)?.list,
    (d?.data as Record<string, unknown>)?.common_sale_record,
    (d?.data as Record<string, unknown>)?.records,
    (d as Record<string, unknown>)?.data,
    d,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length && typeof c[0] === 'object') {
      return { row: c[0] as Record<string, unknown>, keys: Object.keys(c[0] as object) };
    }
  }
  return { row: null, keys: [] };
}

async function doReplay(
  req: Parameters<RouteHandler>[0],
  res: Parameters<RouteHandler>[1],
  cookieEnv: string,
  baseEnv: string,
) {
  const body = (req.body ?? {}) as {
    url?: string; method?: string; headers?: Record<string, string>; body?: unknown; expect?: number;
  };
  if (!body.url) return err(res, '请提供 url（完整 URL 或以 / 开头的路径）');

  const apiBase = (process.env[baseEnv] ?? '').replace(/\/$/, '');
  const url = body.url.startsWith('http') ? body.url : apiBase + body.url;
  if (!url.startsWith('http')) return err(res, `url 是相对路径但未配置 ${baseEnv}`);

  const cookie = process.env[cookieEnv] ?? '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0',
    ...(apiBase ? { 'Referer': apiBase + '/', 'Origin': apiBase } : {}),
    ...(body.headers ?? {}),
  };
  // 调用方未显式给 Cookie 时，注入 .env Cookie（不回显明文）
  if (!Object.keys(headers).some(k => k.toLowerCase() === 'cookie') && cookie) {
    headers['Cookie'] = cookie;
  }

  const method = (body.method ?? 'POST').toUpperCase();
  let httpStatus = 0;
  let rawText = '';
  try {
    const r = await fetch(url, {
      method,
      headers,
      ...(method === 'GET' ? {} : { body: typeof body.body === 'string' ? body.body : JSON.stringify(body.body ?? {}) }),
    });
    httpStatus = r.status;
    rawText = await r.text();
  } catch (e) {
    return ok(res, { success: false, error: String(e), request: { url, method } });
  }

  const json = tryParse(rawText);
  const isObj = json && typeof json === 'object';
  const { row, keys } = firstRowOf(json);

  return ok(res, {
    success: httpStatus >= 200 && httpStatus < 300,
    http_status: httpStatus,
    request: { url, method, cookie_injected: !!cookie },
    response_keys: isObj ? Object.keys(json as object) : [],
    data_keys: isObj && (json as Record<string, unknown>).data && typeof (json as Record<string, unknown>).data === 'object'
      ? Object.keys((json as Record<string, unknown>).data as object) : [],
    meta: isObj ? (json as Record<string, unknown>).meta ?? null : null,
    first_row: row,
    first_row_keys: keys,
    non_zero_values: collectNonZero(json).slice(0, 80),
    expect_hits: body.expect != null ? findExpect(json, Number(body.expect)) : null,
    raw_response: rawText.slice(0, 20000),
  });
}

export const laikeReplay: RouteHandler = (req, res) =>
  doReplay(req, res, 'LAIKE_COOKIE', 'LAIKE_API_BASE');

export const businessReplay: RouteHandler = (req, res) =>
  doReplay(req, res, 'BUSINESS_COMPASS_COOKIE', 'BUSINESS_COMPASS_API_BASE');
