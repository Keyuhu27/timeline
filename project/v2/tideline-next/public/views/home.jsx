// 潮线 Tideline · 首页 — 本地推真实数据工作台 + AI 决策面板

window.TL = window.TL || {};
const { useState, useEffect, useCallback } = React;

const Home = function Home({ moduleOrder }) {
  const modules = {
    today:        <TodayBlock key="today" />,
    campaigns:    <CampaignsBlock key="campaigns" />,
    activityLogs: <ActivityLogsBlock key="activityLogs" />,
    aiDecisions:  <AiDecisionsBlock key="aiDecisions" />,
  };
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">本地推工作台</h1>
            <p className="page-sub">实时巨量本地推投放概览 · 计划、规则与 AI 决策一站可见。</p>
          </div>
        </div>
        {(moduleOrder ?? ['today','campaigns','activityLogs','aiDecisions']).map(key => modules[key]).filter(Boolean)}
      </div>
    </div>
  );
};

// ── 今日概览 — 真实 /api/ads + /api/logs ─────────────────────────────────
function TodayBlock() {
  const [ads, setAds] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/ads').then(r => r.json()).catch(() => null),
      fetch('/api/logs').then(r => r.json()).catch(() => null),
    ]).then(([a, l]) => {
      if (a && a.data) setAds(a.data);
      if (l && l.data) setLogs(l.data.logs || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const syncAccounts = async () => {
    setSyncing(true); setMsg('正在同步广告主…');
    try {
      const r = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      const errs = d.data?.errors || [];
      setMsg(errs.length ? `同步完成，但有提示：${errs[0]}` : '同步成功');
      await TL._refresh();
      load();
    } catch (e) { setMsg('同步失败：' + e.message); }
    setSyncing(false);
  };

  const refresh = async () => {
    setMsg('正在刷新数据…');
    await TL._refresh();
    load();
    setMsg('已刷新');
  };

  const fmt = n => n >= 10000 ? (n / 10000).toFixed(1) + '万' : (Math.round(n || 0)).toLocaleString();
  const campaigns = ads?.campaigns || [];
  const cs = ads?.summary;
  const pausedCnt = campaigns.filter(c => TL._normStatus(c.status) === 'paused').length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const rulesToday = logs.filter(l => l.source === 'auto_rule' && (l.createdAt || '').slice(0, 10) === todayStr).length;
  const cpl = cs && cs.totalLeads > 0 ? (cs.totalSpent / cs.totalLeads) : 0;

  const stats = [
    { label: '今日花费',   icon: 'cart',    value: loading ? '—' : `¥ ${fmt(cs?.totalSpent || 0)}`, sub: cs ? `预算 ¥${fmt(cs.totalBudget)}` : '请先同步广告主' },
    { label: '总线索量',   icon: 'sparkle', value: loading ? '—' : fmt(cs?.totalLeads || 0), sub: '到店 + 电话 + 发券' },
    { label: '线索成本',   icon: 'wallet',  value: loading ? '—' : (cpl > 0 ? `¥ ${cpl.toFixed(1)}` : '—'), sub: 'CPL' },
    { label: '活跃计划',   icon: 'target',  value: loading ? '—' : (cs?.activeCnt || 0), sub: '投放中' },
    { label: '已暂停计划', icon: 'pause',   value: loading ? '—' : pausedCnt, sub: '已暂停' },
    { label: '今日触发规则', icon: 'zap',   value: loading ? '—' : rulesToday, sub: '规则引擎自动调控' },
  ];

  return (
    <section style={{ marginBottom: 20 }}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="row tight">
          {msg && <span className="muted" style={{ fontSize: 11.5 }}>{msg}</span>}
        </div>
        <div className="row tight">
          <button className="btn ghost sm" onClick={refresh} disabled={loading || syncing}><Icon name="refresh" size={12} /> 刷新数据</button>
          <button className="btn primary sm" onClick={syncAccounts} disabled={syncing}><Icon name={syncing ? 'loader' : 'download'} size={12} /> {syncing ? '同步中…' : '同步广告主'}</button>
        </div>
      </div>
      <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {stats.map((s, i) => (
          <div className="stat" key={i}>
            <div className="stat-label"><Icon name={s.icon} size={13} /> {s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-delta">{s.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 本地推计划表 — 真实 /api/ads ─────────────────────────────────────────
function CampaignsBlock() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/ads').then(r => r.json())
      .then(d => setCampaigns(d.data?.campaigns || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <section style={{ marginBottom: 24 }}>
      <SectionTitle title="本地推计划" sub={`${campaigns.length} 个项目`} actions={<button className="btn ghost sm" onClick={load}><Icon name="refresh" size={12} /></button>} />
      <div className="card">
        {loading ? (
          <div className="card-b muted" style={{ fontSize: 12.5 }}>加载中…</div>
        ) : campaigns.length === 0 ? (
          <div className="card-b muted" style={{ fontSize: 12.5 }}>暂无投放数据，请先「同步广告主」。</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>品牌 / 计划</th><th>预算</th><th>今日花费</th><th>总线索</th>
                <th>线索成本</th><th>点击率</th><th>ROAS</th><th>状态</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const brand = TL.brandById(c.brand);
                const acc = TL.accountById(c.account);
                const leads = c.leads || 0;
                const cpl = leads > 0 ? (c.spent / leads).toFixed(1) : '—';
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{TL.displayCampaignName(c)}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{TL.displayBrandName(brand, acc)}</div>
                    </td>
                    <td>¥ {TL.fmtMoney(c.budget || 0)}</td>
                    <td>¥ {TL.fmtMoney(c.spent || 0)}</td>
                    <td>{leads}</td>
                    <td>{cpl === '—' ? '—' : `¥ ${cpl}`}</td>
                    <td>{((c.ctr || 0) * 100).toFixed(1)}%</td>
                    <td>{(c.roas || 0).toFixed(2)}</td>
                    <td><Chip tone={TL.statusTone(c.status)}>{TL.statusLabel(c.status)}</Chip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// ── 规则引擎动态 — 真实 /api/logs ────────────────────────────────────────
function ActivityLogsBlock() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/logs').then(r => r.json())
      .then(d => setLogs(d.data?.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sourceLabel = {
    auto_rule: '规则引擎', manual: '手动', scheduler: '调度器',
    system: '系统', ai_analysis: 'AI诊断', ai_creative: 'AI创意', ai_agent: 'AI决策',
  };

  return (
    <section style={{ marginBottom: 24 }}>
      <SectionTitle title="规则引擎动态" sub="自动调控记录" />
      <div className="card">
        {loading ? (
          <div className="card-b muted" style={{ fontSize: 12.5 }}>加载中…</div>
        ) : logs.length === 0 ? (
          <div className="card-b muted" style={{ fontSize: 12.5 }}>暂无规则触发记录。</div>
        ) : (
          <div className="card-b" style={{ padding: 0 }}>
            {logs.slice(0, 12).map((l, i) => (
              <div key={l.id} className="row" style={{ padding: '10px 16px', borderBottom: i < Math.min(logs.length, 12) - 1 ? '1px solid var(--divider)' : 'none' }}>
                <Chip>{sourceLabel[l.source] || l.source}</Chip>
                <div style={{ fontSize: 12.5, flex: 1, lineHeight: 1.4 }}>
                  {l.ruleName && <b style={{ fontWeight: 500 }}>{l.ruleName}</b>}{' '}
                  <span className="muted">{l.campaignName ? `· ${l.campaignName} · ` : ''}{l.action}</span>
                </div>
                <Chip tone={l.success ? 'success' : 'danger'}>{l.success ? '成功' : '失败'}</Chip>
                <span className="muted mono" style={{ fontSize: 11, marginLeft: 8 }}>
                  {new Date(l.createdAt).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
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
            <span>{aiStatus?.lastRunAt ? `暂无待审批的 AI 建议 · 上次分析 ${new Date(aiStatus.lastRunAt).toLocaleTimeString('zh')}` : '今日尚未运行 AI 分析'}</span>
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

                  <div className="row tight" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                    <Icon name="zap" size={11} />
                    <span>{topRec.reason}</span>
                  </div>

                  <div className="row tight">
                    <button className="btn sm primary" disabled={isActing} onClick={() => decide(d.id, 'approve')}>
                      <Icon name={isActing ? 'loader' : 'check'} size={12} />
                      {isActing ? '执行中…' : '确认执行'}
                    </button>
                    <button className="btn sm ghost" disabled={isActing} onClick={() => decide(d.id, 'reject')}>忽略</button>
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

TL.Home = Home;
window.Home = Home;
