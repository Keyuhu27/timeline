import type { RouteHandler } from '../../../lib/api';
import { ok, err } from '../../../lib/api';
import { tokenManager } from '../../../lib/adapters/index';
import { safeJsonParse } from '../../../lib/adapters/oceanengine-adapter';
import type { PlatformCredential } from '../../../types/index';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASE_URL = 'https://open.oceanengine.com';

// 把最新 token 写回 .env，避免 24h 过期后还要手动改文件
function persistTokensToEnv(accessToken: string, refreshToken: string) {
  try {
    if (!existsSync('.env')) return;
    const lines = readFileSync('.env', 'utf8').split('\n');
    const upsert = (key: string, val: string) => {
      const i = lines.findIndex(l => l.trim().startsWith(`${key}=`));
      if (i >= 0) lines[i] = `${key}=${val}`;
      else lines.push(`${key}=${val}`);
    };
    upsert('OCEANENGINE_ACCESS_TOKEN', accessToken);
    if (refreshToken) upsert('OCEANENGINE_REFRESH_TOKEN', refreshToken);
    writeFileSync('.env', lines.join('\n'));
    process.env.OCEANENGINE_ACCESS_TOKEN = accessToken;
    if (refreshToken) process.env.OCEANENGINE_REFRESH_TOKEN = refreshToken;
    console.log('[OAuth] ✅ 新 token 已写回 .env');
  } catch (e) {
    console.error('[OAuth] ⚠️ 写回 .env 失败:', String(e));
  }
}
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
      const cred: PlatformCredential = {
        id: `cred_${Date.now()}`, accountId: primaryId,
        platform: 'oceanengine', accessToken: access_token, refreshToken: refresh_token,
        expiresAt, advertiserId: primaryId, appId: APP_ID, updatedAt: new Date().toISOString(),
      };
      tokenManager.register(cred);
      tokenManager.register({ ...cred, id: `cred_app_${Date.now()}`, accountId: APP_ID });
      persistTokensToEnv(access_token, refresh_token);
      console.log(`[OAuth] ✅ 授权成功 advertiser_ids: ${ids.join(', ')}, expires_in: ${expires_in}s`);
      redirect(res, '/?oauth=success');
    } catch (e) {
      console.error('[OAuth] 网络错误:', e);
      redirect(res, '/?oauth=error&msg=network');
    }
    return;
  }

  if (!advertiser_id) return err(res, '缺少 advertiser_id');
  const params = new URLSearchParams({ app_id: APP_ID, redirect_uri: CALLBACK_URL, state: String(advertiser_id) });
  redirect(res, `${BASE_URL}/open_api/oauth2/authorize/?${params}`);
};

export const POST: RouteHandler = (req, res) => {
  const { APP_ID } = getEnv();
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
