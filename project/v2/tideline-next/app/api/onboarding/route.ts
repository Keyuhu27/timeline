// 自助入驻 · 候选本地推账户确认
// GET  /api/onboarding/pending  — 拉取当前租户待确认的候选账户（OAuth 回调后暂存的）
// POST /api/onboarding/confirm  — 客户勾选确认后，真正建 Brand/Account + 注册凭证

import type { RouteHandler } from '../../../lib/api';
import { ok, err } from '../../../lib/api';
import { tokenManager } from '../../../lib/adapters/index';
import { saveCredentials } from '../../../lib/persist';
import { getPendingDiscovery, clearPendingDiscovery } from '../../../lib/onboarding-store';
import { syncLocalAccounts } from '../accounts/route';
import type { PlatformCredential } from '../../../types/index';

export const pending: RouteHandler = (req, res) => {
  const tenantId = req.session?.tenantId;
  if (!tenantId) return err(res, '请先登录');
  const disc = getPendingDiscovery(tenantId);
  if (!disc) return ok(res, { pending: false, candidates: [] }, {});
  ok(res, { pending: true, candidates: disc.candidates }, {});
};

export const confirm: RouteHandler = async (req, res) => {
  const tenantId = req.session?.tenantId;
  if (!tenantId) return err(res, '请先登录');

  const disc = getPendingDiscovery(tenantId);
  if (!disc) return err(res, '未找到待确认的授权，请重新点击"连接我的本地推账户"');

  const body = (req.body ?? {}) as { localAccountIds?: unknown };
  const selected = Array.isArray(body.localAccountIds)
    ? body.localAccountIds.map(String).filter(Boolean)
    : [];
  if (!selected.length) return err(res, '请至少勾选一个本地推账户');

  const validIds = new Set(disc.candidates.map(c => c.localAccountId));
  const invalid = selected.filter(id => !validIds.has(id));
  if (invalid.length) return err(res, `以下账户不在本次授权范围内: ${invalid.join(', ')}`);

  // 先注册凭证——syncLocalAccounts 内部拉计划/报表要靠 (tenantId, platform) 取 token
  // （见 token-manager.ts 的 getToken），必须先有凭证才能同步。
  const cred: PlatformCredential = {
    id: `cred_${Date.now()}`,
    accountId: selected[0]!,
    tenantId,
    platform: 'oceanengine',
    accessToken: disc.accessToken,
    refreshToken: disc.refreshToken,
    expiresAt: disc.expiresAt,
    advertiserId: selected[0],
    appId: disc.appId,
    updatedAt: new Date().toISOString(),
  };
  tokenManager.register(cred);
  saveCredentials();

  const nameById = new Map(disc.candidates.map(c => [c.localAccountId, c.name]));
  const result = await syncLocalAccounts(selected, disc.accessToken, tenantId, nameById, true);

  clearPendingDiscovery(tenantId);

  ok(res, {
    message: `已连接 ${result.synced} 个本地推账户`,
    synced: result.synced,
    campaignsSynced: result.campaignsSynced,
    accounts: result.accounts,
    errors: result.errors,
  }, {});
};
