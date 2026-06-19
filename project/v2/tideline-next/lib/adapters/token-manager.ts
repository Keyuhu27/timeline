// 潮线 Tideline · Token 管理器
// 缓存 Access Token，提前 30 分钟刷新（巨量引擎 token 有效期 2 小时）
// 拿到真实 API 后：填充 _refreshFromApi() 方法

import type { PlatformCredential } from '../../types/index';
import { alertService } from './alert-service';

// 内存缓存（生产环境可换 Redis）
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

// Mock 凭证存储（生产替换为 DB）
const credentials = new Map<string, PlatformCredential>();

// 提前刷新时间窗口（秒）
const REFRESH_AHEAD_SECS = 30 * 60; // 30分钟

/** 缓存 key：accountId + platform */
function cacheKey(accountId: string, platform: string): string {
  return `${accountId}::${platform}`;
}

export const tokenManager = {
  /** 注册凭证（对接 API 后通过 OAuth 回调写入） */
  register(cred: PlatformCredential): void {
    credentials.set(cacheKey(cred.accountId, cred.platform), cred);
    // 清除旧缓存，强制下次重新获取
    tokenCache.delete(cacheKey(cred.accountId, cred.platform));
  },

  /** 获取有效 token，必要时自动刷新 */
  async getToken(accountId: string, platform: PlatformCredential['platform']): Promise<string> {
    const key = cacheKey(accountId, platform);
    const cached = tokenCache.get(key);
    const now = Math.floor(Date.now() / 1000);

    // 缓存有效
    if (cached && cached.expiresAt - now > REFRESH_AHEAD_SECS) {
      return cached.token;
    }

    // 需要刷新
    const cred = credentials.get(key);
    if (!cred) {
      // 没有凭证时返回 mock token（开发阶段用）
      const mockToken = `mock_token_${accountId}_${Date.now()}`;
      tokenCache.set(key, { token: mockToken, expiresAt: now + 7200 });
      return mockToken;
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

  /** 真实 API 刷新（目前为 Mock，拿到 API 后填充）*/
  async _refreshFromApi(cred: PlatformCredential): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: number; // 秒
  }> {
    // Mock 实现：返回一个假 token，有效期 2 小时
    console.log(`[TokenManager] Mock 刷新 token: ${cred.accountId} / ${cred.platform}`);
    await new Promise(r => setTimeout(r, 200));
    return {
      accessToken:  `mock_refreshed_${Date.now()}`,
      refreshToken: cred.refreshToken,
      expiresAt:    Math.floor(Date.now() / 1000) + 7200,
    };

    // ── 真实实现（巨量引擎）────────────────────────────────────────────
    // const res = await fetch('https://open.oceanengine.com/open_api/oauth2/refresh_token/', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     appid: cred.appId,
    //     secret: process.env.OCEANENGINE_APP_SECRET,
    //     grant_type: 'refresh_token',
    //     refresh_token: cred.refreshToken,
    //   }),
    // });
    // const data = await res.json();
    // if (data.message !== 'success') throw new Error(data.message);
    // return {
    //   accessToken:  data.data.access_token,
    //   refreshToken: data.data.refresh_token,
    //   expiresAt:    Math.floor(Date.now() / 1000) + data.data.expires_in,
    // };
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

  /** 获取所有凭证状态摘要（供 API 返回） */
  getStatus(): Array<{ accountId: string; platform: string; expiresAt: number; healthy: boolean }> {
    const now = Date.now();
    return Array.from(credentials.values()).map(c => ({
      accountId: c.accountId,
      platform:  c.platform,
      expiresAt: c.expiresAt,
      healthy:   c.expiresAt - now > REFRESH_AHEAD_SECS * 1000,
    }));
  },
};
