// GET  /api/products?brand=b4&cat=户外&status=hot&q=防晒
// POST /api/products  新建商品
import { products } from '../../../lib/db';
import { ok, err, paginate } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';
import type { Product } from '../../../types/index';

export const GET: RouteHandler = (req, res) => {
  const { brand, cat, status, q, sortBy = 'score', order = 'desc' } = req.query;
  let filtered = products.slice();
  if (brand)  filtered = filtered.filter(p => p.brand === brand);
  if (cat)    filtered = filtered.filter(p => p.cat === cat);
  if (status) filtered = filtered.filter(p => p.status === status);
  if (q)      filtered = filtered.filter(p => p.name.includes(q));

  filtered.sort((a, b) => {
    const va = (a as Record<string, unknown>)[sortBy] as number ?? 0;
    const vb = (b as Record<string, unknown>)[sortBy] as number ?? 0;
    return order === 'desc' ? vb - va : va - vb;
  });

  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};

export const POST: RouteHandler = async (req, res) => {
  const body = req.body as Partial<Product>;
  if (!body.name || !body.brand) return err(res, 'name 和 brand 为必填项');
  const p: Product = {
    id: `p${Date.now()}`,
    name: body.name,
    brand: body.brand,
    cat: body.cat ?? '其他',
    price: body.price ?? 0,
    orig: body.orig ?? 0,
    stock: body.stock ?? 0,
    sold30d: 0,
    gmv30d: 0,
    comm: body.comm ?? 0.15,
    sample: body.sample ?? 0,
    status: 'active',
    trend: 'flat',
    score: 0,
  };
  products.push(p);
  ok(res, p);
};
