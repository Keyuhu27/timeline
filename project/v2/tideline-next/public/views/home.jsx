// 潮线 Tideline · 首页 — 工作流 + 真实巨量数据 + AI 决策面板

window.TL = window.TL || {};
const { useState, useEffect, useCallback } = React;

const Home = function Home({ moduleOrder, openTask }) {
  const modules = {
    today:       <TodayBlock key="today" />,
    kanban:      <KanbanBlock key="kanban" openTask={openTask} />,
    aiDecisions: <AiDecisionsBlock key="aiDecisions" />,
    activity:    <ActivityBlock key="activity" />,
    brands:      <BrandsBlock key="brands" />,
    schedule:    <SchedulePeek key="schedule" />,
  };
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">早上好，思远</h1>
            <p className="page-sub">今天有 <b style={{color:'var(--text)'}}>7</b> 个待办，2 场直播预计于今天 19:30 起开播。</p>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="filter" size={13} /> 筛选</button>
            <button className="btn primary"><Icon name="plus" size={13} /> 新建任务</button>
          </div>
        </div>

        {(moduleOrder ?? ['today','kanban','aiDecisions','activity','brands','schedule']).map(key => modules[key]).filter(Boolean)}
      </div>
    </div>
  );
};

// ── 今日概览 — 接真实巨量数据 ────────────────────────────────────────────
function TodayBlock() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ai/workflow')
      .then(r => r.json())
      .then(d => setData(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = n => n >= 10000 ? (n / 10000).toFixed(1) + '万' : (n || 0).toLocaleString();
  const cs = data?.campaignSummary;

  const stats = [
    {
      label: '今日待办',
      value: 7,
      sub: '其中 3 项截止于今天',
      icon: 'inbox',
      delta: null,
    },
    {
      label: '本周已发布',
      value: 18,
      sub: '视频 12 · 图文 4 · 直播 2',
      icon: 'check',
      delta: '+24%',
    },
    {
      label: '投流花费',
      value: loading ? '—' : (cs ? `¥ ${fmt(cs.totalSpent)}` : '未同步'),
      sub: loading ? '' : (cs ? `预算 ¥${fmt(cs.totalBudget)} · ${cs.activeCnt} 个活跃计划` : '请先同步广告主'),
      icon: 'cart',
      delta: null,
    },
    {
      label: '总线索量',
      value: loading ? '—' : (cs ? fmt(cs.totalLeads) : '—'),
      sub: loading ? '' : (cs && cs.totalLeads > 0 ? `CPL ¥${cs.avgCostPerLead}` : '到店 + 电话 + 发券'),
      icon: 'sparkle',
      delta: null,
    },
  ];

  return (
    <section style={{ marginBottom: 20 }}>
      <div className="stat-row">
        {stats.map((s, i) => (
          <div className="stat" key={i}>
            <div className="stat-label"><Icon name={s.icon} size={13} /> {s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={`stat-delta ${s.delta && s.delta[0] === '+' ? 'up' : ''}`}>
              {s.delta ? <><Icon name="arrowUp" size={10} /> {s.delta} vs 上周 · </> : null}{s.sub}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 工作流看板 ────────────────────────────────────────────────────────────
function KanbanBlock({ openTask }) {
  const stages = TL.stages;
  const grouped = stages.map(s => ({ ...s, tasks: TL.tasks.filter(t => t.stage === s.id) }));
  return (
    <section style={{ marginBottom: 24 }}>
      <SectionTitle
        title="工作流看板"
        sub="按阶段查看 · 全部品牌"
        actions={<>
          <button className="btn ghost sm"><Icon name="sort" size={12} /> 排序</button>
          <button className="btn ghost sm"><Icon name="more" size={12} /></button>
        </>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {grouped.map(stage => (
          <div className="kb-col" key={stage.id}>
            <div className="kb-col-head">
              <span className="dot" style={{ background: stage.color }} />
              {stage.name}
              <span style={{ marginLeft: 'auto' }} className="muted mono">{stage.tasks.length}</span>
              <button className="btn ghost icon sm"><Icon name="plus" size={11} /></button>
            </div>
            {stage.tasks.map(t => (
              <KanbanCard key={t.id} task={t} onClick={() => openTask(t)} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function KanbanCard({ task, onClick }) {
  const b = TL.brandById(task.brand);
  const u = TL.userById(task.assignee);
  const prTone = task.priority === 'high' ? 'danger' : task.priority === 'med' ? 'warn' : 'default';
  const prLabel = task.priority === 'high' ? 'P1' : task.priority === 'med' ? 'P2' : 'P3';
  return (
    <div className="kb-card" onClick={onClick}>
      <div className="row tight" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        <Icon name={task.cover === 'image' ? 'image' : task.cover === 'doc' ? 'fileText' : 'video'} size={12} />
        <span>{b?.name}</span>
        <Chip tone={prTone}>{prLabel}</Chip>
      </div>
      <div className="title">{task.title}</div>
      <div className="row between">
        <div className="row tight muted" style={{ fontSize: 11 }}>
          <Icon name="clock" size={11} /> {task.due}
        </div>
        <div className="row tight">
          {task.score && <span className="muted mono" style={{ fontSize: 11 }}>AI {task.score}</span>}
          <Avatar user={u} size="sm" />
        </div>
      </div>
    </div>
  );
}

// ── AI 待确认决策面板 ─────────────────────────────────────────────────────
const ACTION_LABEL = {
  pause: '暂停计划', resume: '恢复计划',
  increase_budget: '提升预算', decrease_budget: '降低预算',
  change_creative: '更换素材', manual_review: '人工复审', hold: '维持观察',
};
const RISK_TONE = { low: 'success', medium: 'warn', high: 'danger' };
const STATUS_TONE = { good: 'success', warning: 'warn', bad: 'danger', unknown: 'default' };

function AiDecisionsBlock() {
  const [decisions, setDecisions] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [acting, setActing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch('/api/ai/workflow')
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setDecisions(d.data.pendingDecisions || []);
          setAiStatus(d.data.aiStatus);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const decide = async (decisionId, action) => {
    setActing(decisionId + action);
    try {
      await fetch('/api/ai/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: decisionId, action, approvedBy: 'admin' }),
      });
      load();
    } catch {}
    setActing(null);
  };

  const hasPending = decisions.length > 0;

  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{
        background: hasPending
          ? 'linear-gradient(135deg, oklch(0.97 0.02 30), oklch(0.97 0.015 50))'
          : 'linear-gradient(135deg, oklch(0.97 0.02 258), oklch(0.97 0.02 200))',
        border: `1px solid ${hasPending ? 'var(--warning-border, oklch(0.85 0.08 60))' : 'var(--accent-border)'}`,
        borderRadius: 'var(--r-xl)',
        padding: '18px 20px',
      }}>
        <div className="row between" style={{ marginBottom: hasPending ? 14 : 0 }}>
          <div className="row tight">
            <Icon name="sparkle" size={14} style={{ color: hasPending ? 'var(--warning)' : 'var(--accent)' }} />
            <span className="chip accent">AI · 投流优化</span>
            {aiStatus && (
              <span className="muted" style={{ fontSize: 11 }}>
                今日分析 {aiStatus.decisionsToday} 个 · 已执行 {aiStatus.executedToday} 个
              </span>
            )}
          </div>
          <div className="row tight">
            {hasPending && (
              <span className="chip" style={{ background: 'var(--warning-subtle)', color: 'var(--warning)', border: '1px solid var(--warning-border)' }}>
                {decisions.length} 条待确认
              </span>
            )}
            <button className="btn ghost sm" onClick={load}><Icon name="refresh" size={12} /></button>
          </div>
        </div>

        {loading && <div className="muted" style={{ fontSize: 12.5 }}>加载中…</div>}

        {!loading && !hasPending && (
          <div className="row tight" style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
            <Icon name="check" size={13} />
            <span>暂无待审批的 AI 建议 · {aiStatus?.lastRunAt ? `上次分析 ${new Date(aiStatus.lastRunAt).toLocaleTimeString('zh')}` : '尚未运行分析'}</span>
          </div>
        )}

        {!loading && hasPending && (
          <div className="col" style={{ gap: 10 }}>
            {decisions.map(d => {
              const topRec = d.recommendations?.[0];
              if (!topRec) return null;
              const isActing = acting && acting.startsWith(d.id);
              return (
                <div key={d.id} style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: '12px 14px',
                }}>
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <div className="row tight">
                      <Chip tone={STATUS_TONE[d.analysis?.performanceStatus] || 'default'} dot>
                        {d.analysis?.performanceStatus === 'bad' ? '表现差' :
                         d.analysis?.performanceStatus === 'warning' ? '需关注' :
                         d.analysis?.performanceStatus === 'good' ? '表现好' : '待判断'}
                      </Chip>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{d.campaignName}</span>
                    </div>
                    <div className="row tight">
                      <Chip tone={RISK_TONE[topRec.riskLevel]}>
                        {topRec.riskLevel === 'high' ? '高风险' : topRec.riskLevel === 'medium' ? '中风险' : '低风险'}
                      </Chip>
                      <Chip tone="accent">{ACTION_LABEL[topRec.action] || topRec.action}</Chip>
                      {topRec.suggestedValue && (
                        <span className="muted mono" style={{ fontSize: 11 }}>±{topRec.suggestedValue}%</span>
                      )}
                    </div>
                  </div>

                  {d.analysis?.summary && (
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6, lineHeight: 1.5 }}>
                      {d.analysis.summary}
                    </div>
                  )}

                  {d.analysis?.problems?.length > 0 && (
                    <div className="row tight" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                      {d.analysis.problems.slice(0, 3).map((p, i) => (
                        <span key={i} className="chip" style={{
                          fontSize: 10.5,
                          color: p.severity === 'high' ? 'var(--danger)' : p.severity === 'medium' ? 'var(--warning)' : 'var(--text-muted)',
                          background: p.severity === 'high' ? 'var(--danger-subtle)' : 'var(--bg-subtle)',
                        }}>
                          {p.type.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {d.creative && <span className="chip accent" style={{ fontSize: 10.5 }}>· 创意已生成</span>}
                    </div>
                  )}

                  <div className="row tight" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                    <Icon name="zap" size={11} />
                    <span>{topRec.reason}</span>
                  </div>

                  <div className="row tight">
                    <button
                      className="btn sm primary"
                      disabled={isActing}
                      onClick={() => decide(d.id, 'approve')}
                    >
                      <Icon name={isActing ? 'loader' : 'check'} size={12} />
                      {isActing ? '执行中…' : '确认执行'}
                    </button>
                    <button
                      className="btn sm ghost"
                      disabled={isActing}
                      onClick={() => decide(d.id, 'reject')}
                    >
                      忽略
                    </button>
                    {d.recommendations?.length > 1 && (
                      <span className="muted" style={{ fontSize: 11 }}>+{d.recommendations.length - 1} 条备选建议</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ── 团队动态 + 节点提醒 ───────────────────────────────────────────────────
function ActivityBlock() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch('/api/ai/workflow')
      .then(r => r.json())
      .then(d => setLogs(d.data?.recentLogs || []))
      .catch(() => {});
  }, []);

  const sourceLabel = {
    auto_rule: '规则引擎', manual: '手动', scheduler: '调度器',
    system: '系统', ai_analysis: 'AI诊断', ai_creative: 'AI创意', ai_agent: 'AI决策',
  };

  return (
    <section style={{ marginBottom: 24 }}>
      <div className="g2">
        <div className="card">
          <div className="card-h">
            <Icon name="zap" size={14} />
            <h3>团队动态</h3>
            <div className="actions"><button className="btn ghost sm">全部</button></div>
          </div>
          <div className="card-b" style={{ padding: 0 }}>
            {logs.length === 0 ? (
              // 无日志时显示 TL 静态数据兜底
              TL.activity.map((a, i) => {
                const u = TL.userById(a.who);
                return (
                  <div key={i} className="row" style={{ padding: '10px 16px', borderBottom: i < TL.activity.length-1 ? '1px solid var(--divider)' : 'none' }}>
                    <Avatar user={u} size="sm" />
                    <div style={{ fontSize: 12.5, flex: 1 }}>
                      <b style={{ fontWeight: 500 }}>{u.name}</b> <span className="muted">{a.what}</span> <span>{a.obj}</span>
                    </div>
                    <span className="muted mono" style={{ fontSize: 11 }}>{a.when}</span>
                  </div>
                );
              })
            ) : (
              logs.map((l, i) => {
                const isAi = l.source.startsWith('ai');
                return (
                  <div key={l.id} className="row" style={{ padding: '10px 16px', borderBottom: i < logs.length-1 ? '1px solid var(--divider)' : 'none' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: isAi ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      display: 'grid', placeItems: 'center',
                      fontSize: 11, color: isAi ? 'var(--accent)' : 'var(--text-muted)',
                    }}>
                      <Icon name={isAi ? 'sparkle' : 'zap'} size={12} />
                    </div>
                    <div style={{ fontSize: 12.5, flex: 1, lineHeight: 1.4 }}>
                      <Chip>{sourceLabel[l.source] || l.source}</Chip>{' '}
                      <span className="muted">{l.action}</span>
                    </div>
                    <span className="muted mono" style={{ fontSize: 11 }}>
                      {new Date(l.createdAt).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <Icon name="trending" size={14} />
            <h3>本周节点 & 提醒</h3>
            <div className="actions"><span className="chip">5/12 · 周一</span></div>
          </div>
          <div className="card-b">
            <ReminderList />
          </div>
        </div>
      </div>
    </section>
  );
}

function ReminderList() {
  const items = [
    { tag: '今天', tone: 'danger', text: '青朴 · 9月主推脚本 v2 截稿 18:00', meta: '林玥' },
    { tag: '今天', tone: 'danger', text: '云杉防晒衣大场开播 19:30', meta: '苏念' },
    { tag: '明天', tone: 'warn', text: '林野直播脚本评审 10:00', meta: '陈思远 · 苏念' },
    { tag: '5/14', tone: 'default', text: '团队周会复盘 10:00', meta: '全员' },
    { tag: '5/17', tone: 'accent', text: '618 预热启动节点', meta: '全员' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((it, i) => (
        <div key={i} className="row" style={{ padding: '8px 0', borderBottom: i < items.length-1 ? '1px solid var(--divider)' : 'none' }}>
          <Chip tone={it.tone} dot>{it.tag}</Chip>
          <div className="grow" style={{ fontSize: 12.5 }}>{it.text}</div>
          <span className="muted" style={{ fontSize: 11 }}>{it.meta}</span>
        </div>
      ))}
    </div>
  );
}

// ── 在管品牌 ──────────────────────────────────────────────────────────────
function BrandsBlock() {
  return (
    <section style={{ marginBottom: 24 }}>
      <SectionTitle
        title="在管品牌"
        sub="5 个品牌 · 12 个抖音号在运营"
        actions={<button className="btn ghost sm"><Icon name="plus" size={12} /> 添加品牌</button>}
      />
      <div className="g3">
        {TL.brands.map(b => {
          const accs = TL.accounts.filter(a => a.brand === b.id);
          const gmv7 = accs.reduce((s, a) => s + a.gmv7d, 0);
          return (
            <div key={b.id} className="card" style={{ padding: 14 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                  display: 'grid', placeItems: 'center',
                  fontWeight: 600, color: 'var(--text-secondary)'
                }}>{b.logo}</div>
                <div className="col tight grow">
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{b.cat} · {accs.length} 账号</div>
                </div>
                <button className="btn ghost icon"><Icon name="more" size={13} /></button>
              </div>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span className="muted" style={{ fontSize: 11 }}>7日 GMV</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>¥ {TL.fmtMoney(gmv7)}</span>
              </div>
              <Sparkline data={TL.gmvTrend.slice(-10).map((v, i) => v + i * (b.id === 'b4' ? 4 : 1))} width={300} height={28} />
            </div>
          );
        })}
        <div className="card" style={{ padding: 14, display: 'grid', placeItems: 'center', color: 'var(--text-muted)', minHeight: 116, border: '1px dashed var(--border-strong)', boxShadow: 'none' }}>
          <div className="col" style={{ alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={18} />
            <span style={{ fontSize: 12 }}>添加新品牌</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 本周排期速览 ──────────────────────────────────────────────────────────
function SchedulePeek() {
  const days = ['一','二','三','四','五','六','日'];
  const today = 11;
  return (
    <section style={{ marginBottom: 24 }}>
      <SectionTitle
        title="本周排期速览"
        sub="5月12日 - 5月18日"
        actions={<button className="btn ghost sm"><Icon name="calendar" size={12} /> 打开日历</button>}
      />
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((d, i) => {
            const dayNum = 12 + i;
            const evts = TL.schedule.filter(e => e.day === dayNum);
            const isToday = dayNum === today + 1;
            return (
              <div key={i} style={{
                borderRight: i < 6 ? '1px solid var(--divider)' : 'none',
                padding: '10px 12px', minHeight: 130,
                background: isToday ? 'var(--accent-subtle)' : 'transparent'
              }}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>周{d}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text)' }}>{dayNum}</span>
                </div>
                <div className="col tight">
                  {evts.slice(0, 3).map((e, ei) => (
                    <div key={ei} className={`cal-evt t-${e.type}`} title={e.label}>{e.time} · {e.label}</div>
                  ))}
                  {evts.length > 3 && <div className="muted" style={{ fontSize: 10.5 }}>+ {evts.length - 3} 项</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

TL.Home = Home;
window.Home = Home;
