import type { IAdAdapter, CampaignStats, CreateCampaignParams, UpdateCampaignParams } from './ad-adapter';

const BASE = 'https://ad.oceanengine.com/open_api/2/';

async function oeRequest<T>(path: string, token: string, body: Record<string, unknown>): Promise<T> {
  const res  = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { code: number; message: string; data: T };
  if (data.code !== 0) throw new Error(`巨量引擎 API [${path}]: ${data.message} (code=${data.code})`);
  return data.data;
}

export class OceanEngineAdapter implements IAdAdapter {
  constructor(private getAccessToken: (advertiserId: string) => Promise<string>) {}

  async fetchCampaignStats(externalId: string, advertiserId: string): Promise<CampaignStats> {
    const token = await this.getAccessToken(advertiserId);
    const today = new Date().toISOString().slice(0, 10);
    const data  = await oeRequest<{ list: any[] }>('report/integrated/get/', token, {
      advertiser_id: advertiserId, report_type: 'CAMPAIGN', dimensions: ['campaign_id'],
      metrics: ['stat_cost','show_cnt','click_cnt','convert_cnt','pay_order_count','pay_order_amount','cpm_platform','ctr','cvr','roi'],
      filters: [{ field: 'campaign_id', type: 'IN', values: [externalId] }],
      start_date: today, end_date: today, page: 1, page_size: 1,
    });
    const row = data.list[0];
    if (!row) throw new Error(`找不到计划数据: ${externalId}`);
    return {
      externalId, roas: row.roi, ctr: row.ctr / 100, cvr: row.cvr / 100,
      cpm: row.cpm_platform, spent: row.stat_cost, gmv: row.pay_order_amount,
      impressions: row.show_cnt, clicks: row.click_cnt, orders: row.pay_order_count,
    };
  }

  async fetchBatchStats(externalIds: string[], advertiserId: string): Promise<CampaignStats[]> {
    const token = await this.getAccessToken(advertiserId);
    const today = new Date().toISOString().slice(0, 10);
    const data  = await oeRequest<{ list: any[] }>('report/integrated/get/', token, {
      advertiser_id: advertiserId, report_type: 'CAMPAIGN', dimensions: ['campaign_id'],
      metrics: ['stat_cost','show_cnt','click_cnt','convert_cnt','pay_order_count','pay_order_amount','cpm_platform','ctr','cvr','roi'],
      filters: [{ field: 'campaign_id', type: 'IN', values: externalIds }],
      start_date: today, end_date: today, page: 1, page_size: externalIds.length,
    });
    return data.list.map(row => ({
      externalId: row.campaign_id, roas: row.roi, ctr: row.ctr / 100, cvr: row.cvr / 100,
      cpm: row.cpm_platform, spent: row.stat_cost, gmv: row.pay_order_amount,
      impressions: row.show_cnt, clicks: row.click_cnt, orders: row.pay_order_count,
    }));
  }

  async createCampaign(params: CreateCampaignParams): Promise<{ externalId: string }> {
    const token = await this.getAccessToken(params.advertiserId);
    const data  = await oeRequest<{ campaign_id: string }>('campaign/create/', token, {
      advertiser_id: params.advertiserId, campaign_name: params.name,
      campaign_type: 'FEED', budget: params.budget, budget_mode: 'BUDGET_MODE_DAY',
      landing_type: 'VIDEO_PROM_GOODS',
    });
    return { externalId: data.campaign_id };
  }

  async updateCampaign(params: UpdateCampaignParams): Promise<boolean> {
    const token = await this.getAccessToken(params.advertiserId);
    const body: Record<string, unknown> = { advertiser_id: params.advertiserId, campaign_id: params.externalId };
    if (params.budget   !== undefined) { body.budget = params.budget; body.budget_mode = 'BUDGET_MODE_DAY'; }
    if (params.status   !== undefined) { body.opt_status = params.status === 'enable' ? 'ENABLE' : 'DISABLE'; }
    await oeRequest('campaign/update/', token, body);
    return true;
  }

  async pauseCampaign(externalId: string, advertiserId: string)  { return this.updateCampaign({ externalId, advertiserId, status: 'disable' }); }
  async resumeCampaign(externalId: string, advertiserId: string) { return this.updateCampaign({ externalId, advertiserId, status: 'enable'  }); }
  async adjustBudget(externalId: string, advertiserId: string, newBudget: number) { return this.updateCampaign({ externalId, advertiserId, budget: newBudget }); }
}
