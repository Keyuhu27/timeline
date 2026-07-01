// 潮线 Tideline · Auth v2
// JWT-like token（HMAC-SHA256）+ 密码哈希（PBKDF2）零外部依赖
// 生产迁移：hashPassword/verifyPassword → bcrypt，signToken → jose/jsonwebtoken

import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const JWT_SECRET  = process.env.JWT_SECRET ?? 'tideline-dev-secret-change-in-prod';
const TOKEN_TTL   = 7 * 24 * 60 * 60; // 7天（秒）
const PBKDF2_ITER = 100_000;
const PBKDF2_LEN  = 32;

export interface Session {
  userId: string;
  name: string;
  role: string;
  orgId: string;
  iat: number;
  exp: number;
}

// ─── 密码哈希（pbkdf2$salt$hash）─────────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITER, PBKDF2_LEN, 'sha256').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const hash = pbkdf2Sync(password, parts[1]!, PBKDF2_ITER, PBKDF2_LEN, 'sha256').toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(parts[2]!));
  } catch { return false; }
}

// ─── Token（header.payload.sig，Base64URL）────────────────────────────────
function b64(s: string) { return Buffer.from(s).toString('base64url'); }

function signToken(payload: Session): string {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64(JSON.stringify(payload));
  const s = createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

function verifyToken(token: string): Session | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(s!), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(p!, 'base64url').toString()) as Session;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ─── Cookie ───────────────────────────────────────────────────────────────
function parseCookies(req: IncomingMessage): Record<string, string> {
  return Object.fromEntries(
    (req.headers.cookie ?? '').split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k?.trim() ?? '', decodeURIComponent(v.join('='))];
    })
  );
}

// ─── 公开 API ─────────────────────────────────────────────────────────────
export function login(email: string, password: string): { token: string; session: Session } | null {
  const account = DEMO_ACCOUNTS[email];
  if (!account || !verifyPassword(password, account.passwordHash)) return null;
  const now = Math.floor(Date.now() / 1000);
  const session: Session = { ...account.profile, iat: now, exp: now + TOKEN_TTL };
  return { token: signToken(session), session };
}

export function getSession(req: IncomingMessage): Session | null {
  const token = parseCookies(req)['tide_session'];
  return token ? verifyToken(token) : null;
}

// ─── 机器鉴权（API Key）────────────────────────────────────────────────────
// 供外部程序（worker / Codex 等）调用接口用。请求头 `X-Api-Key: <key>`，
// key 从 process.env.API_KEY 读取（逗号分隔可配多把，便于轮换/多客户端）。
// 命中则返回一个合成的机器会话，等价于已登录（主理人权限）。
// 时间恒定比较，防止时序侧信道。
function checkApiKey(req: IncomingMessage): Session | null {
  const raw = process.env.API_KEY;
  if (!raw) return null;
  const header = req.headers['x-api-key'];
  const provided = Array.isArray(header) ? header[0] : header;
  if (!provided) return null;
  const provBuf = Buffer.from(provided);
  const valid = raw.split(',').map(k => k.trim()).filter(Boolean).some(key => {
    const keyBuf = Buffer.from(key);
    return keyBuf.length === provBuf.length && timingSafeEqual(keyBuf, provBuf);
  });
  if (!valid) return null;
  const now = Math.floor(Date.now() / 1000);
  return { userId: 'machine', name: 'API Client', role: '主理人', orgId: 'system', iat: now, exp: now + TOKEN_TTL };
}

export function requireAuth(req: IncomingMessage, res: ServerResponse): Session | null {
  // 优先浏览器会话，其次 API Key（机器对机器）
  const session = getSession(req) ?? checkApiKey(req);
  if (!session) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '未登录，请先登录工作台（或提供有效 X-Api-Key）' }));
    return null;
  }
  return session;
}

export function setSessionCookie(res: ServerResponse, token: string): void {
  res.setHeader('Set-Cookie', `tide_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_TTL}`);
}

export function clearSessionCookie(res: ServerResponse): void {
  res.setHeader('Set-Cookie', 'tide_session=; Path=/; Max-Age=0');
}

export function logout(res: ServerResponse): void {
  clearSessionCookie(res);
}

// ─── 演示账号（启动时生成哈希，生产替换为 DB 查询）──────────────────────
const DEMO_ACCOUNTS: Record<string, { passwordHash: string; profile: Omit<Session, 'iat' | 'exp'> }> = {
  'chen@nanji.cn': {
    passwordHash: hashPassword('tideline2026'),
    profile: { userId: 'u1', name: '陈思远', role: '主理人', orgId: 'nanji' },
  },
  'lin@nanji.cn': {
    passwordHash: hashPassword('tideline2026'),
    profile: { userId: 'u2', name: '林玥', role: '编导', orgId: 'nanji' },
  },
};
