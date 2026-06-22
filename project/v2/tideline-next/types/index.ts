// 潮线 Tideline · 核心类型定义

export interface Brand {
  id: string;
  name: string;
  cat: string;
  logo: string;
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

// ─── API 响应 ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}
