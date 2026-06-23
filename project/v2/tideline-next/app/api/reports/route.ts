// GET  /api/reports                      — 列出已保存日报（摘要）
// GET  /api/reports?id=rpt_xxx            — 取单份已保存日报
// GET  /api/reports?brand=b_x&date=YYYY-MM-DD  — 取该品牌该日日报；无则按当前平台数据生成（未保存）
// POST /api/reports                       — 保存/更新日报（运营编辑后落盘）
//
// 设计：日报结构对齐运营手工表（成交/核销分板块 + 直播明细 + 备注）。
// 平台 statQuery 只覆盖「昨日」全域口径的直播/短视频成交，回填到对应单元格；
// 目标/历史/本月累计/核销等平台无数据，留作可编辑字段，由运营补充后保存。

import { dailyReports, brands, accounts, brandById } from '../../../lib/db';
import { ok, err }            from '../../../lib/api';
import { saveSnapshot }       from '../../../lib/persist';
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

/** 按品牌+日期生成一份新日报，回填平台 statQuery 数据（不落盘） */
export function buildReport(brandId: string, date: string): DailyReport {
  const brand = brandById(brandId);
  const account = accounts.find(a => a.brand === brandId);
  const sq = account?.statQueryReport;
  const now = new Date().toISOString();

  const gmvRows = emptyRows();
  const liveDetail = { zibo: emptyLiveBlock(), dabo: emptyLiveBlock() };
  let seeded = false;
  let seedNote = '未检测到该品牌的巨量后台全域数据（statQuery 未同步）。所有数字为空，请手动填写或先在品牌详情页「同步状态」。';

  if (sq) {
    seeded = true;
    // 直播全域成交 → 自播；短视频全域成交 → 短视频（昨日列）
    const zibo = gmvRows.find(r => r.key === 'zibo')!;
    const video = gmvRows.find(r => r.key === 'video')!;
    zibo.yesterday = Math.round(sq.liveGmv || 0);
    video.yesterday = Math.round(sq.videoGmv || 0);
    liveDetail.zibo.yesterday.gmv = Math.round(sq.liveGmv || 0);
    seedNote = `已回填巨量后台全域口径「昨日」成交：直播自播 ¥${Math.round(sq.liveGmv || 0)}、短视频 ¥${Math.round(sq.videoGmv || 0)}（数据来源：statQuery pc_home_roi2，同步于 ${new Date(sq.syncedAt).toLocaleString('zh')}）。达播/POI、核销、目标、历史与本月累计平台无对应口径，请手动补充。`;
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

export const GET: RouteHandler = (req, res) => {
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
    return ok(res, { ...buildReport(brand, date), saved: false });
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

export const POST: RouteHandler = (req, res) => {
  const body = req.body as Partial<DailyReport>;
  if (!body || !body.brandId || !body.date) {
    return err(res, 'brandId 和 date 为必填项');
  }
  const now = new Date().toISOString();
  const id = `rpt_${body.brandId}_${body.date}`;
  const existingIdx = dailyReports.findIndex(r => r.id === id);

  const merged: DailyReport = {
    ...(existingIdx >= 0 ? dailyReports[existingIdx] : buildReport(body.brandId, body.date)),
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
