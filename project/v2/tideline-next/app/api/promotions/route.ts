// GET /api/promotions[?brand=b4&project=c_xxx] —— Phase 5a：只读，租户隔离
// 单元(promotion) 数据来自 syncPromotionsForAccount()（POST /api/accounts/sync-promotions），
// 这里只负责展示已同步的数据，不主动触发同步。

import { promotionsForTenant } from '../../../lib/db';
import { ok, paginate } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';

export const GET: RouteHandler = (req, res) => {
  const { brand, project } = req.query;
  let list = promotionsForTenant(req.session?.tenantId ?? '');
  if (brand) list = list.filter(p => p.brand === brand);
  if (project) list = list.filter(p => p.projectInternalId === project);
  const { items, total, page, pageSize } = paginate(list, req.query);
  ok(res, items, { total, page, pageSize });
};
