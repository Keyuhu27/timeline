// POST /api/auth/login   { email, password, remember }
// POST /api/auth/logout
// GET  /api/auth/me
import { login, logout, getSession, setSessionCookie, clearSessionCookie } from '../../../lib/auth';
import { ok, err } from '../../../lib/api';
import type { RouteHandler } from '../../../lib/api';

export const GET: RouteHandler = (req, res) => {
  // GET /api/auth/login → 返回当前会话信息
  const session = getSession(req);
  if (!session) return err(res, '未登录', 401);
  ok(res, { userId: session.userId, name: session.name, role: session.role, orgId: session.orgId });
};

export const POST: RouteHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const action = (body.action as string) ?? 'login';

  if (action === 'logout') {
    logout(req);
    clearSessionCookie(res);
    return ok(res, { ok: true });
  }

  // login
  const email = (body.email as string) ?? '';
  const password = (body.password as string) ?? '';
  const remember = (body.remember as boolean) ?? true;

  const result = login(email, password);
  if (!result) return err(res, '邮箱或密码错误', 401);

  setSessionCookie(res, result.token, remember);
  ok(res, {
    userId: result.session.userId,
    name: result.session.name,
    role: result.session.role,
    orgId: result.session.orgId,
  });
};
