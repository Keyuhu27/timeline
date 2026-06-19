import type { RouteHandler } from '../../../lib/api';
import { ok, err } from '../../../lib/api';
import { tokenManager } from '../../../lib/adapters/index';
import type { PlatformCredential } from '../../../types/index';

const APP_ID       = process.env.OCEANENGINE_APP_ID     ?? '';
const APP_SECRET   = process.env.OCEANENGINE_APP_SECRET ?? '';
const CALLBACK_URL = process.env.OCEANENGINE_CALLBACK_URL ?? '';
const BASE_URL     = 'https://open.oceanengine.com';

export const GET: RouteHandler = async (req, res) => {
  const { advertiser_id, auth_code, error_code } = req.query;

  if (auth_code) {
    if (error_code) { res.raw.writeHead(302, { Location: '/?oauth=denied' }); res.raw.end(); return; }
    try {
      const r = await fetch(`${BASE_URL}/open_api/oauth2/access_token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appid: APP_ID, secret: APP_SECRET, auth_code, grant_type: 'auth_code' }),
      });
      const data = await r.json() as any;
      if (data.message !== 'OK' || !data.data) {
        res.raw.writeHead(302, { Location: `/?oauth=error&msg=${encodeURIComponent(data.message)}` });
        res.raw.end(); return;
      }
      const { access_token, refresh_token, expires_in, advertiser_ids } = data.data;
      const cred: PlatformCredential = {
        id: `cred_${Date.now()}`, accountId: String(advertiser_ids[0] ?? 'unknown'),
        platform: 'oceanengine', accessToken: access_token, refreshToken: refresh_token,
        expiresAt: Date.now() + expires_in * 1000, advertiserId: String(advertiser_ids[0]),
        appId: APP_ID, updatedAt: new Date().toISOString(),
      };
      tokenManager.register(cred);
      console.log(`[OAuth] ✅ 授权成功 advertiser_ids: ${advertiser_ids.join(', ')}`);
      res.raw.writeHead(302, { Location: '/?oauth=success' }); res.raw.end();
    } catch (e) {
      console.error('[OAuth] 失败:', e);
      res.raw.writeHead(302, { Location: '/?oauth=error&msg=network' }); res.raw.end();
    }
    return;
  }

  if (!advertiser_id) return err(res, '缺少 advertiser_id');
  const params = new URLSearchParams({ app_id: APP_ID, redirect_uri: CALLBACK_URL, state: String(advertiser_id) });
  res.raw.writeHead(302, { Location: `${BASE_URL}/open_api/oauth2/authorize/?${params}` });
  res.raw.end();
};

export const POST: RouteHandler = (req, res) => {
  const body = req.body as Partial<PlatformCredential>;
  if (!body.accountId || !body.accessToken || !body.refreshToken) return err(res, '缺少必填项');
  const cred: PlatformCredential = {
    id: `cred_${Date.now()}`, accountId: body.accountId, platform: body.platform ?? 'oceanengine',
    accessToken: body.accessToken, refreshToken: body.refreshToken,
    expiresAt: body.expiresAt ?? Date.now() + 86400000,
    advertiserId: body.advertiserId, appId: APP_ID, updatedAt: new Date().toISOString(),
  };
  tokenManager.register(cred);
  ok(res, { message: '凭证注册成功', accountId: cred.accountId });
};
