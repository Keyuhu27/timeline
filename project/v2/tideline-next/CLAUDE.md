# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 项目定位

**潮线 Tideline** — MCN（达人机构）全流程运营平台，覆盖：本地推投流管理、AI文案生成、内容排期、数据看板、财务结算。

当前技术状态：**过渡架构** — 目录结构仿照 Next.js App Router，但运行时是自定义 Node.js HTTP 服务器（esbuild 打包为单文件）。路由表静态注册，不走 Next.js 运行时。

---

## 常用命令

```bash
# 构建（esbuild 打包 server/index.ts → dist/server.mjs）
npm run build

# 运行开发服务器（需先 build）
npm run dev

# 类型检查（不打包，仅 tsc）
npm run typecheck

# 默认端口 3005（.env 中配置）
```

> **无热更新**：修改任何 `.ts` 文件后必须重新 `npm run build`，修改 `public/` 下的 `.jsx`/`.css` 文件无需重建（直接静态服务）。

---

## 架构关键点

### 路由注册（必须手动维护）

新增 API endpoint 必须在 **`server/index.ts`** 的 `ROUTES` 静态表中注册，否则永远 404：

```typescript
// server/index.ts — ROUTES 对象
'/api/ai/analyze': { POST: aiAnalyzeRoute.POST },
```

`app/api/*/route.ts` 文件只导出 `GET`/`POST`/`PATCH`/`DELETE` 函数，不自动发现。

### 前端架构

纯 CDN React（无 JSX 编译步骤），所有视图在 `public/views/*.jsx` 中：

- `public/data.jsx` — 全局状态，`TL` 对象（`TL.brands`, `TL.campaigns` 等），所有视图共享
- `public/components.jsx` — 通用 UI：`Chip`, `Icon`, `Stat3` 等
- `public/views/ads.jsx` — 本地推管理（含 Campaigns / Rules / Logs 三个子组件）
- `public/views/ai-copy.jsx` — AI 文案生成工作台

新视图需在 `public/app.jsx` 的路由中注册，并在 `public/data.jsx` 初始化时加载。

### 数据层

`lib/db.ts` 导出内存数组（`brands[]`, `accounts[]`, `adCampaigns[]` 等），并暴露辅助函数：

```typescript
brandById(id)   // 按 id 查 Brand
accountById(id) // 按 id 查 Account
```

`adCampaigns[]` 启动时为空，通过 `/api/accounts POST` 触发同步后填充。

`aiDecisions[]` 同样为空数组，存储 AI 诊断决策记录。

### 大整数处理（重要）

OceanEngine 的 `advertiser_id` 和 `campaign_id` 是 19 位雪花 ID，超过 `Number.MAX_SAFE_INTEGER`。所有 OceanEngine API 响应必须用 `safeJsonParse()`（`lib/adapters/oceanengine-adapter.ts`）而非 `JSON.parse()`，否则 ID 精度丢失。

### AI 层

`lib/ai/` 目录：

| 文件 | 职责 |
|------|------|
| `claude-client.ts` | Anthropic SDK 封装，默认模型 `claude-opus-4-8` |
| `campaign-analyzer.ts` | 分析单个广告计划，输出结构化诊断（`AiAnalysisResult`） |
| `creative-generator.ts` | 生成标题/正文/标签/卖点 |
| `optimization-agent.ts` | 多指标决策，输出 `AiRecommendation[]` |

所有 AI 写操作必须写入 `operationLogs`，`source` 字段用 `'ai_analysis'` / `'ai_creative'` / `'ai_agent'` 区分。

### 规则引擎

`lib/scheduler/rule-engine.ts` — 已实现两层调控：

- **硬边界**：`autoRules[]` 的 if-else 阈值触发，调用 `executeAction()` → 真实 OceanEngine API（pause / resume / adjustBudget）
- **软优化**（规划中）：AI Agent 层，建议而非自动执行，需人工审批

`executeAction()` 调用的是真实巨量引擎 API，不是 mock。

---

## 环境变量

`.env` 文件（不提交 Git）：

```
OCEANENGINE_APP_ID=
OCEANENGINE_APP_SECRET=
OCEANENGINE_ACCESS_TOKEN=
OCEANENGINE_REFRESH_TOKEN=
OCEANENGINE_LOCAL_ACCOUNT_IDS=   # 逗号分隔的本地推账户 ID
JWT_SECRET=
PORT=3005
ANTHROPIC_API_KEY=               # AI 功能必须
ANTHROPIC_MODEL=claude-opus-4-8  # 可选，覆盖默认模型
AI_OPTIMIZATION_ENABLED=true
```

---

## 类型定义

核心类型在 `types/index.ts`：

- `AdCampaign` — 广告计划（含本地推核心指标：`storeVisits`, `phoneCalls`, `leads`, `costPerLead`）
- `OperationLog` — 操作日志，`source` 字段区分来源（`auto_rule` / `manual` / `scheduler` / `system` / `ai_analysis` / `ai_creative` / `ai_agent`）
- `AiDecision` — AI 决策记录，含 `status`（`pending` / `approved` / `rejected` / `executed` / `failed`）
- `AiAnalysisResult` — 诊断结构（`summary`, `problems[]`, `recommendations[]`, `confidence`）
- `AiRecommendation` — 单条建议，含 `requiresApproval` 标志

---

## 演示账号

```
chen@nanji.cn / tideline2026  （主理人，全权限）
lin@nanji.cn  / tideline2026  （编导，内容权限）
```

---

## 正在进行的 AI 功能开发（Phase 1-3）

计划文件：`/root/.claude/plans/shiny-forging-wreath.md`

**已完成：**
- `@anthropic-ai/sdk` 已安装
- `types/index.ts` 已扩展 `AiDecision`, `AiAnalysisResult`, `AiRecommendation` 等类型
- `lib/ai/` 四个文件已创建骨架

**下一步：**
1. 补全 `lib/ai/campaign-analyzer.ts` 核心 prompt 逻辑
2. 实现 `POST /api/ai/analyze` endpoint，注册到路由表
3. 在 `public/views/ads.jsx` 的投放计划列表加「AI诊断」按钮
4. 将 `public/views/ai-copy.jsx` 的 mock `regen()` 替换为真实 `POST /api/ai/creative` 调用
