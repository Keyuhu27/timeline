// 潮线 Tideline · 广告平台适配器
// 定义统一接口（IAdAdapter），Mock 实现 + 巨量引擎实现骨架。
// 拿到真实 API 后：
//   1. 在 OceanEngineAdapter 里填充真实 HTTP 调用
//   2. 将 lib/adapters/index.ts 中的 export 切换到真实实现
//   3. 其余代码不动

import type { AdCampaign } from '../../types/index';

// ─── 统一接口 ──────────────────────────────────────────────────────────────

export interface CampaignStats {
  externalId: string;
  roas: number;
  ctr: number;
  cvr: number;
  cpm: number;
  spent: number;
  gmv: number;
  impressions: number;
  clicks: number;
  orders: number;
}

export interface CreateCampaignParams {
  name: string;
  advertiserId: string;
  budget: number;
  goal: 'video_sales' | 'live_room' | 'product_card' | 'follow';
  productIds?: string[];
  startDate: string;
}

export interface UpdateCampaignParams {
  externalId: string;
  advertiserId: string;
  budget?: number;
  status?: 'enable' | 'disable';
}

export interface IAdAdapter {
  /** 拉取单个计划的实时数据 */
  fetchCampaignStats(externalId: string, advertiserId: string): Promise<CampaignStats>;
  /** 批量拉取（更高效，减少请求次数） */
  fetchBatchStats(externalIds: string[], advertiserId: string): Promise<CampaignStats[]>;
  /** 创建广告计划 */
  createCampaign(params: CreateCampaignParams): Promise<{ externalId: string }>;
  /** 修改计划（预算/状态） */
  updateCampaign(params: UpdateCampaignParams): Promise<boolean>;
  /** 暂停计划 */
  pauseCampaign(externalId: string, advertiserId: string): Promise<boolean>;
  /** 恢复计划 */
  resumeCampaign(externalId: string, advertiserId: string): Promise<boolean>;
  /** 调整日预算 */
  adjustBudget(externalId: string, advertiserId: string, newBudget: number): Promise<boolean>;
}

// ─── Mock 实现（模拟真实 API 的波动数据）─────────────────────────────────
// 每次调用都会在基准值上加随机波动，模拟实时数据变化

function jitter(base: number, pct = 0.08): number {
  return parseFloat((base * (1 + (Math.random() - 0.5) * pct * 2)).toFixed(4));
}

// Mock 基准数据（key = externalId）
const MOCK_BASES: Record<string, Omit<CampaignStats, 'externalId'>> = {
  'ext_c1': { roas: 4.82, ctr: 0.083, cvr: 0.047, cpm: 18.4, spent: 62480, gmv: 301194, impressions: 3394565, clicks: 281748, orders: 13237 },
  'ext_c2': { roas: 3.94, ctr: 0.071, cvr: 0.041, cpm: 22.1, spent: 48200, gmv: 189908, impressions: 2180995, clicks: 154850, orders: 6349 },
  'ext_c3': { roas: 2.87, ctr: 0.061, cvr: 0.038, cpm: 16.8, spent: 28640, gmv:  82197, impressions: 1704762, clicks: 104091, orders: 3955 },
  'ext_c4': { roas: 2.14, ctr: 0.052, cvr: 0.028, cpm: 24.2, spent: 12840, gmv:  27477, impressions:  530579, clicks:  27590, orders:   773 },
  'ext_c5': { roas: 1.68, ctr: 0.044, cvr: 0.021, cpm: 31.6, spent: 15000, gmv:  25200, impressions:  474684, clicks:  20886, orders:   438 },
};

export class MockAdAdapter implements IAdAdapter {
  private pausedIds = new Set<string>();

  async fetchCampaignStats(externalId: string, _advertiserId: string): Promise<CampaignStats> {
    await this._delay();
    const base = MOCK_BASES[externalId];
    if (!base) throw new Error(`Mock: 找不到计划 ${externalId}`);
    return {
      externalId,
      roas:        jitter(base.roas),
      ctr:         jitter(base.ctr),
      cvr:         jitter(base.cvr),
      cpm:         jitter(base.cpm),
      spent:       Math.round(jitter(base.spent, 0.02)),
      gmv:         Math.round(jitter(base.gmv, 0.03)),
      impressions: Math.round(jitter(base.impressions, 0.01)),
      clicks:      Math.round(jitter(base.clicks, 0.02)),
      orders:      Math.round(jitter(base.orders, 0.03)),
    };
  }

  async fetchBatchStats(externalIds: string[], advertiserId: string): Promise<CampaignStats[]> {
    return Promise.all(externalIds.map(id => this.fetchCampaignStats(id, advertiserId)));
  }

  async createCampaign(params: CreateCampaignParams): Promise<{ externalId: string }> {
    await this._delay(800);
    const externalId = `ext_mock_${Date.now()}`;
    // 为新建计划注册 mock 基准值
    MOCK_BASES[externalId] = {
      roas: 1.0, ctr: 0.03, cvr: 0.02, cpm: 25,
      spent: 0, gmv: 0, impressions: 0, clicks: 0, orders: 0,
    };
    console.log(`[MockAd] 创建计划: ${params.name} → ${externalId}`);
    return { externalId };
  }

  async updateCampaign(params: UpdateCampaignParams): Promise<boolean> {
    await this._delay(400);
    console.log(`[MockAd] 更新计划: ${params.externalId}`, params);
    return true;
  }

  async pauseCampaign(externalId: string, _advertiserId: string): Promise<boolean> {
    await this._delay(400);
    this.pausedIds.add(externalId);
    console.log(`[MockAd] 暂停计划: ${externalId}`);
    return true;
  }

  async resumeCampaign(externalId: string, _advertiserId: string): Promise<boolean> {
    await this._delay(400);
    this.pausedIds.delete(externalId);
    console.log(`[MockAd] 恢复计划: ${externalId}`);
    return true;
  }

  async adjustBudget(externalId: string, advertiserId: string, newBudget: number): Promise<boolean> {
    return this.updateCampaign({ externalId, advertiserId, budget: newBudget });
  }

  private _delay(ms = 200): Promise<void> {
    return new Promise(r => setTimeout(r, ms + Math.random() * 100));
  }
}

// ─── 巨量引擎真实实现骨架（拿到 API 后填充）──────────────────────────────
// 文档：https://open.oceanengine.com/labels/7/docs/1696710498267148
export class OceanEngineAdapter implements IAdAdapter {
  private readonly baseUrl = 'https://ad.oceanengine.com/open_api/2/';

  constructor(private getAccessToken: (advertiserId: string) => Promise<string>) {}

  async fetchCampaignStats(externalId: string, advertiserId: string): Promise<CampaignStats> {
    const token = await this.getAccessToken(advertiserId);
    // TODO: 填充真实请求
    // const res = await fetch(`${this.baseUrl}report/integrated/get/`, {
    //   method: 'POST',
    //   headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     advertiser_id: advertiserId,
    //     report_type: 'CAMPAIGN',
    //     dimensions: ['campaign_id'],
    //     metrics: ['spend', 'gross_profit', 'ctr', 'cvr', 'cpm', 'roi'],
    //     filters: [{ field: 'campaign_id', type: 'IN', values: [externalId] }],
    //   }),
    // });
    // const data = await res.json();
    // return this._mapStats(data.data.list[0]);
    void token;
    throw new Error('OceanEngineAdapter.fetchCampaignStats 待实现');
  }

  async fetchBatchStats(externalIds: string[], advertiserId: string): Promise<CampaignStats[]> {
    const token = await this.getAccessToken(advertiserId);
    void token; void externalIds;
    throw new Error('OceanEngineAdapter.fetchBatchStats 待实现');
  }

  async createCampaign(params: CreateCampaignParams): Promise<{ externalId: string }> {
    const token = await this.getAccessToken(params.advertiserId);
    void token;
    throw new Error('OceanEngineAdapter.createCampaign 待实现');
  }

  async updateCampaign(params: UpdateCampaignParams): Promise<boolean> {
    const token = await this.getAccessToken(params.advertiserId);
    void token;
    throw new Error('OceanEngineAdapter.updateCampaign 待实现');
  }

  async pauseCampaign(externalId: string, advertiserId: string): Promise<boolean> {
    return this.updateCampaign({ externalId, advertiserId, status: 'disable' });
  }

  async resumeCampaign(externalId: string, advertiserId: string): Promise<boolean> {
    return this.updateCampaign({ externalId, advertiserId, status: 'enable' });
  }

  async adjustBudget(externalId: string, advertiserId: string, newBudget: number): Promise<boolean> {
    return this.updateCampaign({ externalId, advertiserId, budget: newBudget });
  }
}
