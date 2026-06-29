// 日报数据流水线（轻量封装）
// ─────────────────────────────────────────────────────────────────────────────
// 把原 app/api/reports/route.ts 的 buildReport 拆成可复用的小函数，便于：
//   · 「生成日报」按钮      → generateReportForBrand()
//   · 「投流诊断」工作流    → 复用 buildReportContext() + fetchBusinessCompassForBrand()
//   · 定时 / 批量任务       → 循环调用 generateReportForBrand()
//
// 设计原则（与原实现一致）：
//   · 所有外部调用 try/catch 静默 → 返回 null，日报始终可生成；
//   · 数据优先级：statQuery（投放）> 生意经覆盖 > 来客成交/核销 > 手动待补充；
//   · lifeAccountId 最终由 business-compass-adapter 内部按 LIFE_ACCOUNT_MAP 解析；
//   · 不在此处读取/落地任何 cookie、msToken、a_bogus（仅 process.env，绝不入库）。

import { dailyReports, accounts, brandById } from '../db';
import { saveSnapshot }       from '../persist';
import { OceanEngineAdapter } from '../adapters/oceanengine-adapter';
import { LaikeAdapter }       from '../adapters/laike-adapter';
import { BusinessCompassAdapter } from '../adapters/business-compass-adapter';
import type { DailyReport, DailyReportRow, DailyReportLiveBlock } from '../../types/index';

// ─── 行定义 / 空模板 ─────────────────────────────────────────────────────────
const ROW_DEFS: Array<{ key: string; label: string }> = [
  { key: 'zibo',  label: '自播' },
  { key: 'dabo',  label: '达播' },
  { key: 'poi',   label: 'POI' },
  { key: 'video', label: '短视频' },
];

export function emptyRows(): DailyReportRow[] {
  return ROW_DEFS.map(d => ({ key: d.key, label: d.label, history: null, yesterday: null, month: null, target: null }));
}
// 历史 = 本月 − 昨日（推算回填）。onlyEmpty=true 时仅填补空白行，保留人工录入值。
export function fillHistoryRows(rows: DailyReportRow[], onlyEmpty = false): void {
  for (const r of rows) {
    if (onlyEmpty && r.history != null) continue;  // 保留已有（手动/已存）历史值
    if (r.month == null) continue;                 // 本月无数据则不推算，保持「待补充」
    const hist = Math.round(r.month - (r.yesterday ?? 0));
    r.history = hist < 0 ? 0 : hist;
    r.src = { ...r.src, history: 'derived' };
  }
}
function emptyLiveBlock(): DailyReportLiveBlock {
  const col = () => ({ sessions: null, gmv: null, duration: null });
  return { history: col(), yesterday: col(), month: col() };
}

// ─── 日期工具（北京时间 UTC+8） ──────────────────────────────────────────────
function timeProgressOf(date: string): number {
  const d = new Date(date + 'T00:00:00');
  if (isNaN(d.getTime())) return 0;
  const day = d.getDate();
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.round((day / daysInMonth) * 100);
}
function bjDateStr(date: string, offsetDays = 0): string {
  // 纯日历运算：按 UTC 解析+偏移，避免 +08:00 解析后 toISOString 转回 UTC 造成 off-by-one
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function bjMonthStartStr(date: string): string {
  return date.slice(0, 8) + '01';
}
/** 北京时（UTC+8）今天 YYYY-MM-DD —— endpoint date 缺省时使用 */
export function bjToday(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
function sq(dt: string, hms: string) { return `${dt} ${hms}`; }

// ─── 共享上下文 ──────────────────────────────────────────────────────────────
// 一次解析品牌/账户/日期口径，供各 fetcher 与 merge 复用（也供投流诊断工作流复用）。
export interface ReportContext {
  brandId: string;
  date: string;          // 选择日（今天）
  yesterday: string;     // 数据日 = date − 1
  monthStart: string;    // 本月口径锚定 yesterday（避免把未结算的今天算进本月）
  poiId: string;         // 生意经 poiId / 来客 poiId（laikePoi ?? externalId）
  account: ReturnType<typeof findAccount>;
  brand: ReturnType<typeof brandById>;
  lifeAccountId?: string;
}

function findAccount(brandId: string) {
  return accounts.find(a => a.brand === brandId);
}

export function buildReportContext(brandId: string, date: string): ReportContext {
  const brand = brandById(brandId);
  const account = findAccount(brandId);
  const yesterday  = bjDateStr(date, -1);
  const monthStart = bjMonthStartStr(yesterday);
  const poiId = account?.laikePoi ?? account?.externalId ?? '';
  return { brandId, date, yesterday, monthStart, poiId, account, brand, lifeAccountId: account?.lifeAccountId };
}

// ─── 各数据源原始结果（merge 前的中间结构）──────────────────────────────────
export interface LocalAdsSources {
  sqYday: Awaited<ReturnType<typeof OceanEngineAdapter.fetchHomeRoi2StatQuery>> | null;
  sqMonth: Awaited<ReturnType<typeof OceanEngineAdapter.fetchHomeRoi2StatQuery>> | null;
}
export interface LaikeSources {
  sales:   Awaited<ReturnType<typeof LaikeAdapter.fetchCouponSaleRecords>> | null;
  vYday:   Awaited<ReturnType<typeof LaikeAdapter.fetchVerifyRecords>> | null;
  vMonth:  Awaited<ReturnType<typeof LaikeAdapter.fetchVerifyRecords>> | null;
  overview:Awaited<ReturnType<typeof LaikeAdapter.fetchDataOverview>> | null;
  insight: Awaited<ReturnType<typeof LaikeAdapter.fetchInsights>> | null;
}
export interface BusinessCompassSources {
  trade:    Awaited<ReturnType<typeof BusinessCompassAdapter.fetchTradeSplit>> | null;
  exposure: Awaited<ReturnType<typeof BusinessCompassAdapter.fetchExposureSplit>> | null;
  bIns:     Awaited<ReturnType<typeof BusinessCompassAdapter.fetchInsights>> | null;
  mktOv:    Awaited<ReturnType<typeof BusinessCompassAdapter.fetchMarketingOverview>> | null;
  mktTrend: Awaited<ReturnType<typeof BusinessCompassAdapter.fetchMarketingTrend>> | null;
  srcYday:  Awaited<ReturnType<typeof BusinessCompassAdapter.fetchPayOrderSourceSplit>> | null;
  srcMonth: Awaited<ReturnType<typeof BusinessCompassAdapter.fetchPayOrderSourceSplit>> | null;
  liveYday: Awaited<ReturnType<typeof BusinessCompassAdapter.fetchLiveAnalysis>> | null;
  liveMonth:Awaited<ReturnType<typeof BusinessCompassAdapter.fetchLiveAnalysis>> | null;
  verYday:  Awaited<ReturnType<typeof BusinessCompassAdapter.fetchVerifyOrderSourceSplit>> | null;
  verMonth: Awaited<ReturnType<typeof BusinessCompassAdapter.fetchVerifyOrderSourceSplit>> | null;
}
export interface ReportSources {
  localAds: LocalAdsSources | null;
  laike: LaikeSources | null;
  business: BusinessCompassSources | null;
}

// ── 1. 本地推 statQuery（全域投放成交）───────────────────────────────────────
export async function syncLocalAdsForBrand(ctx: ReportContext): Promise<LocalAdsSources | null> {
  const { account, brandId, date, yesterday, monthStart } = ctx;
  // 有专属 COOKIE_MAP 或全局 cookie 都尝试拉 statQuery；适配器内部按 COOKIE_MAP/DATASET_MAP 自动选 dataset
  const hasCookie = (() => {
    if (process.env.OCEANENGINE_LOCALADS_COOKIE_MAP && account?.externalId) {
      try {
        const m = JSON.parse(process.env.OCEANENGINE_LOCALADS_COOKIE_MAP) as Record<string, string>;
        if (m[account.externalId]) return true;
      } catch { /* ignore */ }
    }
    return !!process.env.OCEANENGINE_LOCALADS_COOKIE;
  })();
  if (!account?.externalId || !hasCookie) return null;

  console.log(`[GenerateReport] localAds advid=${account.externalId} (brandId=${brandId} date=${date})`);
  const [sqYday, sqMonth] = await Promise.all([
    OceanEngineAdapter.fetchHomeRoi2StatQuery(
      account.externalId, sq(yesterday, '00:00:00'), sq(yesterday, '23:59:59'),
    ).catch((e) => { console.warn(`[GenerateReport] statQuery 昨日失败: ${String(e)}`); return null; }),
    OceanEngineAdapter.fetchHomeRoi2StatQuery(
      account.externalId, sq(monthStart, '00:00:00'), sq(yesterday, '23:59:59'),
    ).catch((e) => { console.warn(`[GenerateReport] statQuery 本月失败: ${String(e)}`); return null; }),
  ]);
  return { sqYday, sqMonth };
}

// ── 2. 来客（成交明细 + 核销明细 + 经营概览 + 经营洞察）──────────────────────
// 注：原 buildReport 中 fetchLaikeVerifyForBrand 仅覆盖核销；这里聚合来客全部接口，
//     单独需要核销时取返回值的 { vYday, vMonth } 即可。
export async function fetchLaikeForBrand(ctx: ReportContext): Promise<LaikeSources | null> {
  const { poiId, yesterday, monthStart, date } = ctx;
  if (!poiId || !process.env.LAIKE_COOKIE) return null;
  const [sales, vYday, vMonth, overview, insight] = await Promise.all([
    LaikeAdapter.fetchCouponSaleRecords(poiId, yesterday, yesterday).catch(() => null),
    LaikeAdapter.fetchVerifyRecords(poiId, yesterday, yesterday).catch(() => null),
    LaikeAdapter.fetchVerifyRecords(poiId, monthStart, date).catch(() => null),
    LaikeAdapter.fetchDataOverview(poiId).catch(() => null),
    LaikeAdapter.fetchInsights(poiId, yesterday, date).catch(() => null),
  ]);
  return { sales, vYday, vMonth, overview, insight };
}

// ── 3. 生意经（流量成交 / 曝光 / 洞察 / 营销 / 来源拆分 / 直播 / 核销拆分）─────
// 投流诊断工作流可直接调用本函数拿到生意经全量原始数据。
export async function fetchBusinessCompassForBrand(ctx: ReportContext): Promise<BusinessCompassSources | null> {
  const { poiId, brandId, date, yesterday, monthStart, lifeAccountId, account } = ctx;
  console.log(`[buildReport] pre-check brandId=${brandId} accountId=${account?.id ?? 'none'} poiId="${poiId}" hasBizCookie=${!!process.env.BUSINESS_COMPASS_COOKIE}`);
  if (!poiId || !process.env.BUSINESS_COMPASS_COOKIE) return null;

  console.log(`[GenerateReport] businessCompass poiId=${poiId} lifeAccountId=${lifeAccountId ?? '(from map/env)'} isSingle=? brandId=${brandId} date=${date}`);
  console.log(`[buildReport] 生意经 poiId=${poiId} lifeAccountId=${lifeAccountId ?? '(from map/env)'} yesterday=${yesterday} monthStart=${monthStart} date=${date}`);
  const [trade, exposure, bIns, mktOv, mktTrend, srcYday, srcMonth, liveYday, liveMonth, verYday, verMonth] = await Promise.all([
    BusinessCompassAdapter.fetchTradeSplit(poiId, yesterday, yesterday).catch((e) => { console.error('[buildReport] tradeSplit err', String(e)); return null; }),
    BusinessCompassAdapter.fetchExposureSplit(poiId, yesterday, yesterday).catch((e) => { console.error('[buildReport] exposureSplit err', String(e)); return null; }),
    BusinessCompassAdapter.fetchInsights(poiId, yesterday, yesterday).catch((e) => { console.error('[buildReport] insights err', String(e)); return null; }),
    BusinessCompassAdapter.fetchMarketingOverview(poiId, yesterday, yesterday).catch((e) => { console.error('[buildReport] mktOv err', String(e)); return null; }),
    BusinessCompassAdapter.fetchMarketingTrend(poiId, monthStart, yesterday).catch((e) => { console.error('[buildReport] mktTrend err', String(e)); return null; }),
    // 经营概览 — 官号/达人 GMV 拆分（自播 / 达播）
    BusinessCompassAdapter.fetchPayOrderSourceSplit(poiId, yesterday, yesterday, lifeAccountId).catch((e) => { console.error('[buildReport] srcYday err', String(e)); return null; }),
    BusinessCompassAdapter.fetchPayOrderSourceSplit(poiId, monthStart, yesterday, lifeAccountId).catch((e) => { console.error('[buildReport] srcMonth err', String(e)); return null; }),
    // 直播内容分析 — 场次 / 时长 / 达人数（不再取 GMV）
    BusinessCompassAdapter.fetchLiveAnalysis(poiId, yesterday, yesterday).catch((e) => { console.error('[buildReport] liveYday err', String(e)); return null; }),
    BusinessCompassAdapter.fetchLiveAnalysis(poiId, monthStart, yesterday).catch((e) => { console.error('[buildReport] liveMonth err', String(e)); return null; }),
    // 核销来源拆分 — 自播 / 达播 / POI / 短视频
    BusinessCompassAdapter.fetchVerifyOrderSourceSplit(poiId, yesterday, yesterday, lifeAccountId).catch((e) => { console.error('[buildReport] verYday err', String(e)); return null; }),
    BusinessCompassAdapter.fetchVerifyOrderSourceSplit(poiId, monthStart, yesterday, lifeAccountId).catch((e) => { console.error('[buildReport] verMonth err', String(e)); return null; }),
  ]);
  console.log(`[buildReport] srcYday=${srcYday ? `official=${srcYday.officialLiveGmv} dabo=${srcYday.daboGmv}` : 'null'} srcMonth=${srcMonth ? `official=${srcMonth.officialLiveGmv} dabo=${srcMonth.daboGmv}` : 'null'}`);
  console.log(`[buildReport] liveYday=${liveYday ? `cnt=${liveYday.daboCnt} dur=${liveYday.daboDurationSec}s` : 'null'} liveMonth=${liveMonth ? `cnt=${liveMonth.daboCnt}` : 'null'}`);
  return { trade, exposure, bIns, mktOv, mktTrend, srcYday, srcMonth, liveYday, liveMonth, verYday, verMonth };
}

// ── 4. 合并：把各数据源原始结果汇总成一份 DailyReport（不落盘）─────────────────
export function mergeDailyReportData(ctx: ReportContext, sources: ReportSources): DailyReport {
  const { brandId, date, yesterday, monthStart, account, brand } = ctx;
  const now = new Date().toISOString();
  const { localAds, laike, business } = sources;

  const gmvRows = emptyRows();
  const redeemRows = emptyRows();
  const liveDetail = { zibo: emptyLiveBlock(), dabo: emptyLiveBlock() };
  let seeded = false;
  const sourceLines: string[] = [];

  // ── 1. statQuery 投放全域成交 ────────────────────────────────────────────
  let adSpend: DailyReport['adSpend'] | undefined;
  if (localAds) {
    const { sqYday, sqMonth } = localAds;
    if (sqYday) {
      const zibo  = gmvRows.find(r => r.key === 'zibo')!;
      const video = gmvRows.find(r => r.key === 'video')!;
      zibo.yesterday  = Math.round(sqYday.liveGmv  || 0);
      video.yesterday = Math.round(sqYday.videoGmv || 0);
      zibo.src = { ...zibo.src,  yesterday: 'platform' };
      video.src = { ...video.src, yesterday: 'platform' };
      liveDetail.zibo.yesterday.gmv = Math.round(sqYday.liveGmv || 0);
      adSpend = {
        totalSpent: Math.round(sqYday.spent || 0),
        liveSpent:  Math.round(sqYday.liveSpent || 0),
        videoSpent: Math.round(sqYday.videoSpent || 0),
        liveRoi:    sqYday.liveRoi || 0,
        videoRoi:   sqYday.videoRoi || 0,
        period: `${yesterday} 全天`,
        source: sqYday.source as DailyReport['adSpend']['source'],
      };
      console.log(`[GenerateReport] localAds advid=${account?.externalId} source=${sqYday.source} totalSpent=${adSpend.totalSpent}`);
      sourceLines.push(`投放消耗（${yesterday}）：全域 ¥${adSpend.totalSpent} / 直播 ¥${adSpend.liveSpent} / 短视频 ¥${adSpend.videoSpent}`);
      seeded = true;
    }
    if (sqMonth) {
      const zibo  = gmvRows.find(r => r.key === 'zibo')!;
      const video = gmvRows.find(r => r.key === 'video')!;
      zibo.month  = Math.round(sqMonth.liveGmv  || 0);
      video.month = Math.round(sqMonth.videoGmv || 0);
      zibo.src  = { ...zibo.src,  month: 'platform' };
      video.src = { ...video.src, month: 'platform' };
      liveDetail.zibo.month.gmv = Math.round(sqMonth.liveGmv || 0);
      // 注意：本月成交提示行不在此 push，移到生意经覆盖之后，确保口径与下方表格一致
      seeded = true;
    }
  }

  // ── 2. 来客成交明细（coupon_sale_record）─────────────────────────────────
  let laikeSales: DailyReport['laikeSales'] | undefined;
  let laikeVerify: DailyReport['laikeVerify'] | undefined;
  let laikeOverview: DailyReport['laikeOverview'] | undefined;
  let laikeInsight: DailyReport['laikeInsight'] | undefined;
  if (laike) {
    const { sales, vYday, vMonth, overview, insight } = laike;
    if (sales) {
      laikeSales = sales;
      sourceLines.push(`来客成交（${yesterday}）：¥${sales.totalGmv} / ${sales.validOrderCount} 单 / 直播 ¥${sales.liveGmv} / 搜索 ¥${sales.searchGmv}`);
      seeded = true;
    }
    // ── 2b. 来客核销明细（coupon_verify_record）→ 核销板块 ────────────────────
    if (vYday || vMonth) {
      laikeVerify = {
        yesterdayAmount:         vYday?.verifyAmount        ?? null,
        yesterdayMerchantAmount: vYday?.merchantAmount      ?? null,
        yesterdayOrderCnt:       vYday?.verifyOrderCnt      ?? null,
        monthAmount:             vMonth?.verifyAmount       ?? null,
        monthMerchantAmount:     vMonth?.merchantAmount     ?? null,
        monthOrderCnt:           vMonth?.verifyOrderCnt     ?? null,
        fetchedAt: now,
      };
      // 回填「核销板块」自播行（核销口径暂不区分达播，先填自播/合计行）
      const rZibo = redeemRows.find(r => r.key === 'zibo');
      if (rZibo) {
        if (vYday) { rZibo.yesterday = vYday.verifyAmount; rZibo.src = { ...rZibo.src, yesterday: 'laike_sales' }; }
        if (vMonth) { rZibo.month = vMonth.verifyAmount; rZibo.src = { ...rZibo.src, month: 'laike_sales' }; }
      }
      const vy = vYday ? `昨日 ¥${vYday.verifyAmount}/${vYday.verifyOrderCnt}单` : '';
      const vm = vMonth ? `本月 ¥${vMonth.verifyAmount}/${vMonth.verifyOrderCnt}单` : '';
      sourceLines.push(`来客核销（${[vy, vm].filter(Boolean).join('，')}）`);
      seeded = true;
    }
    // ── 3. 来客经营概览（data_overview）──────────────────────────────────────
    if (overview) {
      laikeOverview = overview;
      sourceLines.push(`来客经营概览（当前周期）：核销 ¥${overview.verifyAmount} / ${overview.verifyCertCnt} 张`);
      seeded = true;
    }
    // ── 4. 来客经营洞察（data_conclusion）────────────────────────────────────
    if (insight) {
      laikeInsight = { ...insight, fetchedAt: now };
      seeded = true;
    }
  }

  // ── 5. 生意经流量成交拆分 / 曝光拆分 / 洞察 ───────────────────────────────
  let businessTrade: DailyReport['businessTrade'] | undefined;
  let businessExposure: DailyReport['businessExposure'] | undefined;
  let businessInsight: DailyReport['businessInsight'] | undefined;
  let businessMarketing: DailyReport['businessMarketing'] | undefined;
  let businessLive: DailyReport['businessLive'] | undefined;

  if (business) {
    const { trade, exposure, bIns, mktOv, mktTrend, srcYday, srcMonth, liveYday, liveMonth, verYday, verMonth } = business;
    if (trade) {
      businessTrade = trade;
      sourceLines.push(`生意经流量成交（${yesterday}）：直播渠道 ¥${trade.liveGmv} / 视频渠道 ¥${trade.videoGmv} / 搜索场景 ¥${trade.searchSceneGmv}`);
      seeded = true;
    }
    if (exposure) {
      businessExposure = exposure;
      seeded = true;
    }
    if (bIns) {
      businessInsight = { ...bIns, fetchedAt: now };
      seeded = true;
    }
    if (mktOv) {
      businessMarketing = { ...mktOv, trend: mktTrend ?? [] };
      sourceLines.push(`生意经营销成交（${yesterday}）：营销成交 ¥${mktOv.couponPayGmv} / 平台补贴 ¥${mktOv.platAmt} / 商家补贴 ¥${mktOv.merAmt}`);
      seeded = true;
    }
    // ── 生意经来源拆分：达播（达人）+ 自播（官号）GMV ────────────────────────
    if (srcYday || srcMonth || liveYday || liveMonth) {
      const dabo = gmvRows.find(r => r.key === 'dabo')!;

      // 达播 GMV（达人直播）
      if (srcYday) {
        dabo.yesterday = Math.round(srcYday.daboGmv);
        dabo.src = { ...dabo.src, yesterday: 'platform' };
        liveDetail.dabo.yesterday.gmv = Math.round(srcYday.daboGmv);
      }
      if (srcMonth) {
        dabo.month = Math.round(srcMonth.daboGmv);
        dabo.src = { ...dabo.src, month: 'platform' };
        liveDetail.dabo.month.gmv = Math.round(srcMonth.daboGmv);
      }
      // 直播场次 / 时长来自 fetchLiveAnalysis（measureDataV2）
      if (liveYday) {
        liveDetail.dabo.yesterday.sessions = liveYday.daboCnt   || null;
        liveDetail.dabo.yesterday.duration = liveYday.daboDurationSec
          ? Math.round(liveYday.daboDurationSec / 3600 * 10) / 10  // 秒→小时
          : null;
      }
      if (liveMonth) {
        liveDetail.dabo.month.sessions = liveMonth.daboCnt   || null;
        liveDetail.dabo.month.duration = liveMonth.daboDurationSec
          ? Math.round(liveMonth.daboDurationSec / 3600 * 10) / 10
          : null;
      }

      const liveBase = liveYday ?? liveMonth;
      businessLive = {
        daboGmv:       srcYday?.daboGmv       ?? 0,
        daboCnt:       liveYday?.daboCnt       ?? 0,
        daboDurationSec: liveYday?.daboDurationSec ?? 0,
        authorCnt:     liveYday?.authorCnt     ?? 0,
        verifyAmount:  0,
        verifyCertCnt: 0,
        rooms:         liveBase?.rooms         ?? [],
        dailyTrend:    liveBase?.dailyTrend    ?? [],
        fetchedAt:     new Date().toISOString(),
        ...(srcMonth ? {
          monthGmv:         Math.round(srcMonth.daboGmv),
          monthCnt:         liveMonth?.daboCnt         ?? 0,
          monthDurationSec: liveMonth?.daboDurationSec ?? 0,
          monthAuthorCnt:   liveMonth?.authorCnt       ?? 0,
        } : {}),
      };

      const yd = srcYday  ? `昨日达播 ¥${srcYday.daboGmv} / 自播 ¥${srcYday.officialLiveGmv}` : '';
      const mo = srcMonth ? `本月达播 ¥${srcMonth.daboGmv} / 自播 ¥${srcMonth.officialLiveGmv}` : '';
      sourceLines.push(`生意经经营概览（${[yd, mo].filter(Boolean).join('，')}）`);
      seeded = true;
    }

    // 生意经自播（官号直播）— 覆盖 OceanEngine statQuery 的 liveGmv
    if (srcYday || srcMonth) {
      const zibo = gmvRows.find(r => r.key === 'zibo')!;
      if (srcYday) {
        zibo.yesterday = Math.round(srcYday.officialLiveGmv);
        zibo.src = { ...zibo.src, yesterday: 'platform' };
        liveDetail.zibo.yesterday.gmv = Math.round(srcYday.officialLiveGmv);
      }
      if (srcMonth) {
        zibo.month = Math.round(srcMonth.officialLiveGmv);
        zibo.src = { ...zibo.src, month: 'platform' };
        liveDetail.zibo.month.gmv = Math.round(srcMonth.officialLiveGmv);
      }
    }

    // 生意经 POI 成交（获客卡 + 搜索结果卡 + 其他）
    if (srcYday || srcMonth) {
      const poi = gmvRows.find(r => r.key === 'poi')!;
      if (srcYday) {
        poi.yesterday = Math.round(srcYday.poiGmv);
        poi.src = { ...poi.src, yesterday: 'platform' };
      }
      if (srcMonth) {
        poi.month = Math.round(srcMonth.poiGmv);
        poi.src = { ...poi.src, month: 'platform' };
      }
    }

    // 生意经短视频成交 — 覆盖 OceanEngine statQuery 的 videoGmv（口径以生意经为准）
    if (srcYday || srcMonth) {
      const video = gmvRows.find(r => r.key === 'video')!;
      if (srcYday) {
        video.yesterday = Math.round(srcYday.videoTotalGmv);
        video.src = { ...video.src, yesterday: 'platform' };
      }
      if (srcMonth) {
        video.month = Math.round(srcMonth.videoTotalGmv);
        video.src = { ...video.src, month: 'platform' };
      }
    }

    // ── 核销来源拆分：自播 / 达播 / POI / 短视频 ─────────────────────────────
    if (verYday || verMonth) {
      const rZibo  = redeemRows.find(r => r.key === 'zibo')!;
      const rDabo  = redeemRows.find(r => r.key === 'dabo')!;
      const rPoi   = redeemRows.find(r => r.key === 'poi')!;
      const rVideo = redeemRows.find(r => r.key === 'video')!;
      if (verYday) {
        rZibo.yesterday  = Math.round(verYday.officialLiveGmv);  rZibo.src  = { ...rZibo.src,  yesterday: 'platform' };
        rDabo.yesterday  = Math.round(verYday.daboGmv);          rDabo.src  = { ...rDabo.src,  yesterday: 'platform' };
        rPoi.yesterday   = Math.round(verYday.poiGmv);           rPoi.src   = { ...rPoi.src,   yesterday: 'platform' };
        rVideo.yesterday = Math.round(verYday.videoTotalGmv);    rVideo.src = { ...rVideo.src, yesterday: 'platform' };
      }
      if (verMonth) {
        rZibo.month  = Math.round(verMonth.officialLiveGmv);  rZibo.src  = { ...rZibo.src,  month: 'platform' };
        rDabo.month  = Math.round(verMonth.daboGmv);          rDabo.src  = { ...rDabo.src,  month: 'platform' };
        rPoi.month   = Math.round(verMonth.poiGmv);           rPoi.src   = { ...rPoi.src,   month: 'platform' };
        rVideo.month = Math.round(verMonth.videoTotalGmv);    rVideo.src = { ...rVideo.src, month: 'platform' };
      }
      const vy = verYday  ? `昨日核销 自播 ¥${verYday.officialLiveGmv.toFixed(0)} / 达播 ¥${verYday.daboGmv.toFixed(0)} / POI ¥${verYday.poiGmv.toFixed(0)} / 短视频 ¥${verYday.videoTotalGmv.toFixed(0)}` : '';
      const vm = verMonth ? `本月核销 自播 ¥${verMonth.officialLiveGmv.toFixed(0)} / 达播 ¥${verMonth.daboGmv.toFixed(0)} / POI ¥${verMonth.poiGmv.toFixed(0)}` : '';
      sourceLines.push(`生意经核销概览（${[vy, vm].filter(Boolean).join('，')}）`);
      seeded = true;
    }
  }

  // ── 本月成交提示行：用最终表格口径（生意经优先覆盖 statQuery）─────────────────
  // 放在所有数据源覆盖之后，避免顶部提示条与下方成交表自相矛盾（自播/短视频曾出现两套口径）
  {
    const zibo  = gmvRows.find(r => r.key === 'zibo')!;
    const dabo  = gmvRows.find(r => r.key === 'dabo')!;
    const poi   = gmvRows.find(r => r.key === 'poi')!;
    const video = gmvRows.find(r => r.key === 'video')!;
    const hasMonth = [zibo, dabo, poi, video].some(r => r.src?.month === 'platform');
    if (hasMonth) {
      sourceLines.push(`本月成交（${monthStart}~${yesterday}）：自播 ¥${zibo.month} / 达播 ¥${dabo.month} / POI ¥${poi.month} / 短视频 ¥${video.month}`);
    }
  }

  // ── 历史GMV/历史核销 = 本月 - 昨日（推算回填，覆盖每个品牌的成交/核销分板块）──
  fillHistoryRows(gmvRows);
  fillHistoryRows(redeemRows);

  const seedNote = sourceLines.length
    ? `自动回填：${sourceLines.join('；')}。核销明细如平台无接口，请手动补充。`
    : '未检测到可用的平台数据接口（未配置 statQuery Cookie 或 Laike Cookie）。所有字段为空，请手动填写。';

  const report = {
    id: `rpt_${brandId}_${date}`,
    brandId,
    brandName: brand?.name || (account?.name ?? brandId),
    accountExternalId: account?.externalId,
    date,
    timeProgress: timeProgressOf(yesterday),
    gmvRows,
    redeemRows,
    liveDetail,
    notes: { dabo: '', official: '', officialVideo: '' },
    seeded,
    seedNote,
    source: 'platform',
    createdAt: now,
    updatedAt: now,
    ...(adSpend     ? { adSpend }     : {}),
    ...(laikeSales  ? { laikeSales }  : {}),
    ...(laikeVerify ? { laikeVerify } : {}),
    ...(laikeOverview ? { laikeOverview } : {}),
    ...(laikeInsight  ? { laikeInsight }  : {}),
    ...(businessTrade     ? { businessTrade }     : {}),
    ...(businessExposure  ? { businessExposure }  : {}),
    ...(businessInsight   ? { businessInsight }   : {}),
    ...(businessMarketing ? { businessMarketing } : {}),
    ...(businessLive      ? { businessLive }      : {}),
  } as DailyReport;

  const daboRow = report.gmvRows.find(r => r.key === 'dabo');
  const ziboRow = report.gmvRows.find(r => r.key === 'zibo');
  console.log(`[ReportAPI] gmvRows self/live = yesterday=${ziboRow?.yesterday} month=${ziboRow?.month}`);
  console.log(`[ReportAPI] gmvRows dabo = yesterday=${daboRow?.yesterday} month=${daboRow?.month}`);
  console.log(`[ReportAPI] businessLive =`, businessLive ? JSON.stringify({ daboGmv: businessLive.daboGmv, monthGmv: (businessLive as any).monthGmv, daboCnt: businessLive.daboCnt, daboDurationSec: businessLive.daboDurationSec }) : 'undefined');
  console.log(`[GenerateReport] brandId=${brandId} date=${date} done (seeded=${seeded} sources=${sourceLines.length})`);

  return report;
}

// ── 编排：按品牌+日期生成一份新日报（不落盘）─────────────────────────────────
// 数据优先级：statQuery（投放）> 来客成交明细 > 来客经营概览 > 手动待补充。
// 所有外部调用均 catch 静默，日报始终可生成。
export async function generateReportForBrand(brandId: string, date: string): Promise<DailyReport> {
  console.log(`[GenerateReport] brandId=${brandId} date=${date} start`);
  const ctx = buildReportContext(brandId, date);
  const [localAds, laike, business] = await Promise.all([
    syncLocalAdsForBrand(ctx),
    fetchLaikeForBrand(ctx),
    fetchBusinessCompassForBrand(ctx),
  ]);
  return mergeDailyReportData(ctx, { localAds, laike, business });
}

// ── 落盘：upsert 到 dailyReports 并持久化快照 ────────────────────────────────
export function saveDailyReport(report: DailyReport): DailyReport {
  const idx = dailyReports.findIndex(r => r.id === report.id);
  if (idx >= 0) dailyReports[idx] = report;
  else dailyReports.push(report);
  saveSnapshot();
  return report;
}
