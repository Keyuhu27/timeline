import { MockContentAdapter } from './content-adapter';
import { OceanEngineAdapter }  from './oceanengine-adapter';
import { tokenManager }        from './token-manager';
import type { PlatformCredential } from '../../types/index';

// 广告适配器：MCN 模式，用同一个主 token 管所有广告主
export const adAdapter = new OceanEngineAdapter(
  (_advertiserId) => tokenManager.getAnyToken('oceanengine')
);

// 内容发布：仍用 Mock（Content API 待接入）
export const contentAdapter = new MockContentAdapter();

// 预注入已获取的 Token
const _token = process.env.OCEANENGINE_ACCESS_TOKEN ?? '';
if (_token) {
  const cred: PlatformCredential = {
    id: 'cred_init', accountId: '1840323525509444', platform: 'oceanengine',
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
