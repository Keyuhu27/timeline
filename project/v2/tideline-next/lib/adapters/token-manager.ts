// 潮线 Tideline · Token 管理器
// 缓存 Access Token，提前 30 分钟刷新（巨量引擎 token 有效期 2 小时）

import type { PlatformCredential } from '../../types/index';
import { alertService } from './alert-service';

const OCEANENGINE_REFRESH_URL = 'https://open.oceanengine.com/open_api/oauth2/refresh_token/';

// 内存缓存（生产环境可换 Redis）
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

// 凭证存储（生产替换为 DB）
const credentials = new Map<string, PlatformCredential>();

// 提前刷新时间窗口（秒）
const REFRESH_AHEAD_SECS = 30 * 60; // 30分钟

/** 缓存 key：tenantId + platform（不是 accountId——一次 OAuth 授权对应整个
 *  工作台下所有账户，不是单个账户，按 accountId 存会导致同一租户的凭证
 *  重复占位、也解决不了本地推 local_account_id 与 advertiser_id 两套编号不对应的问题）。 */
function cacheKey(tenantId: string, platform: string): string {
  return `${tenantId}::${platform}`;
}

export const tokenManager = {
  /** 持久化钩子：由 persist 层在启动时挂上，刷新/注册凭证后回写数据库 */
  persistHook: undefined as (undefined | (() => void)),

  /** 返回所有已注册凭证（供持久化层落盘） */
  getAllCredentials(): PlatformCredential[] {
    return Array.from(credentials.values());
  },

  /** 注册凭证（对接 API 后通过 OAuth 回调写入） */
  register(cred: PlatformCredential): void {
    const key = cacheKey(cred.tenantId, cred.platform);
    credentials.set(key, cred);
    // 同时写入缓存，避免立即触发刷新
    if (cred.accessToken) {
      tokenCache.set(key, {
        token:     cred.accessToken,
        expiresAt: Math.floor(cred.expiresAt / 1000),
      });
    }
  },

  /** 获取有效 token，必要时自动刷新 */
  async getToken(tenantId: string, platform: PlatformCredential['platform']): Promise<string> {
    const key = cacheKey(tenantId, platform);
    const cached = tokenCache.get(key);
    const now = Math.floor(Date.now() / 1000);

    // 缓存有效
    if (cached && cached.expiresAt - now > REFRESH_AHEAD_SECS) {
      return cached.token;
    }

    // 需要刷新
    const cred = credentials.get(key);
    if (!cred) {
      throw new Error(`[TokenManager] 未找到凭证: ${key}，请先为该租户完成 OAuth 授权`);
    }

    return this._refresh(key, cred);
  },

  /** 内部：执行刷新 */
  async _refresh(key: string, cred: PlatformCredential): Promise<string> {
    try {
      const result = await this._refreshFromApi(cred);
      tokenCache.set(key, { token: result.accessToken, expiresAt: result.expiresAt });

      // 更新存储的凭证
      const updated: PlatformCredential = {
        ...cred,
        accessToken:  result.accessToken,
        refreshToken: result.refreshToken ?? cred.refreshToken,
        expiresAt:    result.expiresAt * 1000, // 转为 ms
        updatedAt:    new Date().toISOString(),
      };
      credentials.set(key, updated);
      // 刷新后回写持久化（token 改存数据库，不再写 .env）
      try { this.persistHook?.(); } catch { /* ignore */ }

      // 检查是否即将过期（剩余不足1小时告警）
      const remainSecs = result.expiresAt - Math.floor(Date.now() / 1000);
      if (remainSecs < 3600) {
        await alertService.send('token_expiring', {
          accountId: cred.accountId,
          platform: cred.platform,
          remainMinutes: Math.floor(remainSecs / 60),
        });
      }

      return result.accessToken;
    } catch (e) {
      console.error(`[TokenManager] 刷新失败 ${key}:`, e);
      // 降级：如果有旧 token 且未完全过期，继续使用
      const cached = tokenCache.get(key);
      if (cached) return cached.token;
      throw e;
    }
  },

  /** 调用巨量引擎 OAuth2 接口刷新 Token */
  async _refreshFromApi(cred: PlatformCredential): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: number; // 秒
  }> {
    const appId     = cred.appId     ?? process.env.OCEANENGINE_APP_ID;
    const appSecret = process.env.OCEANENGINE_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error('[TokenManager] 缺少 OCEANENGINE_APP_ID 或 OCEANENGINE_APP_SECRET 环境变量');
    }
    if (!cred.refreshToken) {
      throw new Error(`[TokenManager] 账户 ${cred.accountId} 没有 refreshToken，无法刷新`);
    }

    console.log(`[TokenManager] 正在刷新 Token: accountId=${cred.accountId}`);

    const res = await fetch(OCEANENGINE_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appid:         Number(appId),
        secret:        appSecret,
        grant_type:    'refresh_token',
        refresh_token: cred.refreshToken,
      }),
    });

    if (!res.ok) {
      throw new Error(`[TokenManager] HTTP ${res.status} 刷新失败`);
    }

    const data = await res.json() as {
      message: string;
      data?: { access_token: string; refresh_token: string; expires_in: number };
    };

    if ((data.message !== 'success' && data.message !== 'OK') || !data.data) {
      throw new Error(`[TokenManager] 巨量引擎返回错误: ${data.message}`);
    }

    console.log(`[TokenManager] Token 刷新成功: accountId=${cred.accountId}，有效期 ${data.data.expires_in}s`);

    return {
      accessToken:  data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt:    Math.floor(Date.now() / 1000) + data.data.expires_in,
    };
  },

  /** 检查所有凭证的过期状态（定时任务调用） */
  async checkAll(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, cred] of credentials) {
      const expiresAtSec = cred.expiresAt / 1000;
      const remain = expiresAtSec - now;
      if (remain < REFRESH_AHEAD_SECS) {
        console.log(`[TokenManager] 预刷新: ${key}，剩余 ${Math.floor(remain / 60)} 分钟`);
        await this._refresh(key, cred).catch(console.error);
      }
    }
  },

  /** 获取任意一个可用 token（不区分租户）。
   *  ⚠️ 只能在明确知道"当前只有一个租户"的场景下用（内部管理端点/调试接口/
   *  账户发现流程，这些还没有真正的多租户上下文）。任何针对具体账户的读写操作
   *  （暂停/改预算/拉报表）都必须走 getToken(tenantId, platform)，先从账户反查
   *  租户，不能在这里"随便挑一个"——多租户上线后这里会把别的租户的 token 用
   *  到当前账户上。 */
  async getAnyToken(platform: PlatformCredential['platform']): Promise<string> {
    // 优先从已注册凭证中找
    for (const [, cred] of credentials) {
      if (cred.platform === platform) {
        return this.getToken(cred.tenantId, platform);
      }
    }
    // 降级：直接用环境变量中的 access token
    if (platform === 'oceanengine') {
      const envToken = process.env.OCEANENGINE_ACCESS_TOKEN;
      if (envToken) {
        console.log('[TokenManager] 降级：直接使用环境变量 OCEANENGINE_ACCESS_TOKEN');
        return envToken;
      }
    }
    throw new Error(`[TokenManager] 没有任何可用的 ${platform} Token`);
  },

  /** 获取所有凭证状态摘要（供 API 返回） */
  getStatus(): Array<{ tenantId: string; accountId: string; platform: string; expiresAt: number; healthy: boolean }> {
    const now = Date.now();
    return Array.from(credentials.values()).map(c => ({
      tenantId:  c.tenantId,
      accountId: c.accountId,
      platform:  c.platform,
      expiresAt: c.expiresAt,
      healthy:   c.expiresAt - now > REFRESH_AHEAD_SECS * 1000,
    }));
  },
};

// 服务启动时：若 .env 中有 Token，自动注册为默认凭证，无需手动 curl
(function bootstrapFromEnv() {
  const accessToken  = process.env.OCEANENGINE_ACCESS_TOKEN;
  const refreshToken = process.env.OCEANENGINE_REFRESH_TOKEN;
  const appId        = process.env.OCEANENGINE_APP_ID;

  if (accessToken && refreshToken && appId) {
    // TODO(Phase 3): 多租户自助入驻上线后，.env 里的凭证不再够用（每个租户
    // 有自己的一套 token），这段整体会被 OAuth 回调注册取代。今天只有 'nanji'
    // 一个租户，凭证挂在这个固定 tenantId 下。
    // 注意：.env 里的 access_token 很可能已过期（巨量有效期仅 2 小时），
    // 不能假定它是新的——否则缓存命中会一直拿过期 token 报 40105。
    // 标记为「已过期」，让第一次 getToken 用 refresh_token 自动换新 token（自愈）。
    const cred: PlatformCredential = {
      id:           'env_default',
      accountId:    appId,
      tenantId:     'nanji',
      platform:     'oceanengine',
      appId,
      accessToken,
      refreshToken,
      expiresAt:    Date.now() - 1000, // 立即视为过期，触发首次刷新
      updatedAt:    new Date().toISOString(),
    };
    tokenManager.register(cred);
    // 缓存也写成已过期：getToken 会因 expiresAt-now < 刷新窗口而走 refresh_token 换新
    const key = cacheKey('nanji', 'oceanengine');
    tokenCache.set(key, {
      token:     accessToken,
      expiresAt: Math.floor(Date.now() / 1000) - 1,
    });
    console.log(`[TokenManager] 已从环境变量注入 Token（标记为待刷新，首次调用将用 refresh_token 换新）: tenantId=nanji`);
  }
}());
