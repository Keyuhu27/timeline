// 潮线 Tideline · Layer 3: Creative Generator Agent
// 职责：生成广告文案/标题/视频脚本/素材brief
// 支持两种触发模式：low_ctr（主打钩子）/ low_cvr（主打转化点）/ standalone（均衡）
import { ask } from './claude-client';
import type { CreativeResult } from '../../types/index';

const SYSTEM = `你是抖音本地推高转化广告文案专家，擅长为餐饮/酒旅/零售门店写让用户立刻到店的标题和话术。
严格以 JSON 格式回复，不输出其他内容。`;

export interface CreativeParams {
  storeName: string;
  product: string;
  audience?: string;
  tone?: string;
  count?: number;
  trigger?: 'low_ctr' | 'low_cvr' | 'standalone';
  diagnosisSummary?: string;
}

function buildFocusInstruction(trigger?: string): string {
  if (trigger === 'low_ctr') {
    return `【触发原因：点击率低，重点优化钩子】
标题必须在前3秒制造强冲突或强好奇心，数字/反差/痛点三选一必须出现。
优先使用"没想到""真的假的""终于找到"等高点击词。
图片方向：视觉冲击大，突出价格或品相差异。`;
  }
  if (trigger === 'low_cvr') {
    return `【触发原因：转化率低，重点优化转化动机】
文案重点突出：价格优惠/限时/位置便利/预约简单/口碑背书。
减少夸大卖点，增加具体利益（如"到店即送""限今天""3分钟步行"）。
CTA 必须明确："点击预约""立即领券""今天到店"。`;
  }
  return `【均衡输出：兼顾吸引力与转化率】
标题有钩子，正文有转化点，CTA 明确。`;
}

export async function generateCreative(params: CreativeParams): Promise<CreativeResult> {
  const { storeName, product, audience = '周边3公里用户', tone = '种草分享', count = 4, trigger = 'standalone', diagnosisSummary } = params;

  const focusBlock = buildFocusInstruction(trigger);
  const diagBlock = diagnosisSummary ? `\n【关联诊断】${diagnosisSummary}` : '';

  const prompt = `为以下本地推广告生成全套创意素材。

【基本信息】
门店 / 品牌：${storeName}
商品 / 主题：${product}
目标人群：${audience}
情绪基调：${tone}
${diagBlock}

${focusBlock}

【输出任务】
1. 生成 ${count} 个抖音短视频标题（≤20字，必须含利益点/钩子）
2. 生成 2 段正文文案（每段 120–180 字，角度不同：一种草、一对比）
3. 生成 3 个核心卖点（≤15字/条，适合字幕打出来）
4. 生成 1 段视频脚本（分镜格式，含口播文案，30秒左右）
5. 生成 2 个图片主视觉方向（描述构图/主体/文字）
6. 推荐 5 个话题标签
7. 说明创作逻辑

请输出如下 JSON：
{
  "titles": [
    { "text": "标题文本", "predictedCtr": 3.2 }
  ],
  "bodies": [
    "正文1...",
    "正文2..."
  ],
  "sellingPoints": ["卖点1", "卖点2", "卖点3"],
  "videoScript": "【分镜1】0–5s: 画面描述\\n口播：xxx\\n【分镜2】...",
  "imageDirections": [
    "图片方向1描述",
    "图片方向2描述"
  ],
  "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"],
  "rationale": "创作逻辑说明"
}`;

  const raw = await ask(prompt, SYSTEM);
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('Creative Generator: Claude 返回格式不符');
  const result = JSON.parse(json) as CreativeResult;
  result.trigger = trigger;
  return result;
}
