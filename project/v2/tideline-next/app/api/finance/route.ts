// GET /api/finance?status=pending&brand=云杉运动
// PATCH /api/finance?id=f1  { status: 'paid' }
import { financeRecords } from '../../../lib/db';
import { ok, err, paginate } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';
import type { FinanceRecord } from '../../../types/index';

export const GET: RouteHandler = (req, res) => {
  const { status, brand, type } = req.query;
  let filtered = financeRecords.slice();
  if (status) filtered = filtered.filter(f => f.status === status);
  if (brand)  filtered = filtered.filter(f => f.brand === brand);
  if (type)   filtered = filtered.filter(f => f.type === type);

  // 汇总统计
  const summary = {
    totalAmount:    financeRecords.reduce((s, f) => s + f.amount, 0),
    paidAmount:     financeRecords.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0),
    pendingAmount:  financeRecords.filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0),
    disputeAmount:  financeRecords.filter(f => f.status === 'dispute').reduce((s, f) => s + f.amount, 0),
  };

  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, { records: items, summary }, { total, page, pageSize });
};

export const PATCH: RouteHandler = (req, res) => {
  const { id } = req.query;
  const idx = financeRecords.findIndex(f => f.id === id);
  if (idx === -1) return err(res, '记录不存在', 404);
  const body = req.body as Partial<FinanceRecord>;
  Object.assign(financeRecords[idx], body);
  ok(res, financeRecords[idx]);
};
