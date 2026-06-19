// 潮线 Tideline · 千川投流管理

const Ads = function Ads() {
  const [tab, setTab] = React.useState('campaigns');
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">千川投流</h1>
            <p className="page-sub">14 个活跃计划 · 本周累计花费 ¥ 4.82 万 · 综合 ROI 3.02</p>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="refresh" size={13} /> 同步千川</button>
            <button className="btn"><Icon name="download" size={13} /> 导出</button>
            <button className="btn primary"><Icon name="plus" size={13} /> 新建计划</button>
          </div>
        </div>

        <div className="g4 mt-sm" style={{ marginBottom: 16 }}>
          <Stat3 label="本周花费" value="¥ 4.82 万" delta="+8.4%" sub="预算剩余 ¥ 1.2 万" />
          <Stat3 label="本周成交 GMV" value="¥ 14.6 万" delta="+18.4%" sub="vs 上周" />
          <Stat3 label="综合 ROI" value="3.02" delta="+0.34" sub="目标 2.8" tone="success" />
          <Stat3 label="单次转化成本" value="¥ 28.4" delta="-12%" sub="行业 ¥ 34" tone="success" />
        </div>

        <div className="tabs">
          <div className={`tab ${tab === 'campaigns' ? 'active' : ''}`} onClick={() => setTab('campaigns')}>投放计划</div>
          <div className={`tab ${tab === 'materials' ? 'active' : ''}`} onClick={() => setTab('materials')}>素材表现</div>
          <div className={`tab ${tab === 'crowds' ? 'active' : ''}`} onClick={() => setTab('crowds')}>人群包</div>
        </div>

        {tab === 'campaigns' && <Campaigns />}
        {tab === 'materials' && <AdMaterials />}
        {tab === 'crowds' && <Crowds />}
      </div>
    </div>
  );
};

function Stat3({ label, value, delta, sub, tone }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-delta ${delta && delta[0] !== '-' ? 'up' : delta ? 'down' : ''}`} style={{ color: tone === 'success' && delta && delta[0] === '-' ? 'var(--success)' : undefined }}>
        {delta && <Icon name={delta[0] === '-' ? 'arrowDown' : 'arrowUp'} size={10} />} {delta} {delta && sub ? '·' : ''} {sub}
      </div>
    </div>
  );
}

function Campaigns() {
  const camps = [
    { id: 'c01', name: '云杉防晒衣 · 短视频带货 5月场', acc: 'a4', goal: '短视频带货', budget: 8000, spent: 6420, gmv: 21240, roi: 3.31, ctr: 6.8, cvr: 4.2, status: 'on' },
    { id: 'c02', name: '青朴 · 母亲节直播间引流', acc: 'a1', goal: '直播间', budget: 6000, spent: 5180, gmv: 18620, roi: 3.59, ctr: 5.4, cvr: 3.8, status: 'on' },
    { id: 'c03', name: '林野山货 · 商品卡推广', acc: 'a2', goal: '商品卡', budget: 4000, spent: 3240, gmv: 8260, roi: 2.55, ctr: 4.2, cvr: 3.2, status: 'on' },
    { id: 'c04', name: '云杉 · 户外日专场 LIVE', acc: 'a4', goal: '直播间', budget: 12000, spent: 10840, gmv: 38420, roi: 3.54, ctr: 7.2, cvr: 4.6, status: 'on' },
    { id: 'c05', name: '小鹿真丝枕套 · 转粉计划', acc: 'a3', goal: '主页推广', budget: 3000, spent: 2120, gmv: 4680, roi: 2.21, ctr: 3.8, cvr: 2.4, status: 'paused' },
    { id: 'c06', name: '青朴 · 618 预热测试', acc: 'a1', goal: '短视频带货', budget: 5000, spent: 1240, gmv: 3640, roi: 2.94, ctr: 5.8, cvr: 3.4, status: 'on' },
    { id: 'c07', name: '北麓 N1 耳机 · 测评引流', acc: 'a5', goal: '短视频带货', budget: 2000, spent: 1820, gmv: 2840, roi: 1.56, ctr: 3.2, cvr: 1.8, status: 'low' },
  ];
  return (
    <div className="card">
      <div className="card-h">
        <h3>投放计划 · 14 个活跃</h3>
        <div className="actions row tight">
          <select className="select" style={{ width: 'auto' }}><option>全部账号</option></select>
          <select className="select" style={{ width: 'auto' }}><option>全部状态</option></select>
        </div>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>计划</th>
            <th>账号</th>
            <th>目标</th>
            <th className="num">预算 / 已花</th>
            <th className="num">GMV</th>
            <th className="num">ROI</th>
            <th className="num">点击率</th>
            <th className="num">转化率</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {camps.map(c => {
            const acc = TL.accountById(c.acc);
            const pct = c.spent / c.budget;
            return (
              <tr key={c.id}>
                <td><span style={{ fontWeight: 500 }}>{c.name}</span><div className="muted mono" style={{ fontSize: 11 }}>{c.id.toUpperCase()}</div></td>
                <td><div className="row tight"><span className={`av sm av-${acc.color}`}>{acc.name[0]}</span><span style={{ fontSize: 12 }}>{acc.name}</span></div></td>
                <td><Chip>{c.goal}</Chip></td>
                <td className="num">
                  <div className="mono" style={{ fontSize: 12 }}>¥ {c.spent.toLocaleString()} <span className="muted">/ {c.budget.toLocaleString()}</span></div>
                  <div className="bar" style={{ marginTop: 4 }}><div style={{ width: `${pct*100}%`, background: pct > 0.9 ? 'var(--warning)' : 'var(--accent)' }} /></div>
                </td>
                <td className="num mono">¥ {c.gmv.toLocaleString()}</td>
                <td className="num mono" style={{ fontWeight: 600, color: c.roi >= 2.8 ? 'var(--success)' : c.roi >= 2 ? 'var(--text)' : 'var(--danger)' }}>{c.roi.toFixed(2)}</td>
                <td className="num mono">{c.ctr.toFixed(1)}%</td>
                <td className="num mono">{c.cvr.toFixed(1)}%</td>
                <td>
                  {c.status === 'on' && <Chip tone="success" dot>投放中</Chip>}
                  {c.status === 'paused' && <Chip tone="default" dot>已暂停</Chip>}
                  {c.status === 'low' && <Chip tone="warn" dot>低效预警</Chip>}
                </td>
                <td className="row tight">
                  <button className="btn ghost icon sm"><Icon name={c.status === 'on' ? 'pause' : 'play'} size={11} /></button>
                  <button className="btn ghost icon sm"><Icon name="more" size={11} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdMaterials() {
  const mats = [
    { t: '云杉防晒衣 · 反差钩子 30s', acc: 'a4', vv: 184200, ctr: 7.8, cvr: 4.6, spent: 2420, gmv: 8420, roi: 3.48, score: 92 },
    { t: '青朴 · 成分溯源 25s',     acc: 'a1', vv: 142800, ctr: 6.4, cvr: 3.8, spent: 1820, gmv: 5680, roi: 3.12, score: 88 },
    { t: '云杉 · 户外日 LIVE 切片', acc: 'a4', vv: 96400,  ctr: 5.2, cvr: 4.2, spent: 1240, gmv: 4280, roi: 3.45, score: 86 },
    { t: '林野山货 · ASMR 拆袋',    acc: 'a2', vv: 64200,  ctr: 4.8, cvr: 3.2, spent: 820,  gmv: 2120, roi: 2.59, score: 78 },
    { t: '北麓 N1 · 盲测对比 45s', acc: 'a5', vv: 28400,  ctr: 3.2, cvr: 1.8, spent: 620,  gmv: 980,  roi: 1.58, score: 62 },
    { t: '小鹿真丝枕套 · 测评图文', acc: 'a3', vv: 18400,  ctr: 3.8, cvr: 2.4, spent: 420,  gmv: 920,  roi: 2.19, score: 68 },
  ];
  return (
    <div className="g3">
      {mats.map((m, i) => {
        const acc = TL.accountById(m.acc);
        return (
          <div key={i} className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              aspectRatio: '16/9',
              background: `linear-gradient(135deg, oklch(0.35 0.1 ${258 + i*30}), oklch(0.55 0.14 ${200 + i*30}))`,
              position: 'relative', display: 'grid', placeItems: 'center', color: 'white',
            }}>
              <Icon name="play" size={28} />
              <div style={{ position: 'absolute', top: 8, left: 10 }}>
                <Chip tone={m.roi >= 3 ? 'success' : m.roi >= 2 ? 'warn' : 'danger'} dot>ROI {m.roi.toFixed(2)}</Chip>
              </div>
              <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 11, opacity: 0.85, fontFamily: 'var(--font-mono)' }}>AI {m.score}</div>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }}>{m.t}</div>
              <div className="row tight" style={{ marginTop: 6 }}>
                <span className={`av sm av-${acc.color}`}>{acc.name[0]}</span>
                <span className="muted" style={{ fontSize: 11 }}>{acc.name}</span>
              </div>
              <div className="row" style={{ marginTop: 10, gap: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                <span><span className="mono">{TL.fmtCount(m.vv)}</span> 播放</span>
                <span>·</span>
                <span>点 <span className="mono" style={{ color: 'var(--text)' }}>{m.ctr.toFixed(1)}%</span></span>
                <span>·</span>
                <span>转 <span className="mono" style={{ color: 'var(--text)' }}>{m.cvr.toFixed(1)}%</span></span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Crowds() {
  const crowds = [
    { name: '都市白领·美妆复购', size: 124000, src: '历史购买', usage: 8, perf: 92 },
    { name: '户外徒步·男女', size: 286000, src: 'AI 扩展', usage: 12, perf: 88 },
    { name: '宝妈·家居重决策', size: 184000, src: '互动行为', usage: 6, perf: 76 },
    { name: '成分党·25-35女', size: 92000, src: 'LBS+互动', usage: 14, perf: 95 },
    { name: '3C 数码尝鲜', size: 64000, src: '历史搜索', usage: 4, perf: 68 },
  ];
  return (
    <div className="card">
      <div className="card-h"><h3>自定义人群包</h3><span className="chip">5 个 · 共 75 万人</span></div>
      <table className="tbl">
        <thead><tr><th>人群包</th><th className="num">规模</th><th>来源</th><th className="num">已用计划</th><th className="num">综合效果</th><th></th></tr></thead>
        <tbody>
          {crowds.map((c, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{c.name}</td>
              <td className="num mono">{TL.fmtCount(c.size)} 人</td>
              <td><Chip>{c.src}</Chip></td>
              <td className="num mono">{c.usage}</td>
              <td className="num">
                <div className="row tight" style={{ justifyContent: 'flex-end' }}>
                  <div className="bar" style={{ width: 70 }}>
                    <div style={{ width: `${c.perf}%`, background: c.perf >= 90 ? 'var(--success)' : 'var(--accent)' }} />
                  </div>
                  <span className="mono" style={{ width: 30 }}>{c.perf}</span>
                </div>
              </td>
              <td className="row tight">
                <button className="btn ghost sm">编辑</button>
                <button className="btn sm">用于新计划</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

TL.Ads = Ads;
window.Ads = Ads;
