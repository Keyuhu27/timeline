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
      const expiresAt = Date.now() + expires_in * 1000;
      // 每个授权广告主都注册同一个 token（MCN 模式：一次授权管所有广告主）
      const ids: string[] = Array.isArray(advertiser_ids) ? advertiser_ids.map(String) : [];
      // 同时注册一个以 app_id 为 key 的通用凭证，供 getAnyToken 使用
      const primaryId = ids[0] ?? APP_ID;
      const cred: PlatformCredential = {
        id: `cred_${Date.now()}`, accountId: primaryId,
        platform: 'oceanengine', accessToken: access_token, refreshToken: refresh_token,
        expiresAt, advertiserId: primaryId, appId: APP_ID, updatedAt: new Date().toISOString(),
      };
      tokenManager.register(cred);
      // 为 APP_ID 也注册一份，确保 getAnyToken 兜底能找到
      tokenManager.register({ ...cred, id: `cred_app_${Date.now()}`, accountId: APP_ID });
      console.log(`[OAuth] ✅ 授权成功 advertiser_ids: ${ids.join(', ')}, expires_in: ${expires_in}s`);
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
