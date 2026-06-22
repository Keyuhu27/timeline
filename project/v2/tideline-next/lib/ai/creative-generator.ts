// 潮线 Tideline · AI 文案生成
import { ask } from './claude-client';

const SYSTEM = `你是抖音本地推高转化广告文案专家，擅长写让用户立刻到店的标题和话术。
严格以 JSON 格式回复，不输出其他内容。`;

export interface CreativeResult {
  titles: Array<{ text: string; predictedCtr: number }>;
  body: string;
  livestreamScript: string;
  tags: string[];
  rationale: string;
}

export async function generateCreative(params: {
  storeName: string;
  product: string;
  audience: string;
  tone: string;
  count?: number;
}): Promise<CreativeResult> {
  const { storeName, product, audience, tone, count = 4 } = params;

  const prompt = `为以下本地推广告生成文案素材：

门店 / 品牌：${storeName}
商品 / 主题：${product}
目标人群：${audience}
情绪基调：${tone}
生成数量：${count} 个标题

任务：
1. 生成 ${count} 个抖音短视频标题（前3秒抓眼球，含具体利益点，≤20字）
2. 生成 1 段正文文案（150-200字，种草+转化）
3. 生成 1 段直播开场话术（≤100字，含留人钩子）
4. 推荐 5 个话题标签
5. 说明创作逻辑

请输出如下 JSON：
{
  "titles": [
    { "text": "标题文本", "predictedCtr": 3.2 }
  ],
  "body": "正文文案...",
  "livestreamScript": "直播话术...",
  "tags": ["标签1", "标签2"],
  "rationale": "创作逻辑说明"
}`;

  const raw = await ask(prompt, SYSTEM);
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('Claude 返回格式不符');
  return JSON.parse(json) as CreativeResult;
}
