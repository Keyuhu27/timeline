// 潮线 Tideline · 品牌详情页 — 单个本地推品牌/门店的当日数据分析

window.TL = window.TL || {};

const BrandDetail = function BrandDetail({ brandId, onBack }) {
  const { useState, useEffect, useCallback } = React;
  const [campaigns, setCampaigns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [showInternal, setShowInternal] = useState(false);

  const brand = TL.brandById ? TL.brandById(brandId) : (TL.brands || []).find(b => b.id === brandId);
  const account = (TL.accounts || []).find(a => a.brand === brandId);
  const title = TL.displayBrandName(brand, account);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/ads?brand=' + encodeURIComponent(brandId)).then(r => r.json()).catch(() => null),
      fetch('/api/logs').then(r => r.json()).catch(() => null),
    ]).then(([a, l]) => {
      setCampaigns(a?.data?.campaigns || []);
      setLogs(l?.data?.logs || []);
    }).finally(() => setLoading(false));
  }, [brandId]);

  useEffect(load, [load]);

  const toggle = async (c) => {
    setActing(c.id);
    const newStatus = TL._normStatus(c.status) === 'active' ? 'paused' : 'active';
    try {
      await fetch(`/api/ads?id=${c.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {}
    setActing(null);
    load();
  };

  const adjustBudget = async (c) => {
    const input = window.prompt(`调整「${TL.displayCampaignName(c)}」的日预算（当前 ¥${c.budget}）`, c.budget);
    if (!input) return;
    const budget = Number(input);
    if (!budget || budget <= 0) return;
    setActing(c.id);
    try {
      await fetch(`/api/ads?id=${c.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget }),
      });
    } catch {}
    setActing(null);
    load();
  };

  // 聚合当日概览
  const agg = campaigns.reduce((s, c) => {
    s.spent += c.spent || 0; s.leads += c.leads || 0;
    s.impressions += c.impressions || 0; s.clicks += c.clicks || 0;
    s.gmv += c.gmv || 0;
    s.roasSum += c.roas || 0; s.ctrSum += c.ctr || 0; s.n += 1;
    if (TL._normStatus(c.status) === 'active') s.active += 1;
    if (TL._normStatus(c.status) === 'paused') s.paused += 1;
    return s;
  }, { spent: 0, leads: 0, impressions: 0, clicks: 0, gmv: 0, roasSum: 0, ctrSum: 0, n: 0, active: 0, paused: 0 });
  const cpl = agg.leads > 0 ? (agg.spent / agg.leads) : 0;
  const ctrAvg = agg.n > 0 ? (agg.ctrSum / agg.n) : 0;
  const roasAvg = agg.n > 0 ? (agg.roasSum / agg.n) : 0;
  const lastSync = campaigns.reduce((m, c) => Math.max(m, c.lastSyncAt || 0), 0);

  const campIds = new Set(campaigns.map(c => c.id));
  const brandLogs = logs.filter(l => l.campaignId && campIds.has(l.campaignId));

  const hasData = campaigns.length > 0 && (agg.spent > 0 || agg.leads > 0 || agg.impressions > 0);

  const overview = [
    { label: '今日消耗', value: `¥ ${TL.fmtMoney(agg.spent)}` },
    { label: '展现',     value: TL.fmtCount(agg.impressions) },
    { label: '点击',     value: TL.fmtCount(agg.clicks) },
    { label: 'CTR',      value: `${(ctrAvg * 100).toFixed(1)}%` },
    { label: '线索数',   value: agg.leads },
    { label: '线索成本', value: cpl > 0 ? `¥ ${cpl.toFixed(1)}` : '—' },
    { label: 'GMV',      value: `¥ ${TL.fmtMoney(agg.gmv)}` },
    { label: 'ROAS',     value: roasAvg.toFixed(2) },
    { label: '活跃计划', value: agg.active },
    { label: '暂停计划', value: agg.paused },
  ];

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 8 }}><Icon name="chevL" size={12} /> 返回</button>
            <h1 className="page-title">{title}</h1>
            <div className="row tight" style={{ marginTop: 4 }}>
              <Chip>{brand?.cat || '本地推'}</Chip>
              <button className="btn ghost sm" onClick={() => setShowInternal(v => !v)}>
                <Icon name={showInternal ? 'chevD' : 'chevR'} size={11} /> 详情
              </button>
            </div>
            {showInternal && (
              <div className="muted mono" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>
                local_account_id: {account?.externalId || '—'}<br />
                内部账户ID: {account?.id || '—'} · 内部品牌ID: {brand?.id || '—'}<br />
                最近同步: {lastSync ? new Date(lastSync).toLocaleString('zh') : '尚未同步'}
              </div>
            )}
          </div>
          <div className="page-actions">
            <button className="btn sm" onClick={load} disabled={loading}><Icon name="refresh" size={12} /> 刷新数据</button>
          </div>
        </div>

        {loading ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>加载中…</div>
        ) : !hasData ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Icon name="inbox" size={22} />
            <div style={{ marginTop: 10, fontSize: 13 }}>今日暂无投放数据</div>
          </div>
        ) : (
          <>
            {/* 当日概览 */}
            <section style={{ marginBottom: 24 }}>
              <SectionTitle title="当日数据概览" />
              <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {overview.map((o, i) => (
                  <div className="stat" key={i}>
                    <div className="stat-label">{o.label}</div>
                    <div className="stat-value" style={{ fontSize: 20 }}>{o.value}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* 当日计划列表 */}
            <section style={{ marginBottom: 24 }}>
              <SectionTitle title="当日计划" sub={`${campaigns.length} 个项目`} />
              <div className="card">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>计划 / project_id</th><th className="num">预算</th><th className="num">今日花费</th>
                      <th className="num">线索</th><th className="num">CPL</th><th className="num">ROAS</th>
                      <th>状态</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => {
                      const leads = c.leads || 0;
                      const ccpl = leads > 0 ? (c.spent / leads).toFixed(1) : '—';
                      const norm = TL._normStatus(c.status);
                      return (
                        <tr key={c.id}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{TL.displayCampaignName(c)}</div>
                            <div className="muted mono" style={{ fontSize: 10.5 }}>{c.externalId || '—'}</div>
                          </td>
                          <td className="num">¥ {TL.fmtMoney(c.budget || 0)}</td>
                          <td className="num">¥ {TL.fmtMoney(c.spent || 0)}</td>
                          <td className="num">{leads}</td>
                          <td className="num">{ccpl === '—' ? '—' : `¥ ${ccpl}`}</td>
                          <td className="num">{(c.roas || 0).toFixed(2)}</td>
                          <td><Chip tone={TL.statusTone(c.status)}>{TL.statusLabel(c.status)}</Chip></td>
                          <td>
                            <div className="row tight">
                              <button className="btn ghost icon sm" disabled={acting === c.id} title={norm === 'active' ? '暂停' : '恢复'} onClick={() => toggle(c)}>
                                <Icon name={norm === 'active' ? 'pause' : 'play'} size={12} />
                              </button>
                              <button className="btn ghost icon sm" disabled={acting === c.id} title="调预算" onClick={() => adjustBudget(c)}>
                                <Icon name="wallet" size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 规则触发记录 */}
            <section style={{ marginBottom: 24 }}>
              <SectionTitle title="规则触发记录" sub={`${brandLogs.length} 条`} />
              <div className="card">
                {brandLogs.length === 0 ? (
                  <div className="card-b muted" style={{ fontSize: 12.5 }}>该品牌暂无规则触发记录。</div>
                ) : (
                  <div className="card-b" style={{ padding: 0 }}>
                    {brandLogs.slice(0, 10).map((l, i) => (
                      <div key={l.id} className="row" style={{ padding: '10px 16px', borderBottom: i < Math.min(brandLogs.length, 10) - 1 ? '1px solid var(--divider)' : 'none' }}>
                        <div style={{ fontSize: 12.5, flex: 1 }}>
                          {l.ruleName && <b style={{ fontWeight: 500 }}>{l.ruleName}</b>}{' '}
                          <span className="muted">· {l.action}</span>
                        </div>
                        <Chip tone={l.success ? 'success' : 'danger'}>{l.success ? '成功' : '失败'}</Chip>
                        <span className="muted mono" style={{ fontSize: 11, marginLeft: 8 }}>{new Date(l.createdAt).toLocaleString('zh')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

TL.BrandDetail = BrandDetail;
window.BrandDetail = BrandDetail;
