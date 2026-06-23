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
import type { RouteHandler }  from '../../../lib/api';
import type { DailyReport, DailyReportRow, DailyReportLiveBlock } from '../../../types/index';

const ROW_DEFS: Array<{ key: string; label: string }> = [
  { key: 'zibo',  label: '自播' },
  { key: 'dabo',  label: '达播' },
  { key: 'poi',   label: 'POI' },
  { key: 'video', label: '短视频' },
];

function emptyRows(): DailyReportRow[] {
  return ROW_DEFS.map(d => ({ key: d.key, label: d.label, history: 0, yesterday: 0, month: 0, target: 0 }));
}
function emptyLiveBlock(): DailyReportLiveBlock {
  const col = () => ({ sessions: 0, gmv: 0, duration: 0 });
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

/** 按品牌+日期生成一份新日报，尝试从 statQuery 按精确日期区间回填数据（不落盘） */
export async function buildReport(brandId: string, date: string): Promise<DailyReport> {
  const brand = brandById(brandId);
  const account = accounts.find(a => a.brand === brandId);
  const now = new Date().toISOString();

  const gmvRows = emptyRows();
  const liveDetail = { zibo: emptyLiveBlock(), dabo: emptyLiveBlock() };
  let seeded = false;
  let seedNote = '未检测到该品牌的巨量后台全域数据（statQuery 无法访问）。所有数字为空，请手动填写。';

  if (account?.externalId && process.env.OCEANENGINE_LOCALADS_COOKIE) {
    const yesterday   = bjDateStr(date, -1);
    const monthStart  = bjMonthStartStr(date);

    try {
      const [sqYday, sqMonth] = await Promise.all([
        OceanEngineAdapter.fetchHomeRoi2StatQuery(
          account.externalId,
          sq(yesterday, '00:00:00'),
          sq(yesterday, '23:59:59'),
        ).catch(() => null),
        OceanEngineAdapter.fetchHomeRoi2StatQuery(
          account.externalId,
          sq(monthStart, '00:00:00'),
          sq(date, '23:59:59'),
        ).catch(() => null),
      ]);

      const zibo  = gmvRows.find(r => r.key === 'zibo')!;
      const video = gmvRows.find(r => r.key === 'video')!;

      if (sqYday) {
        zibo.yesterday  = Math.round(sqYday.liveGmv  || 0);
        video.yesterday = Math.round(sqYday.videoGmv || 0);
        liveDetail.zibo.yesterday.gmv = Math.round(sqYday.liveGmv || 0);
        seeded = true;
      }
      if (sqMonth) {
        zibo.month  = Math.round(sqMonth.liveGmv  || 0);
        video.month = Math.round(sqMonth.videoGmv || 0);
        liveDetail.zibo.month.gmv = Math.round(sqMonth.liveGmv || 0);
        seeded = true;
      }

      if (seeded) {
        seedNote = [
          `昨日数据（${yesterday} 全天 statQuery）：自播 ¥${zibo.yesterday}、短视频 ¥${video.yesterday}。`,
          `本月数据（${monthStart}～${date} statQuery）：自播 ¥${zibo.month}、短视频 ¥${video.month}。`,
          `达播/POI、核销、目标、历史平台无对应口径，请手动补充。`,
        ].join('');
      }
    } catch {
      seedNote = 'statQuery 请求失败，所有数字为空，请手动填写。';
    }
  }

  return {
    id: `rpt_${brandId}_${date}`,
    brandId,
    brandName: brand?.name || (account?.name ?? brandId),
    accountExternalId: account?.externalId,
    date,
    timeProgress: timeProgressOf(date),
    gmvRows,
    redeemRows: emptyRows(),
    liveDetail,
    notes: { dabo: '', official: '', officialVideo: '' },
    seeded,
    seedNote,
    source: 'platform',
    createdAt: now,
    updatedAt: now,
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
