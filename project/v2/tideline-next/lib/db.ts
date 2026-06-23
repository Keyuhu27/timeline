// 潮线 Tideline · In-memory data store
// 所有数字均为虚构演示数据。
// 结构对齐 SQL schema，后续可直接替换为 Prisma/Drizzle 调用。

import type {
  Brand, TeamMember, Task, Account, LiveSession,
  Product, FinanceRecord, AdCampaign, ScheduleItem, Competitor, AiDecision,
  DailyReport,
} from '../types/index';

// ─── Brands ────────────────────────────────────────────────────────────────
export const brands: Brand[] = [
  { id: 'b1',  name: '快乐蜂（中国）餐饮',         cat: '餐饮',   logo: '快' },
  { id: 'b2',  name: '耀银-广州烨道餐饮',           cat: '餐饮',   logo: '耀' },
  { id: 'b3',  name: '广州烨道餐饮上城钱江',        cat: '餐饮',   logo: '广' },
  { id: 'b4',  name: '亿滋本地推',                  cat: '餐饮',   logo: '亿' },
  { id: 'b5',  name: '萤山の温泉',                  cat: '休闲旅游', logo: '萤' },
  { id: 'b6',  name: '武义蝶来望境温泉酒店',        cat: '酒店',   logo: '蝶' },
  { id: 'b7',  name: '武义宏马文化发展',            cat: '文旅',   logo: '宏' },
  { id: 'b8',  name: '天鸿丝绸(福田三区店)',        cat: '零售',   logo: '天' },
  { id: 'b9',  name: '上前小店',                    cat: '零售',   logo: '上' },
  { id: 'b10', name: '半日懒竹林漂流',              cat: '户外休闲', logo: '竹' },
];

// ─── Team ────────────────────────────────────────────────────────────────
export const team: TeamMember[] = [
  { id: 'u1', name: '陈思远', role: '主理人 / Owner', email: 'chen@nanji.cn', dept: '管理层', brands: ['全部'], status: 'online', last: '5分钟前', initial: '陈' },
  { id: 'u2', name: '林玥',   role: '编导',           email: 'lin@nanji.cn',  dept: '内容',   brands: ['青朴','云杉'], status: 'online', last: '刚才', initial: '林' },
  { id: 'u3', name: '周一航', role: '剪辑师',         email: 'zhou@nanji.cn', dept: '内容',   brands: ['云杉','林野'], status: 'online', last: '12分钟前', initial: '周' },
  { id: 'u4', name: '宋知夏', role: '数据分析师',     email: 'song@nanji.cn', dept: '数据',   brands: ['全部'], status: 'offline', last: '昨天 18:20', initial: '宋' },
  { id: 'u5', name: '苏念',   role: '直播运营',       email: 'su@nanji.cn',   dept: '直播',   brands: ['云杉','青朴'], status: 'live', last: '直播中', initial: '苏' },
  { id: 'u6', name: '黎明',   role: '投放',           email: 'li@nanji.cn',   dept: '投放',   brands: ['全部'], status: 'online', last: '8分钟前', initial: '黎' },
  { id: 'u7', name: '何雨彤', role: '编导',           email: 'he@nanji.cn',   dept: '内容',   brands: ['林野','小鹿'], status: 'offline', last: '昨天 22:15', initial: '何' },
  { id: 'u8', name: '罗子谦', role: '商务',           email: 'luo@nanji.cn',  dept: '商务',   brands: ['全部'], status: 'online', last: '32分钟前', initial: '罗' },
];

// ─── Tasks ────────────────────────────────────────────────────────────────
export const tasks: Task[] = [
  { id: 't101', title: '青朴山茶花精华 · 9月主推视频脚本 v2', brand: 'b1', stage: 'review', assignee: 'u2', due: '今天 18:00', priority: 'high', cover: 'video', score: 86 },
  { id: 't102', title: '林野手剥松子 · 直播间预告短视频',      brand: 'b2', stage: 'shoot',  assignee: 'u3', due: '明天 12:00', priority: 'med',  cover: 'video', score: 72 },
  { id: 't103', title: '小鹿真丝枕套 · 测评对比图文',          brand: 'b3', stage: 'edit',   assignee: 'u2', due: '5月14日',  priority: 'med',  cover: 'image', score: 68 },
  { id: 't104', title: '云杉夏日防晒衣 · 达人合作剧情',        brand: 'b4', stage: 'plan',   assignee: 'u1', due: '5月15日',  priority: 'high', cover: 'video', score: 90 },
  { id: 't105', title: '北麓 N1 蓝牙耳机 · 开箱测评',          brand: 'b5', stage: 'plan',   assignee: 'u3', due: '5月16日',  priority: 'low',  cover: 'video', score: 64 },
  { id: 't106', title: '青朴 · 母亲节大促首图&主图',            brand: 'b1', stage: 'done',   assignee: 'u2', due: '已完成',   priority: 'high', cover: 'image', score: 95 },
  { id: 't107', title: '林野 · 直播脚本（5/12 晚 19:30）',     brand: 'b2', stage: 'review', assignee: 'u5', due: '今天 22:00', priority: 'high', cover: 'doc',   score: 81 },
  { id: 't108', title: '云杉防晒衣 · 投流素材 ×6',             brand: 'b4', stage: 'edit',   assignee: 'u6', due: '5月13日',  priority: 'med',  cover: 'video', score: 75 },
  { id: 't109', title: '小鹿 · 周报数据复盘',                  brand: 'b3', stage: 'done',   assignee: 'u4', due: '已完成',   priority: 'low',  cover: 'doc',   score: 92 },
];

// ─── Accounts ────────────────────────────────────────────────────────────
// externalId = 巨量引擎广告主 ID（advertiser_id）
export const accounts: Account[] = [
  { id: 'a1',  name: '快乐蜂（中国）餐饮管理有限公司',        externalId: '1745303406415880', brand: 'b1',  color: 'c1',  followers: 0, growth7d: 0, gmv7d: 0, live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0 },
  { id: 'a2',  name: '耀银-广州烨道餐饮-上城钱江路',          externalId: '1847915308786764', brand: 'b2',  color: 'c2',  followers: 0, growth7d: 0, gmv7d: 0, live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0 },
  { id: 'a3',  name: '广州烨道餐饮管理有限公司上城钱江',      externalId: '1839229761224026', brand: 'b3',  color: 'c3',  followers: 0, growth7d: 0, gmv7d: 0, live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0 },
  { id: 'a4',  name: '亿滋本地推',                             externalId: '1851121699721292', brand: 'b4',  color: 'c4',  followers: 0, growth7d: 0, gmv7d: 0, live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0 },
  { id: 'a5',  name: '萤山の温泉',                             externalId: '1815580479574091', brand: 'b5',  color: 'c5',  followers: 0, growth7d: 0, gmv7d: 0, live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0 },
  { id: 'a6',  name: '武义蝶来望境温泉酒店_3号',              externalId: '1845654470244352', brand: 'b6',  color: 'c6',  followers: 0, growth7d: 0, gmv7d: 0, live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0 },
  { id: 'a7',  name: '武义宏马文化发展有限公司_2号',          externalId: '1845654181143703', brand: 'b7',  color: 'c7',  followers: 0, growth7d: 0, gmv7d: 0, live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0 },
  { id: 'a8',  name: '天鸿丝绸(福田三区店)-gfs',              externalId: '1844144155187404', brand: 'b8',  color: 'c8',  followers: 0, growth7d: 0, gmv7d: 0, live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0 },
  { id: 'a9',  name: '上前小店-gfs',                          externalId: '1840323758018395', brand: 'b9',  color: 'c9',  followers: 0, growth7d: 0, gmv7d: 0, live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0 },
  { id: 'a10', name: '半日懒竹林漂流',                        externalId: '',                 brand: 'b10', color: 'c10', followers: 0, growth7d: 0, gmv7d: 0, live7d: 0, video7d: 0, avgVV: 0, ctr: 0, cvr: 0 },
];

// ─── Live Sessions ────────────────────────────────────────────────────────
export const lives: LiveSession[] = [
  { id: 'l1', brand: 'b4', account: 'a4', title: '云杉夏日防晒衣场专场', anchor: '苏念', startTime: '2026-05-12 19:00', duration: 240, gmv: 482600, viewers: 28400, orders: 1842, ctr: 0.083, cvr: 0.064, status: 'live' },
  { id: 'l2', brand: 'b1', account: 'a1', title: '青朴母亲节大促直播',   anchor: '陈思远', startTime: '2026-05-11 20:00', duration: 180, gmv: 312000, viewers: 19200, orders: 1048, ctr: 0.072, cvr: 0.054, status: 'ended' },
  { id: 'l3', brand: 'b2', account: 'a2', title: '林野夏日鲜食专场',     anchor: '林玥', startTime: '2026-05-10 19:30', duration: 210, gmv: 198400, viewers: 14600, orders: 892, ctr: 0.061, cvr: 0.061, status: 'ended' },
  { id: 'l4', brand: 'b3', account: 'a3', title: '小鹿夏日家居焕新',     anchor: '何雨彤', startTime: '2026-05-09 20:00', duration: 150, gmv: 124800, viewers: 9800,  orders: 524, ctr: 0.052, cvr: 0.054, status: 'ended' },
];

// ─── Products ────────────────────────────────────────────────────────────
export const products: Product[] = [
  { id: 'p1', name: '青朴山茶花修护精华液 30ml', brand: 'b1', cat: '美妆', price: 298, orig: 358, stock: 4280, sold30d: 1842, gmv30d: 548616, comm: 0.18, sample: 8,  status: 'active', trend: 'up',   score: 92 },
  { id: 'p2', name: '林野手剥松子 罐装 220g',    brand: 'b2', cat: '食品', price: 68,  orig: 89,  stock: 6840, sold30d: 3284, gmv30d: 223312, comm: 0.22, sample: 6,  status: 'active', trend: 'up',   score: 84 },
  { id: 'p3', name: '小鹿真丝枕套 19姆米 单只',  brand: 'b3', cat: '家居', price: 168, orig: 228, stock: 1240, sold30d: 642,  gmv30d: 107856, comm: 0.25, sample: 4,  status: 'active', trend: 'flat', score: 76 },
  { id: 'p4', name: '云杉凉感防晒衣 男女款',     brand: 'b4', cat: '户外', price: 198, orig: 268, stock: 8420, sold30d: 4182, gmv30d: 828036, comm: 0.16, sample: 12, status: 'hot',    trend: 'up',   score: 95 },
  { id: 'p5', name: '云杉速干T恤 3 件装',        brand: 'b4', cat: '户外', price: 128, orig: 168, stock: 5240, sold30d: 2148, gmv30d: 274944, comm: 0.18, sample: 6,  status: 'active', trend: 'up',   score: 88 },
  { id: 'p6', name: '北麓 N1 主动降噪耳机',      brand: 'b5', cat: '3C',   price: 399, orig: 499, stock: 820,  sold30d: 218,  gmv30d: 86982,  comm: 0.12, sample: 2,  status: 'active', trend: 'down', score: 64 },
  { id: 'p7', name: '青朴 · 母亲节限定礼盒',     brand: 'b1', cat: '美妆', price: 588, orig: 698, stock: 320,  sold30d: 184,  gmv30d: 108192, comm: 0.20, sample: 4,  status: 'new',    trend: 'up',   score: 86 },
  { id: 'p8', name: '林野山茶油 250ml',           brand: 'b2', cat: '食品', price: 48,  orig: 68,  stock: 12480,sold30d: 1284, gmv30d: 61632,  comm: 0.20, sample: 8,  status: 'active', trend: 'flat', score: 72 },
];

// ─── Finance Records ────────────────────────────────────────────────────
export const financeRecords: FinanceRecord[] = [
  { id: 'f1', brand: '云杉运动',   type: 'commission', amount: 168000, status: 'reconciled', period: '2026-04', dueDate: '2026-05-15' },
  { id: 'f2', brand: '青朴自然护肤', type: 'commission', amount: 92000,  status: 'paid',       period: '2026-04', dueDate: '2026-05-10' },
  { id: 'f3', brand: '林野鲜食',   type: 'commission', amount: 68000,  status: 'pending',    period: '2026-04', dueDate: '2026-05-20' },
  { id: 'f4', brand: '小鹿家居',   type: 'commission', amount: 42000,  status: 'pending',    period: '2026-04', dueDate: '2026-05-25' },
  { id: 'f5', brand: '北麓数码',   type: 'service',    amount: 16000,  status: 'paid',       period: '2026-04', dueDate: '2026-05-08' },
  { id: 'f6', brand: '云杉运动',   type: 'bonus',      amount: 28000,  status: 'reconciled', period: '2026-04', dueDate: '2026-05-15' },
  { id: 'f7', brand: '青朴自然护肤', type: 'service',  amount: 12000,  status: 'dispute',    period: '2026-03', dueDate: '2026-04-15' },
];

// ─── Ad Campaigns ────────────────────────────────────────────────────────
// account 字段存 advertiser_id（巨量引擎广告主 ID）
// 计划列表由 /api/accounts 同步时从 API 自动填充，此处为初始占位
export const adCampaigns: AdCampaign[] = [];

// ─── Schedule ────────────────────────────────────────────────────────────
export const schedule: ScheduleItem[] = [
  { id: 's1', title: '云杉防晒衣专场直播',    brand: 'b4', type: 'live',  date: '2026-05-12', time: '19:00', platform: '抖音', assignee: 'u5', status: 'scheduled' },
  { id: 's2', title: '青朴精华液测评短视频',  brand: 'b1', type: 'video', date: '2026-05-13', time: '10:00', platform: '抖音', assignee: 'u3', status: 'approved' },
  { id: 's3', title: '林野松子食用场景图文',  brand: 'b2', type: 'post',  date: '2026-05-13', time: '12:00', platform: '小红书', assignee: 'u2', status: 'approved' },
  { id: 's4', title: '小鹿家居夏日换新专场',  brand: 'b3', type: 'live',  date: '2026-05-14', time: '20:00', platform: '抖音', assignee: 'u5', status: 'draft' },
  { id: 's5', title: '云杉速干T恤对比视频',   brand: 'b4', type: 'video', date: '2026-05-14', time: '09:00', platform: '抖音', assignee: 'u3', status: 'draft' },
  { id: 's6', title: '北麓N1耳机开箱',        brand: 'b5', type: 'video', date: '2026-05-15', time: '15:00', platform: '抖音', assignee: 'u3', status: 'draft' },
  { id: 's7', title: '青朴母亲节礼盒直播',    brand: 'b1', type: 'live',  date: '2026-05-15', time: '19:30', platform: '抖音', assignee: 'u5', status: 'approved' },
];

// ─── Competitors ────────────────────────────────────────────────────────
export const competitors: Competitor[] = [
  { id: 'cp1', name: '花西子旗舰',   platform: '抖音', followers: 2840000, growth7d: 0.031, avgVV: 142000, postFreq: 14, category: '美妆',   threat: 'high' },
  { id: 'cp2', name: '珀莱雅旗舰',   platform: '抖音', followers: 1920000, growth7d: 0.018, avgVV: 98400,  postFreq: 12, category: '美妆',   threat: 'high' },
  { id: 'cp3', name: '百草味零食',   platform: '抖音', followers: 1480000, growth7d: 0.052, avgVV: 64200,  postFreq: 21, category: '食品',   threat: 'med' },
  { id: 'cp4', name: '三夫户外',     platform: '抖音', followers: 842000,  growth7d: 0.084, avgVV: 48600,  postFreq: 10, category: '户外',   threat: 'high' },
  { id: 'cp5', name: '林氏家居',     platform: '抖音', followers: 1240000, growth7d: 0.024, avgVV: 52100,  postFreq: 18, category: '家居',   threat: 'med' },
  { id: 'cp6', name: '数码博主小K',  platform: '抖音', followers: 428000,  growth7d: 0.063, avgVV: 28400,  postFreq: 7,  category: '3C',     threat: 'med' },
];

// ─── Helper functions (mirrors TL.* from data.jsx) ───────────────────────
export const fmtMoney = (n: number): string => {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + ' 亿';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + ' 万';
  return n.toLocaleString();
};

export const fmtCount = (n: number): string => {
  if (n >= 1e4) return (n / 1e4).toFixed(1) + 'w';
  return n.toLocaleString();
};

export const fmtPct = (n: number, sign = true): string =>
  (sign && n > 0 ? '+' : '') + (n * 100).toFixed(1) + '%';

export const brandById = (id: string) => brands.find(b => b.id === id);
export const userById  = (id: string) => team.find(u => u.id === id);
export const accountById = (id: string) => accounts.find(a => a.id === id);

// ─── Auto Rules ────────────────────────────────────────────────────────────
import type { AutoRule, OperationLog } from '../types/index';

export const autoRules: AutoRule[] = [
  {
    id: 'rule_01',
    name: 'ROAS 过低自动暂停',
    enabled: true,
    brand: 'all',
    metric: 'roas',
    operator: 'lt',
    threshold: 1.5,
    action: 'pause',
    cooldownMinutes: 120,
    createdBy: 'u1',
    createdAt: '2026-05-01T09:00:00Z',
  },
  {
    id: 'rule_02',
    name: '预算消耗超 90% 告警',
    enabled: true,
    brand: 'all',
    metric: 'spent_pct',
    operator: 'gte',
    threshold: 0.9,
    action: 'alert',
    cooldownMinutes: 60,
    createdBy: 'u1',
    createdAt: '2026-05-01T09:00:00Z',
  },
  {
    id: 'rule_03',
    name: '云杉爆款高 ROI 加预算',
    enabled: true,
    brand: 'b4',
    metric: 'roas',
    operator: 'gte',
    threshold: 4.5,
    action: 'increase_budget',
    actionValue: 20,
    cooldownMinutes: 180,
    createdBy: 'u1',
    createdAt: '2026-05-05T10:00:00Z',
  },
  {
    id: 'rule_04',
    name: 'CTR 持续低位降预算',
    enabled: false,
    brand: 'all',
    metric: 'ctr',
    operator: 'lt',
    threshold: 0.03,
    action: 'decrease_budget',
    actionValue: 30,
    cooldownMinutes: 240,
    createdBy: 'u6',
    createdAt: '2026-05-08T14:00:00Z',
  },
];

// externalId 由规则引擎首次同步时从巨量引擎 API 回填，此处不再预设假值

// ─── Operation Logs ────────────────────────────────────────────────────────
export const operationLogs: OperationLog[] = [
  {
    id: 'log_001',
    source: 'auto_rule',
    level: 'success',
    campaignId: 'c5',
    campaignName: '北麓耳机-新品测流',
    ruleId: 'rule_01',
    ruleName: 'ROAS 过低自动暂停',
    action: '暂停计划 · roas lt 1.5（实际 1.680）',
    before: { status: 'active', roas: 1.68 },
    after:  { status: 'paused' },
    success: true,
    createdAt: '2026-05-10T14:30:00Z',
  },
  {
    id: 'log_002',
    source: 'auto_rule',
    level: 'success',
    campaignId: 'c1',
    campaignName: '云杉防晒衣-爆款放量',
    ruleId: 'rule_03',
    ruleName: '云杉爆款高 ROI 加预算',
    action: '提升预算 +20% · roas gte 4.5（实际 4.820）',
    before: { budget: 80000 },
    after:  { budget: 96000 },
    success: true,
    createdAt: '2026-05-11T10:00:00Z',
  },
  {
    id: 'log_003',
    source: 'scheduler',
    level: 'info',
    action: '定时同步：拉取所有活跃计划数据',
    success: true,
    createdAt: '2026-05-12T08:00:00Z',
  },
];

// ─── AI 决策 ─────────────────────────────────────────────────────────────
export const aiDecisions: AiDecision[] = [];

// ─── 经营日报 ─────────────────────────────────────────────────────────────
// 运营生成/编辑后保存的日报。按 brandId + date 唯一。
export const dailyReports: DailyReport[] = [];

// ─── 账户 ID 解析（统一入口，防止内部 DB ID 泄漏给 OceanEngine API）────────
/**
 * 把任意形式的账户引用转换成巨量引擎 local_account_id（纯数字字符串）。
 * - 输入已经是纯数字（≥10 位）→ 直接返回
 * - 输入是内部 DB ID（如 a1 / a_1751...）→ 在 accounts 数组中查找 externalId
 * - 找不到或 externalId 不是纯数字 → 抛出清晰错误，禁止 fallback 到内部 ID
 */
// 把任意账户引用归一化成巨量引擎要求的纯数字 local_account_id / advertiser_id。
// 规则：
//   1. 纯数字（10+ 位）→ 直接返回
//   2. a_ + 纯数字（如 a_1751180038902863）→ 剥离前缀返回 1751180038902863
//   3. 内部种子 ID（a1/a2/a10 等）→ 从 accounts 查 externalId（externalId 也可能被污染成 a_）
//   4. 查不到有效 externalId → 抛错，禁止 fallback
// 返回值始终满足 /^\d{10,}$/。
export function normalizeOceanEngineAccountId(input: string): string {
  const raw = String(input ?? '').trim();
  // 1. 纯数字
  if (/^\d{10,}$/.test(raw)) return raw;
  // 2. a_ + 纯数字
  const m = raw.match(/^a_(\d{10,})$/);
  if (m) return m[1]!;
  // 3. 内部种子 ID → 查 externalId
  const acct = accounts.find(a => a.id === raw);
  const extId = String(acct?.externalId ?? '').trim();
  const em = extId.match(/^a_(\d{10,})$/);
  const resolved = /^\d{10,}$/.test(extId) ? extId : (em ? em[1]! : '');
  // 4. 查不到 → 抛错
  if (!/^\d{10,}$/.test(resolved)) {
    throw new Error(
      `无法归一化巨量账户 ID："${raw}" 既非纯数字、非 a_<数字>，` +
      `且在 accounts 中找不到有效 externalId（externalId="${extId}"）。请先执行「同步广告主」使账户数据进入内存。`,
    );
  }
  return resolved;
}

// 兼容旧调用名
export const resolveExternalAccountId = normalizeOceanEngineAccountId;
