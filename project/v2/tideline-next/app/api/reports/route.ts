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
  const d = new Date(date + 'T00:00:00+08:00');
  d.setDate(d.getDate() + offsetDays);
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
  if (account?.externalId && process.env.OCEANENGINE_LOCALADS_COOKIE) {
    const [sqYday, sqMonth] = await Promise.all([
      OceanEngineAdapter.fetchHomeRoi2StatQuery(
        account.externalId, sq(yesterday, '00:00:00'), sq(yesterday, '23:59:59'),
      ).catch(() => null),
      OceanEngineAdapter.fetchHomeRoi2StatQuery(
        account.externalId, sq(monthStart, '00:00:00'), sq(date, '23:59:59'),
      ).catch(() => null),
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
        source: 'statQuery_pc_home_roi2',
      };
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
  if (poiId && process.env.BUSINESS_COMPASS_COOKIE) {
    const [trade, exposure, bIns, mktOv, mktTrend, liveA] = await Promise.all([
      BusinessCompassAdapter.fetchTradeSplit(poiId, yesterday, yesterday).catch(() => null),
      BusinessCompassAdapter.fetchExposureSplit(poiId, yesterday, yesterday).catch(() => null),
      BusinessCompassAdapter.fetchInsights(poiId, yesterday, date).catch(() => null),
      BusinessCompassAdapter.fetchMarketingOverview(poiId, yesterday, yesterday).catch(() => null),
      BusinessCompassAdapter.fetchMarketingTrend(poiId, yesterday, date).catch(() => null),
      BusinessCompassAdapter.fetchLiveAnalysis(poiId, yesterday, yesterday).catch(() => null),
    ]);
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
    if (liveA) {
      businessLive = liveA;
      const dabo = gmvRows.find(r => r.key === 'dabo')!;
      dabo.yesterday = Math.round(liveA.daboGmv);
      dabo.src = { ...dabo.src, yesterday: 'platform' };
      liveDetail.dabo.yesterday.gmv = Math.round(liveA.daboGmv);
      liveDetail.dabo.yesterday.sessions = liveA.daboCnt || null;
      liveDetail.dabo.yesterday.duration = liveA.daboDurationSec || null;
      sourceLines.push(`生意经达播（${yesterday}）：GMV ¥${liveA.daboGmv} / ${liveA.daboCnt} 场 / 时长 ${Math.round(liveA.daboDurationSec / 60)} 分钟 / ${liveA.authorCnt} 达人`);
      seeded = true;
    }
  }

  const seedNote = sourceLines.length
    ? `自动回填：${sourceLines.join('；')}。达播/POI、核销明细、直播场次/时长平台无接口，请手动补充。`
    : '未检测到可用的平台数据接口（未配置 statQuery Cookie 或 Laike Cookie）。所有字段为空，请手动填写。';

  return {
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
}

export const GET: RouteHandler = async (req, res) => {
  const id = (req.query.id ?? '').trim();
  if (id) {
    const found = dailyReports.find(r => r.id === id);
    if (!found) return err(res, `日报 ${id} 不存在`, 404);
    return ok(res, found);
  }

  const brand = (req.query.brand ?? '').trim();
  const date  = (req.query.date ?? '').trim();
  if (brand && date) {
    const saved = dailyReports.find(r => r.brandId === brand && r.date === date);
    if (saved) return ok(res, { ...saved, saved: true });
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
