// 复用一条有效 statQuery curl 的鉴权（URL+cookie+headers，含 msToken/a_bogus），
// 把请求体换成多种候选，挨个打，找出返回「全域投放 35.67」的那个数据集/filter 组合。
// 用法：node scripts/probe-variants.mjs <curl文件>
// 只打印各候选的 DataSetKey + Totals，不打印 cookie/token。

import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('用法: node scripts/probe-variants.mjs <curl文件>'); process.exit(1); }
const joined = readFileSync(file, 'utf8').replace(/\\\r?\n/g, ' ');

// URL（保留 msToken/a_bogus 等 query）
let url = (joined.match(/curl\s+['"]?(https?:\/\/[^'"\s]+)/) || [])[1]
       || (joined.match(/(https?:\/\/[^'"\s]+)/) || [])[1];

// headers（跳过会让 fetch 报错或无关的浏览器头）
const SKIP = new Set(['sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-platform','priority','traceparent','sec-fetch-dest','sec-fetch-mode','sec-fetch-site','pragma','cache-control','content-length']);
const headers = {};
const hre = /(?:-H|--header)\s+'([^']*)'|(?:-H|--header)\s+"([^"]*)"/g;
let hm;
while ((hm = hre.exec(joined))) {
  const hv = hm[1] ?? hm[2]; const i = hv.indexOf(':');
  if (i <= 0) continue;
  const k = hv.slice(0, i).trim();
  if (SKIP.has(k.toLowerCase())) continue;
  headers[k] = hv.slice(i + 1).replace(/[\x00-\x1f\x7f]/g, '').trim();
}
const cm = joined.match(/(?:-b|--cookie)\s+'([^']*)'|(?:-b|--cookie)\s+"([^"]*)"/);
if (cm) headers['Cookie'] = (cm[1] ?? cm[2]).replace(/[\x00-\x1f\x7f]/g, '').replace(/\s{2,}/g, ' ').trim();

const ADVID = '1844144155187404';
const now = new Date(Date.now() + 8 * 3600_000);
const todayStr = now.toISOString().slice(0, 10);
const StartTime = `${todayStr} 00:00:00`;
const EndTime   = now.toISOString().replace('T', ' ').slice(0, 19);
const FrameId = '7289039319510155321';

const adv = { Field: 'advertiser_id', Operator: 7, Values: [ADVID] };
const pv2 = { Field: 'platform_version', Operator: 8, Values: ['2'] };

const ROI2_METRICS = ['stat_cost','live_stat_cost_for_roi2','video_stat_cost_for_roi2','live_oto_pay_order_stat_amount_for_roi2','video_oto_pay_order_stat_amount_for_roi2','live_oto_pay_order_roi2_new','video_oto_pay_order_roi2_new'];
const STD_METRICS  = ['stat_cost','show_cnt','click_cnt','oto_pay_order_count','oto_pay_order_amount','oto_pay_order_roi'];

const variants = [
  { name: 'V1 roi2 + adlab_mode=1,create_channel=64', DataSetKey: 'pc_home_roi2', ModuleId: '7396885770868375562',
    Conditions: [adv, {Field:'adlab_mode',Operator:7,Values:['1']}, {Field:'create_channel',Operator:7,Values:['64']}], Metrics: ROI2_METRICS },
  { name: 'V2 roi2 + 仅 advertiser_id', DataSetKey: 'pc_home_roi2', ModuleId: '7396885770868375562',
    Conditions: [adv], Metrics: ROI2_METRICS },
  { name: 'V3 standard + derivate_is_order=1 (全域)', DataSetKey: 'pc_home_standard_promotion', ModuleId: '7399754894837612581',
    Conditions: [adv, pv2, {Field:'derivate_is_order',Operator:7,Values:['1']}], Metrics: STD_METRICS },
  { name: 'V4 standard + adlab_mode=1 (全域)', DataSetKey: 'pc_home_standard_promotion', ModuleId: '7399754894837612581',
    Conditions: [adv, pv2, {Field:'adlab_mode',Operator:7,Values:['1']}], Metrics: STD_METRICS },
  { name: 'V5 standard + 仅 advertiser_id+platform', DataSetKey: 'pc_home_standard_promotion', ModuleId: '7399754894837612581',
    Conditions: [adv, pv2], Metrics: STD_METRICS },
];

function findTotals(o, d=0){ if(!o||typeof o!=='object'||d>8)return null; if(o.Totals&&typeof o.Totals==='object')return o.Totals; for(const v of Object.values(o)){const t=findTotals(v,d+1); if(t)return t;} return null; }

console.log('目标：找到返回「全域投放 ¥35.67」的组合。窗口', StartTime, '~', EndTime, '\n');
for (const v of variants) {
  const body = {
    StartTime, EndTime,
    Filters: { ConditionRelationshipType: 1, Conditions: v.Conditions },
    Metrics: v.Metrics, FrameId, ModuleId: v.ModuleId, DataSetKey: v.DataSetKey,
  };
  console.log(`=== ${v.name} (${v.DataSetKey}) ===`);
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = JSON.parse(await res.text());
    if ((json.status_code ?? json.code) !== 0 && (json.status_code ?? json.code) !== undefined) {
      console.log('  ✗ code=', json.status_code ?? json.code, 'message=', json.message); console.log(); continue;
    }
    const t = findTotals(json);
    if (!t) { console.log('  无 Totals'); console.log(); continue; }
    const val = (k) => { const c = t[k]; return c==null?undefined:(typeof c==='object'?c.Value:c); };
    console.log('  stat_cost =', val('stat_cost'),
                ' show =', val('show_cnt'),
                ' gmv =', val('oto_pay_order_amount'),
                ' liveCost =', val('live_stat_cost_for_roi2'),
                ' videoCost =', val('video_stat_cost_for_roi2'));
  } catch (e) { console.log('  请求异常:', String(e)); }
  console.log();
}
