import type { RouteHandler } from '../../../lib/api';
import { ok, err } from '../../../lib/api';
import { tokenManager } from '../../../lib/adapters/index';
import { OceanEngineAdapter, safeJsonParse } from '../../../lib/adapters/oceanengine-adapter';
import type { PlatformCredential } from '../../../types/index';
import { setPendingDiscovery, type OnboardingCandidate } from '../../../lib/onboarding-store';

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

// 自助入驻：客户点「连接我的本地推账户」→ 巨量官方授权页 → 回调这里。
// 不再要求调用方传 advertiser_id（那是旧版"运营帮每个客户手工生成一条链接"的模式）——
// 授权发起、回调确认都要求已登录（session），租户身份完全来自 session.tenantId，
// 不依赖容易被篡改的 query 参数。
export const GET: RouteHandler = async (req, res) => {
  const { APP_ID, APP_SECRET, CALLBACK_URL } = getEnv();
  const { auth_code, error_code } = req.query;
  const session = req.session;
  if (!session) return err(res, '请先登录再连接本地推账户');

  console.log(`[OAuth] callback hit, APP_ID=${APP_ID}, tenantId=${session.tenantId}, auth_code=${auth_code ? auth_code.slice(0,8)+'...' : 'none'}`);

  if (auth_code) {
    if (error_code) { redirect(res, '/?oauth=denied'); return; }
    try {
      const body = { appid: Number(APP_ID), secret: APP_SECRET, auth_code, grant_type: 'auth_code' };
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
      const { access_token, refresh_token, expires_in } = data.data;
      const expiresAt = Date.now() + expires_in * 1000;

      // 自动发现该授权下的候选本地推账户（已验证链路，见
      // /root/.claude/plans/mighty-enchanting-firefly.md 的 C 节）：
      //   oauth2/advertiser/get 筛 PLATFORM_ROLE_LIFE（来客账户）
      //   → v3.0/local/life/advertiser/list 拿 local_account_id
      const authorized = await OceanEngineAdapter.fetchAuthorizedAccounts(access_token);
      const lifeAccounts = authorized.filter(a => a.account_role === 'PLATFORM_ROLE_LIFE');

      const candidates: OnboardingCandidate[] = [];
      for (const life of lifeAccounts) {
        const advs = await OceanEngineAdapter.fetchLifeAdvertiserList(access_token, life.advertiser_id);
        for (const adv of advs) {
          if (!adv.local_account_id) continue;
          const projectCount = await OceanEngineAdapter.countProjectsForLocalAccount(access_token, adv.local_account_id);
          candidates.push({
            localAccountId: adv.local_account_id,
            name: adv.local_account_name || life.advertiser_name || adv.local_account_id,
            mainCopyTag: adv.account_main_copy_tag,
            accountRole: adv.local_account_role,
            projectCount,
            recommended: projectCount > 0,
          });
        }
      }

      if (!candidates.length) {
        console.error(`[OAuth] 租户 ${session.tenantId} 授权成功但未发现任何本地推账户（来客账户数=${lifeAccounts.length}）`);
        redirect(res, `/?oauth=error&msg=${encodeURIComponent('未发现可用的本地推账户，请确认该巨量账户下已开通抖音来客/本地推能力')}`);
        return;
      }

      // 先暂存凭证 + 候选账户，等客户在确认页勾选后才真正建 Brand/Account、
      // 注册 PlatformCredential——授权 ≠ 客户在系统里可见可用。
      setPendingDiscovery(session.tenantId, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        appId: APP_ID,
        candidates,
      });

      console.log(`[OAuth] ✅ 租户 ${session.tenantId} 授权成功，发现 ${candidates.length} 个候选本地推账户，等待客户确认`);
      redirect(res, '/onboarding/connect-review');
    } catch (e) {
      console.error('[OAuth] 网络错误:', e);
      redirect(res, '/?oauth=error&msg=network');
    }
    return;
  }

  // 发起授权：正确的授权页是 audit/oauth.html（oauth2/authorize/ 已 404）；
  // material_auth=1 带素材授权。state 带上 tenantId 仅供日志追踪，安全边界
  // 由 session cookie 保证——回调阶段的租户认定用 req.session，不信任 state。
  const params = new URLSearchParams({
    app_id: APP_ID, state: session.tenantId,
    material_auth: '1', redirect_uri: CALLBACK_URL,
  });
  redirect(res, `${BASE_URL}/audit/oauth.html?${params}`);
};

// 内部/调试用：手工注册一条凭证（无需走完整 OAuth 页面跳转）。
// 现在要求已登录，tenantId 默认取当前会话租户，可传 body.tenantId 覆盖（管理员场景）。
export const POST: RouteHandler = (req, res) => {
  const { APP_ID } = getEnv();
  if (!req.session) return err(res, '请先登录');
  const body = req.body as Partial<PlatformCredential>;
  if (!body.accountId || !body.accessToken || !body.refreshToken) return err(res, '缺少必填项');
  const cred: PlatformCredential = {
    id: `cred_${Date.now()}`, accountId: body.accountId, tenantId: body.tenantId ?? req.session.tenantId,
    platform: body.platform ?? 'oceanengine',
    accessToken: body.accessToken, refreshToken: body.refreshToken,
    expiresAt: body.expiresAt ?? Date.now() + 86400000,
    advertiserId: body.advertiserId, appId: APP_ID, updatedAt: new Date().toISOString(),
  };
  tokenManager.register(cred);
  ok(res, { message: '凭证注册成功', accountId: cred.accountId, tenantId: cred.tenantId });
};
