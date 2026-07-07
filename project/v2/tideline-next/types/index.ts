// 潮线 Tideline · 核心类型定义

export interface Brand {
  id: string;
  name: string;
  cat: string;
  logo: string;
  hidden?: boolean;  // 归档/合并时隐藏，不在侧栏显示
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  dept: string;
  brands: string[];
  status: 'online' | 'offline' | 'live';
  last: string;
  initial: string;
}

export interface Task {
  id: string;
  title: string;
  brand: string;
  stage: 'plan' | 'shoot' | 'edit' | 'review' | 'done';
  assignee: string;
  due: string;
  priority: 'high' | 'med' | 'low';
  cover: 'video' | 'image' | 'doc';
  score: number;
}

export interface Account {
  id: string;
  name: string;
  followers: number;
  growth7d: number;
  gmv7d: number;
  live7d: number;
  video7d: number;
  avgVV: number;
  ctr: number;
  cvr: number;
  brand: string;
  color: string;
  externalId?: string;
  tokenExpiresAt?: number;
  hidden?: boolean;           // 归档/隐藏账户（如重复账户），不在常规列表展示
  laikePoi?: string;          // 抖音来客 POI ID（用于来客经营数据接口）
  lifeAccountId?: string;     // 生意经 life-account-id（每品牌不同，区分数据来源）
  bizIsSingle?: number;       // 生意经 is_single：0=集团多店，1=单店（默认 0）
  // 后台首页 statQuery 全域消耗（DataSetKey=pc_home_roi2）——最高优先级今日消耗来源。
  // 开放平台三个 report 接口均不覆盖全域投放口径，只能用 statQuery 对齐后台首页数字。
  // 鉴权依赖本地 .env OCEANENGINE_LOCALADS_COOKIE，不提交。
  statQueryReport?: {
    spent:      number;
    liveSpent:  number;
    videoSpent: number;
    liveGmv:    number;
    videoGmv:   number;
    gmv:        number;
    liveRoi:    number;
    videoRoi:   number;
    roi:        number;
    orders:     number;
    orderCost:  number;
    syncedAt:   number;
    source: 'statQuery_pc_home_roi2' | 'statQuery_pc_home_standard_promotion' | string;
  };
  // 账户级（全域投放）报表汇总——来自 /local/report/account/get/。
  // 全域投放消耗不进项目报表，只在账户报表，故单独缓存供品牌详情页顶部展示。
  globalReport?: {
    spent: number;       // stat_cost 全域消耗（今日）
    gmv: number;         // oto_pay_order_amount 全域成交金额
    orders: number;      // oto_pay_order_count 全域成交订单数
    roi: number;         // oto_pay_order_roi 全域支付ROI
    orderCost: number;   // conversion_cost 成交订单成本
    impressions: number;
    clicks: number;
    ctr: number;
    cpm: number;
    syncedAt: number;
    source: 'account_report';
  };
}

export interface LiveSession {
  id: string;
  brand: string;
  account: string;
  title: string;
  anchor: string;
  startTime: string;
  duration: number;
  gmv: number;
  viewers: number;
  orders: number;
  ctr: number;
  cvr: number;
  status: 'live' | 'ended';
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  cat: string;
  price: number;
  orig: number;
  stock: number;
  sold30d: number;
  gmv30d: number;
  comm: number;
  sample: number;
  status: 'active' | 'hot' | 'new' | 'paused';
  trend: 'up' | 'down' | 'flat';
  score: number;
}

export interface FinanceRecord {
  id: string;
  brand: string;
  type: 'commission' | 'service' | 'bonus';
  amount: number;
  status: 'paid' | 'reconciled' | 'pending' | 'dispute';
  period: string;
  dueDate: string;
}

export interface AdCampaign {
  id: string;
  name: string;
  brand: string;
  account: string;      // advertiser_id（巨量引擎广告主 ID）
  budget: number;
  spent: number;
  cpm: number;
  ctr: number;
  // 本地推核心指标
  storeVisits: number;  // 到店量
  phoneCalls: number;   // 电话确认量
  mapSearches: number;  // 地图搜索量
  coupons: number;      // 发券量
  leads: number;        // 总线索量
  costPerLead: number;  // 线索成本
  impressions?: number;
  clicks?: number;
  // 兼容旧字段
  roas: number;
  cvr: number;
  gmv: number;
  status: 'active' | 'paused' | 'ended' | 'deleted' | 'unknown';
  rawStatus?: string;     // 巨量引擎原始状态字符串，用于调试和诊断
  startDate: string;
  externalId?: string;
  lastSyncAt?: number;
}

export interface ScheduleItem {
  id: string;
  title: string;
  brand: string;
  type: 'live' | 'video' | 'post';
  date: string;
  time: string;
  platform: string;
  assignee: string;
  status: 'draft' | 'approved' | 'scheduled' | 'published' | 'failed';
  videoPath?: string;
  externalVideoId?: string;
  publishedAt?: string;
  failReason?: string;
}

export interface Competitor {
  id: string;
  name: string;
  platform: string;
  followers: number;
  growth7d: number;
  avgVV: number;
  postFreq: number;
  category: string;
  threat: 'high' | 'med' | 'low';
}

// ─── 调控规则 ─────────────────────────────────────────────────────────────
export type RuleMetric   = 'ctr' | 'cpm' | 'spent_pct' | 'store_visits' | 'leads' | 'cost_per_lead' | 'roas' | 'cvr' | 'gmv';
export type RuleOperator = 'lt' | 'gt' | 'lte' | 'gte';
export type RuleAction   = 'pause' | 'resume' | 'increase_budget' | 'decrease_budget' | 'alert';

export interface AutoRule {
  id: string;
  name: string;
  enabled: boolean;
  brand: string;                 // 品牌 id，'all' 表示全部
  metric: RuleMetric;
  operator: RuleOperator;
  threshold: number;
  action: RuleAction;
  actionValue?: number;          // 幅度百分比，如 20 = ±20%
  cooldownMinutes: number;
  createdBy: string;
  createdAt: string;
  lastTriggeredAt?: string;
}

// ─── 操作日志 ─────────────────────────────────────────────────────────────
export type LogSource = 'auto_rule' | 'manual' | 'scheduler' | 'system' | 'ai_analysis' | 'ai_creative' | 'ai_agent';
export type LogLevel  = 'info' | 'warn' | 'error' | 'success';

export interface OperationLog {
  id: string;
  source: LogSource;
  level: LogLevel;
  campaignId?: string;
  campaignName?: string;
  ruleId?: string;
  ruleName?: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  success: boolean;
  errorMsg?: string;
  operatorId?: string;
  aiReason?: string;
  approvedBy?: string;
  createdAt: string;
  // 直播间优化投流（计划级巡检）扩展字段（可选，向后兼容旧日志）
  brandId?: string;
  advertiserId?: string;
  projectId?: string;
  materialId?: string;
  ruleCode?: string;
  evidence?: string;
  suggestedAction?: string;
  dryRun?: boolean;
}

// ─── 外部投流复盘（Codex 等外部代理写入，平台只存+展示）──────────────────────
export interface ExternalReport {
  id: string;
  date: string;            // YYYY-MM-DD
  brandId?: string;
  brandName?: string;
  title: string;
  content: string;         // 纯文本 / Markdown 源文（前端按纯文本安全渲染，防 XSS）
  source: string;          // 来源标记，如 'codex'
  createdAt: string;
}

// ─── AI 4层架构类型 ────────────────────────────────────────────────────────

// Layer 1: Performance Analyzer 输出
export type ProblemType = 'low_ctr' | 'low_cvr' | 'high_cost' | 'low_volume' | 'budget_limited' | 'budget_depleted' | 'data_insufficient';

export interface PerformanceProblem {
  type: ProblemType;
  description: string;
  evidence: string;        // 具体数据依据，如 "CTR 0.8% < 基准 1.5%"
  severity: 'high' | 'medium' | 'low';
}

export interface PerformanceAnalysis {
  summary: string;
  performanceStatus: 'good' | 'warning' | 'bad' | 'unknown';
  problems: PerformanceProblem[];
  rootCauses: string[];
  confidence: number;      // 0–1
}

// Layer 2: Optimization Recommender 输出
export type AiAction = 'hold' | 'pause' | 'increase_budget' | 'decrease_budget' | 'change_creative' | 'manual_review';

export interface AiRecommendation {
  priority: 'high' | 'medium' | 'low';
  action: AiAction;
  suggestedValue?: number;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  triggerCreative?: boolean;
  creativeContext?: 'low_ctr' | 'low_cvr' | 'standalone';
}

// Layer 3: Creative Generator 输出
export interface CreativeResult {
  titles: Array<{ text: string; predictedCtr: number }>;
  bodies: string[];
  sellingPoints: string[];
  videoScript: string;
  imageDirections: string[];
  tags: string[];
  rationale: string;
  trigger?: string;
}

// Layer 4 统一决策记录（替换旧 AiDecision）
export interface AiDecision {
  id: string;
  campaignId: string;
  campaignName: string;
  accountId: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  // Layer 1 输出
  analysis: PerformanceAnalysis;
  // Layer 2 输出
  recommendations: AiRecommendation[];
  selectedRecommendation?: AiRecommendation;
  // Layer 3 输出（如果触发了创意）
  creative?: CreativeResult;
  // 触发时的指标快照
  metricsSnapshot: {
    spent: number; budget: number; ctr: number; leads: number;
    costPerLead: number; roas: number; storeVisits: number; phoneCalls: number;
  };
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  executedAt?: string;
  executionResult?: { success: boolean; errorMsg?: string; before?: Record<string, unknown>; after?: Record<string, unknown> };
  errorMsg?: string;
  createdAt: string;
}

// ─── 平台凭证 ─────────────────────────────────────────────────────────────
export interface PlatformCredential {
  id: string;
  accountId: string;
  platform: 'oceanengine' | 'qianchuan' | 'douyin_open';
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  advertiserId?: string;
  appId?: string;
  updatedAt: string;
}

// ─── 告警配置 ─────────────────────────────────────────────────────────────
export interface AlertConfig {
  id: string;
  type: 'webhook' | 'email';
  name: string;
  endpoint: string;
  enabled: boolean;
  events: Array<'rule_triggered' | 'publish_failed' | 'budget_low' | 'token_expiring'>;
}

// ─── 经营日报 ─────────────────────────────────────────────────────────────

// 每个数字字段的数据来源标注
export type DailyReportCellSrc =
  | 'platform'       // 绿色：statQuery 平台自动拉取
  | 'laike_sales'    // 绿色：抖音来客 coupon_sale_record 自动拉取
  | 'laike_overview' // 蓝色：抖音来客 data_overview（周期不确定）
  | 'manual'         // 灰色：用户手动录入
  | 'derived'        // 紫色：推算（本月 − 昨日）
  | 'pending';       // 黄色：暂无接口，待补充

export interface DailyReportRow {
  key: string;           // zibo | dabo | poi | video
  label: string;         // 自播 | 达播 | POI | 短视频
  history: number | null;
  yesterday: number | null;
  month: number | null;
  target: number | null;
  // 每格数据来源；不记录 = pending
  src?: Partial<Record<'history' | 'yesterday' | 'month' | 'target', DailyReportCellSrc>>;
}

export interface DailyReportLiveCol {
  sessions: number | null;
  gmv: number | null;
  duration: number | null;
}
export interface DailyReportLiveBlock {
  history: DailyReportLiveCol;
  yesterday: DailyReportLiveCol;
  month: DailyReportLiveCol;
}

// 抖音来客 coupon_sale_record 聚合
export interface LaikeSaleSummary {
  totalGmv: number;
  totalOrders: number;
  liveGmv: number;
  searchGmv: number;
  otherGmv: number;
  refundGmv: number;
  validOrderCount: number;
  refundOrderCount: number;
  byChannel: Record<string, number>;
  byProduct: Array<{ name: string; gmv: number; orders: number }>;
}

// 抖音来客 data_overview
export interface LaikeOverviewData {
  payAmount: number;
  payCertCnt: number;
  verifyAmount: number;
  verifyCertCnt: number;
  refundAmount: number;
  productViewUv: number;
}

export interface DailyReport {
  id: string;
  brandId: string;
  brandName: string;
  accountExternalId?: string;
  date: string;
  timeProgress: number;
  gmvRows: DailyReportRow[];
  redeemRows: DailyReportRow[];
  liveDetail: {
    zibo: DailyReportLiveBlock;
    dabo: DailyReportLiveBlock;
  };
  notes: { dabo: string; official: string; officialVideo: string };
  seeded: boolean;
  seedNote?: string;
  source: 'platform' | 'manual';
  createdAt: string;
  updatedAt: string;

  // 投放数据（statQuery 昨日全域消耗）
  adSpend?: {
    totalSpent: number;
    liveSpent: number;
    videoSpent: number;
    liveRoi: number;
    videoRoi: number;
    period: string;   // e.g. "2026-06-15 全天"
    source: 'statQuery_pc_home_roi2' | 'statQuery_pc_home_standard_promotion' | string;
  };

  // 来客成交明细汇总（coupon_sale_record 昨日）
  laikeSales?: LaikeSaleSummary & {
    startDate: string;
    endDate: string;
    fetchedAt: string;
  };

  // 来客经营概览（data_overview，周期不确定）
  laikeOverview?: LaikeOverviewData & {
    fetchedAt: string;
    periodNote: string;
  };

  // 来客经营洞察（data_conclusion/data_explain）
  laikeInsight?: {
    conclusion: string;
    startDate: string;
    endDate: string;
    fetchedAt: string;
  };

  // 来客核销明细（verify_record_list）——元；null=待接入/无数据
  laikeVerify?: {
    yesterdayAmount: number | null;      // 用户实付核销金额（pay_amount ÷ 100）
    yesterdayMerchantAmount: number | null; // 商家实收（merchant_amount ÷ 100，扣佣金后）
    yesterdayOrderCnt: number | null;
    monthAmount: number | null;
    monthMerchantAmount: number | null;
    monthOrderCnt: number | null;
    fetchedAt: string;
  };

  // 生意经流量成交拆分（pay_amount_1d × 场景 × 体裁）——元
  businessTrade?: {
    liveGmv: number;             // 生意经直播渠道 GMV（非达播）
    videoGmv: number;            // 生意经视频渠道 GMV
    leadCardGmv: number;         // 获客卡 GMV
    searchResultCardGmv: number; // 搜索结果卡 GMV
    searchSceneGmv: number;      // 抖音搜索场景 GMV
    recommendSceneGmv: number;   // 推荐分享场景 GMV
    groupbuySceneGmv: number;    // 团购商城场景 GMV
    totalGmv: number;
    rows: Array<{ name: string; scene: string; order: string; gmv: number }>;
    fetchedAt: string;
  };

  // 生意经曝光拆分（show_cnt_1d × 场景）
  businessExposure?: {
    rows: Array<{ scene: string; showCnt: number | null; rate: number | null }>;
    totalShow: number;
    fetchedAt: string;
  };

  // 生意经经营洞察（data_conclusion/data_explain）
  businessInsight?: {
    conclusion: string;
    startDate: string;
    endDate: string;
    fetchedAt: string;
  };

  // 生意经营销概览（coupon_pay_gmv / pay_ord_plat_amt / pay_ord_mer_amt）
  // 单位：分→元。不覆盖总GMV/达播GMV/POI GMV。
  businessMarketing?: {
    couponPayGmv: number;   // 营销成交金额（元）
    platAmt: number;        // 营销平台补贴金额（元）
    merAmt: number;         // 营销商家补贴金额（元）
    compare?: {             // 环比（来自 DeriveData）
      value: number;        // hb_value：上周期绝对值
      diff: number;         // hb_diff：变化量
      ratio: number;        // hb_ratio：变化率（小数，如 0.12 = 12%）
    };
    trend: Array<{ date: string; gmv: number }>; // 营销成交趋势（元）
    fetchedAt: string;
  };

  // 生意经直播分析（达播口径：room_type_filter=TALENT）
  // 昨日区间请求 → yesterday 汇总；本月区间请求 → month 汇总（分别存两个字段）
  businessLive?: {
    // 区间汇总（measureDataV2.data[0]）
    daboGmv: number;          // 达播成交 GMV（元）
    daboCnt: number;          // 达播场次
    daboDurationSec: number;  // 达播时长（秒）
    authorCnt: number;        // 达人数量
    verifyAmount: number;     // 直播间核销金额（元）
    verifyCertCnt: number;    // 直播间核销券数/辅助
    // 本月汇总（由 monthResult 回填，避免两次请求都存在 businessLive 时覆盖）
    monthGmv?: number;
    monthCnt?: number;
    monthDurationSec?: number;
    monthAuthorCnt?: number;
    // 每日趋势（FlowSourceV2.data[]，按 date 升序）
    dailyTrend: Array<{ date: string; gmv: number; durationSec: number; liveCnt: number; authorCnt: number; verifyAmount: number }>;
    // 场次明细（roomRank.data[]）
    rooms: Array<{
      roomTypeTag: string;
      nickname: string;
      uniqueId: string;
      roomTitle: string;
      liveStartStr: string;
      gmv: number;
      durationSec: number;
      verifyOrderAmt: number;
      verifyCertNum: number;
      payCertNum: number;
      payUser: number;
    }>;
    dataDate?: string;        // 数据日（YYYY-MM-DD），与投放数据对齐
    fetchedAt: string;
  };
}

// ─── API 响应 ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}
