# CODEX 直连 API 手册 · 巨量本地推 / 生意经

> 目的：让 Codex（或它写的 worker）**不经过潮线平台**，直接调用巨量本地推 / 生意经的
> 真实接口读数与调控。本手册中的接口全部是潮线适配器里**已跑通**的调用，逐条标注了
> 方法、URL、关键参数、以及凭证**存在哪个环境变量**。

## ⚠️ 安全须知（务必遵守）

- 所有 cookie / access_token / msToken **只从环境变量读取**，绝不写进代码、绝不提交 Git。
- 本手册**不含任何明文凭证**，只写变量名。真实值在 Railway 环境变量面板里。
- `life-account-id` 只能由 `BUSINESS_COMPASS_LIFE_ACCOUNT_MAP` 按品牌解析，**禁止**写死在
  `BUSINESS_COMPASS_EXTRA_HEADERS_JSON` 里（会串品牌）。
- 直连 = 绕过了潮线平台已有的护栏（dry-run / 审批 / 冷却 / 操作日志）。因此调控脚本必须
  **自带护栏**（见文末 Prompt）。

## 🔑 先认清一件事

| 系统 | 能读 | 能写/调控 | 鉴权 |
|------|------|-----------|------|
| **生意经 life-data.cn** | ✅ 成交/流量/直播拆分 | ❌ **没有任何写接口** | Cookie + life-account-id |
| **本地推 OpenAPI v3.0** | ✅ 计划/账户报表 | ✅ **开关计划、改预算** | Access-Token |
| **本地推 网页口径** | ✅ 全域消耗/ROI/短视频 | ❌ 只读 | Cookie |

**结论：真正的"自动调控"这条腿只能落在「本地推 OpenAPI v3.0」上。** 生意经和网页 statQuery
只能当只读输入。

---

## ① 本地推 OpenAPI v3.0（可写 · 调控主力 · 推荐）

- **Base**：`https://api.oceanengine.com/open_api/v3.0/local/`
- **鉴权头**：`Access-Token: <OCEANENGINE_ACCESS_TOKEN>`
- **Token 刷新**（access_token 会过期）：用 `OCEANENGINE_REFRESH_TOKEN` +
  `OCEANENGINE_APP_ID` + `OCEANENGINE_APP_SECRET` 走标准 OAuth 刷新接口
  （`POST https://api.oceanengine.com/open_api/oauth2/refresh_token/`）。
- **大整数**：`local_account_id`、`project_id` 是 19 位雪花 ID，超过 JS 安全整数。**必须以原始
  整数字面量序列化**（不加引号、不经 `Number()`），否则精度丢失。潮线用 `stringifyWithRawInts`
  实现（`lib/adapters/oceanengine-adapter.ts`）。

| 动作 | 方法 · 路径 | 关键 body / params | 只读/写 |
|------|-----------|-------------------|---------|
| **关计划** | `POST project/status/update/` | `{ local_account_id, data:[{ project_id, opt_status:"PAUSED" }] }` | 写 |
| **开计划** | `POST project/status/update/` | 同上，`opt_status:"ENABLE"` | 写 |
| **改预算** | `POST project/update/` | `{ local_account_id, data:{ project_id, budget:<元>, budget_mode:"BUDGET_MODE_DAY" } }` | 写 |
| **读计划报表** | `GET report/project/get/` | `local_account_id, time_granularity:"TIME_GRANULARITY_TOTAL", start_date, end_date, metrics:<JSON字符串>, page, page_size`；按计划过滤加 `filtering={"cdp_project_ids":[<原始整数>,...]}` | 读 |
| **读账户报表** | `GET report/account/get/` | 同上（不带 project 过滤） | 读 |

来源核对：`_updateProjectStatus` / `_updateProjectBudget` / `fetchProjectReport` /
`fetchAccountReport`（`lib/adapters/oceanengine-adapter.ts`）。

---

## ② 本地推 网页 Cookie 口径（只读 · 脆弱）

- **Base**：`https://localads.chengzijianzhan.cn/`
- **鉴权**：`Cookie: <OCEANENGINE_LOCALADS_COOKIE>`（或按 advid 覆盖的
  `OCEANENGINE_LOCALADS_COOKIE_MAP`），并带额外头 `OCEANENGINE_LOCALADS_HEADERS(_MAP)`。
- 必带 `Origin: https://localads.chengzijianzhan.cn`、
  `Referer: https://localads.chengzijianzhan.cn/lamp/pc/home?advid=<advid>`。
- ⚠️ Cookie 会过期、可能触发风控。**只适合读，不能作为长期自动化的唯一依赖。**

| 数据 | 方法 · 路径 | 说明 |
|------|-----------|------|
| 全域投放消耗/ROI（直播/门店POI） | `POST /api/lamp/pc/v2/statistics/data/statQuery?advid=<advid>` | body 指定 dataset（`pc_home_roi2` / `pc_home_standard_promotion`）与 metrics/conditions |
| 短视频素材（消耗/转化数） | `GET /material_center/api/v1/analysis/adv/overview/metrics?advid=&statistic_start_time=&statistic_end_time=&scene=<OCEANENGINE_MATERIAL_SCENE>` | scene 全账户通用 |

来源核对：`fetchHomeRoi2StatQuery` / `fetchStandardPromotionSpent` /
`fetchVideoAnalysisMetrics`（同文件）。

---

## ③ 生意经 life-data.cn（只读 · 无写接口）

- **Base**：`BUSINESS_COMPASS_API_BASE`（例：`https://www.life-data.cn`）
- **鉴权**：`Cookie: <BUSINESS_COMPASS_COOKIE>` + 头 `life-account-id` / `root-life-account-id`
  （**只从 `BUSINESS_COMPASS_LIFE_ACCOUNT_MAP` 按品牌 poiId 解析**）+ 可选
  `BUSINESS_COMPASS_EXTRA_HEADERS_JSON`（不得含 life-account-id）。

| 数据 | 方法 · 路径（可被同名 `_URL` env 覆盖） |
|------|------|
| 成交概览 / 直播拆分 | `POST /api/dito/query`（`BUSINESS_FLOW_TRADE_OVERVIEW_URL` / `BUSINESS_FLOW_LIVE_URL`） |
| 流量成交拆分 | `POST /api/compass/flow/trade_split`（`BUSINESS_FLOW_TRADE_SPLIT_URL`） |
| 流量曝光拆分 | `POST /api/compass/flow/exposure_split`（`BUSINESS_FLOW_EXPOSURE_URL`） |
| 营销概览 / 趋势 | `POST /api/compass/marketing/overview` · `/trend` |
| 洞察结论 | `POST /api/compass/flow/insights`（`BUSINESS_FLOW_INSIGHTS_URL`） |

来源核对：`headers()` 与各接口（`lib/adapters/business-compass-adapter.ts`）。

---

## 📋 环境变量速查（只列名，值在 Railway）

```
# 本地推 OpenAPI（可写/调控）
OCEANENGINE_ACCESS_TOKEN
OCEANENGINE_REFRESH_TOKEN
OCEANENGINE_APP_ID
OCEANENGINE_APP_SECRET
OCEANENGINE_LOCAL_ACCOUNT_IDS      # 逗号分隔的本地推账户 advid

# 本地推 网页口径（只读）
OCEANENGINE_LOCALADS_COOKIE / _MAP
OCEANENGINE_LOCALADS_HEADERS / _MAP
OCEANENGINE_LOCALADS_DATASET_MAP   # advid → standard/roi2
OCEANENGINE_MATERIAL_SCENE         # 短视频 scene，全账户通用

# 生意经（只读）
BUSINESS_COMPASS_API_BASE
BUSINESS_COMPASS_COOKIE
BUSINESS_COMPASS_LIFE_ACCOUNT_MAP  # poiId → "lifeAccountId,isSingle"
BUSINESS_COMPASS_EXTRA_HEADERS_JSON
```

各品牌 advid 对照见 `DEPLOY.md` 的「2.5 按品牌四套配置总清单」。

---

## 🤖 给 Codex 的 Prompt（可直接粘贴）

```
你是投流自动化工程师。请阅读本仓库的 CODEX_DIRECT_API.md，直接对接巨量本地推做自动调控，
不经过潮线平台。

数据与凭证：
- 所有 cookie / access_token 只从环境变量读（变量名见 CODEX_DIRECT_API.md 的「环境变量速查」），
  绝不硬编码、绝不提交 Git。
- 调控只用「① 本地推 OpenAPI v3.0」（Access-Token）：
  · 关计划 POST project/status/update/ (opt_status=PAUSED)
  · 开计划 POST project/status/update/ (opt_status=ENABLE)
  · 改预算 POST project/update/ (budget + budget_mode=BUDGET_MODE_DAY)
  · 读报表 GET report/project/get/ 和 report/account/get/
  · local_account_id / project_id 必须以原始整数字面量序列化（19 位大整数，别用 Number()）。
- 只读输入：网页 statQuery（消耗/ROI）与生意经（成交拆分）。注意生意经没有写接口、
  statQuery 的 cookie 会过期——它们只能当参考信号，不要依赖它们做调控通道。
- access_token 过期时用 refresh_token + app_id/app_secret 刷新后重试。

方法论（确定性阈值，先用这套）：
- 止损：某计划 消耗 > <阈值> 且 ROI < <地板值> → PAUSED。
- 放大：某计划 ROI > <目标> 且 预算消耗接近上限 → 提预算（单次 ≤ <幅度上限>%）。
- 憋单节点（若有实时信号）：进入逼单 → ENABLE + 临时提预算；节点结束 → PAUSED 或回落。

执行纪律（重要）：
1. 默认 dry-run：只打印「将要发送的请求」（方法/URL/body），不真实下发。
2. 我显式说「开真实执行」后才下发；即便如此，放大类动作要有护栏：单场消耗上限、单次调幅
   上限、两次动作最短间隔。控损类（PAUSED/降预算）可自动。
3. 每个动作打印一条结构化日志：时间、计划、动作、依据指标值、结果。
4. 先产出「先读一条 advid 的计划报表」的最小验证，再逐步接调控。
```

> 建议先让 Codex 只跑「读报表 + dry-run 调控预览」，确认它对接正确、方法论符合预期，
> 再打开真实执行开关，并只在一条测试计划上验证 PAUSED→ENABLE 往返。
