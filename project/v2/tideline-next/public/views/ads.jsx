// 潮线 Tideline · 本地推投流管理

const { useState, useEffect, useCallback } = React;

const Ads = function Ads() {
  const [tab, setTab] = useState('campaigns');
  const [summary, setSummary] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const loadSummary = () => {
    fetch('/api/ads')
      .then(r => r.json())
      .then(d => { if (d.data?.summary) setSummary(d.data.summary); })
      .catch(() => {});
  };

  useEffect(loadSummary, []);

  const syncAdvertisers = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const r = await fetch('/api/accounts', { method: 'POST' });
      const d = await r.json();
      if (d.data) {
        const errs = d.data.errors ?? [];
        let msg = `已同步 ${d.data.synced} 个新广告主，共 ${d.data.total} 个，拉取 ${d.data.campaignsSynced ?? 0} 个计划`;
        if (errs.length > 0) msg += `\n⚠️ ${errs.length} 个错误：${errs[0]}`;
        setSyncMsg(msg);
        await TL._loadFromApi();
        window.dispatchEvent(new Event('tl:brands-updated'));
        loadSummary();
      } else {
        setSyncMsg('❌ ' + (d.error || '同步失败'));
      }
    } catch (e) {
      setSyncMsg('同步失败: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const fmt = (n) => n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : (n || 0).toLocaleString();

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">本地推投流</h1>
            <p className="page-sub">
              {summary
                ? `${summary.activeCnt} 个活跃计划 · 今日花费 ¥ ${fmt(summary.totalSpent)}`
                : '加载中…'}
            </p>
          </div>
          <div className="page-actions">
            <button className="btn" onClick={() => { window.location.href = '/api/auth'; }}>
              <Icon name="plus" size={13} /> 连接我的本地推账户
            </button>
            <button className="btn" onClick={syncAdvertisers} disabled={syncing}>
              <Icon name="refresh" size={13} /> {syncing ? '同步中…' : '同步广告主'}
            </button>
            <button className="btn" onClick={loadSummary}><Icon name="refresh" size={13} /> 刷新数据</button>
          </div>
        </div>

        {syncMsg && (
          <div style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--surface)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            {syncMsg}
          </div>
        )}

        <div className="g4 mt-sm" style={{ marginBottom: 16 }}>
          <Stat3 label="今日花费" value={summary ? `¥ ${fmt(summary.totalSpent)}` : '—'} sub={summary ? `预算 ¥ ${fmt(summary.totalBudget)}` : ''} />
          <Stat3 label="总线索量" value={summary ? fmt(summary.totalLeads ?? 0) : '—'} sub="到店 + 电话 + 发券" />
          <Stat3 label="线索成本" value={summary ? (summary.totalLeads > 0 ? `¥ ${(summary.totalSpent / summary.totalLeads).toFixed(1)}` : '—') : '—'} />
          <Stat3 label="活跃计划" value={summary ? String(summary.activeCnt) : '—'} sub={summary?.lastSyncAt ? `同步 ${new Date(summary.lastSyncAt).toLocaleTimeString('zh')}` : '未同步'} />
        </div>

        <div className="tabs">
          <div className={`tab ${tab === 'brands'    ? 'active' : ''}`} onClick={() => setTab('brands')}>品牌汇总</div>
          <div className={`tab ${tab === 'liveOpt'   ? 'active' : ''}`} onClick={() => setTab('liveOpt')}>
            <Icon name="target" size={12} /> 直播间优化投流
          </div>
          <div className={`tab ${tab === 'review'    ? 'active' : ''}`} onClick={() => setTab('review')}>投流复盘</div>
          <div className={`tab ${tab === 'campaigns' ? 'active' : ''}`} onClick={() => setTab('campaigns')}>投放计划</div>
          <div className={`tab ${tab === 'promotions' ? 'active' : ''}`} onClick={() => setTab('promotions')}>单元管理</div>
          <div className={`tab ${tab === 'rules'     ? 'active' : ''}`} onClick={() => setTab('rules')}>自动规则</div>
          <div className={`tab ${tab === 'logs'      ? 'active' : ''}`} onClick={() => setTab('logs')}>操作日志</div>
          <div className={`tab ${tab === 'ai'        ? 'active' : ''}`} onClick={() => setTab('ai')}>
            <Icon name="sparkle" size={12} /> AI 决策
          </div>
        </div>

        {tab === 'brands'    && <BrandsSummary />}
        {tab === 'liveOpt'   && <LiveOptimization />}
        {tab === 'review'    && <ExternalReports />}
        {tab === 'campaigns' && <Campaigns />}
        {tab === 'promotions' && <Promotions />}
        {tab === 'rules'     && <Rules />}
        {tab === 'logs'      && <Logs />}
        {tab === 'ai'        && <AiDecisions />}
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

// ── 品牌汇总（按品牌聚合投放计划）──────────────────────────────────────────
function BrandsSummary() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const money = (n) => `¥ ${(Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

  useEffect(() => {
    Promise.all([
      fetch('/api/brands').then(r => r.json()),
      fetch('/api/ads?pageSize=1000').then(r => r.json()),
    ])
      .then(([brandsRes, adsRes]) => {
        const brandList = brandsRes.data ?? [];
        const camps = adsRes.data?.campaigns ?? [];
        const byBrand = {};
        // 先把这个本地推账号下所有品牌都建一行——不管当前有没有投放计划/在不在投流中，
        // 都要出现在汇总里，不能只靠"有计划数据的品牌才出现"。
        for (const br of brandList) {
          byBrand[br.id] = { brand: br.id, name: br.name, count: 0, active: 0, spent: 0, gmv: 0 };
        }
        for (const c of camps) {
          const bid = c.brand;
          const b = byBrand[bid] || (byBrand[bid] = { brand: bid, name: (TL.brandById(bid)?.name) || bid, count: 0, active: 0, spent: 0, gmv: 0 });
          b.count++; if ((c.status === 'active')) b.active++;
          b.spent += Number(c.spent) || 0; b.gmv += Number(c.gmv) || 0;
        }
        setRows(Object.values(byBrand).sort((a, b) => b.spent - a.spent));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card-b muted" style={{ fontSize: 12.5 }}>加载中…</div>;
  if (!rows.length) return <div className="card-b muted" style={{ fontSize: 12.5 }}>暂无品牌数据，请先「连接我的本地推账户」或「同步广告主」。</div>;
  return (
    <div className="card">
      <table className="tbl">
        <thead><tr>
          <th>品牌</th><th className="num">计划数</th><th className="num">活跃</th>
          <th className="num">消耗</th><th className="num">成交金额</th><th className="num">ROI</th>
        </tr></thead>
        <tbody>
          {rows.map(b => (
            <tr key={b.brand}>
              <td style={{ fontWeight: 500 }}>{b.name}</td>
              <td className="num">{b.count}</td>
              <td className="num">{b.active}</td>
              <td className="num">{money(b.spent)}</td>
              <td className="num">{money(b.gmv)}</td>
              <td className="num">{b.spent > 0 ? (b.gmv / b.spent).toFixed(2) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 投流复盘（Codex 等外部代理写入，平台只展示）──────────────────────────────
function ExternalReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState({});

  useEffect(() => {
    fetch('/api/reports/external')
      .then(r => r.json())
      .then(d => setReports(d.data?.reports || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card-b muted" style={{ fontSize: 12.5 }}>加载中…</div>;
  if (!reports.length) return (
    <div className="card-b muted" style={{ fontSize: 12.5 }}>
      暂无投流复盘。由 Codex 等外部代理通过 <span className="mono">POST /api/reports/external</span>（带 X-Api-Key）写入后在此展示。
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {reports.map(r => (
        <div key={r.id} className="card" style={{ padding: '12px 14px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', cursor: 'pointer' }} onClick={() => setOpen(o => ({ ...o, [r.id]: !o[r.id] }))}>
            <div>
              <span style={{ fontWeight: 600 }}>{r.title}</span>
              <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>
                {r.date}{r.brandName ? ` · ${r.brandName}` : ''} · 来源 {r.source}
              </span>
            </div>
            <span className="muted mono" style={{ fontSize: 11 }}>{open[r.id] ? '收起 ▲' : '展开 ▼'}</span>
          </div>
          {open[r.id] && (
            // 纯文本安全渲染（white-space: pre-wrap），不解析 HTML，防 XSS
            <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text)' }}>
              {r.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 直播间优化投流（计划级只读巡检 · dry-run）────────────────────────────────
function LiveOptimization() {
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const money = (v) => v == null ? '—' : `¥ ${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  const num = (v) => v == null ? '—' : Number(v).toLocaleString('zh-CN');

  const load = useCallback(() => {
    fetch('/api/live-optimization').then(r => r.json()).then(d => setScan(d.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const runScan = async () => {
    setScanning(true);
    try {
      const r = await fetch('/api/live-optimization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scan' }) });
      const d = await r.json();
      if (d.data) setScan(d.data);
    } catch (e) { /* ignore */ } finally { setScanning(false); }
  };

  const decide = async (id, action) => {
    await fetch('/api/ai/decisions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, approvedBy: 'operator' }) });
    load();
  };

  if (loading) return <div className="card-b muted" style={{ fontSize: 12.5 }}>加载中…</div>;
  const control = (scan?.hits || []).filter(h => h.kind === 'control');
  const pending = scan?.pending || [];
  const recChip = (rec) => {
    if (!rec) return <Chip tone="muted">—</Chip>;
    if (rec.action === 'pause') return <Chip tone="danger">关停计划</Chip>;
    if (rec.action === 'increase_budget' || rec.action === 'decrease_budget') {
      const sign = rec.action === 'increase_budget' ? '+' : '-';
      const label = rec.budgetDeltaAbsolute != null
        ? `${sign}¥${Math.abs(rec.budgetDeltaAbsolute)}`
        : `${sign}${rec.suggestedValue ?? 20}%`;
      return <Chip tone={rec.action === 'increase_budget' ? 'success' : 'warn'}>{rec.action === 'increase_budget' ? '追加预算' : '降低预算'} {label}</Chip>;
    }
    return <Chip tone="muted">{rec.action}</Chip>;
  };
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          最近巡检：{scan?.at ? new Date(scan.at).toLocaleString('zh') : '尚未巡检'} · 状态 {scan?.status || '—'} · 检查 {scan?.checked ?? 0} 个计划
          <span style={{ marginLeft: 8, padding: '1px 6px', background: '#fff7e6', color: '#d46b08', borderRadius: 4, fontSize: 11 }}>命中 ROI 红线进人工审批；批准后是否真实执行取决于 OCEANENGINE_EXECUTE_WRITES</span>
        </div>
        <button className="btn" onClick={runScan} disabled={scanning}><Icon name="refresh" size={13} /> {scanning ? '巡检中…' : '立即巡检'}</button>
      </div>

      {/* 待审批：ROI 红线命中（关停 / 追投） */}
      <div style={{ fontSize: 12, fontWeight: 600, margin: '10px 0 6px' }}>待审批 · ROI 红线命中（{pending.length}）</div>
      {pending.length === 0 ? (
        <div className="card-b muted" style={{ fontSize: 12.5 }}>暂无待审批项。</div>
      ) : (
        <div className="card" style={{ marginBottom: 14 }}>
          <table className="tbl">
            <thead><tr><th>计划</th><th>建议</th><th>依据</th><th>操作</th></tr></thead>
            <tbody>
              {pending.map(d => (
                <tr key={d.id}>
                  <td>{d.campaignName}</td>
                  <td>{recChip(d.recommendations?.[0])}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.recommendations?.[0]?.reason || '—'}</td>
                  <td>
                    <div className="row tight">
                      <button className="btn sm" onClick={() => decide(d.id, 'approve')}>批准</button>
                      <button className="btn ghost sm" onClick={() => decide(d.id, 'reject')}>驳回</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 其余控损命中（暂仍只记录日志，无待审批操作） */}
      <div style={{ fontSize: 12, fontWeight: 600, margin: '10px 0 6px' }}>控损命中（{control.length}）</div>
      {control.length === 0 ? (
        <div className="card-b muted" style={{ fontSize: 12.5 }}>本次巡检无控损命中。</div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th>计划 / projectId</th><th className="num">消耗</th><th className="num">全域成交金额</th>
                <th className="num">订单数</th><th className="num">支付ROI</th><th className="num">订单成本</th>
                <th>命中规则</th><th>建议动作</th><th>状态</th>
              </tr></thead>
              <tbody>
                {control.map((h, i) => (
                  <tr key={i}>
                    <td><div style={{ fontWeight: 500 }}>{h.materialName}</div><div className="muted mono" style={{ fontSize: 10.5 }}>{h.projectId}</div></td>
                    <td className="num">{money(h.spent)}</td>
                    <td className="num">{money(h.globalGmv)}</td>
                    <td className="num">{num(h.globalOrderCount)}</td>
                    <td className="num">{h.globalPayRoi == null ? '—' : Number(h.globalPayRoi).toFixed(2)}</td>
                    <td className="num">{money(h.globalOrderCost)}</td>
                    <td style={{ fontSize: 11 }}>{h.ruleName}</td>
                    <td><Chip tone="warn">{h.suggestedAction}</Chip></td>
                    <td>{h.requiresApproval ? <Chip tone="warn">待审批</Chip> : <Chip tone="muted">dry-run</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 投放计划（本地推指标）────────────────────────────────────────────────
function Campaigns() {
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/ads')
      .then(r => r.json())
      .then(d => setCamps(d.data?.campaigns || []))
      .catch(() => setCamps([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const toggle = async (c) => {
    setActing(c.id);
    const newStatus = c.status === 'active' ? 'paused' : 'active';
    await fetch(`/api/ads?id=${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setActing(null);
    load();
  };

  if (loading) return (
    <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
      正在从巨量引擎拉取数据…
    </div>
  );

  if (!camps.length) return (
    <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ marginBottom: 8 }}>暂无计划数据</div>
      <div style={{ fontSize: 12 }}>请先点击「同步广告主」拉取账户，规则引擎将在 60 分钟内自动同步计划数据</div>
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
            <th className="num">到店量</th>
            <th className="num">电话量</th>
            <th className="num">总线索</th>
            <th className="num">线索成本</th>
            <th className="num">点击率</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {camps.map(c => {
            const brand = TL.brandById ? TL.brandById(c.brand) : null;
            const pct = c.budget > 0 ? c.spent / c.budget : 0;
            const leads = c.leads ?? (c.storeVisits + c.phoneCalls + c.coupons);
            const costPerLead = leads > 0 && c.spent > 0 ? c.spent / leads : 0;
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
                      <div style={{ width: `${Math.min(pct, 1) * 100}%`, background: pct > 0.9 ? 'var(--warning)' : 'var(--accent)' }} />
                    </div>
                  )}
                </td>
                <td className="num mono">{c.spent > 0 ? `¥ ${c.spent.toLocaleString()}` : '—'}</td>
                <td className="num mono" style={{ color: (c.storeVisits ?? 0) > 0 ? 'var(--success)' : undefined }}>
                  {(c.storeVisits ?? 0) > 0 ? (c.storeVisits).toLocaleString() : '—'}
                </td>
                <td className="num mono">{(c.phoneCalls ?? 0) > 0 ? c.phoneCalls.toLocaleString() : '—'}</td>
                <td className="num mono" style={{ fontWeight: 600 }}>{leads > 0 ? leads.toLocaleString() : '—'}</td>
                <td className="num mono" style={{ color: costPerLead > 0 && costPerLead < 50 ? 'var(--success)' : undefined }}>
                  {costPerLead > 0 ? `¥ ${costPerLead.toFixed(1)}` : '—'}
                </td>
                <td className="num mono">{c.ctr > 0 ? (c.ctr * 100).toFixed(1) + '%' : '—'}</td>
                <td>
                  {c.status === 'active' && <Chip tone="success" dot>投放中</Chip>}
                  {c.status === 'paused' && <Chip dot>已暂停</Chip>}
                  {c.status === 'ended'  && <Chip tone="default">已结束</Chip>}
                </td>
                <td className="row tight">
                  <button className="btn ghost icon sm" disabled={acting === c.id} onClick={() => toggle(c)}>
                    <Icon name={acting === c.id ? 'loader' : c.status === 'active' ? 'pause' : 'play'} size={11} />
                  </button>
                  <AiDiagnoseButton campaign={c} onDone={() => {}} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 单元管理（Phase 5a：只读，无暂停/恢复——promotion/update/ 全量替换的
//    写安全性还没在真实环境验证过，见 mighty-enchanting-firefly.md Phase 5）──
function Promotions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/promotions?pageSize=1000')
      .then(r => r.json())
      .then(d => setRows(d.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const syncPromotions = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const r = await fetch('/api/accounts/sync-promotions', { method: 'POST' });
      const d = await r.json();
      if (d.data) {
        let msg = `已同步 ${d.data.synced} 个单元（检查了 ${d.data.accountsChecked} 个账户）`;
        if (d.data.errors?.length > 0) msg += `\n⚠️ ${d.data.errors.length} 个错误：${d.data.errors[0]}`;
        setSyncMsg(msg);
        load();
      } else {
        setSyncMsg('❌ ' + (d.error || '同步失败'));
      }
    } catch (e) {
      setSyncMsg('同步失败: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="card">
      <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>单元管理 · {rows.filter(p => p.status === 'active').length} 个投放中</h3>
        <button className="btn" onClick={syncPromotions} disabled={syncing}>
          <Icon name="refresh" size={13} /> {syncing ? '同步中…' : '同步单元数据'}
        </button>
      </div>
      {syncMsg && (
        <div style={{ padding: '8px 12px', margin: '0 16px 12px', background: 'var(--surface)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          {syncMsg}
        </div>
      )}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>加载中…</div>
      ) : !rows.length ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ marginBottom: 8 }}>暂无单元数据</div>
          <div style={{ fontSize: 12 }}>点击「同步单元数据」拉取当前租户下所有账户的单元列表</div>
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>单元 / 所属项目</th>
              <th className="num">消耗</th>
              <th className="num">支付ROI</th>
              <th className="num">点击率</th>
              <th>学习期</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id}>
                <td>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  <div className="muted mono" style={{ fontSize: 11 }}>{p.promotionId}</div>
                </td>
                <td className="num mono">{p.spent > 0 ? `¥ ${p.spent.toLocaleString()}` : '—'}</td>
                <td className="num mono">{p.roas > 0 ? p.roas.toFixed(2) : '—'}</td>
                <td className="num mono">{p.ctr > 0 ? (p.ctr * 100).toFixed(1) + '%' : '—'}</td>
                <td className="muted" style={{ fontSize: 12 }}>{p.learningPhase || '—'}</td>
                <td>
                  {p.status === 'active' && <Chip tone="success" dot>投放中</Chip>}
                  {p.status === 'paused' && <Chip dot>已暂停</Chip>}
                  {p.status === 'ended'  && <Chip tone="default">已结束</Chip>}
                  {p.status === 'unknown' && <Chip tone="default">未知</Chip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
      .catch(() => {})
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

  const metricLabel = {
    store_visits: '到店量', leads: '总线索量', cost_per_lead: '线索成本',
    ctr: '点击率', cpm: 'CPM', spent_pct: '预算消耗%',
    roas: 'ROI', cvr: '转化率', gmv: 'GMV',
  };
  const actionLabel = {
    pause: '暂停计划', resume: '恢复计划',
    increase_budget: '提升预算', decrease_budget: '降低预算', alert: '发送告警',
  };

  if (loading) return <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>加载中…</div>;

  return (
    <div className="card">
      <div className="card-h"><h3>自动调控规则</h3></div>
      <table className="tbl">
        <thead>
          <tr><th>规则名</th><th>品牌</th><th>触发条件</th><th>动作</th><th>冷却</th><th>最近触发</th><th>状态</th></tr>
        </thead>
        <tbody>
          {rules.map(r => (
            <tr key={r.id}>
              <td style={{ fontWeight: 500 }}>{r.name}</td>
              <td><Chip>{r.brand === 'all' ? '全部品牌' : (TL.brandById?.(r.brand)?.name || r.brand)}</Chip></td>
              <td className="mono" style={{ fontSize: 11 }}>{metricLabel[r.metric] ?? r.metric} {r.operator} {r.threshold}</td>
              <td>
                <Chip tone={r.action === 'pause' ? 'warn' : r.action === 'increase_budget' ? 'success' : 'default'}>
                  {actionLabel[r.action]}{r.actionValue ? ` ${r.actionValue}%` : ''}
                </Chip>
              </td>
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>加载中…</div>;

  return (
    <div className="card">
      <div className="card-h"><h3>操作日志</h3></div>
      {!logs.length
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
        )}
    </div>
  );
}

// ── AI 诊断按钮（内嵌在计划行中）────────────────────────────────────────
function AiDiagnoseButton({ campaign, onDone }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(false);

  const diagnose = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const r = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const d = await r.json();
      if (d.data) { setResult(d.data); setOpen(true); }
      else alert('AI 分析失败: ' + (d.error || '未知错误'));
    } catch (e) { alert('请求失败: ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <button className="btn ghost icon sm" title="AI 诊断" disabled={loading} onClick={diagnose}>
        <Icon name={loading ? 'loader' : 'sparkle'} size={11} />
      </button>
      {open && result && (
        <AiDiagnosisModal result={result} onClose={() => { setOpen(false); onDone(); }} />
      )}
    </>
  );
}

function AiDiagnosisModal({ result, onClose }) {
  const { diagnosis, decision } = result;
  const [approving, setApproving] = useState(false);

  const approve = async () => {
    if (!decision) return;
    setApproving(true);
    try {
      const r = await fetch('/api/ai/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: decision.id, action: 'approve', approvedBy: '当前用户' }),
      });
      const d = await r.json();
      if (d.data) { alert('执行成功'); onClose(); }
      else alert('执行失败: ' + (d.error || '未知'));
    } catch (e) { alert('请求失败: ' + e.message); }
    finally { setApproving(false); }
  };

  const reject = async () => {
    if (!decision) return;
    await fetch('/api/ai/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: decision.id, action: 'reject', approvedBy: '当前用户' }),
    });
    onClose();
  };

  const severityColor = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--text-muted)' };
  const actionLabel = { pause: '暂停计划', resume: '恢复计划', increase_budget: '提升预算', decrease_budget: '降低预算', alert: '发送告警' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 24, width: 560, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <div className="row tight">
            <Icon name="sparkle" size={16} />
            <h3 style={{ margin: 0 }}>AI 诊断报告 · {result.campaignName}</h3>
          </div>
          <button className="btn ghost icon sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13, lineHeight: 1.6 }}>
          {diagnosis.summary}
        </div>

        {diagnosis.issues?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>发现问题</div>
            {diagnosis.issues.map((issue, i) => (
              <div key={i} className="row tight" style={{ marginBottom: 5, fontSize: 12.5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: severityColor[issue.severity], flexShrink: 0, marginTop: 5 }} />
                <span style={{ color: issue.severity === 'high' ? 'var(--danger)' : undefined }}>{issue.desc}</span>
              </div>
            ))}
          </div>
        )}

        {diagnosis.recommendations?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>优化建议</div>
            {diagnosis.recommendations.map((rec, i) => (
              <div key={i} style={{ padding: '8px 10px', background: 'var(--accent-subtle)', borderRadius: 6, marginBottom: 6, fontSize: 12.5 }}>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{i + 1}. {rec.action}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{rec.reason}</div>
              </div>
            ))}
          </div>
        )}

        {decision && (
          <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 14, marginTop: 4 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI 建议操作</div>
            <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}>
              <div className="row tight" style={{ marginBottom: 4 }}>
                <Chip tone={decision.action === 'pause' ? 'warn' : decision.action.includes('increase') ? 'success' : 'default'}>
                  {actionLabel[decision.action] ?? decision.action}{decision.value ? ` ${decision.value}%` : ''}
                </Chip>
                <span className="muted" style={{ fontSize: 11 }}>置信度：{diagnosis.confidence}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{decision.reason}</div>
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost sm" onClick={reject}>忽略建议</button>
              <button className="btn primary sm" disabled={approving} onClick={approve}>
                {approving ? '执行中…' : '确认执行'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI 决策列表（Tab）────────────────────────────────────────────────────
function AiDecisions() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  const load = () => {
    setLoading(true);
    fetch(`/api/ai/decisions?status=${filter}`)
      .then(r => r.json())
      .then(d => setDecisions(d.data?.decisions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const statusLabel = { pending: '待审批', approved: '已批准', rejected: '已拒绝', executed: '已执行', failed: '失败' };
  const actionLabel = { pause: '暂停', resume: '恢复', increase_budget: '提升预算', decrease_budget: '降低预算', alert: '告警', hold: '维持' };

  if (loading) return <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>加载中…</div>;

  return (
    <div className="card">
      <div className="card-h">
        <h3>AI 决策记录</h3>
        <div className="actions row tight">
          {['pending', 'executed', 'rejected'].map(s => (
            <button key={s} className={`btn ghost sm ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
              {statusLabel[s]}
            </button>
          ))}
        </div>
      </div>
      {!decisions.length ? (
        <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
          {filter === 'pending' ? '暂无待审批决策，可在计划列表点击「AI诊断」生成' : '暂无记录'}
        </div>
      ) : (
        <table className="tbl">
          <thead><tr><th>时间</th><th>计划</th><th>AI 建议</th><th>原因摘要</th><th>状态</th></tr></thead>
          <tbody>
            {decisions.map(d => (
              <tr key={d.id}>
                <td className="muted mono" style={{ fontSize: 11 }}>{new Date(d.createdAt).toLocaleString('zh')}</td>
                <td style={{ fontSize: 12 }}>{d.campaignName}</td>
                <td>
                  <Chip tone={d.action === 'pause' ? 'warn' : d.action.includes('increase') ? 'success' : 'default'}>
                    {actionLabel[d.action] ?? d.action}{d.value ? ` ${d.value}%` : ''}
                  </Chip>
                </td>
                <td style={{ fontSize: 11.5, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.reason}</td>
                <td>
                  {d.status === 'pending'  && <Chip tone="warn" dot>待审批</Chip>}
                  {d.status === 'executed' && <Chip tone="success">已执行</Chip>}
                  {d.status === 'rejected' && <Chip>已拒绝</Chip>}
                  {d.status === 'failed'   && <Chip tone="danger">失败</Chip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

TL.Ads = Ads;
window.Ads = Ads;
