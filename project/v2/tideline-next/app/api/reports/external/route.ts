// GET  /api/reports/external?date=&brandId=   → 列出外部投流复盘（按 createdAt 倒序）
// POST /api/reports/external  { date?, brandId?, title?, content, source? } → 存一条复盘
// 鉴权：非公开路由，requireAuth 已放行「登录 Cookie 或 X-Api-Key」。供 Codex 用 X-Api-Key 写入。
// 平台只存+展示，不二次加工；content 为纯文本/Markdown 源文，前端按纯文本安全渲染（防 XSS）。
import { ok, err } from '../../../../lib/api';
import type { RouteHandler } from '../../../../lib/api';
import { externalReports, brandById } from '../../../../lib/db';
import { saveSnapshot } from '../../../../lib/persist';
import type { ExternalReport } from '../../../../types/index';

function bjToday(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

export const GET: RouteHandler = (req, res) => {
  const { date, brandId } = req.query;
  let list = [...externalReports];
  if (date)    list = list.filter(r => r.date === date);
  if (brandId) list = list.filter(r => r.brandId === brandId);
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  ok(res, { reports: list, total: list.length });
};

export const POST: RouteHandler = (req, res) => {
  const body = (req.body ?? {}) as { date?: string; brandId?: string; title?: string; content?: string; source?: string };
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) return err(res, 'content 必填（复盘正文）');
  if (content.length > 100_000) return err(res, 'content 过长（上限 100k 字符）');

  const date = (body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) ? body.date : bjToday();
  const brandId = body.brandId ? String(body.brandId) : undefined;
  const brandName = brandId ? (brandById(brandId)?.name) : undefined;

  const report: ExternalReport = {
    id: `ext_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date,
    brandId,
    brandName,
    title: (body.title && String(body.title).slice(0, 200)) || `投流复盘 · ${date}`,
    content,
    source: (body.source && String(body.source).slice(0, 40)) || 'codex',
    createdAt: new Date().toISOString(),
  };
  externalReports.unshift(report);
  try { saveSnapshot(); } catch { /* best-effort */ }
  ok(res, report);
};
