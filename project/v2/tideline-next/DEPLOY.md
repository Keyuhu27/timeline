# 潮线 Tideline · 部署文档（Railway / Render）

本服务是一个自定义 Node.js HTTP 服务器（esbuild 打包成单文件 `dist/server.mjs`），
零运行时框架依赖，部署非常简单。

---

## 0. 部署前自检（本地）

```bash
cd project/v2/tideline-next
npm install        # 只有 1 个依赖 @anthropic-ai/sdk
npm run build      # 生成 dist/server.mjs（~690kb）
npm run start      # 本地试跑，访问 http://localhost:3005
```

确认本地能跑起来、能登录后再部署。

> ⚠️ **凭证绝不进 Git**：`.env`、`*.curl.txt`、`*.har` 已在 `.gitignore` 中。
> 所有 Cookie / token / secret 一律在平台的「环境变量面板」配置，不写进代码、不提交仓库。

---

## 1. 关键配置（两个平台通用）

| 项 | 值 |
|----|----|
| **Root Directory** | `project/v2/tideline-next` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Node 版本** | ≥ 18（`package.json` 已声明 `engines.node >=18`） |
| **监听端口** | 读 `process.env.PORT`，由平台自动注入，**不要手动写死** |

> 服务器 `server/index.ts` 用 `parseInt(process.env.PORT ?? '3000')` 读端口，
> Railway/Render 会自动注入 `PORT`，无需在环境变量里设 `PORT`。
> 本地开发才需要 `.env` 里的 `PORT=3005`。

---

## 2. 环境变量清单

在平台的 **Variables / Environment** 面板逐条添加（值从你本地 `.env` 复制）：

### 必填

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | 登录态签名密钥。**生产必须设强随机值**：`openssl rand -hex 32` |
| `OCEANENGINE_APP_ID` | 巨量引擎应用 ID |
| `OCEANENGINE_APP_SECRET` | 巨量引擎应用密钥 |
| `OCEANENGINE_ACCESS_TOKEN` | 巨量引擎 access token |
| `OCEANENGINE_REFRESH_TOKEN` | 巨量引擎 refresh token |
| `OCEANENGINE_LOCAL_ACCOUNT_IDS` | 逗号分隔的本地推账户 ID |

### 本地推 statQuery（后台 Cookie，按需）

| 变量 | 说明 |
|------|------|
| `OCEANENGINE_LOCALADS_COOKIE` | 全局后台 Cookie（默认账户） |
| `OCEANENGINE_LOCALADS_COOKIE_MAP` | 单行 JSON：`{"<advid>":"<cookie>"}`，按 advid 覆盖。**必须单行不换行** |
| `OCEANENGINE_LOCALADS_HEADERS_MAP` | 单行 JSON：按 advid 覆盖额外 header（csrf-token 等） |
| `OCEANENGINE_LOCALADS_DATASET_MAP` | 单行 JSON：advid → `standard`/`roi2`，如 `{"1844144155187404":"standard"}` |

### 生意经 / 来客（日报数据，按需）

| 变量 | 说明 |
|------|------|
| `BUSINESS_COMPASS_COOKIE` | 生意经后台 Cookie |
| `BUSINESS_COMPASS_EXTRA_HEADERS_JSON` | 单行 JSON 额外 header。**禁止含 `life-account-id` / `root-life-account-id`**（会串品牌） |
| `BUSINESS_COMPASS_LIFE_ACCOUNT_MAP` | 单行 JSON：`poiId → "lifeAccountId,isSingle"`，严格按品牌，无 fallback |
| `LAIKE_COOKIE` | 来客后台 Cookie |

### AI 功能（可选）

| 变量 | 说明 |
|------|------|
| `ANTHROPIC_API_KEY` | AI 诊断/文案功能必须 |
| `ANTHROPIC_MODEL` | 可选，默认 `claude-opus-4-8` |
| `AI_OPTIMIZATION_ENABLED` | `true` 开启 AI 优化 |

> **JSON 类变量（`*_MAP` / `*_JSON`）必须是单行、不能换行**，否则解析失败会跳过 statQuery。
> 在平台面板里粘贴时确认没有被自动折行。

---

## 3. Railway 部署步骤

1. https://railway.app → **New Project → Deploy from GitHub repo** → 选 `keyuhu27/timeline`
2. 进 Service → **Settings**：
   - **Root Directory** = `project/v2/tideline-next`
   - **Build Command** = `npm install && npm run build`
   - **Start Command** = `npm run start`
3. **Variables** 标签 → 按上面清单添加（推荐用 **Raw Editor** 一次粘贴多行 `KEY=VALUE`）
4. 部署后 → **Settings → Networking → Generate Domain** 拿到公网地址
5. 巨量 OAuth 回调地址（`OCEANENGINE_CALLBACK_URL`）改成这个公网域名 + `/api/auth/callback`

---

## 4. Render 部署步骤

1. https://render.com → **New → Web Service** → 连 GitHub 选 `keyuhu27/timeline`
2. 配置：
   - **Root Directory** = `project/v2/tideline-next`
   - **Runtime** = Node
   - **Build Command** = `npm install && npm run build`
   - **Start Command** = `npm run start`
3. **Environment** → **Add Environment Variable** 按清单逐条添加（或用 **Secret File** 上传 `.env`）
4. 创建后 Render 给出 `https://xxx.onrender.com` 域名
5. 同样更新巨量 OAuth 回调地址

---

## 5. 已知限制（重要）

- **文件系统是临时的**：Railway/Render 每次重新部署会清空磁盘。SQLite 持久化数据
  （`data/` 目录）和上次同步的账户数据**会丢失**，需重新点「同步广告主」拉取。
  如需长期保留，挂载平台的 **Persistent Volume** 到 `data/`。
- **Cookie 会过期**：巨量后台 / 生意经 / 来客的 Cookie 有有效期，失效后 statQuery 报
  「响应非 JSON / 风控拦截」，需在平台面板更新对应 `*_COOKIE` 变量后重新部署。
- **演示账号**：登录账号 `chen@nanji.cn` / `tideline2026` 是代码内置的硬编码哈希，
  生产环境建议改 `lib/auth.ts` 的 `DEMO_ACCOUNTS` 或接入真实用户库。

---

## 6. 部署后冒烟测试

1. 打开公网域名 → 应跳转 `/login`
2. 用演示账号登录 → 进工作台
3. 未登录直接访问 `/api/brands` → 应返回 401（登录保护生效）
4. 点「同步广告主」→ 拉到真实账户/品牌
5. 进某品牌详情 → 「同步状态」「生成日报」正常
