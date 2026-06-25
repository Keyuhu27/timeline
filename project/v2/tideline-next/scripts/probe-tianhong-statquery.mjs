// 诊断天鸿 statQuery：用 .env 的真实 cookie 直接打后台接口，打印原始 Totals。
// 用法（在 project/v2/tideline-next 下）：
//   node scripts/probe-tianhong-statquery.mjs
// 脚本自己解析同目录上层的 .env，无需 dotenv、无需 export。
// 不会写任何文件、不提交任何东西，只读 .env + 打印响应。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// 解析 .env（支持值里含 = 和特殊字符；只按第一个 = 分割，不做 shell 展开）
function loadEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, '..', '.env'), join(process.cwd(), '.env')];
  for (const p of candidates) {
    try {
      const raw = readFileSync(p, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const s = line.trim();
        if (!s || s.startsWith('#')) continue;
        const eq = s.indexOf('=');
        if (eq < 0) continue;
        const k = s.slice(0, eq).trim();
        let v = s.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!(k in process.env)) process.env[k] = v;
      }
      console.log('已加载 .env:', p);
      return;
    } catch {}
  }
  console.warn('⚠️ 未找到 .env，将仅用现有环境变量');
}
loadEnv();

const ADVID = '1844144155187404';

function cookieFor(advid) {
  try {
    if (process.env.OCEANENGINE_LOCALADS_COOKIE_MAP) {
      const m = JSON.parse(process.env.OCEANENGINE_LOCALADS_COOKIE_MAP);
      if (m[advid]) return m[advid];
    }
  } catch {}
  return process.env.OCEANENGINE_LOCALADS_COOKIE;
}
function headersFor(advid) {
  let h = {};
  try { if (process.env.OCEANENGINE_LOCALADS_HEADERS) h = JSON.parse(process.env.OCEANENGINE_LOCALADS_HEADERS); } catch {}
  try {
    if (process.env.OCEANENGINE_LOCALADS_HEADERS_MAP) {
      const hm = JSON.parse(process.env.OCEANENGINE_LOCALADS_HEADERS_MAP);
      if (hm[advid]) h = { ...h, ...hm[advid] };
    }
  } catch {}
  return h;
}

const cookie = cookieFor(ADVID);
if (!cookie) { console.error('❌ 没有 cookie，检查 OCEANENGINE_LOCALADS_COOKIE_MAP / OCEANENGINE_LOCALADS_COOKIE'); process.exit(1); }

const today8 = new Date(Date.now() + 8 * 3600_000);
const todayStr = today8.toISOString().slice(0, 10);
const startTime = `${todayStr} 00:00:00`;
const endTime   = today8.toISOString().replace('T', ' ').slice(0, 19);
const prev = (ts) => { const d = new Date(ts.replace(' ', 'T') + '+08:00'); d.setDate(d.getDate() - 1); return d.toISOString().replace('T', ' ').slice(0, 19); };

// 两种数据集都试，看哪个返回非零
const variants = [
  {
    name: 'cdp (pc_home_app_promotion_cdp)',
    DataSetKey: 'pc_home_app_promotion_cdp',
    Conditions: [
      { Field: 'advertiser_id', Operator: 7, Values: [ADVID] },
      { Field: 'is_order',      Operator: 7, Values: ['1'] },
      { Field: 'landing_type',  Operator: 7, Values: ['1'] },
    ],
    Metrics: ['stat_cost', 'oto_pay_order_stat_amount', 'oto_pay_order_count', 'roi'],
  },
  {
    name: 'roi2 (pc_home_roi2)',
    DataSetKey: 'pc_home_roi2',
    Conditions: [
      { Field: 'advertiser_id',  Operator: 7, Values: [ADVID] },
      { Field: 'adlab_mode',     Operator: 7, Values: ['1'] },
      { Field: 'create_channel', Operator: 7, Values: ['64'] },
    ],
    Metrics: ['stat_cost', 'live_stat_cost_for_roi2', 'video_stat_cost_for_roi2'],
  },
  {
    // cdp 但不带 FrameId/ModuleId（有些数据集不接受这两个会报错/返空）
    name: 'cdp 无 FrameId/ModuleId',
    DataSetKey: 'pc_home_app_promotion_cdp',
    noFrame: true,
    Conditions: [
      { Field: 'advertiser_id', Operator: 7, Values: [ADVID] },
      { Field: 'is_order',      Operator: 7, Values: ['1'] },
      { Field: 'landing_type',  Operator: 7, Values: ['1'] },
    ],
    Metrics: ['stat_cost', 'oto_pay_order_stat_amount', 'oto_pay_order_count', 'roi'],
  },
];

// 对照组：用全局 cookie 打一个已知能出数的账户，确认 localads 登录态是否还活着
const CONTROL_ADVID = process.env.PROBE_CONTROL_ADVID || '1843942799242247';
variants.push({
  name: `对照：全局cookie + roi2 + 已知账户 ${CONTROL_ADVID}`,
  control: true,
  DataSetKey: 'pc_home_roi2',
  Conditions: [
    { Field: 'advertiser_id',  Operator: 7, Values: [CONTROL_ADVID] },
    { Field: 'adlab_mode',     Operator: 7, Values: ['1'] },
    { Field: 'create_channel', Operator: 7, Values: ['64'] },
  ],
  Metrics: ['stat_cost', 'live_stat_cost_for_roi2', 'video_stat_cost_for_roi2'],
});

const urlFor = (advid) => `https://localads.chengzijianzhan.cn/api/lamp/pc/v2/statistics/data/statQuery?advid=${encodeURIComponent(advid)}`;

function findTotals(o, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 6) return null;
  if (o.Totals && typeof o.Totals === 'object') return o.Totals;
  for (const v of Object.values(o)) { const t = findTotals(v, depth + 1); if (t) return t; }
  return null;
}

for (const v of variants) {
  const advid = v.control ? CONTROL_ADVID : ADVID;
  const useCookie = v.control ? process.env.OCEANENGINE_LOCALADS_COOKIE : cookie;
  const useHeaders = v.control
    ? (() => { try { return JSON.parse(process.env.OCEANENGINE_LOCALADS_HEADERS || '{}'); } catch { return {}; } })()
    : headersFor(ADVID);

  const payload = {
    StartTime: startTime, EndTime: endTime,
    ComparisonParams: { RatioStartTime: prev(startTime), RatioEndTime: prev(endTime) },
    DataSetKey: v.DataSetKey,
    Dimensions: ['stat_time_hour'],
    Filters: { ConditionRelationshipType: 1, Conditions: v.Conditions },
    Metrics: v.Metrics,
    OrderBy: [{ Field: 'stat_time_hour', Type: 1 }],
  };
  if (!v.noFrame) { payload.FrameId = '7289039319510155321'; payload.ModuleId = '7396885770868375562'; }

  console.log(`\n=== ${v.name} ===`);
  if (!useCookie) { console.log('（跳过：该组所需 cookie 未配置）'); continue; }
  try {
    const res = await fetch(urlFor(advid), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': useCookie,
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://localads.chengzijianzhan.cn',
        'Referer': 'https://localads.chengzijianzhan.cn/',
        'User-Agent': 'Mozilla/5.0',
        ...useHeaders,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log('HTTP', res.status);
    let json;
    try { json = JSON.parse(text); }
    catch { console.log('⚠️ 非 JSON 响应（疑似 cookie 失效/风控）:', text.slice(0, 300)); continue; }
    console.log('code =', json.code, 'message =', json.message);
    const totals = findTotals(json);
    if (!totals) { console.log('未找到 Totals。原始响应前 500 字:', JSON.stringify(json).slice(0, 500)); continue; }
    console.log('Totals 字段:', Object.keys(totals).join(', ') || '(空)');
    console.log('Totals 值:', JSON.stringify(totals).slice(0, 800));
  } catch (e) {
    console.log('请求异常:', String(e));
  }
}
