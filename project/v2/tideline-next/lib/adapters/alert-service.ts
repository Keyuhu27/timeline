// 潮线 Tideline · 告警通知服务
// 支持企业微信机器人、钉钉机器人、纯日志（降级）
// 拿到 webhook URL 后写入环境变量即可启用

export type AlertEvent = 'rule_triggered' | 'publish_failed' | 'budget_low' | 'token_expiring';

interface AlertPayload {
  [key: string]: unknown;
}

// ─── 告警渠道配置（读环境变量）────────────────────────────────────────────
const WECOM_WEBHOOK  = process.env.WECOM_WEBHOOK_URL;   // 企业微信机器人
const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK_URL; // 钉钉机器人

// 事件 → 人类可读标题
const EVENT_TITLES: Record<AlertEvent, string> = {
  rule_triggered:  '🤖 自动调控规则触发',
  publish_failed:  '❌ 视频发布失败',
  budget_low:      '💸 预算预警',
  token_expiring:  '🔑 Token 即将过期',
};

function formatMessage(event: AlertEvent, payload: AlertPayload): string {
  const title = EVENT_TITLES[event];
  const details = Object.entries(payload)
    .map(([k, v]) => `• ${k}: ${String(v)}`)
    .join('\n');
  return `**潮线 Tideline 告警**\n${title}\n${details}\n时间: ${new Date().toLocaleString('zh-CN')}`;
}

async function sendWecom(text: string): Promise<void> {
  if (!WECOM_WEBHOOK) return;
  await fetch(WECOM_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'markdown', markdown: { content: text } }),
  });
}

async function sendDingtalk(text: string): Promise<void> {
  if (!DINGTALK_WEBHOOK) return;
  await fetch(DINGTALK_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: { title: '潮线告警', text },
    }),
  });
}

export const alertService = {
  async send(event: AlertEvent, payload: AlertPayload): Promise<void> {
    const msg = formatMessage(event, payload);

    // 始终打印日志（降级保底）
    console.log(`[Alert] ${msg}`);

    // 并行发送各渠道（任意失败不影响其他渠道）
    const sends: Promise<void>[] = [
      sendWecom(msg).catch(e => console.error('[Alert] 企业微信发送失败:', e)),
      sendDingtalk(msg).catch(e => console.error('[Alert] 钉钉发送失败:', e)),
    ];

    await Promise.allSettled(sends);
  },
};
