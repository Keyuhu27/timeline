// GET /api/ad-diagnosis?brand=b_x&date=YYYY-MM-DD  （date 缺省 = 今天，北京时；兼容 ?brandId=）
//
// 「投流诊断」规则版（不接 AI、不自动调预算、不落盘、只读）。复用日报流水线两路数据源：
//   · 投放消耗 / ROI ← syncLocalAdsForBrand（巨量本地推 statQuery，roi2「全域」口径）
//   · GMV 经营拆分   ← fetchBusinessCompassForBrand（生意经经营口径）
// 口径以「选择日当天」为数据日，与品牌详情页「当日数据概览」对齐（非日报的昨日已结算口径）。
//
// 口径说明（重要）：spend.* 全部来自本地推 roi2「全域投放」口径，不是「账户整体消耗」。
//   账户整体 / 标准投放 需要 standard 数据集的独立口径，当前 pipeline 未单独暴露 → 返回 null（不发明）。

import { ok, err }   from '../../../lib/api';
import { brandById } from '../../../lib/db';
import {
  buildReportContext,
  fetchBusinessCompassForBrand,
  syncLocalAdsForBrand,
  bjToday,
} from '../../../lib/reports/pipeline';
import { OceanEngineAdapter } from '../../../lib/adapters/oceanengine-adapter';
import type { RouteHandler } from '../../../lib/api';

type FindingSource = 'localAds' | 'businessCompass' | 'mixed';
type Level    = 'info' | 'warn' | 'risk';
type Priority  = 'low' | 'medium' | 'high';
interface Finding {
  level: Level;
  priority: Priority;
  source: FindingSource;
  code: string;
  title: string;
  detail: string;
  evidence: string[];
  action: string;
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

// 阈值（MVP 经验值，规则版；后续可配置或交给模型）
const ROI_GOOD = 2;    // ROI 较好
const ROI_LOW  = 1;    // ROI 偏低
const SPEND_OBS  = 50;  // “有一定消耗”观察门槛
const SPEND_HIGH = 100; // “消耗较高”门槛

const yuan = (v: unknown) => '¥' + Math.round(Number(v ?? 0));

export const GET: RouteHandler = async (req, res) => {
  const brandId = (req.query.brand ?? req.query.brandId ?? '').trim();
  if (!brandId) return err(res, 'brand（或 brandId）为必填项');
  const brand = brandById(brandId);
  if (!brand) return err(res, `品牌 ${brandId} 不存在`, 404);

  const date = (req.query.date ?? '').trim() || bjToday();
  console.log(`[AdDiagnosis] brandId=${brandId} date=${date} start`);

  // 投流诊断口径：数据日 = 选择日「当天」，与「当日数据概览」/巨量后台一致（覆盖日报的昨日口径）。
  // 不改动 generateReportForBrand / 日报本身；月口径同步对齐当天所在月（诊断不展示月值，仅防越界）。
  const base = buildReportContext(brandId, date);
  const ctx = { ...base, yesterday: date, monthStart: date.slice(0, 8) + '01' };
  const advid = ctx.account?.externalId;
  const [business, localAds, standardPromoSpent] = await Promise.all([
    fetchBusinessCompassForBrand(ctx),
    syncLocalAdsForBrand(ctx),
    // 标准投放消耗（后台「标准投放消耗」卡口径），用于算账户整体 = 全域 + 标准
    advid ? OceanEngineAdapter.fetchStandardPromotionSpent(advid, `${date} 00:00:00`, `${date} 23:59:59`).catch(() => null) : Promise.resolve(null),
  ]);

  const sq  = localAds?.sqYday ?? null;   // 本地推 statQuery（roi2 全域口径）
  const src = business?.srcYday ?? null;  // 生意经经营口径成交拆分
  const n = (v: unknown): number | null => (v == null ? null : Math.round(Number(v)));
  const r = (v: unknown): number | null => (v == null ? null : Number(v));

  // ── spend：投放口径拆分（缺失为 null，不写 0、不双算）─────────────────────
  // 全域 = roi2 数据集（可靠）。
  // roi2 账户：标准投放 ← 专门的 standard_promotion 口径（platform_version==2）；账户整体 = 全域 + 标准。
  // standard 账户（如天鸿）：roi2Spent 为 null，账户整体/标准沿用 sq 内的值。
  const roi2TotalSpent = n(sq?.roi2Spent ?? sq?.spent);
  let standardSpent: number | null;
  let accountTotalSpent: number | null;
  if (sq?.roi2Spent != null) {
    standardSpent = n(standardPromoSpent);
    accountTotalSpent = (roi2TotalSpent != null && standardSpent != null) ? roi2TotalSpent + standardSpent : null;
  } else {
    standardSpent = n(sq?.standardSpent);
    accountTotalSpent = n(sq?.accountTotalSpent);
  }
  const spend = {
    accountTotalSpent,                                 // 账户整体消耗 = 全域 + 标准
    standardSpent,                                     // 标准投放消耗
    roi2TotalSpent,                                    // 全域投放消耗（本地推 roi2）
    liveSpent:  n(sq?.liveSpent),                      // 直播全域消耗
    videoSpent: n(sq?.videoSpent),                     // 短视频全域消耗
    liveRoi:    r(sq?.liveRoi),                        // 直播全域 ROI
    videoRoi:   r(sq?.videoRoi),                       // 短视频全域 ROI
  };

  // ── gmvSplit：生意经经营口径渠道拆分（缺失为 null）───────────────────────
  const gmvSplit = {
    zibo:  n(src?.officialLiveGmv),
    dabo:  n(src?.daboGmv),
    poi:   n(src?.poiGmv),
    video: n(src?.videoTotalGmv),
  };

  // ── 直播诊断 metrics ─────────────────────────────────────────────────────
  const ziboGmv = gmvSplit.zibo;
  const daboGmv = gmvSplit.dabo;
  const liveTotalGmv = (ziboGmv != null && daboGmv != null) ? ziboGmv + daboGmv : null;
  // 直播/短视频「总成交 GMV」用本地推全域投放口径（与消耗/ROI 同源，= 后台「直播/短视频全域投放」页
  // 的全域成交金额）；自播/达播拆分用生意经经营口径（未配置则为 0/null）。
  const liveOrders = (sq?.liveOrders != null && sq.liveOrders > 0) ? sq.liveOrders : null;
  const liveMetrics = {
    liveSpent: n(sq?.liveSpent),        // 本地推 直播全域消耗
    liveGmv:   n(sq?.liveGmv),          // 本地推 直播全域成交（与 liveRoi/liveSpent 同源）
    liveRoi:   r(sq?.liveRoi),          // 本地推 直播全域 ROI
    liveOrders,                         // 直播全域成交订单数
    liveOrderCost: (liveOrders != null && sq?.liveSpent != null) ? sq.liveSpent / liveOrders : null, // 全域成交订单成本
    ziboGmv,                            // 生意经自播（保留在响应里，前端默认不展示）
    daboGmv,                            // 生意经达播
    daboShare: (liveTotalGmv && liveTotalGmv > 0) ? daboGmv! / liveTotalGmv : null,
    ziboShare: (liveTotalGmv && liveTotalGmv > 0) ? ziboGmv! / liveTotalGmv : null,
  };
  const videoMetrics = {
    videoSpent: n(sq?.videoSpent),      // 本地推 短视频全域消耗
    videoGmv:   n(sq?.videoGmv),        // 本地推 短视频全域成交
    videoRoi:   r(sq?.videoRoi),        // 本地推 短视频全域 ROI
  };

  // ── 规则评估（保守措辞；缺失字段不触发）──────────────────────────────────
  const liveFindings: Finding[] = [];
  const videoFindings: Finding[] = [];

  // 直播 1：ROI 较好
  if (liveMetrics.liveRoi != null && liveMetrics.liveSpent != null
      && liveMetrics.liveRoi >= ROI_GOOD && liveMetrics.liveSpent > SPEND_OBS) {
    liveFindings.push({
      level: 'info', priority: 'low', source: 'localAds', code: 'LIVE_HIGH_ROI',
      title: '直播投流 ROI 较好',
      detail: '直播全域 ROI 表现较好且有一定消耗。',
      evidence: [`直播全域消耗 ${yuan(liveMetrics.liveSpent)}`, `直播全域 ROI ${liveMetrics.liveRoi.toFixed(2)}`],
      action: '直播投流表现较好，建议观察是否可小幅测试放量。',
    });
  }
  // 直播 2：ROI 偏低
  if (liveMetrics.liveRoi != null && liveMetrics.liveSpent != null
      && liveMetrics.liveRoi < ROI_LOW && liveMetrics.liveSpent > SPEND_HIGH) {
    liveFindings.push({
      level: 'warn', priority: 'high', source: 'localAds', code: 'LIVE_LOW_ROI',
      title: '直播投流 ROI 偏低',
      detail: '直播全域 ROI 偏低但消耗较高。',
      evidence: [`直播全域消耗 ${yuan(liveMetrics.liveSpent)}`, `直播全域 ROI ${liveMetrics.liveRoi.toFixed(2)}`],
      action: '建议检查直播间承接、商品机制与投放时段。',
    });
  }
  // 直播 3：达播明显高于自播（生意经口径）
  if (daboGmv != null && ziboGmv != null && daboGmv > ziboGmv * 2) {
    liveFindings.push({
      level: 'info', priority: 'medium', source: 'businessCompass', code: 'DABO_OUTPERFORMS_ZIBO',
      title: '达播成交明显高于自播',
      detail: '生意经口径下达人直播成交明显高于自播。',
      evidence: [`达播 GMV ${yuan(daboGmv)}`, `自播 GMV ${yuan(ziboGmv)}`],
      action: '建议优先复盘达人直播间素材、人货场。',
    });
  }

  // 短视频 1：有消耗但无成交（本地推全域口径，与展示一致）
  if (videoMetrics.videoSpent != null && videoMetrics.videoSpent > SPEND_HIGH
      && videoMetrics.videoGmv != null && videoMetrics.videoGmv === 0) {
    videoFindings.push({
      level: 'warn', priority: 'high', source: 'localAds', code: 'VIDEO_SPEND_NO_GMV',
      title: '短视频有消耗但无成交',
      detail: '短视频投放产生消耗，但短视频全域成交为 0。',
      evidence: [`短视频全域消耗 ${yuan(videoMetrics.videoSpent)}`, `短视频全域成交 ¥0`],
      action: '建议检查素材方向、商品承接、团购价格，并降低低效计划预算。',
    });
  }
  // 短视频 2：ROI 较好
  if (videoMetrics.videoRoi != null && videoMetrics.videoSpent != null
      && videoMetrics.videoRoi >= ROI_GOOD && videoMetrics.videoSpent > SPEND_OBS) {
    videoFindings.push({
      level: 'info', priority: 'low', source: 'localAds', code: 'VIDEO_HIGH_ROI',
      title: '短视频投流 ROI 较好',
      detail: '短视频全域 ROI 表现较好且有一定消耗。',
      evidence: [`短视频全域消耗 ${yuan(videoMetrics.videoSpent)}`, `短视频全域 ROI ${videoMetrics.videoRoi.toFixed(2)}`],
      action: '短视频投流 ROI 较好，建议观察是否可小幅测试放量。',
    });
  }
  // 短视频 3：ROI 偏低
  if (videoMetrics.videoRoi != null && videoMetrics.videoSpent != null
      && videoMetrics.videoRoi < ROI_LOW && videoMetrics.videoSpent > SPEND_HIGH) {
    videoFindings.push({
      level: 'warn', priority: 'high', source: 'localAds', code: 'VIDEO_LOW_ROI',
      title: '短视频投流 ROI 偏低',
      detail: '短视频全域 ROI 偏低但消耗较高。',
      evidence: [`短视频全域消耗 ${yuan(videoMetrics.videoSpent)}`, `短视频全域 ROI ${videoMetrics.videoRoi.toFixed(2)}`],
      action: '建议检查素材、定向、人群与商品承接。',
    });
  }

  // ── 顶层 findings：合并 + 按 priority 排序（高→低）──────────────────────
  const findings: Finding[] = [...liveFindings, ...videoFindings]
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  if (!business && !localAds) {
    findings.unshift({
      level: 'info', priority: 'low', source: 'mixed', code: 'NO_DATA_SOURCE',
      title: '暂无可用数据源',
      detail: '未检测到生意经 / 本地推数据（可能未配置 cookie 或该品牌未接入），诊断为空。',
      evidence: [], action: '建议检查数据源配置后再查看诊断。',
    });
  } else if (findings.length === 0) {
    findings.push({
      level: 'info', priority: 'low', source: 'mixed', code: 'NO_RULE_HIT',
      title: '暂无明显风险信号',
      detail: '当前规则未命中明显异常。',
      evidence: [], action: '建议结合 ROI 与渠道结构持续观察。',
    });
  }

  const result = {
    meta: {
      brandId,
      brandName: brand.name,
      date,
      dataDay: ctx.yesterday,          // 实际数据日（= 选择日当天）
      hasBusiness: !!(business && business.srcYday),
      hasLocalAds: !!(localAds && localAds.sqYday),  // 只有 statQuery 真正返回才算已接入（失败/无数据则 false）
      spendScope: 'localads_roi2_quanyu', // 口径标识：本地推 roi2 全域投放
      note: '投放消耗、ROI、直播/短视频全域成交来自巨量本地推全域投放口径；自播/达播 GMV 拆分来自生意经经营口径，仅用于投流诊断参考。',
    },
    spend,
    gmvSplit,
    liveDiagnosis:  { metrics: liveMetrics,  findings: liveFindings },
    videoDiagnosis: { metrics: videoMetrics, findings: videoFindings },
    findings,
  };

  console.log(`[AdDiagnosis] brandId=${brandId} date=${date} done (hasBusiness=${!!business} hasLocalAds=${!!localAds} live=${liveFindings.length} video=${videoFindings.length})`);
  return ok(res, result);
};
