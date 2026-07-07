// GET /api/debug/localads-reach
// 在服务器端（Railway）直接探测本地推域名可达性，判断「无头浏览器采集器」能否部署在此。
// 只报告 HTTP 状态/错误，绝不打印 cookie/token。可达的标志：拿到任意 HTTP 响应（含 40010/40000/302）；
// 不可达：连接超时 / CONNECT 403 / DNS 失败。
import { ok } from '../../../../lib/api';
import type { RouteHandler } from '../../../../lib/api';

async function probe(url: string, withCookie: boolean): Promise<Record<string, unknown>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  const headers: Record<string, string> = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  };
  const cookie = process.env.OCEANENGINE_LOCALADS_COOKIE;
  if (withCookie && cookie) headers['Cookie'] = cookie; // 仅用于探测，不回显
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', headers, redirect: 'manual', signal: ctrl.signal });
    const text = await res.text().catch(() => '');
    return {
      url, reachable: true, httpStatus: res.status, ms: Date.now() - t0,
      bodySnippet: text.slice(0, 200), location: res.headers.get('location') || undefined,
    };
  } catch (e) {
    return { url, reachable: false, ms: Date.now() - t0, error: String(e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

export const GET: RouteHandler = async (_req, res) => {
  const home = 'https://localads.chengzijianzhan.cn/lamp/pc/home?advid=1851121699721292';
  const api  = 'https://localads.chengzijianzhan.cn/api/lamp/pc/v2/statistics/promotion/getOrderStatsData?advid=1851121699721292&adId=1&startTime=2026-07-07+00:00:00&endTime=2026-07-07+23:59:59&metrics=stat_cost&page=1&pageSize=10';
  const [homeR, apiR] = await Promise.all([probe(home, false), probe(api, true)]);
  const reachable = homeR.reachable === true || apiR.reachable === true;
  ok(res, {
    reachable,
    verdict: reachable
      ? '✓ Railway 能连到本地推域名 → 可在此部署无头浏览器采集器（下一步装 Chromium）。'
      : '✗ Railway 连不到本地推（被封/超时）→ 采集器需换一台能出网的机器。',
    home: homeR,
    api: apiR,
    note: 'reachable=拿到任意HTTP响应(含40010/40000/302均算通)；不含cookie回显。',
  });
};
