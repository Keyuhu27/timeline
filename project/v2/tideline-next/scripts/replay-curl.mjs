// 重放一条 statQuery curl：解析本地 curl 文件，原样重放，打印响应 Totals。
// 用法：
//   1) 在天鸿后台（显示有数据的页面）DevTools → Network → 找到 statQuery 请求 → 右键 Copy → Copy as cURL
//   2) 粘贴保存为本地文件，例如 tianhong.curl.txt（放哪都行，别提交 git）
//   3) node scripts/replay-curl.mjs tianhong.curl.txt
// 脚本只打印：HTTP 状态、URL、DataSetKey/FrameId/ModuleId/Metrics/Filters（非敏感）、Totals。
// 不打印 cookie / csrf-token，可放心把输出贴出来。

import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('用法: node scripts/replay-curl.mjs <curl文件路径>'); process.exit(1); }
const raw = readFileSync(file, 'utf8');

// 把多行 curl（带反斜杠续行）拼成一行再解析
const joined = raw.replace(/\\\r?\n/g, ' ');

// URL：curl 'xxx' 或 curl "xxx" 或 curl xxx
let url = null;
let m = joined.match(/curl\s+(?:--?\w+\s+(?:'[^']*'|"[^"]*"|\S+)\s+)*?['"]?(https?:\/\/[^'"\s]+)['"]?/);
if (m) url = m[1];
if (!url) { m = joined.match(/(https?:\/\/[^'"\s]+)/); if (m) url = m[1]; }

// headers: -H 'k: v'  /  --header "k: v"
// 跳过会让 Node fetch 报错或与鉴权无关的浏览器头
const SKIP = new Set([
  'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
  'priority', 'traceparent', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
  'pragma', 'cache-control',
]);
const headers = {};
const hre = /(?:-H|--header)\s+'([^']*)'|(?:-H|--header)\s+"([^"]*)"/g;
let hm;
while ((hm = hre.exec(joined))) {
  const hv = hm[1] ?? hm[2];
  const i = hv.indexOf(':');
  if (i <= 0) continue;
  const k = hv.slice(0, i).trim();
  if (SKIP.has(k.toLowerCase())) continue;
  headers[k] = hv.slice(i + 1).trim();
}

// cookie: -b / --cookie 单独给的情况
const cm = joined.match(/(?:-b|--cookie)\s+'([^']*)'|(?:-b|--cookie)\s+"([^"]*)"/);
if (cm) headers['Cookie'] = (cm[1] ?? cm[2]);

// body: --data-raw / --data / -d / --data-binary —— body 是最后一个参数，取 flag 后第一个引号到末尾
let body = null;
const flagIdx = joined.search(/(?:--data-raw|--data-binary|--data|-d)\s+['"]/);
if (flagIdx >= 0) {
  const after = joined.slice(flagIdx);
  const q = after.search(/['"]/);
  const quote = after[q];
  const rest = after.slice(q + 1);
  const end = rest.lastIndexOf(quote);
  body = end >= 0 ? rest.slice(0, end) : rest;
  body = body.trim();
}

console.log('URL:', url);
console.log('Method:', body ? 'POST' : (/\b-X\s+(\w+)/.exec(joined)?.[1] || 'GET'));
console.log('Header keys:', Object.keys(headers).join(', '));

// 打印 body 的非敏感结构
if (body) {
  try {
    const j = JSON.parse(body);
    const pick = (k) => k in j ? `${k}=${JSON.stringify(j[k])}` : null;
    console.log('--- body 非敏感字段 ---');
    for (const k of ['DataSetKey', 'FrameId', 'ModuleId', 'Dimensions', 'Metrics', 'Filters', 'StartTime', 'EndTime']) {
      const s = pick(k); if (s) console.log(' ', s);
    }
  } catch { console.log('(body 不是 JSON，原样长度', body.length, ')'); }
}

function findTotals(o, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 8) return null;
  if (o.Totals && typeof o.Totals === 'object') return o.Totals;
  for (const v of Object.values(o)) { const t = findTotals(v, depth + 1); if (t) return t; }
  return null;
}

async function run(label, theUrl) {
  console.log(`\n=== ${label} ===`);
  console.log('URL:', theUrl.replace(/(msToken|a_bogus)=[^&]*/g, '$1=<隐藏>'));
  const res = await fetch(theUrl, { method: body ? 'POST' : 'GET', headers, body: body ?? undefined });
  const text = await res.text();
  console.log('HTTP', res.status);
  let json;
  try { json = JSON.parse(text); } catch { console.log('非 JSON 响应:', text.slice(0, 300)); return; }
  console.log('status_code/code =', json.status_code ?? json.code, ' message =', json.message);
  const totals = findTotals(json);
  if (!totals) { console.log('未找到 Totals。响应前 600 字:', JSON.stringify(json).slice(0, 600)); return; }
  console.log('Totals 字段:', Object.keys(totals).join(', '));
  console.log('Totals 值:', JSON.stringify(totals).slice(0, 1000));
}

// A：原样（带 msToken / a_bogus）
await run('A 原样（带 msToken/a_bogus）', url);
// B：去掉 msToken / a_bogus，看 cookie+csrf 是否足够
const stripped = url.replace(/[?&]msToken=[^&]*/g, '').replace(/[?&]a_bogus=[^&]*/g, '')
                    .replace(/\?&/, '?').replace(/&&/g, '&').replace(/[?&]$/, '');
await run('B 去掉 msToken/a_bogus', stripped);
