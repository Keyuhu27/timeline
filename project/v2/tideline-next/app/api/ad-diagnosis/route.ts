// GET /api/ad-diagnosis?brand=b_x&date=YYYY-MM-DD  （date 缺省 = 今天，北京时）
//   也兼容 ?brandId=b_x。
//
// 「投流诊断」骨架：复用日报流水线的两路数据源拼出结构化诊断，**不接 AI、不落盘、只读**。
//   · 投放消耗 / ROI ← syncLocalAdsForBrand（本地推 statQuery）
//   · GMV 渠道拆分   ← fetchBusinessCompassForBrand（生意经成交来源拆分）
// 规则 findings 为 MVP 占位（语气保守），后续由 lib/ai 的 Claude 诊断替换/补充（见 TODO(ai)）。

import { ok, err }       from '../../../lib/api';
import { brandById }     from '../../../lib/db';
import {
  buildReportContext,
  fetchBusinessCompassForBrand,
  syncLocalAdsForBrand,
  bjToday,
} from '../../../lib/reports/pipeline';
import type { RouteHandler } from '../../../lib/api';

type FindingSource = 'localAds' | 'businessCompass' | 'mixed';
interface Finding {
  level: 'info' | 'warn' | 'risk';
  source: FindingSource;
  code: string;
  title: string;
  detail: string;
}
interface AdDiagnosisResult {
  meta: {
    brandId: string;
    brandName: string;
    date: string;
    yesterday: string;
    hasBusiness: boolean;
    hasLocalAds: boolean;
  };
  // 字段在数据源缺失时为 null（不写 0，避免误判“消耗/GMV 为零”）
  spend: {
    totalSpent: number | null;
    liveSpent: number | null;
    videoSpent: number | null;
    liveRoi: number | null;
    videoRoi: number | null;
  };
  gmvSplit: {
    zibo: number | null;   // 自播（官号直播）
    dabo: number | null;   // 达播（达人直播）
    poi: number | null;    // 获客卡+搜索结果卡+其他
    video: number | null;  // 短视频
  };
  findings: Finding[];
}

// 直播 ROI 偏低阈值（MVP 经验值，后续可配置/交给 AI）
const LOW_ROI = 1;

export const GET: RouteHandler = async (req, res) => {
  // 1) 兼容 brand / brandId
  const brandId = (req.query.brand ?? req.query.brandId ?? '').trim();
  if (!brandId) return err(res, 'brand（或 brandId）为必填项');
  const brand = brandById(brandId);
  if (!brand) return err(res, `品牌 ${brandId} 不存在`, 404);

  const date = (req.query.date ?? '').trim() || bjToday();
  console.log(`[AdDiagnosis] brandId=${brandId} date=${date} start`);

  // 投流诊断口径：数据日 = 选择日「当天」，与品牌详情页「当日数据概览」/巨量后台一致。
  // 日报流水线默认口径是「昨日已结算」（ctx.yesterday = date−1），这里仅在诊断处覆盖取数日，
  // 不改动 generateReportForBrand / 日报本身。月口径同步对齐当天所在月（诊断不展示月值，仅防越界）。
  const base = buildReportContext(brandId, date);
  const ctx = { ...base, yesterday: date, monthStart: date.slice(0, 8) + '01' };
  const [business, localAds] = await Promise.all([
    fetchBusinessCompassForBrand(ctx),
    syncLocalAdsForBrand(ctx),
  ]);

  const sq = localAds?.sqYday ?? null;
  const src = business?.srcYday ?? null;
  const num = (v: unknown): number | null => (v == null ? null : Math.round(Number(v)));

  const spend: AdDiagnosisResult['spend'] = {
    totalSpent: num(sq?.spent),
    liveSpent:  num(sq?.liveSpent),
    videoSpent: num(sq?.videoSpent),
    liveRoi:    sq?.liveRoi  ?? null,
    videoRoi:   sq?.videoRoi ?? null,
  };
  const gmvSplit: AdDiagnosisResult['gmvSplit'] = {
    zibo:  num(src?.officialLiveGmv),
    dabo:  num(src?.daboGmv),
    poi:   num(src?.poiGmv),
    video: num(src?.videoTotalGmv),
  };

  // 2) findings —— MVP 规则占位（语气保守），每条带 source。TODO(ai): 替换/补充为 Claude 诊断
  const findings: Finding[] = [];
  if (!business && !localAds) {
    findings.push({
      level: 'info', source: 'mixed', code: 'NO_DATA_SOURCE',
      title: '暂无可用数据源',
      detail: '未检测到生意经 / 本地推数据（可能未配置 cookie 或该品牌未接入），诊断为空。',
    });
  } else {
    // TODO(ai): 直播 ROI 评估，后续交给模型结合大盘/历史给阈值
    if (spend.liveRoi != null && spend.liveRoi < LOW_ROI) {
      findings.push({
        level: 'warn', source: 'localAds', code: 'LIVE_ROI_LOW',
        title: '直播投流 ROI 偏低',
        detail: `昨日直播 ROI ${spend.liveRoi.toFixed(2)}（低于 ${LOW_ROI}），建议观察近几日趋势并检查投放计划出价与人群。`,
      });
    }
    // TODO(ai): 达播占比/结构判断
    if (gmvSplit.dabo != null && gmvSplit.zibo != null && gmvSplit.dabo > gmvSplit.zibo) {
      findings.push({
        level: 'info', source: 'businessCompass', code: 'DABO_DOMINANT',
        title: '达播 GMV 高于自播',
        detail: '生意经口径下达播成交高于自播，建议检查自播投流力度与开播节奏是否需要加强。',
      });
    }
    // TODO(ai): 消耗-成交联合判断（mixed），示例占位
    if (spend.videoSpent != null && spend.videoSpent > 0 && gmvSplit.video != null && gmvSplit.video === 0) {
      findings.push({
        level: 'warn', source: 'mixed', code: 'VIDEO_SPEND_NO_GMV',
        title: '短视频有消耗但无成交',
        detail: '短视频投放有消耗但生意经短视频成交为 0，建议检查素材投放方向与转化链路。',
      });
    }
    if (findings.length === 0) {
      findings.push({
        level: 'info', source: 'mixed', code: 'NO_RULE_HIT',
        title: '暂无明显风险信号',
        detail: '当前规则未命中明显异常，建议结合 ROI 与渠道结构持续观察。',
      });
    }
  }

  const result: AdDiagnosisResult = {
    meta: {
      brandId,
      brandName: brand.name,
      date,
      yesterday: ctx.yesterday,
      hasBusiness: !!business,
      hasLocalAds: !!localAds,
    },
    spend,
    gmvSplit,
    findings,
  };

  console.log(`[AdDiagnosis] brandId=${brandId} date=${date} done (hasBusiness=${!!business} hasLocalAds=${!!localAds} findings=${findings.length})`);
  return ok(res, result);
};
