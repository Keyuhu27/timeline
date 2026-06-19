// 潮线 Tideline · 排期执行器
// 扫描 status='scheduled' 且到达发布时间的排期项，自动调用发布接口

import type { ScheduleItem, OperationLog } from '../../types/index';
import { schedule, operationLogs }         from '../db';
import { contentAdapter, alertService }    from '../adapters/index';

export async function runSchedulerOnce(): Promise<{ published: number; failed: number }> {
  const now = new Date();
  let published = 0;
  let failed    = 0;

  // 找出"已审批"或"已排期"、且发布时间已到的视频类排期
  const due = schedule.filter(s => {
    if (s.status !== 'approved' && s.status !== 'scheduled') return false;
    if (s.type !== 'video' && s.type !== 'post') return false;  // 直播排期不在这里处理
    const dt = new Date(`${s.date}T${s.time}:00`);
    return dt <= now;
  });

  if (due.length === 0) return { published: 0, failed: 0 };
  console.log(`[Scheduler] 待发布排期: ${due.length} 条`);

  for (const item of due) {
    await publishOne(item);
    if (item.status === 'published') published++;
    else failed++;
  }

  return { published, failed };
}

async function publishOne(item: ScheduleItem): Promise<void> {
  const before: Record<string, unknown> = { status: item.status };

  try {
    const result = await contentAdapter.publishVideo({
      accountId:   item.brand,       // TODO: 换成 accountId（排期扩展字段后）
      title:       item.title,
      videoPath:   item.videoPath ?? '',
      scheduledAt: `${item.date}T${item.time}:00`,
    });

    if (result.success) {
      item.status          = 'published';
      item.externalVideoId = result.externalVideoId;
      item.publishedAt     = result.publishedAt ?? new Date().toISOString();

      writeLog({
        level:      'success',
        action:     `自动发布: ${item.title}`,
        scheduleId: item.id,
        before,
        after: { status: 'published', externalVideoId: item.externalVideoId },
        success: true,
      });
      console.log(`[Scheduler] 发布成功: ${item.title}`);
    } else {
      throw new Error(result.errorMsg ?? '未知错误');
    }
  } catch (e) {
    const errMsg = String(e);
    item.status    = 'failed';
    item.failReason = errMsg;

    writeLog({
      level:      'error',
      action:     `自动发布失败: ${item.title}`,
      scheduleId: item.id,
      before,
      after: { status: 'failed' },
      success:  false,
      errorMsg: errMsg,
    });

    await alertService.send('publish_failed', {
      排期:   item.title,
      品牌:   item.brand,
      时间:   `${item.date} ${item.time}`,
      原因:   errMsg,
    });
  }
}

function writeLog(params: {
  level: OperationLog['level'];
  action: string;
  scheduleId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  success: boolean;
  errorMsg?: string;
}): void {
  const log: OperationLog = {
    id:        `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    source:    'scheduler',
    level:     params.level,
    action:    params.action,
    before:    params.before,
    after:     params.after,
    success:   params.success,
    errorMsg:  params.errorMsg,
    createdAt: new Date().toISOString(),
  };
  operationLogs.push(log);
}
