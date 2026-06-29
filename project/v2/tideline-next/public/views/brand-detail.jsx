// 潮线 Tideline · 品牌详情页 — 单个本地推品牌/门店的当日数据分析

window.TL = window.TL || {};

const BrandDetail = function BrandDetail({ brandId, onBack }) {
  const { useState, useEffect, useCallback } = React;
  const [campaigns, setCampaigns] = useState([]);
  const [statQueryReport, setStatQueryReport] = useState(null);
  const [accountReport, setAccountReport] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [showInternal, setShowInternal] = useState(false);
  // 投流诊断（独立数据源，单品牌只读，不触发任何同步）
  const [diag, setDiag] = useState(null);
  const [diagLoading, setDiagLoading] = useState(true);

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
      setStatQueryReport(a?.data?.statQueryReport || null);
      setAccountReport(a?.data?.accountReport || null);
      setLogs(l?.data?.logs || []);
    }).finally(() => setLoading(false));
  }, [brandId]);

  useEffect(load, [load]);

  // 投流诊断：单品牌 GET，date 缺省=后端今天（北京时）。不影响 load() / 同步 / 日报。
  useEffect(() => {
    setDiagLoading(true);
    fetch('/api/ad-diagnosis?brand=' + encodeURIComponent(brandId))
      .then(r => r.json()).catch(() => null)
      .then(d => setDiag(d?.data || null))
      .finally(() => setDiagLoading(false));
  }, [brandId]);

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

  // 有项目、或有后台全域 statQuery 报表、或有账户报表消耗，都算有数据。
  // 天鸿这类「纯本地推账户」没有 project 映射，但有 statQueryReport（全域消耗），不能误判为空态。
  const hasData = campaigns.length > 0
    || !!statQueryReport
    || (accountReport && accountReport.spent > 0);

  // 今日消耗数据来源优先级：
  //   1. statQuery_pc_home_roi2（后台首页全域口径，与巨量后台数字一致）
  //   2. project_report_aggregated（开放平台项目报表聚合，标准投放有效）
  //   3. account_report（开放平台账户报表，实测全域账户返回 0，仅备用）
  const sq = statQueryReport;
  const ar = (!sq && accountReport && accountReport.spent > 0) ? accountReport : null;
  const dataSource = sq ? 'statQuery_pc_home_roi2'
    : ar ? 'account_report'
    : campaigns.length ? 'project_report_aggregated'
    : null;
  const dataSourceLabel = {
    statQuery_pc_home_roi2:     '巨量后台全域投放 statQuery',
    account_report:             '开放平台账户报表（account_report）',
    project_report_aggregated:  '项目报表聚合（project_report_aggregated）',
  }[dataSource] || null;

  // 全域投放数据未同步：cookie 未配置或 statQuery 调用失败
  const noStatQuery = !loading && !statQueryReport;

  const overview = sq ? [
    { label: '今日消耗',       value: `¥ ${TL.fmtMoney(sq.spent)}` },
    { label: '直播全域消耗',   value: `¥ ${TL.fmtMoney(sq.liveSpent)}` },
    { label: '短视频全域消耗', value: `¥ ${TL.fmtMoney(sq.videoSpent)}` },
    { label: '全域成交金额',   value: `¥ ${TL.fmtMoney(sq.gmv)}` },
    { label: '全域支付ROI',    value: sq.roi > 0 ? sq.roi.toFixed(2) : '—' },
    { label: '全域成交订单',   value: sq.orders > 0 ? sq.orders : '—' },
    { label: '订单成本',       value: sq.orderCost > 0 ? `¥ ${sq.orderCost.toFixed(1)}` : '—' },
    { label: '直播成交金额',   value: `¥ ${TL.fmtMoney(sq.liveGmv)}` },
    { label: '直播全域ROI',    value: sq.liveRoi > 0 ? sq.liveRoi.toFixed(2) : '—' },
    { label: '短视频成交金额', value: `¥ ${TL.fmtMoney(sq.videoGmv)}` },
    { label: '活跃计划',       value: agg.active },
    { label: '暂停计划',       value: agg.paused },
  ] : ar ? [
    { label: '今日消耗',     value: `¥ ${TL.fmtMoney(ar.spent)}` },
    { label: '全域成交金额', value: `¥ ${TL.fmtMoney(ar.gmv)}` },
    { label: '全域成交订单', value: ar.orders },
    { label: '全域支付ROI',  value: (ar.roi || 0).toFixed(2) },
    { label: '成交订单成本', value: ar.orderCost > 0 ? `¥ ${ar.orderCost.toFixed(1)}` : '—' },
    { label: '展现',         value: TL.fmtCount(ar.impressions) },
    { label: '点击',         value: TL.fmtCount(ar.clicks) },
    { label: 'CTR',          value: `${((ar.ctr || 0) * 100).toFixed(1)}%` },
    { label: '活跃计划',     value: agg.active },
    { label: '暂停计划',     value: agg.paused },
  ] : [
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
            <div className="row tight">
              <button className="btn sm" onClick={() => TL.openDailyReport(brandId)}>
                <Icon name="fileText" size={12} /> 生成日报
              </button>
              <button className="btn sm" onClick={async () => {
                setLoading(true);
                try {
                  await fetch('/api/accounts/sync-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId }) });
                } catch {}
                load();
              }} disabled={loading}><Icon name="refresh" size={12} /> 同步状态</button>
            </div>
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
            {/* 全域投放数据未同步提示 */}
            {noStatQuery && (
              <div className="card" style={{ padding: '10px 16px', marginBottom: 16, color: 'var(--text-muted)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="info" size={13} />
                全域投放数据暂未同步，请检查后台 Cookie 配置或点击「同步状态」刷新。下方数据来自项目报表（非全域口径）。
              </div>
            )}

            {/* 当日概览 */}
            <section style={{ marginBottom: 24 }}>
              <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <SectionTitle title="当日数据概览" />
                {dataSourceLabel && (
                  <Chip tone={dataSource === 'statQuery_pc_home_roi2' ? 'success' : dataSource === 'account_report' ? '' : ''}>
                    数据来源：{dataSourceLabel}
                  </Chip>
                )}
              </div>
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

        {/* ── 投流诊断（独立模块，始终展示于品牌详情页下方）─────────────────── */}
        <AdDiagnosisSection diag={diag} loading={diagLoading} />
      </div>
    </div>
  );
};

// 投流诊断模块 —— 渲染 GET /api/ad-diagnosis 返回结构（规则版）
const moneyN = (v) => (v == null ? '—' : `¥ ${TL.fmtMoney(v)}`);
const roiN   = (v) => (v == null ? '—' : Number(v).toFixed(2));
const pctN   = (v) => (v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`);
const SOURCE_LABEL = { localAds: '本地推', businessCompass: '生意经', mixed: '混合' };
const LEVEL = {
  info: { tone: 'info',   label: '提示' },
  warn: { tone: 'warn',   label: '关注' },
  risk: { tone: 'danger', label: '风险' },
};
const PRIORITY = {
  high:   { tone: 'danger', label: '高优先' },
  medium: { tone: 'warn',   label: '中优先' },
  low:    { tone: '',       label: '低优先' },
};

const StatGrid = function StatGrid({ items, cols }) {
  return (
    <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
      {items.map((o, i) => (
        <div className="stat" key={i}>
          <div className="stat-label">{o.label}</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{o.value}</div>
        </div>
      ))}
    </div>
  );
};

const FindingCard = function FindingCard({ f, showPriority }) {
  const lv = LEVEL[f.level] || LEVEL.info;
  const pr = PRIORITY[f.priority] || PRIORITY.low;
  return (
    <div className="card-b" style={{ border: '1px solid var(--divider)', borderRadius: 8, padding: '10px 14px' }}>
      <div className="row tight" style={{ alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        <Chip tone={lv.tone}>{lv.label}</Chip>
        {showPriority && <Chip tone={pr.tone}>{pr.label}</Chip>}
        <Chip>{SOURCE_LABEL[f.source] || f.source}</Chip>
        <b style={{ fontWeight: 600, fontSize: 13 }}>{f.title}</b>
      </div>
      <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{f.detail}</div>
      {f.evidence && f.evidence.length > 0 && (
        <div className="row tight" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {f.evidence.map((e, i) => <Chip key={i}>{e}</Chip>)}
        </div>
      )}
      {f.action && (
        <div style={{ fontSize: 12.5, marginTop: 6, color: 'var(--accent)' }}>→ {f.action}</div>
      )}
    </div>
  );
};

const AdDiagnosisSection = function AdDiagnosisSection({ diag, loading }) {
  if (loading) {
    return (
      <section style={{ marginTop: 24, marginBottom: 24 }}>
        <SectionTitle title="投流诊断" />
        <div className="card card-b muted" style={{ fontSize: 12.5 }}>诊断加载中…</div>
      </section>
    );
  }
  if (!diag) {
    return (
      <section style={{ marginTop: 24, marginBottom: 24 }}>
        <SectionTitle title="投流诊断" />
        <div className="card card-b muted" style={{ fontSize: 12.5 }}>暂无诊断数据。</div>
      </section>
    );
  }

  const { meta, spend, liveDiagnosis, videoDiagnosis, findings } = diag;
  const lm = (liveDiagnosis && liveDiagnosis.metrics) || {};
  const vm = (videoDiagnosis && videoDiagnosis.metrics) || {};

  return (
    <section style={{ marginTop: 24, marginBottom: 24 }}>
      <SectionTitle title="投流诊断" sub={`${meta.brandName} · ${meta.date}`} />

      {/* 数据源状态 + 口径说明 */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="row tight" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
          <Chip tone={meta.hasLocalAds ? 'success' : ''}>本地推：{meta.hasLocalAds ? '已接入' : '该数据源暂未配置'}</Chip>
          <Chip tone={meta.hasBusiness ? 'success' : ''}>生意经：{meta.hasBusiness ? '已接入' : '该数据源暂未配置'}</Chip>
        </div>
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
          {meta.note || '投放消耗来自巨量本地推全域投放口径；GMV 拆分来自生意经经营口径，仅用于投流诊断参考。'}
        </div>
      </div>

      {/* 投放口径总览 */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>投放口径总览（本地推）</div>
        <StatGrid cols={5} items={[
          { label: '账户整体消耗',   value: moneyN(spend.accountTotalSpent) },
          { label: '标准投放消耗',   value: moneyN(spend.standardSpent) },
          { label: '全域总消耗',     value: moneyN(spend.roi2TotalSpent) },
          { label: '直播全域消耗',   value: moneyN(spend.liveSpent) },
          { label: '短视频全域消耗', value: moneyN(spend.videoSpent) },
        ]} />
      </div>

      {/* 直播诊断 */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>直播诊断</div>
        <StatGrid cols={5} items={[
          { label: '直播消耗',  value: moneyN(lm.liveSpent) },
          { label: '直播 GMV',  value: moneyN(lm.liveGmv) },
          { label: '直播 ROI',  value: roiN(lm.liveRoi) },
          { label: '自播 GMV',  value: moneyN(lm.ziboGmv) },
          { label: '达播 GMV',  value: moneyN(lm.daboGmv) },
        ]} />
        {(lm.daboShare != null || lm.ziboShare != null) && (
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            自播占比 {pctN(lm.ziboShare)} · 达播占比 {pctN(lm.daboShare)}
          </div>
        )}
        {liveDiagnosis && liveDiagnosis.findings && liveDiagnosis.findings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {liveDiagnosis.findings.map((f, i) => <FindingCard key={f.code || i} f={f} />)}
          </div>
        )}
      </div>

      {/* 短视频诊断 */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>短视频诊断</div>
        <StatGrid cols={3} items={[
          { label: '短视频消耗', value: moneyN(vm.videoSpent) },
          { label: '短视频 GMV', value: moneyN(vm.videoGmv) },
          { label: '短视频 ROI', value: roiN(vm.videoRoi) },
        ]} />
        {videoDiagnosis && videoDiagnosis.findings && videoDiagnosis.findings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {videoDiagnosis.findings.map((f, i) => <FindingCard key={f.code || i} f={f} />)}
          </div>
        )}
      </div>

      {/* 今日重点建议（按 priority 排序，高优先在前）*/}
      <div className="card" style={{ padding: 16 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>今日重点建议</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(findings || []).map((f, i) => <FindingCard key={f.code || i} f={f} showPriority />)}
        </div>
      </div>
    </section>
  );
};

TL.BrandDetail = BrandDetail;
window.BrandDetail = BrandDetail;
