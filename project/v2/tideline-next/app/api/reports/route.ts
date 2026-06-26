// GET  /api/reports                      — 列出已保存日报（摘要）
// GET  /api/reports?id=rpt_xxx            — 取单份已保存日报
// GET  /api/reports?brand=b_x&date=YYYY-MM-DD  — 取该品牌该日日报；无则按当前平台数据生成（未保存）
// POST /api/reports                       — 保存/更新日报（运营编辑后落盘）
//
// 设计：日报结构对齐运营手工表（成交/核销分板块 + 直播明细 + 备注）。
// 平台 statQuery 只覆盖「昨日」全域口径的直播/短视频成交，回填到对应单元格；
// 目标/历史/本月累计/核销等平台无数据，留作可编辑字段，由运营补充后保存。

import { dailyReports, accounts, brandById } from '../../../lib/db';
import { ok, err }            from '../../../lib/api';
import { saveSnapshot }       from '../../../lib/persist';
import { OceanEngineAdapter } from '../../../lib/adapters/oceanengine-adapter';
import { LaikeAdapter }       from '../../../lib/adapters/laike-adapter';
import { BusinessCompassAdapter } from '../../../lib/adapters/business-compass-adapter';
import type { RouteHandler }  from '../../../lib/api';
import type { DailyReport, DailyReportRow, DailyReportLiveBlock } from '../../../types/index';

const ROW_DEFS: Array<{ key: string; label: string }> = [
  { key: 'zibo',  label: '自播' },
  { key: 'dabo',  label: '达播' },
  { key: 'poi',   label: 'POI' },
  { key: 'video', label: '短视频' },
];

function emptyRows(): DailyReportRow[] {
  return ROW_DEFS.map(d => ({ key: d.key, label: d.label, history: null, yesterday: null, month: null, target: null }));
}
// 历史 = 本月 − 昨日（推算回填）。onlyEmpty=true 时仅填补空白行，保留人工录入值。
function fillHistoryRows(rows: DailyReportRow[], onlyEmpty = false): void {
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

// 当月时间进度 %（已过天数 / 当月总天数）
function timeProgressOf(date: string): number {
  const d = new Date(date + 'T00:00:00');
  if (isNaN(d.getTime())) return 0;
  const day = d.getDate();
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.round((day / daysInMonth) * 100);
}

// 北京时间（UTC+8）日期工具
function bjDateStr(date: string, offsetDays = 0): string {
  // 纯日历运算：按 UTC 解析+偏移，避免 +08:00 解析后 toISOString 转回 UTC 造成 off-by-one
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function bjMonthStartStr(date: string): string {
  return date.slice(0, 8) + '01';
}
function sq(dt: string, hms: string) { return `${dt} ${hms}`; }

/** 按品牌+日期生成一份新日报（不落盘）。
 *  数据优先级：statQuery（投放）> 来客成交明细 > 来客经营概览 > 手动待补充。
 *  所有外部调用均 catch 静默，日报始终可生成。
 */
export async function buildReport(brandId: string, date: string): Promise<DailyReport> {
  console.log(`[GenerateReport] brandId=${brandId} date=${date} start`);
  const brand = brandById(brandId);
  const account = accounts.find(a => a.brand === brandId);
  const now = new Date().toISOString();
  const yesterday  = bjDateStr(date, -1);
  const monthStart = bjMonthStartStr(date);
  const poiId = account?.laikePoi ?? account?.externalId ?? '';

  const gmvRows = emptyRows();
  const redeemRows = emptyRows();
  const liveDetail = { zibo: emptyLiveBlock(), dabo: emptyLiveBlock() };
  let seeded = false;
  const sourceLines: string[] = [];

  // ── 1. statQuery 投放全域成交 ────────────────────────────────────────────
  let adSpend: DailyReport['adSpend'] | undefined;
  // 有专属 COOKIE_MAP 或全局 cookie 都尝试拉 statQuery；适配器内部按 COOKIE_MAP/DATASET_MAP 自动选 dataset
  const hasLocalAdsCookieForReport = (() => {
    if (process.env.OCEANENGINE_LOCALADS_COOKIE_MAP && account?.externalId) {
      try {
        const m = JSON.parse(process.env.OCEANENGINE_LOCALADS_COOKIE_MAP) as Record<string, string>;
        if (m[account.externalId]) return true;
      } catch { /* ignore */ }
    }
    return !!process.env.OCEANENGINE_LOCALADS_COOKIE;
  })();
  if (account?.externalId && hasLocalAdsCookieForReport) {
    console.log(`[GenerateReport] localAds advid=${account.externalId} (brandId=${brandId} date=${date})`);
    const [sqYday, sqMonth] = await Promise.all([
      OceanEngineAdapter.fetchHomeRoi2StatQuery(
        account.externalId, sq(yesterday, '00:00:00'), sq(yesterday, '23:59:59'),
      ).catch((e) => { console.warn(`[GenerateReport] statQuery 昨日失败: ${String(e)}`); return null; }),
      OceanEngineAdapter.fetchHomeRoi2StatQuery(
        account.externalId, sq(monthStart, '00:00:00'), sq(date, '23:59:59'),
      ).catch((e) => { console.warn(`[GenerateReport] statQuery 本月失败: ${String(e)}`); return null; }),
    ]);

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
      console.log(`[GenerateReport] localAds advid=${account.externalId} source=${sqYday.source} totalSpent=${adSpend.totalSpent}`);
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
      sourceLines.push(`本月成交（${monthStart}~${date}）：自播 ¥${zibo.month} / 短视频 ¥${video.month}`);
      seeded = true;
    }
  }

  // ── 2. 来客成交明细（coupon_sale_record）─────────────────────────────────
  let laikeSales: DailyReport['laikeSales'] | undefined;
  if (poiId && process.env.LAIKE_COOKIE) {
    const sales = await LaikeAdapter.fetchCouponSaleRecords(poiId, yesterday, yesterday).catch(() => null);
    if (sales) {
      laikeSales = sales;
      sourceLines.push(`来客成交（${yesterday}）：¥${sales.totalGmv} / ${sales.validOrderCount} 单 / 直播 ¥${sales.liveGmv} / 搜索 ¥${sales.searchGmv}`);
      seeded = true;
    }
  }

  // ── 2b. 来客核销明细（coupon_verify_record）→ 核销板块 ────────────────────
  let laikeVerify: DailyReport['laikeVerify'] | undefined;
  if (poiId && process.env.LAIKE_COOKIE) {
    const [vYday, vMonth] = await Promise.all([
      LaikeAdapter.fetchVerifyRecords(poiId, yesterday, yesterday).catch(() => null),
      LaikeAdapter.fetchVerifyRecords(poiId, monthStart, date).catch(() => null),
    ]);
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
  }

  // ── 3. 来客经营概览（data_overview）──────────────────────────────────────
  let laikeOverview: DailyReport['laikeOverview'] | undefined;
  if (poiId && process.env.LAIKE_COOKIE) {
    const ov = await LaikeAdapter.fetchDataOverview(poiId).catch(() => null);
    if (ov) {
      laikeOverview = ov;
      sourceLines.push(`来客经营概览（当前周期）：核销 ¥${ov.verifyAmount} / ${ov.verifyCertCnt} 张`);
      seeded = true;
    }
  }

  // ── 4. 来客经营洞察（data_conclusion）────────────────────────────────────
  let laikeInsight: DailyReport['laikeInsight'] | undefined;
  if (poiId && process.env.LAIKE_COOKIE) {
    const ins = await LaikeAdapter.fetchInsights(poiId, yesterday, date).catch(() => null);
    if (ins) {
      laikeInsight = { ...ins, fetchedAt: now };
      seeded = true;
    }
  }

  // ── 5. 生意经流量成交拆分 / 曝光拆分 / 洞察 ───────────────────────────────
  let businessTrade: DailyReport['businessTrade'] | undefined;
  let businessExposure: DailyReport['businessExposure'] | undefined;
  let businessInsight: DailyReport['businessInsight'] | undefined;
  let businessMarketing: DailyReport['businessMarketing'] | undefined;
  let businessLive: DailyReport['businessLive'] | undefined;

  // 诊断日志：无论条件是否满足都打印，方便排查
  console.log(`[buildReport] pre-check brandId=${brandId} accountId=${account?.id ?? 'none'} poiId="${poiId}" hasBizCookie=${!!process.env.BUSINESS_COMPASS_COOKIE}`);

  const lifeAccountId = account?.lifeAccountId;
  if (poiId && process.env.BUSINESS_COMPASS_COOKIE) {
    // lifeAccountId 最终由 business-compass-adapter 内部按 BUSINESS_COMPASS_LIFE_ACCOUNT_MAP 解析
    console.log(`[GenerateReport] businessCompass poiId=${poiId} lifeAccountId=${lifeAccountId ?? '(from map/env)'} isSingle=? brandId=${brandId} date=${date}`);
    console.log(`[buildReport] 生意经 poiId=${poiId} lifeAccountId=${lifeAccountId ?? '(from map/env)'} yesterday=${yesterday} monthStart=${monthStart} date=${date}`);
    const [trade, exposure, bIns, mktOv, mktTrend, srcYday, srcMonth, liveYday, liveMonth, verYday, verMonth] = await Promise.all([
      BusinessCompassAdapter.fetchTradeSplit(poiId, yesterday, yesterday).catch((e) => { console.error('[buildReport] tradeSplit err', String(e)); return null; }),
      BusinessCompassAdapter.fetchExposureSplit(poiId, yesterday, yesterday).catch((e) => { console.error('[buildReport] exposureSplit err', String(e)); return null; }),
      BusinessCompassAdapter.fetchInsights(poiId, yesterday, date).catch((e) => { console.error('[buildReport] insights err', String(e)); return null; }),
      BusinessCompassAdapter.fetchMarketingOverview(poiId, yesterday, yesterday).catch((e) => { console.error('[buildReport] mktOv err', String(e)); return null; }),
      BusinessCompassAdapter.fetchMarketingTrend(poiId, yesterday, date).catch((e) => { console.error('[buildReport] mktTrend err', String(e)); return null; }),
      // 经营概览 — 官号/达人 GMV 拆分（自播 / 达播）
      BusinessCompassAdapter.fetchPayOrderSourceSplit(poiId, yesterday, yesterday, lifeAccountId).catch((e) => { console.error('[buildReport] srcYday err', String(e)); return null; }),
      BusinessCompassAdapter.fetchPayOrderSourceSplit(poiId, monthStart, date, lifeAccountId).catch((e) => { console.error('[buildReport] srcMonth err', String(e)); return null; }),
      // 直播内容分析 — 场次 / 时长 / 达人数（不再取 GMV）
      BusinessCompassAdapter.fetchLiveAnalysis(poiId, yesterday, yesterday).catch((e) => { console.error('[buildReport] liveYday err', String(e)); return null; }),
      BusinessCompassAdapter.fetchLiveAnalysis(poiId, monthStart, date).catch((e) => { console.error('[buildReport] liveMonth err', String(e)); return null; }),
      // 核销来源拆分 — 自播 / 达播 / POI / 短视频
      BusinessCompassAdapter.fetchVerifyOrderSourceSplit(poiId, yesterday, yesterday, lifeAccountId).catch((e) => { console.error('[buildReport] verYday err', String(e)); return null; }),
      BusinessCompassAdapter.fetchVerifyOrderSourceSplit(poiId, monthStart, date, lifeAccountId).catch((e) => { console.error('[buildReport] verMonth err', String(e)); return null; }),
    ]);
    console.log(`[buildReport] srcYday=${srcYday ? `official=${srcYday.officialLiveGmv} dabo=${srcYday.daboGmv}` : 'null'} srcMonth=${srcMonth ? `official=${srcMonth.officialLiveGmv} dabo=${srcMonth.daboGmv}` : 'null'}`);
    console.log(`[buildReport] liveYday=${liveYday ? `cnt=${liveYday.daboCnt} dur=${liveYday.daboDurationSec}s` : 'null'} liveMonth=${liveMonth ? `cnt=${liveMonth.daboCnt}` : 'null'}`);
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
    timeProgress: timeProgressOf(date),
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
  };

  const daboRow = report.gmvRows.find(r => r.key === 'dabo');
  const ziboRow = report.gmvRows.find(r => r.key === 'zibo');
  console.log(`[ReportAPI] gmvRows self/live = yesterday=${ziboRow?.yesterday} month=${ziboRow?.month}`);
  console.log(`[ReportAPI] gmvRows dabo = yesterday=${daboRow?.yesterday} month=${daboRow?.month}`);
  console.log(`[ReportAPI] businessLive =`, businessLive ? JSON.stringify({ daboGmv: businessLive.daboGmv, monthGmv: (businessLive as any).monthGmv, daboCnt: businessLive.daboCnt, daboDurationSec: businessLive.daboDurationSec }) : 'undefined');
  console.log(`[GenerateReport] brandId=${brandId} date=${date} done (seeded=${seeded} sources=${sourceLines.length})`);

  return report;
}

export const GET: RouteHandler = async (req, res) => {
  const id = (req.query.id ?? '').trim();
  if (id) {
    const found = dailyReports.find(r => r.id === id);
    if (!found) return err(res, `日报 ${id} 不存在`, 404);
    fillHistoryRows(found.gmvRows, true);
    fillHistoryRows(found.redeemRows, true);
    return ok(res, found);
  }

  const brand = (req.query.brand ?? '').trim();
  const date  = (req.query.date ?? '').trim();
  if (brand && date) {
    const saved = dailyReports.find(r => r.brandId === brand && r.date === date);
    if (saved) {
      fillHistoryRows(saved.gmvRows, true);
      fillHistoryRows(saved.redeemRows, true);
      return ok(res, { ...saved, saved: true });
    }
    // 没有已保存的 → 实时生成一份（不落盘），前端编辑后再 POST 保存
    const generated = await buildReport(brand, date);
    return ok(res, { ...generated, saved: false });
  }

  // 列表：按日期倒序返回摘要
  const list = dailyReports
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map(r => ({
      id: r.id, brandId: r.brandId, brandName: r.brandName, date: r.date,
      seeded: r.seeded, updatedAt: r.updatedAt,
      gmvMonth: r.gmvRows.reduce((s, x) => s + (x.month || 0), 0),
      gmvTarget: r.gmvRows.reduce((s, x) => s + (x.target || 0), 0),
    }));
  return ok(res, list);
};

export const POST: RouteHandler = async (req, res) => {
  const body = req.body as Partial<DailyReport>;
  if (!body || !body.brandId || !body.date) {
    return err(res, 'brandId 和 date 为必填项');
  }
  const now = new Date().toISOString();
  const id = `rpt_${body.brandId}_${body.date}`;
  const existingIdx = dailyReports.findIndex(r => r.id === id);

  const base = existingIdx >= 0 ? dailyReports[existingIdx] : await buildReport(body.brandId, body.date);
  const merged: DailyReport = {
    ...base,
    ...body,
    id,
    source: 'manual',
    updatedAt: now,
  } as DailyReport;
  if (existingIdx >= 0) dailyReports[existingIdx] = merged;
  else dailyReports.push(merged);

  saveSnapshot();
  return ok(res, merged);
};
