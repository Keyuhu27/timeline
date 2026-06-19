// 潮线 Tideline · 千川投流管理（接真实 API）

const { useState, useEffect } = React;

const Ads = function Ads() {
  const [tab, setTab] = useState('campaigns');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ads')
      .then(r => r.json())
      .then(d => { if (d.data?.summary) setSummary(d.data.summary); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n) => n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : (n || 0).toLocaleString();

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">本地推投流</h1>
            <p className="page-sub">
              {summary
                ? `${summary.activeCnt} 个活跃计划 · 今日花费 ¥ ${fmt(summary.totalSpent)} · 综合 ROI ${(summary.avgRoas || 0).toFixed(2)}`
                : loading ? '加载中…' : '暂无数据'}
            </p>
          </div>
          <div className="page-actions">
            <button className="btn" onClick={() => window.location.reload()}><Icon name="refresh" size={13} /> 同步</button>
            <button className="btn primary"><Icon name="plus" size={13} /> 新建计划</button>
          </div>
        </div>

        <div className="g4 mt-sm" style={{ marginBottom: 16 }}>
          <Stat3 label="今日花费" value={summary ? `¥ ${fmt(summary.totalSpent)}` : '—'} sub={summary ? `预算 ¥ ${fmt(summary.totalBudget)}` : ''} />
          <Stat3 label="今日 GMV" value={summary ? `¥ ${fmt(summary.totalGmv)}` : '—'} />
          <Stat3 label="综合 ROI" value={summary ? (summary.avgRoas || 0).toFixed(2) : '—'} tone={summary && summary.avgRoas >= 2.8 ? 'success' : undefined} />
          <Stat3 label="活跃计划" value={summary ? String(summary.activeCnt) : '—'} sub={summary?.lastSyncAt ? `同步 ${new Date(summary.lastSyncAt).toLocaleTimeString('zh')}` : '未同步'} />
        </div>

        <div className="tabs">
          <div className={`tab ${tab === 'campaigns' ? 'active' : ''}`} onClick={() => setTab('campaigns')}>投放计划</div>
          <div className={`tab ${tab === 'rules' ? 'active' : ''}`} onClick={() => setTab('rules')}>自动规则</div>
          <div className={`tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>操作日志</div>
        </div>

        {tab === 'campaigns' && <Campaigns />}
        {tab === 'rules'     && <Rules />}
        {tab === 'logs'      && <Logs />}
      </div>
    </div>
  );
};

function Stat3({ label, value, sub, tone }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: tone === 'success' ? 'var(--success)' : undefined }}>{value}</div>
      {sub && <div className="stat-delta">{sub}</div>}
    </div>
  );
}

// ── 投放计划 ─────────────────────────────────────────────────────────────
function Campaigns() {
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);

  const load = () => {
    setLoading(true);
    fetch('/api/ads')
      .then(r => r.json())
      .then(d => setCamps(d.data?.campaigns || []))
      .catch(() => setCamps([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggle = async (c) => {
    setSyncing(c.id);
    const newStatus = c.status === 'active' ? 'paused' : 'active';
    await fetch(`/api/ads?id=${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setSyncing(null);
    load();
  };

  if (loading) return <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>正在从巨量引擎拉取数据…</div>;
  if (!camps.length) return (
    <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
      暂无计划数据。请确认 Token 已注入并运行「同步」。
    </div>
  );

  return (
    <div className="card">
      <div className="card-h">
        <h3>投放计划 · {camps.filter(c => c.status === 'active').length} 个活跃</h3>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>广告主 / 计划</th>
            <th className="num">预算</th>
            <th className="num">今日花费</th>
            <th className="num">GMV</th>
            <th className="num">ROI</th>
            <th className="num">CTR</th>
            <th className="num">CVR</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {camps.map(c => {
            const brand = TL.brandById(c.brand);
            const pct = c.budget > 0 ? c.spent / c.budget : 0;
            const isLoading = syncing === c.id;
            return (
              <tr key={c.id}>
                <td>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  <div className="muted mono" style={{ fontSize: 11 }}>{c.account}</div>
                </td>
                <td className="num">
                  <div className="mono" style={{ fontSize: 12 }}>
                    {c.budget > 0 ? `¥ ${c.budget.toLocaleString()}` : '—'}
                  </div>
                  {c.budget > 0 && (
                    <div className="bar" style={{ marginTop: 4 }}>
                      <div style={{ width: `${pct * 100}%`, background: pct > 0.9 ? 'var(--warning)' : 'var(--accent)' }} />
                    </div>
                  )}
                </td>
                <td className="num mono">{c.spent > 0 ? `¥ ${c.spent.toLocaleString()}` : '—'}</td>
                <td className="num mono">{c.gmv > 0 ? `¥ ${c.gmv.toLocaleString()}` : '—'}</td>
                <td className="num mono" style={{ fontWeight: 600, color: c.roas >= 2.8 ? 'var(--success)' : c.roas > 0 && c.roas < 1.5 ? 'var(--danger)' : undefined }}>
                  {c.roas > 0 ? c.roas.toFixed(2) : '—'}
                </td>
                <td className="num mono">{c.ctr > 0 ? (c.ctr * 100).toFixed(1) + '%' : '—'}</td>
                <td className="num mono">{c.cvr > 0 ? (c.cvr * 100).toFixed(1) + '%' : '—'}</td>
                <td>
                  {c.status === 'active'  && <Chip tone="success" dot>投放中</Chip>}
                  {c.status === 'paused'  && <Chip dot>已暂停</Chip>}
                  {c.status === 'ended'   && <Chip tone="default">已结束</Chip>}
                </td>
                <td className="row tight">
                  <button className="btn ghost icon sm" disabled={isLoading} onClick={() => toggle(c)}>
                    <Icon name={isLoading ? 'loader' : c.status === 'active' ? 'pause' : 'play'} size={11} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 自动规则 ─────────────────────────────────────────────────────────────
function Rules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rules')
      .then(r => r.json())
      .then(d => setRules(d.data?.rules || []))
      .catch(() => [])
      .finally(() => setLoading(false));
  }, []);

  const toggleRule = async (r) => {
    await fetch(`/api/rules?id=${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !r.enabled }),
    });
    setRules(prev => prev.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x));
  };

  const metricLabel = { roas: 'ROI', ctr: '点击率', cvr: '转化率', cpm: 'CPM', gmv: 'GMV', spent_pct: '预算消耗%' };
  const actionLabel = { pause: '暂停计划', resume: '恢复计划', increase_budget: '提升预算', decrease_budget: '降低预算', alert: '发送告警' };

  if (loading) return <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>加载中…</div>;

  return (
    <div className="card">
      <div className="card-h"><h3>自动调控规则</h3></div>
      <table className="tbl">
        <thead><tr><th>规则名</th><th>品牌</th><th>触发条件</th><th>动作</th><th>冷却</th><th>最近触发</th><th>状态</th></tr></thead>
        <tbody>
          {rules.map(r => (
            <tr key={r.id}>
              <td style={{ fontWeight: 500 }}>{r.name}</td>
              <td><Chip>{r.brand === 'all' ? '全部品牌' : (TL.brandById(r.brand)?.name || r.brand)}</Chip></td>
              <td className="mono" style={{ fontSize: 11 }}>{metricLabel[r.metric]} {r.operator} {r.threshold}</td>
              <td><Chip tone={r.action === 'pause' ? 'warn' : r.action === 'increase_budget' ? 'success' : 'default'}>{actionLabel[r.action]}{r.actionValue ? ` ${r.actionValue}%` : ''}</Chip></td>
              <td className="num muted">{r.cooldownMinutes}min</td>
              <td className="muted" style={{ fontSize: 11 }}>{r.lastTriggeredAt ? new Date(r.lastTriggeredAt).toLocaleString('zh') : '从未'}</td>
              <td>
                <button className="btn ghost sm" onClick={() => toggleRule(r)}>
                  {r.enabled ? <Chip tone="success" dot>启用</Chip> : <Chip dot>停用</Chip>}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 操作日志 ─────────────────────────────────────────────────────────────
function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/logs')
      .then(r => r.json())
      .then(d => setLogs(d.data?.logs || []))
      .catch(() => [])
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>加载中…</div>;

  return (
    <div className="card">
      <div className="card-h"><h3>操作日志</h3></div>
      {logs.length === 0
        ? <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>暂无日志</div>
        : (
          <table className="tbl">
            <thead><tr><th>时间</th><th>来源</th><th>动作</th><th>计划</th><th>结果</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td className="muted mono" style={{ fontSize: 11 }}>{new Date(l.createdAt).toLocaleString('zh')}</td>
                  <td><Chip>{l.source === 'auto_rule' ? '规则引擎' : l.source}</Chip></td>
                  <td style={{ fontSize: 12 }}>{l.action}</td>
                  <td style={{ fontSize: 12 }}>{l.campaignName || '—'}</td>
                  <td>{l.success ? <Chip tone="success">成功</Chip> : <Chip tone="danger">失败</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  );
}

TL.Ads = Ads;
window.Ads = Ads;
