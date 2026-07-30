import { MockContentAdapter } from './content-adapter';
import { OceanEngineAdapter }  from './oceanengine-adapter';
import { tokenManager }        from './token-manager';
import { accounts }            from '../db';
import type { PlatformCredential } from '../../types/index';

// 广告适配器：每次调用先从被操作的账户反查它属于哪个租户，再按租户拿 token——
// 不能像以前那样"随便挑一个能用的 token"，多租户场景下会串号（拿 A 租户的
// token 去操作 B 租户的账户），而且这类调用大多是写操作（暂停/改预算）。
export const adAdapter = new OceanEngineAdapter((advertiserId) => {
  const acct = accounts.find(a => a.externalId === advertiserId || a.id === advertiserId);
  if (!acct) throw new Error(`[Adapter] 无法解析账户 ${advertiserId} 所属租户：账户不存在，请先同步账户数据`);
  return tokenManager.getToken(acct.tenantId, 'oceanengine');
});

// 内容发布：仍用 Mock（Content API 待接入）
export const contentAdapter = new MockContentAdapter();

// 预注入已获取的 Token
// TODO(Phase 3): 多租户自助入驻上线后，这段会被 OAuth 回调注册取代；今天只有
// 'nanji' 一个租户，直接挂在这个固定 tenantId 下。
const _token = process.env.OCEANENGINE_ACCESS_TOKEN ?? '';
if (_token) {
  const cred: PlatformCredential = {
    id: 'cred_init', accountId: '1840323525509444', tenantId: 'nanji', platform: 'oceanengine',
    accessToken:  _token,
    refreshToken: process.env.OCEANENGINE_REFRESH_TOKEN ?? '',
    expiresAt:    Date.now() + 82800 * 1000,
    advertiserId: '1840323525509444',
    appId:        process.env.OCEANENGINE_APP_ID ?? '',
    updatedAt:    new Date().toISOString(),
  };
  tokenManager.register(cred);
  console.log('[Adapter] ✅ 真实 Token 已加载，巨量引擎 API 已启用');
}

export { tokenManager } from './token-manager';
export { alertService  } from './alert-service';
