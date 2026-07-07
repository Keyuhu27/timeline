// 加载 .env 环境变量
import { readFileSync as _rfs, existsSync as _ex } from 'node:fs';
// OCEANENGINE_LOCALADS_* 这几个变量值很长（JSON/cookie），用户有时通过 export 设过截断值，
// 必须让 .env 强制覆盖 shell，否则 JSON.parse 失败导致 statQuery 跳过天鸿。
const _FORCE_OVERRIDE = new Set(['OCEANENGINE_LOCALADS_COOKIE_MAP','OCEANENGINE_LOCALADS_COOKIE','OCEANENGINE_LOCALADS_HEADERS_MAP','OCEANENGINE_LOCALADS_DATASET_MAP']);
if (_ex('.env')) {
  _rfs('.env', 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq < 0) return;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    // LOCALADS 变量强制用 .env 值（防止 shell 里残留的截断 export 覆盖）；
    // 其余变量仍让命令行/系统已有的非空值优先。
    if (k && (_FORCE_OVERRIDE.has(k) || !(k in process.env) || !process.env[k])) process.env[k] = v;
  });
}

// 潮线 Tideline · Node HTTP Server
// 所有 route 静态导入，esbuild 打包成零依赖单文件。
// 迁移到真实 Next.js 时删掉此文件，route.ts 的 export 即为 Next.js handler。

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { enhanceRes, parseQuery, readBody, type RouteHandler, type TideResponse } from '../lib/api';
import { requireAuth, getSession } from '../lib/auth';

// ── 静态导入所有 route handlers ──────────────────────────────────────────
import * as routeBrands     from '../app/api/brands/route';
import * as routeTasks      from '../app/api/tasks/route';
import * as routeAccounts   from '../app/api/accounts/route';
import * as routeLives      from '../app/api/lives/route';
import * as routeProducts   from '../app/api/products/route';
import * as routeFinance    from '../app/api/finance/route';
import * as routeTeam       from '../app/api/team/route';
import * as routeAds        from '../app/api/ads/route';
import * as routeSchedule   from '../app/api/schedule/route';
import * as routeMonitor    from '../app/api/monitor/route';
import * as routeAuth       from '../app/(auth)/login/route';
import * as routeRules      from '../app/api/rules/route';
import * as routeLogs       from '../app/api/logs/route';
import * as routeAutomation from '../app/api/automation/route';
import { startScheduler }   from '../lib/scheduler/cron';
import * as routeOAuth      from '../app/api/auth/route';
import { loadPersisted }    from '../lib/persist';
import * as routeAiAnalyze   from '../app/api/ai/analyze/route';
import * as routeAiDecisions from '../app/api/ai/decisions/route';
import * as routeAiCreative  from '../app/api/ai/creative/route';
import * as routeAiWorkflow  from '../app/api/ai/workflow/route';
import * as routeDebugOE     from '../app/api/debug/oe/route';
import * as routeDebugReplay from '../app/api/debug/replay/route';
import * as routeReports      from '../app/api/reports/route';
import * as routeAdDiagnosis  from '../app/api/ad-diagnosis/route';
import * as routeLiveOptim     from '../app/api/live-optimization/route';
import * as routeLocaladsReach from '../app/api/debug/localads-reach/route';

// 启动即注水：把上次同步的真实数据从磁盘恢复到内存
loadPersisted();

type RouteModule = Partial<Record<'GET'|'POST'|'PATCH'|'DELETE', RouteHandler>>;

// 路由表：URL 路径 → 已导入的模块对象
const ROUTES: Record<string, RouteModule> = {
  '/api/brands':     routeBrands,
  '/api/tasks':      routeTasks,
  '/api/accounts':   routeAccounts,
  '/api/accounts/add-local':    { POST: routeAccounts.addLocal },
  '/api/accounts/ebp-orgs':    { GET:  routeAccounts.ebpOrgs },
  '/api/accounts/debug':       { GET:  routeAccounts.debug },
  '/api/accounts/test-fetch':  { POST: routeAccounts.testFetch },
  '/api/accounts/sync-status': { POST: routeAccounts.syncStatus },
  '/api/accounts/sync-diagnosis': { GET: routeAccounts.syncDiagnosis },
  '/api/lives':      routeLives,
  '/api/products':   routeProducts,
  '/api/finance':    routeFinance,
  '/api/team':       routeTeam,
  '/api/ads':        routeAds,
  '/api/ads/stat-query': { GET: routeAds.statQueryRange },
  '/api/schedule':   routeSchedule,
  '/api/monitor':    routeMonitor,
  '/api/auth/login': routeAuth,
  '/api/rules':      routeRules,
  '/api/logs':       routeLogs,
  '/api/automation': routeAutomation,
  '/api/auth':          routeOAuth,
  '/api/auth/callback': routeOAuth,   // 巨量引擎 OAuth 回调别名
  '/api/ai/analyze':   routeAiAnalyze,
  '/api/ai/decisions': routeAiDecisions,
  '/api/ai/creative':  routeAiCreative,
  '/api/ai/workflow':  routeAiWorkflow,
  '/api/debug/oe/account-report':   { GET: routeDebugOE.accountReport },
  '/api/debug/oe/project-report':   { GET: routeDebugOE.projectReport },
  '/api/debug/oe/promotion-report': { GET: routeDebugOE.promotionReport },
  '/api/debug/oe/stat-query':       { GET: routeDebugOE.statQueryAuto, POST: routeDebugOE.statQuery },
  '/api/debug/oe/workbench-local-accounts': { GET: routeDebugOE.workbenchLocalAccounts },
  '/api/debug/laike/replay':    { POST: routeDebugReplay.laikeReplay },
  '/api/debug/business/replay': { POST: routeDebugReplay.businessReplay },
  '/api/debug/business/live':   { GET: routeDebugReplay.businessLiveDebug, POST: routeDebugReplay.businessLiveDebug },
  '/api/reports':    routeReports,
  '/api/ad-diagnosis': routeAdDiagnosis,
  '/api/live-optimization': routeLiveOptim,
  '/api/debug/localads-reach': routeLocaladsReach,
};

const PUBLIC_ROUTES = new Set(['/api/auth/login', '/api/auth', '/api/auth/callback']);

// ── 静态文件 ─────────────────────────────────────────────────────────────
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.jsx':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2': 'font/woff2',
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORT = parseInt(process.env.PORT ?? '3000');

function serveStatic(res: ServerResponse, filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  const body = readFileSync(filePath);
  const ext = extname(filePath);
  const mime = MIME[ext] ?? 'application/octet-stream';
  // 源码类资源（jsx/js/css/html）改后必须立即生效，禁止浏览器长缓存——
  // 否则改了 .jsx 还得手动硬刷，普通刷新会拿到 1h 旧缓存（曾导致同步按钮不带 brandId）。
  // 静态素材（图片/字体）仍可长缓存。
  const noCache = ext === '.jsx' || ext === '.js' || ext === '.css' || ext === '.html';
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': body.length,
    'Cache-Control': noCache ? 'no-cache, must-revalidate' : 'public, max-age=3600' });
  res.end(body);
  return true;
}

// ── SSR Shell ─────────────────────────────────────────────────────────────
function renderShell(session: { name: string; role: string }): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>潮线 Tideline · MCN 代运营工作台</title>
<meta name="description" content="MCN 代运营全栈工作台 — 选题、生成、投放、结算一站完成"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<script>
  window.__TIDE_SESSION__ = ${JSON.stringify({ name: session.name, role: session.role })};
  window.__TIDE_API_BASE__ = '';
</script>
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" crossorigin></script>
</head>
<body>
<div id="root"></div>
<script type="text/babel" src="/data.jsx"></script>
<script type="text/babel" src="/components.jsx"></script>
<script type="text/babel" src="/tweaks-panel.jsx"></script>
<script type="text/babel" src="/views/home.jsx"></script>
<script type="text/babel" src="/views/data.jsx"></script>
<script type="text/babel" src="/views/brand-detail.jsx"></script>
<script type="text/babel" src="/views/daily-report.jsx"></script>
<script type="text/babel" src="/views/ai-video.jsx"></script>
<script type="text/babel" src="/views/ai-copy.jsx"></script>
<script type="text/babel" src="/views/library.jsx"></script>
<script type="text/babel" src="/views/schedule.jsx"></script>
<script type="text/babel" src="/views/monitor.jsx"></script>
<script type="text/babel" src="/views/ads.jsx"></script>
<script type="text/babel" src="/views/products.jsx"></script>
<script type="text/babel" src="/views/finance.jsx"></script>
<script type="text/babel" src="/views/team.jsx"></script>
<script type="text/babel" src="/views/live-screen.jsx"></script>
<script type="text/babel" src="/views/task-drawer.jsx"></script>
<script type="text/babel" src="/views/live-drawer.jsx"></script>
<script type="text/babel" src="/app.jsx"></script>
</body>
</html>`;
}

// ── Request handler ───────────────────────────────────────────────────────
async function handler(rawReq: IncomingMessage, rawRes: ServerResponse) {
  const res = enhanceRes(rawRes);
  const url = rawReq.url ?? '/';
  const [pathname] = url.split('?');
  const method = (rawReq.method ?? 'GET').toUpperCase() as 'GET'|'POST'|'PATCH'|'DELETE'|'OPTIONS';

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
    });
    return res.end();
  }

  // API routes
  const mod = ROUTES[pathname];
  if (mod) {
    if (!PUBLIC_ROUTES.has(pathname)) {
      const s = requireAuth(rawReq, res);
      if (!s) return;
    }
    if (method === 'POST' || method === 'PATCH') {
      (rawReq as IncomingMessage & { body?: unknown }).body = await readBody(rawReq);
    }
    const req = Object.assign(rawReq, { query: parseQuery(url) });
    const fn = (mod as Record<string, RouteHandler>)[method];
    if (fn) return await fn(req as Parameters<RouteHandler>[0], res);
    return res.json({ error: `Method ${method} not allowed` }, 405);
  }

  // Page: 工作台（需要登录）
  if (pathname === '/' || pathname === '/dashboard') {
    const session = getSession(rawReq);
    if (!session) {
      res.writeHead(302, { Location: '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderShell(session));
  }

  // Page: 登录
  if (pathname === '/login') {
    const session = getSession(rawReq);
    if (session) {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    const html = readFileSync(join(ROOT, 'public/login.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // Static files
  if (serveStatic(res, join(ROOT, 'public', pathname))) return;

  // 404
  res.json({ error: `Not found: ${pathname}` }, 404);
}

// ── Start ─────────────────────────────────────────────────────────────────
const server = createServer(handler);
server.listen(PORT, () => {
  // 启动定时任务调度器
  startScheduler();
  const line = '═'.repeat(54);
  console.log(`
╔${line}╗
║  潮线 Tideline · Dev Server                          ║
║                                                      ║
║  工作台  →  http://localhost:${PORT}                  ║
║  登录页  →  http://localhost:${PORT}/login            ║
║  API     →  http://localhost:${PORT}/api/brands       ║
║                                                      ║
║  demo: chen@nanji.cn  /  tideline2026                ║
╚${line}╝
  `);
});

server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n❌  端口 ${PORT} 被占用，请改用: PORT=3001 node dist/server.mjs\n`);
    process.exit(1);
  } else throw e;
});
