# 潮线 Tideline · 全栈工程

MCN 代运营平台全栈版。Next.js App Router 目录结构，当前由 Node.js 原生 HTTP server 驱动，`dist/server.mjs` 是零依赖单文件产物，`node dist/server.mjs` 即可运行。

---

## 立即运行（你的机器）

```bash
# 解压后，只需要一条命令：
node dist/server.mjs

# 打开浏览器访问：
# http://localhost:3000          工作台（需要登录）
# http://localhost:3000/login    登录页

# demo 账号
# chen@nanji.cn  /  tideline2026
# lin@nanji.cn   /  tideline2026

# 换端口：
PORT=3001 node dist/server.mjs
```

> **要求：** Node.js ≥ 18。不需要 npm install，`dist/server.mjs` 零依赖。

---

## 目录结构

```
tideline-next/
├── dist/
│   └── server.mjs           ← 零依赖可运行产物（直接 node 跑）
├── app/
│   ├── api/                  # API Route Handlers（Next.js App Router 约定）
│   │   ├── brands/route.ts   GET  /api/brands
│   │   ├── tasks/route.ts    GET + POST + PATCH  /api/tasks
│   │   ├── accounts/route.ts GET  /api/accounts
│   │   ├── lives/route.ts    GET  /api/lives
│   │   ├── products/route.ts GET + POST  /api/products
│   │   ├── finance/route.ts  GET + PATCH  /api/finance
│   │   ├── team/route.ts     GET + POST  /api/team
│   │   ├── ads/route.ts      GET  /api/ads
│   │   ├── schedule/route.ts GET  /api/schedule
│   │   └── monitor/route.ts  GET  /api/monitor
│   └── (auth)/
│       └── login/route.ts    GET + POST  /api/auth/login
├── lib/
│   ├── db.ts                 内存数据层（可替换为 Prisma + SQLite/Postgres）
│   ├── api.ts                ok() / err() / paginate() 工具
│   └── auth.ts               Session cookie 鉴权
├── types/index.ts            12 个实体的完整 TypeScript 类型
├── server/index.ts           Node HTTP 服务器（静态路由 + SSR shell + 静态文件）
└── public/                   前端 SPA（11 个视图）
    ├── app.jsx
    ├── components.jsx
    ├── styles.css
    └── views/（11个）
```

---

## API 端点

所有 API 路由需要登录（`/api/auth/login` 除外）。

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | `{ email, password, action:'login'/'logout' }` | 登录/登出 |
| GET  | `/api/brands` | — | 品牌列表 |
| GET  | `/api/tasks` | `brand` `stage` `assignee` `priority` `page` `pageSize` | 任务看板 |
| POST | `/api/tasks` | `{ title, brand, stage?, assignee?, due?, priority? }` | 新建任务 |
| PATCH| `/api/tasks` | `?id=t101` + body | 更新任务 |
| GET  | `/api/accounts` | `brand` | 账号数据 |
| GET  | `/api/lives` | `brand` `status` | 直播记录 |
| GET  | `/api/products` | `brand` `cat` `status` `q` `sortBy` `order` | 选品中心 |
| GET  | `/api/finance` | `status` `brand` `type` | 结算（含汇总） |
| PATCH| `/api/finance` | `?id=f1` + `{ status }` | 更新结算状态 |
| GET  | `/api/team` | `dept` `status` `q` | 团队成员 |
| POST | `/api/team` | `{ name, email, role?, dept? }` | 邀请成员 |
| GET  | `/api/ads` | `brand` `status` | 投放计划（含汇总） |
| GET  | `/api/schedule` | `brand` `type` `status` `from` `to` | 排期日历 |
| GET  | `/api/monitor` | `category` `threat` | 竞品监控 |

---

## 迁移到真实 Next.js（5 步，约 30 分钟）

### 1. 初始化 Next.js

```bash
npx create-next-app@latest . --typescript --app --no-tailwind --no-eslint
```

### 2. Route handlers 改写

`app/api/*/route.ts` 已按 Next.js App Router 约定组织。改动只有函数签名：

```typescript
// 现在（自定义 server）
export const GET: RouteHandler = (req, res) => {
  ok(res, brands);
};

// Next.js 改法
import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ data: brands });
}
```

运行一键迁移脚本（约 80% 自动转换）：
```bash
node scripts/migrate-routes.mjs
```

### 3. 数据层换 SQLite

```bash
npm install better-sqlite3 @types/better-sqlite3
```

```typescript
// lib/db.ts 顶部替换为：
import Database from 'better-sqlite3';
const db = new Database('tideline.db');
export const brands = db.prepare('SELECT * FROM brands').all() as Brand[];
```

### 4. Auth 换 NextAuth

```bash
npm install next-auth
```

把 `lib/auth.ts` 的 session 换成 NextAuth 的 `getServerSession()`。

### 5. 删除 server/ 目录

Next.js 自带 server，`server/index.ts` 整个目录删掉即可。

---

**技术栈：** Node 18+ · TypeScript · React 18（客户端 SPA）  
**测试：** 37 个单元测试全部通过（数据层 / 过滤 / 排序 / 分页 / Auth）
