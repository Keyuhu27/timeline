// GET  /api/reports                      — 列出已保存日报（摘要）
// GET  /api/reports?id=rpt_xxx            — 取单份已保存日报
// GET  /api/reports?brand=b_x&date=YYYY-MM-DD  — 取该品牌该日日报；无则按当前平台数据生成（未保存）
// POST /api/reports                       — 保存/更新日报（运营编辑后落盘）
//
// 设计：日报结构对齐运营手工表（成交/核销分板块 + 直播明细 + 备注）。
// 实际数据流水线已抽到 lib/reports/pipeline.ts（可被「投流诊断」「定时/批量」等复用）：
//   generateReportForBrand / syncLocalAdsForBrand / fetchBusinessCompassForBrand /
//   fetchLaikeForBrand / mergeDailyReportData / saveDailyReport。

import { dailyReports } from '../../../lib/db';
import { ok, err }      from '../../../lib/api';
import { saveSnapshot } from '../../../lib/persist';
import {
  generateReportForBrand,
  fillHistoryRows,
} from '../../../lib/reports/pipeline';
import type { RouteHandler } from '../../../lib/api';
import type { DailyReport }  from '../../../types/index';

/** 按品牌+日期生成一份新日报（不落盘）。保留旧名以兼容历史引用。 */
export const buildReport = generateReportForBrand;

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
    const generated = await generateReportForBrand(brand, date);
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

  const base = existingIdx >= 0 ? dailyReports[existingIdx] : await generateReportForBrand(body.brandId, body.date);
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
