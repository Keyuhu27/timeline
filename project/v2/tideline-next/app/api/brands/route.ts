// GET /api/brands
import { brandsForTenant } from '../../../lib/db';
import { ok } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';

export const GET: RouteHandler = (req, res) => {
  // 只返回拥有真实生意经数据账户的品牌（已按 externalId 去重，过滤重复/脏数据品牌），
  // 并且只返回当前登录租户自己的品牌。
  const list = brandsForTenant(req.session?.tenantId ?? '');
  ok(res, list, { total: list.length });
};
