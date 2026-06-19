// 潮线 Tideline · 结算中心 — 佣金 / 提现

const Finance = function Finance() {
  const [tab, setTab] = React.useState('overview');
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">结算中心</h1>
            <p className="page-sub">应结佣金 · 月结 / 双周结 · 财务对账</p>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="download" size={13} /> 对账单</button>
            <button className="btn primary"><Icon name="wallet" size={13} /> 申请提现</button>
          </div>
        </div>

        <div className="g4 mt-sm" style={{ marginBottom: 20 }}>
          <BigStat label="账户余额" value="¥ 28.4 万" sub="可立即提现" accent />
          <BigStat label="本月预估收入" value="¥ 42.6 万" sub="待结算 5 个品牌" />
          <BigStat label="本月已结算" value="¥ 16.2 万" sub="到账 3 笔" />
          <BigStat label="待对账" value="¥ 8.4 万" sub="3 笔需确认" warn />
        </div>

        <div className="tabs">
          <div className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>结算概览</div>
          <div className={`tab ${tab === 'bills' ? 'active' : ''}`} onClick={() => setTab('bills')}>账单明细</div>
          <div className={`tab ${tab === 'withdraw' ? 'active' : ''}`} onClick={() => setTab('withdraw')}>提现记录</div>
          <div className={`tab ${tab === 'invoice' ? 'active' : ''}`} onClick={() => setTab('invoice')}>开票</div>
        </div>

        {tab === 'overview' && <FinOverview />}
        {tab === 'bills' && <Bills />}
        {tab === 'withdraw' && <Withdraws />}
        {tab === 'invoice' && <Invoices />}
      </div>
    </div>
  );
};

function BigStat({ label, value, sub, accent, warn }) {
  return (
    <div className="stat" style={{
      background: accent ? 'linear-gradient(135deg, oklch(0.96 0.03 258), var(--bg-elevated))' : warn ? 'linear-gradient(135deg, oklch(0.97 0.03 70), var(--bg-elevated))' : 'var(--bg-elevated)',
      borderColor: accent ? 'var(--accent-border)' : warn ? 'oklch(0.85 0.07 70)' : 'var(--border)'
    }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: accent ? 'var(--accent)' : 'inherit' }}>{value}</div>
      <div className="stat-delta">{sub}</div>
    </div>
  );
}

function FinOverview() {
  const labels = ['1月','2月','3月','4月','5月'];
  return (
    <div className="g2">
      <div className="card">
        <div className="card-h"><h3>近 5 个月收入趋势</h3></div>
        <div className="card-b">
          <LineChart
            series={[
              { name: '入账', data: [182000, 218400, 246800, 312600, 384200] },
              { name: '应结', data: [212000, 248000, 286000, 348000, 426000] },
            ]}
            labels={labels}
            height={220}
            colors={['var(--c1)', 'var(--c3)']}
          />
          <div className="row tight" style={{ marginTop: 8 }}>
            <span className="chip"><span className="dot" style={{ background: 'var(--c1)' }} /> 已入账</span>
            <span className="chip"><span className="dot" style={{ background: 'var(--c3)' }} /> 应结金额</span>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h3>本月品牌结算进度</h3></div>
        <div className="card-b col" style={{ gap: 14 }}>
          {[
            { b: '云杉运动', total: 168000, paid: 84000, status: '部分到账' },
            { b: '青朴自然护肤', total: 92000, paid: 92000, status: '已结清' },
            { b: '林野鲜食', total: 68000, paid: 0, status: '账期内' },
            { b: '小鹿家居', total: 42000, paid: 0, status: '待对账' },
            { b: '北麓数码', total: 16000, paid: 16000, status: '已结清' },
          ].map((r, i) => {
            const pct = r.paid / r.total;
            return (
              <div key={i}>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{r.b}</span>
                  <span className="mono" style={{ fontSize: 12 }}>¥ {TL.fmtMoney(r.paid)} / {TL.fmtMoney(r.total)}</span>
                </div>
                <div className="row tight">
                  <div className="bar grow"><div style={{ width: `${pct*100}%`, background: pct === 1 ? 'var(--success)' : 'var(--accent)' }} /></div>
                  <Chip tone={pct === 1 ? 'success' : r.status === '待对账' ? 'warn' : 'default'}>{r.status}</Chip>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Bills() {
  const bills = [
    { id: 'B202605-001', period: '2026/05 上半月', brand: '青朴自然护肤', amount: 46200, comm: '18% + 2%', status: 'reconciled', date: '2026-05-08' },
    { id: 'B202605-002', period: '2026/05 上半月', brand: '林野鲜食',     amount: 38400, comm: '22%',      status: 'pending',    date: '2026-05-09' },
    { id: 'B202605-003', period: '2026/05 全月',   brand: '云杉运动',     amount: 84200, comm: '16% + 4%', status: 'reconciled', date: '2026-05-10' },
    { id: 'B202605-004', period: '2026/05 上半月', brand: '小鹿家居',     amount: 21600, comm: '25%',      status: 'dispute',    date: '2026-05-10' },
    { id: 'B202604-012', period: '2026/04 全月',   brand: '云杉运动',     amount: 92800, comm: '16% + 4%', status: 'paid',       date: '2026-04-30' },
    { id: 'B202604-011', period: '2026/04 全月',   brand: '青朴自然护肤', amount: 84600, comm: '18% + 2%', status: 'paid',       date: '2026-04-30' },
    { id: 'B202604-010', period: '2026/04 全月',   brand: '林野鲜食',     amount: 56800, comm: '22%',      status: 'paid',       date: '2026-04-30' },
    { id: 'B202604-009', period: '2026/04 全月',   brand: '北麓数码',     amount: 16400, comm: '12% + 3%', status: 'paid',       date: '2026-04-30' },
  ];
  const tones = { paid: 'success', reconciled: 'info', pending: 'warn', dispute: 'danger' };
  const labels = { paid: '已入账', reconciled: '已对账', pending: '待对账', dispute: '存疑' };
  return (
    <div className="card">
      <div className="card-h"><h3>账单明细</h3>
        <div className="actions row tight">
          <select className="select" style={{ width: 'auto' }}><option>近 3 个月</option></select>
          <select className="select" style={{ width: 'auto' }}><option>全部状态</option></select>
        </div>
      </div>
      <table className="tbl">
        <thead><tr><th>账单号</th><th>结算周期</th><th>品牌</th><th>佣金比例</th><th className="num">金额</th><th>状态</th><th>对账日</th><th></th></tr></thead>
        <tbody>
          {bills.map(b => (
            <tr key={b.id}>
              <td className="mono" style={{ fontSize: 11.5 }}>{b.id}</td>
              <td style={{ fontSize: 12 }}>{b.period}</td>
              <td>{b.brand}</td>
              <td className="mono" style={{ fontSize: 12 }}>{b.comm}</td>
              <td className="num mono" style={{ fontWeight: 600 }}>¥ {b.amount.toLocaleString()}</td>
              <td><Chip tone={tones[b.status]} dot>{labels[b.status]}</Chip></td>
              <td className="muted mono" style={{ fontSize: 11.5 }}>{b.date}</td>
              <td><button className="btn ghost icon sm"><Icon name="chevR" size={12} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Withdraws() {
  const ws = [
    { id: 'W-202605-3', date: '2026-05-08 14:32', amount: 84000, to: '兴业银行 6228 **** **** 8842', status: '已到账', when: '2 小时到账' },
    { id: 'W-202604-7', date: '2026-04-30 09:14', amount: 168000, to: '兴业银行 6228 **** **** 8842', status: '已到账', when: '即时到账' },
    { id: 'W-202604-4', date: '2026-04-15 11:28', amount: 92000, to: '支付宝 188****6248', status: '已到账', when: '即时到账' },
    { id: 'W-202603-9', date: '2026-03-30 16:08', amount: 142000, to: '兴业银行 6228 **** **** 8842', status: '已到账', when: '2 小时到账' },
  ];
  return (
    <div className="g2">
      <div className="card">
        <div className="card-h"><h3>账户余额</h3></div>
        <div className="card-b col" style={{ gap: 14 }}>
          <div>
            <div className="muted" style={{ fontSize: 11.5 }}>可提现余额</div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>¥ 284,200.00</div>
          </div>
          <div className="g2" style={{ gap: 12 }}>
            <div className="stat" style={{ padding: 10 }}>
              <div className="stat-label" style={{ fontSize: 11 }}>冻结中</div>
              <div className="stat-value" style={{ fontSize: 16 }}>¥ 0.00</div>
            </div>
            <div className="stat" style={{ padding: 10 }}>
              <div className="stat-label" style={{ fontSize: 11 }}>累计入账</div>
              <div className="stat-value" style={{ fontSize: 16 }}>¥ 4.86M</div>
            </div>
          </div>
          <div className="col tight">
            <div style={{ fontSize: 12, fontWeight: 600 }}>结算账户</div>
            <div style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
              <div className="row tight">
                <Icon name="wallet" size={14} className="muted" />
                <span>兴业银行 · 6228 **** **** 8842</span>
                <Chip tone="success" dot>默认</Chip>
              </div>
            </div>
            <div style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
              <div className="row tight">
                <Icon name="wallet" size={14} className="muted" />
                <span>支付宝 · 188****6248</span>
              </div>
            </div>
          </div>
          <button className="btn primary" style={{ justifyContent: 'center' }}><Icon name="wallet" size={13} /> 申请提现</button>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h3>提现记录</h3></div>
        <table className="tbl">
          <thead><tr><th>申请时间</th><th className="num">金额</th><th>到账账户</th><th>状态</th></tr></thead>
          <tbody>
            {ws.map(w => (
              <tr key={w.id}>
                <td className="mono" style={{ fontSize: 11.5 }}>{w.date}</td>
                <td className="num mono" style={{ fontWeight: 600 }}>¥ {w.amount.toLocaleString()}</td>
                <td style={{ fontSize: 12 }}>{w.to}</td>
                <td><div className="col tight"><Chip tone="success" dot>{w.status}</Chip><span className="muted" style={{ fontSize: 10.5 }}>{w.when}</span></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Invoices() {
  return (
    <div className="card">
      <div className="card-h"><h3>开票管理</h3><span className="chip">3 张待开票</span></div>
      <table className="tbl">
        <thead><tr><th>账单</th><th>抬头</th><th className="num">金额</th><th>类型</th><th>状态</th><th></th></tr></thead>
        <tbody>
          {[
            { id: 'B202604-011', title: '杭州青朴科技有限公司', amount: 84600, type: '增值税专票', s: '已开具' },
            { id: 'B202604-012', title: '云杉户外(浙江)有限公司', amount: 92800, type: '增值税专票', s: '邮寄中' },
            { id: 'B202604-010', title: '林野食品有限公司', amount: 56800, type: '增值税专票', s: '待开票' },
            { id: 'B202604-009', title: '北麓数码(深圳)有限公司', amount: 16400, type: '电子普票', s: '待开票' },
          ].map((r, i) => (
            <tr key={i}>
              <td className="mono" style={{ fontSize: 11.5 }}>{r.id}</td>
              <td>{r.title}</td>
              <td className="num mono" style={{ fontWeight: 600 }}>¥ {r.amount.toLocaleString()}</td>
              <td><Chip>{r.type}</Chip></td>
              <td><Chip tone={r.s === '已开具' ? 'success' : r.s === '邮寄中' ? 'info' : 'warn'} dot>{r.s}</Chip></td>
              <td><button className="btn sm">{r.s === '待开票' ? '开具发票' : '查看'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

TL.Finance = Finance;
window.Finance = Finance;
