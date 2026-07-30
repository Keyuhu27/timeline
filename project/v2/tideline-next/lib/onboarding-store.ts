// 潮线 Tideline · 自助入驻「待确认发现」桥接层
// OAuth 回调拿到 token 后，自动发现候选本地推账户，但不立即建 Brand/Account——
// 先把「新鲜的凭证 + 候选账户」暂存在内存里，等客户在确认页勾选后才真正落库。
// 按 tenantId 为 key（一个租户同一时间只应有一次进行中的入驻发现），TTL 过期自动清理，
// 避免客户中途放弃后，一份从未确认过的 token 一直占着内存。

const TTL_MS = 15 * 60 * 1000; // 15 分钟——够客户看完确认页勾选，不会无限占用

export interface OnboardingCandidate {
  localAccountId: string;
  name: string;
  mainCopyTag: string;    // MAIN_ACCOUNT / COPY_ACCOUNT
  accountRole: string;    // DIRECT_ACCOUNT / VIRTUAL_ACCOUNT
  projectCount: number;   // 名下投放项目数——判断"这是不是在用的账户"的关键信号
  recommended: boolean;   // 默认勾选（有真实项目的账户）
}

interface PendingDiscovery {
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  appId: string;
  candidates: OnboardingCandidate[];
  createdAt: number;
}

const pending = new Map<string, PendingDiscovery>();

export function setPendingDiscovery(
  tenantId: string,
  data: Omit<PendingDiscovery, 'tenantId' | 'createdAt'>,
): void {
  pending.set(tenantId, { tenantId, createdAt: Date.now(), ...data });
}

export function getPendingDiscovery(tenantId: string): PendingDiscovery | undefined {
  const p = pending.get(tenantId);
  if (!p) return undefined;
  if (Date.now() - p.createdAt > TTL_MS) {
    pending.delete(tenantId);
    return undefined;
  }
  return p;
}

export function clearPendingDiscovery(tenantId: string): void {
  pending.delete(tenantId);
}
