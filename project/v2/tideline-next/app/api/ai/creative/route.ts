// POST /api/ai/creative — AI 文案生成
import type { RouteHandler } from '../../../../lib/api';
import { generateCreative } from '../../../../lib/ai/creative-generator';
import { operationLogs } from '../../../../lib/db';

export const POST: RouteHandler = async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ error: '未配置 ANTHROPIC_API_KEY' }, 503);
  }

  const body = (req.body ?? {}) as {
    storeName?: string;
    product?: string;
    audience?: string;
    tone?: string;
    count?: number;
  };

  if (!body.product) return res.json({ error: 'product 必填' }, 400);

  try {
    const result = await generateCreative({
      storeName: body.storeName ?? '品牌门店',
      product: body.product,
      audience: body.audience ?? '通用人群',
      tone: body.tone ?? '专业理性',
      count: body.count ?? 4,
    });

    operationLogs.unshift({
      id: `log_ai_creative_${Date.now()}`,
      source: 'ai_creative',
      level: 'success',
      action: `AI文案生成：${body.product.slice(0, 30)}`,
      success: true,
      createdAt: new Date().toISOString(),
    });

    res.json({ data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ error: 'AI 文案生成失败: ' + msg }, 500);
  }
};
