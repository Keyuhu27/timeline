import type { RouteHandler } from '../../../lib/api';
import { ok, err } from '../../../lib/api';
import { tokenManager } from '../../../lib/adapters/index';
import { safeJsonParse } from '../../../lib/adapters/oceanengine-adapter';
import type { PlatformCredential } from '../../../types/index';
import { saveCredentials } from '../../../lib/persist';

const BASE_URL = 'https://open.oceanengine.com';

// 动态读取，避免模块加载时 .env 未就绪
function getEnv() {
  return {
    APP_ID:       process.env.OCEANENGINE_APP_ID     ?? '',
    APP_SECRET:   process.env.OCEANENGINE_APP_SECRET ?? '',
    CALLBACK_URL: process.env.OCEANENGINE_CALLBACK_URL ?? '',
  };
}

function redirect(res: import('../../../lib/api').TideResponse, location: string) {
  res.writeHead(302, { Location: location });
  res.end();
}

export const GET: RouteHandler = async (req, res) => {
  const { APP_ID, APP_SECRET, CALLBACK_URL } = getEnv();
  const { advertiser_id, auth_code, error_code } = req.query;

  console.log(`[OAuth] callback hit, APP_ID=${APP_ID}, auth_code=${auth_code ? auth_code.slice(0,8)+'...' : 'none'}`);

  if (auth_code) {
    if (error_code) { redirect(res, '/?oauth=denied'); return; }
    try {
      const body = { appid: Number(APP_ID), secret: APP_SECRET, auth_code, grant_type: 'auth_code' };
      console.log('[OAuth] 发送换 token 请求 appid=', body.appid, 'type=', typeof body.appid);
      const r = await fetch(`${BASE_URL}/open_api/oauth2/access_token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = safeJsonParse<any>(await r.text());
      if (data.message !== 'OK' || !data.data) {
        console.error('[OAuth] 换 token 失败:', data.message, data);
        redirect(res, `/?oauth=error&msg=${encodeURIComponent(data.message ?? 'unknown')}`);
        return;
      }
      const { access_token, refresh_token, expires_in, advertiser_ids } = data.data;
      const expiresAt = Date.now() + expires_in * 1000;
      const ids: string[] = Array.isArray(advertiser_ids) ? advertiser_ids.map(String) : [];
      const primaryId = ids[0] ?? APP_ID;
      // TODO(Phase 3): 自助入驻上线后，tenantId 要从发起这次授权的租户上下文取
      // （比如授权链接的 state 参数），不能写死——今天只有 'nanji' 一个租户。
      const cred: PlatformCredential = {
        id: `cred_${Date.now()}`, accountId: primaryId, tenantId: 'nanji',
        platform: 'oceanengine', accessToken: access_token, refreshToken: refresh_token,
        expiresAt, advertiserId: primaryId, appId: APP_ID, updatedAt: new Date().toISOString(),
      };
      tokenManager.register(cred);
      saveCredentials();  // token 存数据库，不再写 .env
      console.log(`[OAuth] ✅ 授权成功 advertiser_ids: ${ids.join(', ')}, expires_in: ${expires_in}s`);
      redirect(res, '/?oauth=success');
    } catch (e) {
      console.error('[OAuth] 网络错误:', e);
      redirect(res, '/?oauth=error&msg=network');
    }
    return;
  }

  if (!advertiser_id) return err(res, '缺少 advertiser_id');
  // 正确的授权页是 audit/oauth.html（oauth2/authorize/ 已 404）；material_auth=1 带素材授权
  const params = new URLSearchParams({
    app_id: APP_ID, state: String(advertiser_id),
    material_auth: '1', redirect_uri: CALLBACK_URL,
  });
  redirect(res, `${BASE_URL}/audit/oauth.html?${params}`);
};

export const POST: RouteHandler = (req, res) => {
  const { APP_ID } = getEnv();
  const body = req.body as Partial<PlatformCredential>;
  if (!body.accountId || !body.accessToken || !body.refreshToken) return err(res, '缺少必填项');
  const cred: PlatformCredential = {
    id: `cred_${Date.now()}`, accountId: body.accountId, tenantId: body.tenantId ?? 'nanji',
    platform: body.platform ?? 'oceanengine',
    accessToken: body.accessToken, refreshToken: body.refreshToken,
    expiresAt: body.expiresAt ?? Date.now() + 86400000,
    advertiserId: body.advertiserId, appId: APP_ID, updatedAt: new Date().toISOString(),
  };
  tokenManager.register(cred);
  ok(res, { message: '凭证注册成功', accountId: cred.accountId, tenantId: cred.tenantId });
};
