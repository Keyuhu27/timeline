// 直播间画面（素材级·全域）数据 Playwright 验证脚本
// 目的：用真实浏览器带 Cookie 打开本地推页面，让页面自己的 JS（WebMSSDK）给
//       getOrderStatsData 请求签好 a_bogus/msToken，验证能否拿到「非 40010」的真实数据。
//
// 用法（凭证只从环境变量读，绝不写进代码/仓库）：
//   PROBE_COOKIE='本地推登录后的完整 Cookie 串' \
//   PROBE_ADVID=1851121699721292 \
//   PROBE_ADID=1851177362451895 \
//   [PROBE_DATE=2026-07-07] \
//   [PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome] \
//   node scripts/live-material-probe.mjs
//
// 依赖：playwright-core（npm i -D playwright-core，不会下载浏览器，用系统已装 Chromium）

import { chromium } from 'playwright-core';

const COOKIE = process.env.PROBE_COOKIE || '';
const ADVID  = process.env.PROBE_ADVID  || '';
const ADID   = process.env.PROBE_ADID   || '';
const DATE   = process.env.PROBE_DATE   || new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const EXEC   = process.env.PW_CHROMIUM  || ''; // 留空 = 用 playwright 自带浏览器（本地 mac 用这个）

function die(msg) { console.error('✗ ' + msg); process.exit(1); }
if (!COOKIE) die('缺少 PROBE_COOKIE（本地推登录 Cookie，只放环境变量）');
if (!ADVID)  die('缺少 PROBE_ADVID');
if (!ADID)   die('缺少 PROBE_ADID');

// 解析 "k=v; k2=v2" → playwright cookies（挂在 .chengzijianzhan.cn 域）
const cookies = COOKIE.split(';').map(s => s.trim()).filter(Boolean).map(pair => {
  const i = pair.indexOf('=');
  return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim(), domain: '.chengzijianzhan.cn', path: '/' };
}).filter(c => c.name);

const startTime = `${DATE} 00:00:00`;
const endTime   = `${DATE} 23:59:59`;
// 对比时段 = 前一天（后台真实请求必带 lastStartTime/lastEndTime，缺了会 40000 参数校验未通过）
const prevDate  = new Date(new Date(DATE + 'T00:00:00+08:00').getTime() - 86400_000 + 8 * 3600_000).toISOString().slice(0, 10);
const lastStartTime = `${prevDate} 00:00:00`;
const lastEndTime   = `${prevDate} 23:59:59`;
// 完整 metrics（与后台真实请求一致，别裁短）
const metrics = 'stat_cost,live_oto_pay_order_count_for_roi2,live_oto_pay_order_stat_amount_for_roi2,live_oto_pay_order_roi2,live_cost_per_oto_pay_order_for_roi2,live_oto_pay_order_user_count_for_roi2,live_cost_per_oto_pay_order_user_for_roi2,live_oto_pay_qcpx_coupon_stat_amount_for_roi2,qcpx_coupon_live_oto_pay_order_count_for_roi2,qcpx_coupon_live_oto_pay_order_stat_amount_for_roi2';

const run = async () => {
  const launchOpts = { headless: true, args: ['--no-sandbox'] };
  if (EXEC) launchOpts.executablePath = EXEC; // 仅当显式指定时才用系统 Chromium（如 Linux 服务器）
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36' });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  // 打开本地推页面，让 WebMSSDK 加载并 hook fetch/XHR（负责注入 a_bogus/msToken）
  const home = `https://localads.chengzijianzhan.cn/lamp/pc/home?advid=${encodeURIComponent(ADVID)}`;
  const resp = await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
  console.log(`[probe] 打开首页 status=${resp ? resp.status() : 'nav-failed'} url=${page.url()}`);
  if (page.url().includes('login') || page.url().includes('passport')) {
    die('Cookie 无效/已过期：被重定向到登录页。请重新抓取有效登录 Cookie。');
  }
  // 给 SDK 一点时间完成 hook
  await page.waitForTimeout(4000);

  // 在页面上下文里发起请求 —— 站点自己的 fetch/XHR hook 会自动补上 a_bogus/msToken
  const result = await page.evaluate(async ({ ADVID, ADID, startTime, endTime, lastStartTime, lastEndTime, metrics }) => {
    const qs = new URLSearchParams({
      advid: ADVID, adId: ADID,
      startTime, endTime, lastStartTime, lastEndTime, metrics,
      MarGoal: '2', DeliveryGoal: '2',
      statTimeDimension: 'stat_time_hour', orderField: 'stat_time_hour', orderType: '1',
      page: '1', pageSize: '10',
    }).toString();
    const url = `https://localads.chengzijianzhan.cn/api/lamp/pc/v2/statistics/promotion/getOrderStatsData?${qs}`;
    try {
      const r = await fetch(url, { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json, text/plain, */*' } });
      const text = await r.text();
      return { httpStatus: r.status, body: text };   // 完整返回，解析在 Node 端做，别在此截断
    } catch (e) { return { httpStatus: -1, body: 'fetch error: ' + String(e) }; }
  }, { ADVID, ADID, startTime, endTime, lastStartTime, lastEndTime, metrics });

  console.log(`[probe] getOrderStatsData HTTP=${result.httpStatus}`);
  let code, totals;
  try {
    const j = JSON.parse(result.body);
    code = j.status_code ?? j.code;
    totals = j?.data?.data?.totalMetrics;
  } catch { /* not json */ }

  if (code === 0 && totals) {
    console.log('✓ 成功拿到数据（非 40010）。totalMetrics 摘要：');
    console.log(JSON.stringify({
      statCost: totals.statCost?.value,
      globalGmv: totals.liveOtoPayOrderStatAmountForRoi2?.value,
      globalOrderCount: totals.liveOtoPayOrderCountForRoi2?.value,
      globalPayRoi: totals.liveOtoPayOrderRoi2?.value,
      globalOrderCost: totals.liveCostPerOtoPayOrderForRoi2?.value,
    }, null, 2));
    console.log('→ 结论：无头浏览器代签可行，可封装进 10 分钟巡检。');
  } else {
    console.log(`✗ 未拿到有效数据（code=${code ?? 'n/a'}）。响应前 1200 字：`);
    console.log(String(result.body).slice(0, 1200));
    console.log('→ 若 code=40010：页面内 fetch 未被 SDK 签名/或需先进到「素材」页触发。可再迭代。');
  }

  await browser.close();
};

run().catch(e => { console.error('脚本异常：', e); process.exit(1); });
