// 潮线 Tideline · 视频发布适配器
// Mock 实现 + 抖音开放平台真实接口骨架
// 文档：https://open.douyin.com/platform/resource/docs/ability/content-management/douyin-publish-solution

export interface PublishVideoParams {
  accountId: string;       // 对应 Account.id
  title: string;
  description?: string;
  videoPath: string;       // 本地文件路径 或 已上传的 video_id
  coverPath?: string;
  tags?: string[];
  scheduledAt?: string;    // ISO 8601，留空表示立即发布
  productIds?: string[];   // 挂载商品
  poiId?: string;          // 地点
}

export interface PublishResult {
  success: boolean;
  externalVideoId?: string;
  publishedAt?: string;
  errorCode?: string;
  errorMsg?: string;
}

export interface IContentAdapter {
  /** 上传视频文件（返回 video_id，用于发布） */
  uploadVideo(accountId: string, filePath: string): Promise<string>;
  /** 发布视频到抖音 */
  publishVideo(params: PublishVideoParams): Promise<PublishResult>;
  /** 查询发布状态（异步发布场景） */
  queryPublishStatus(accountId: string, externalVideoId: string): Promise<'pending' | 'success' | 'failed'>;
}

// ─── Mock 实现 ────────────────────────────────────────────────────────────
export class MockContentAdapter implements IContentAdapter {
  // 模拟 10% 的发布失败率
  private readonly failRate = 0.1;

  async uploadVideo(_accountId: string, filePath: string): Promise<string> {
    await this._delay(1500); // 模拟上传耗时
    const videoId = `mock_vid_${Date.now()}`;
    console.log(`[MockContent] 上传视频: ${filePath} → ${videoId}`);
    return videoId;
  }

  async publishVideo(params: PublishVideoParams): Promise<PublishResult> {
    await this._delay(1000);

    if (Math.random() < this.failRate) {
      console.warn(`[MockContent] 发布失败（模拟）: ${params.title}`);
      return {
        success: false,
        errorCode: 'ERR_MOCK_FAIL',
        errorMsg: '模拟发布失败（10% 概率触发，用于测试告警逻辑）',
      };
    }

    const externalVideoId = `mock_vid_pub_${Date.now()}`;
    console.log(`[MockContent] 发布成功: ${params.title} → ${externalVideoId}`);
    return {
      success: true,
      externalVideoId,
      publishedAt: new Date().toISOString(),
    };
  }

  async queryPublishStatus(_accountId: string, externalVideoId: string): Promise<'pending' | 'success' | 'failed'> {
    await this._delay(300);
    // Mock：前5秒 pending，之后 success
    const age = Date.now() - parseInt(externalVideoId.replace('mock_vid_pub_', '') || '0');
    if (age < 5000) return 'pending';
    return 'success';
  }

  private _delay(ms = 200): Promise<void> {
    return new Promise(r => setTimeout(r, ms + Math.random() * 200));
  }
}

// ─── 抖音开放平台真实实现骨架 ─────────────────────────────────────────────
export class DouyinContentAdapter implements IContentAdapter {
  private readonly baseUrl = 'https://open.douyin.com';

  constructor(private getAccessToken: (accountId: string) => Promise<string>) {}

  async uploadVideo(accountId: string, filePath: string): Promise<string> {
    const token = await this.getAccessToken(accountId);
    void token; void filePath;
    // TODO:
    // 1. 初始化上传：POST /api/douyin/v1/video/init_upload/
    // 2. 分片上传：PUT upload_url
    // 3. 完成上传：POST /api/douyin/v1/video/complete_upload/
    // 返回 video_id
    throw new Error('DouyinContentAdapter.uploadVideo 待实现');
  }

  async publishVideo(params: PublishVideoParams): Promise<PublishResult> {
    const token = await this.getAccessToken(params.accountId);
    void token;
    // TODO:
    // POST /api/douyin/v1/video/create/
    // body: { video_id, title, micro_app_id?, poi_id?, product_ids? }
    throw new Error('DouyinContentAdapter.publishVideo 待实现');
  }

  async queryPublishStatus(accountId: string, externalVideoId: string): Promise<'pending' | 'success' | 'failed'> {
    const token = await this.getAccessToken(accountId);
    void token; void externalVideoId;
    // TODO:
    // GET /api/douyin/v1/video/query_status/?video_ids=xxx
    throw new Error('DouyinContentAdapter.queryPublishStatus 待实现');
  }
}
