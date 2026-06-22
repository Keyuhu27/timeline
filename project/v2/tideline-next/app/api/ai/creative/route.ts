// POST /api/ai/creative — AI 文案/脚本生成（独立工作流，无需先做数据分析）
import type { RouteHandler } from '../../../../lib/api';
import { generateCreative } from '../../../../lib/ai/creative-generator';
import { operationLogs } from '../../../../lib/db';

export const POST: RouteHandler = async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ error: 'ANTHROPIC_API_KEY 未配置' }, 503);
  }

  const body = (req.body ?? {}) as {
    storeName?: string;
    product?: string;
    audience?: string;
    tone?: string;
    count?: number;
    trigger?: 'low_ctr' | 'low_cvr' | 'standalone';
    diagnosisSummary?: string;
  };

  if (!body.product) return res.json({ error: 'product 必填' }, 400);

  try {
    const result = await generateCreative({
      storeName: body.storeName ?? '品牌门店',
      product: body.product,
      audience: body.audience ?? '通用人群',
      tone: body.tone ?? '种草分享',
      count: body.count ?? 4,
      trigger: body.trigger ?? 'standalone',
      diagnosisSummary: body.diagnosisSummary,
    });

    operationLogs.unshift({
      id: `log_ai_creative_${Date.now()}`,
      source: 'ai_creative',
      level: 'success',
      action: `AI创意生成：${body.product.slice(0, 30)}${body.trigger && body.trigger !== 'standalone' ? ` · 触发原因 ${body.trigger}` : ''}`,
      success: true,
      createdAt: new Date().toISOString(),
    });

    res.json({ data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ error: 'AI 文案生成失败: ' + msg }, 500);
  }
};
