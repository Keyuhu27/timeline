// GET /api/brands
import { visibleBrands } from '../../../lib/db';
import { ok } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';

export const GET: RouteHandler = (_req, res) => {
  // 只返回拥有真实生意经数据账户的品牌（已按 externalId 去重，过滤重复/脏数据品牌）
  const list = visibleBrands();
  ok(res, list, { total: list.length });
};
