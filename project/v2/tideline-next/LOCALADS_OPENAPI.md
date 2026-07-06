# 巨量本地推 OpenAPI 参考（读数 + 调控）

> 平台代码里**已跑通**的稳定接口整理。全部走官方 OpenAPI v3.0（`Access-Token`），
> **无 a_bogus/msToken 签名问题**，适合服务器自动化。凭证只从环境变量读，勿写死/勿提交 Git。

## 通用

| 项 | 值 |
|----|----|
| **base_url** | `https://api.oceanengine.com/open_api/v3.0/local/` |
| **鉴权方式** | 请求头 `Access-Token: <token>`（**放 header，不是 query**）｜token 来自 `OCEANENGINE_ACCESS_TOKEN`，过期用 `OCEANENGINE_REFRESH_TOKEN`+`APP_ID`/`APP_SECRET` 走 `POST /open_api/oauth2/refresh_token/` 刷新 |
| **响应信封** | `{ "code": 0, "message": "OK", "data": {...} }`，`code===0` 为成功 |
| **大整数** | `local_account_id` / `project_id` 是 19 位雪花 ID，超 JS 安全整数。**写接口 body 里必须是「原始整数字面量」（不加引号）**；**读响应用大整数安全解析**（16 位以上裸整数先包成字符串），否则末位精度丢失 |
| **账户 ID** | 本地推用 `local_account_id`（= oauth2/advertiser/get 返回的本地推商家 ID），不是投放广告的 advertiser_id |

---

## 1. 计划列表（拿 project_id / 状态 / 预算）

`GET project/list/`

**Query**：`local_account_id=<id>&page=1&page_size=100`

**返回样例**：
```json
{ "code": 0, "message": "OK", "data": {
  "project_list": [
    {
      "project_id": 1868969278532624,
      "name": "阿云带你吃-直播全域",
      "opt_status": "PAUSED",              // 开关状态：ENABLE / PAUSED / DELETE（最权威）
      "project_status": "PROJECT_STATUS_DONE",
      "project_budget": 1000,
      "project_budget_mode": "BUDGET_MODE_DAY",
      "poi_info": { "poi_name": "xxx门店" }
    }
  ],
  "page_info": { "total_number": 20, "page": 1, "page_size": 100 }
}}
```

---

## 2. 计划数据 / 报表（消耗、成交、ROI、订单）

`GET report/project/get/`

**Query**：
```
local_account_id=<id>
time_granularity=TIME_GRANULARITY_TOTAL
start_date=2026-07-07&end_date=2026-07-07
metrics=<JSON 字符串数组，见下>
page=1&page_size=100
filtering={"cdp_project_ids":[1868969278532624]}   // 可选，按计划过滤；不传=全部
```

**metrics 可用字段**（总成交口径）：
```
stat_cost              消耗(元)
oto_pay_order_count    总成交订单数
oto_pay_order_amount   总成交金额(元)
oto_pay_order_roi      总支付ROI
show_cnt / click_cnt / ctr / cpm_platform / convert_cnt / conversion_cost
poi_recommend_count（到店引流人数）/ phone_confirm_cnt / form_cnt / clue_pay_order_cnt
```

**返回样例**：
```json
{ "code": 0, "data": {
  "project_list": [
    { "dimensions": { "cdp_project_id": 1868969278532624 },
      "metrics": { "stat_cost": 4551.41, "oto_pay_order_count": 1079,
                   "oto_pay_order_amount": 33898.43, "oto_pay_order_roi": 7.45 } }
  ],
  "page_info": { "total_number": 20 }
}}
```
> 订单成本自算：`stat_cost / oto_pay_order_count`。

**账户级同理**：`GET report/account/get/`（不带计划过滤，返回全域账户汇总）。

---

## 3. 动作 · 启停计划

`POST project/status/update/`

**Body**（project_id / local_account_id 为**原始整数**）：
```json
{ "local_account_id": 1809564038287363,
  "data": [ { "project_id": 1868969278532624, "opt_status": "PAUSED" } ] }
```
- 暂停 → `"opt_status": "PAUSED"`；恢复 → `"opt_status": "ENABLE"`
- 返回 `{ "code": 0, "data": {...} }`

## 4. 动作 · 改预算

`POST project/update/`

**Body**：
```json
{ "local_account_id": 1809564038287363,
  "data": { "project_id": 1868969278532624,
            "budget": 1500, "budget_mode": "BUDGET_MODE_DAY" } }
```
- `budget` 单位元；日预算固定 `BUDGET_MODE_DAY`
- 返回 `{ "code": 0, "data": {...} }`

## 5. 动作 · 调出价 / ROI 目标（未在本平台实现，需确认）

同样走 `POST project/update/`，理论上 `data` 里带出价/ROI 目标字段（如 `roi_goal` / `cpa_bid`），
但**本平台代码未实现、未验证字段名**。要用请查官方文档或抓一次后台「调控」动作确认确切字段，再补。

---

## 附：直播间画面页（素材级 · 全域口径）—— ⚠️ 服务器自动化拉不到

后台「计划详情 → 素材 → 直播间画面」那张表，走的是**网页接口**，**强制 `a_bogus`/`msToken` 签名**
（前端 JS 现算、几分钟过期）。**服务器定时轮询无法稳定获取**（实测返回 `code=40010` 风控）。
人工浏览器可看；自动化需无头浏览器代跑页面 JS 签名（另做）。

- URL：`GET https://localads.chengzijianzhan.cn/api/lamp/pc/v2/statistics/promotion/getOrderStatsData`
- 鉴权：Cookie + query 里的 `a_bogus`&`msToken`（签名）
- 字段映射（响应 `data.data.totalMetrics.<key>.value`）：

| 页面列 | 响应字段 |
|--------|----------|
| 消耗 | `statCost` |
| 全域成交金额 | `liveOtoPayOrderStatAmountForRoi2` |
| 全域成交订单数 | `liveOtoPayOrderCountForRoi2` |
| 全域支付 ROI | `liveOtoPayOrderRoi2` |
| 全域成交订单成本 | `liveCostPerOtoPayOrderForRoi2` |

> 口径差异：本页是「全域(for_roi2)」；OpenAPI 报表（第 2 节）是「总成交(oto_pay)」。
> 自动化只能用后者，数值会略有差异。

---

## 一句话总结

- **能自动化的**：`Access-Token` header + `base_url` 上的 `project/list/`(列计划)、`report/project/get/`(取数)、`project/status/update/`(启停)、`project/update/`(改预算)。
- **不能自动化的**：直播间画面页的「全域/素材级」数据（需 a_bogus 签名）。
