// GET  /api/accounts         — 返回当前账户列表
// POST /api/accounts/sync    — 从巨量引擎 API 自动发现并同步所有授权广告主

import { accounts, brands } from '../../../lib/db';
import { ok, err, paginate } from '../../../lib/api';
import { OceanEngineAdapter } from '../../../lib/adapters/oceanengine-adapter';
import { tokenManager }       from '../../../lib/adapters/token-manager';
import type { RouteHandler }  from '../../../lib/api';
import type { Account, Brand } from '../../../types/index';

export const GET: RouteHandler = (req, res) => {
  const { brand } = req.query;
  let filtered = accounts.slice();
  if (brand) filtered = filtered.filter(a => a.brand === brand);
  const { items, total, page, pageSize } = paginate(filtered, req.query);
  ok(res, items, { total, page, pageSize });
};

export const POST: RouteHandler = async (req, res) => {
  const appId     = process.env.OCEANENGINE_APP_ID;
  const appSecret = process.env.OCEANENGINE_APP_SECRET;

  if (!appId || !appSecret) {
    return err(res, '缺少 OCEANENGINE_APP_ID 或 OCEANENGINE_APP_SECRET');
  }

  // 取一个可用的 access token（用默认凭证）
  let accessToken: string;
  try {
    accessToken = await tokenManager.getAnyToken('oceanengine');
  } catch (e) {
    return err(res, `无法获取 Access Token: ${String(e)}`);
  }

  // 从巨量引擎拉所有授权广告主
  let advertiserList: Array<{ advertiser_id: string; advertiser_name: string; company: string; status: string }>;
  try {
    advertiserList = await OceanEngineAdapter.fetchAdvertiserList(appId, appSecret, accessToken);
  } catch (e) {
    return err(res, `拉取广告主列表失败: ${String(e)}`);
  }

  if (!advertiserList.length) {
    return ok(res, { synced: 0, accounts: [] }, {});
  }

  let synced = 0;
  const result: Account[] = [];

  for (const adv of advertiserList) {
    const advId = String(adv.advertiser_id);
    const advName = adv.advertiser_name || adv.company || advId;
    const logo = advName.slice(0, 1);

    // 检查是否已存在
    const existing = accounts.find(a => a.externalId === advId);
    if (existing) {
      result.push(existing);
      continue;
    }

    // 生成新的品牌记录
    const brandId = `b_${advId}`;
    const accountId = `a_${advId}`;
    const colorIdx = (accounts.length % 10) + 1;

    const newBrand: Brand = {
      id: brandId, name: advName, cat: '本地推', logo,
    };
    const newAccount: Account = {
      id: accountId, name: advName, externalId: advId,
      brand: brandId, color: `c${colorIdx}`,
      followers: 0, growth7d: 0, gmv7d: 0,
      live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0,
    };

    brands.push(newBrand);
    accounts.push(newAccount);
    result.push(newAccount);
    synced++;
    console.log(`[AccountSync] 新增广告主: ${advName} (${advId})`);
  }

  ok(res, { synced, total: advertiserList.length, accounts: result }, {});
};
