// 潮线 Tideline · Live realtime dashboard drawer (subflow from Data > Lives)

const LiveDrawer = function LiveDrawer({ live, onClose }) {
  if (!live) return null;
  const acc = TL.accountById(live.acc);
  const liveData = Array.from({ length: 24 }, (_, i) => 100 + Math.sin(i / 2) * 40 + i * 8 + Math.random() * 20);
  const isLive = live.status === 'ongoing';
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <div className="drawer" style={{ width: 760 }}>
        <div className="drawer-h">
          <Icon name="live" size={16} style={{ color: isLive ? 'var(--danger)' : 'var(--text-muted)' }} />
          <div className="grow">
            <div className="row tight">
              {isLive ? <Chip tone="danger" dot>实时直播中</Chip> : <Chip>已结束</Chip>}
              <span className="muted mono" style={{ fontSize: 11 }}>{live.date}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{live.title}</div>
          </div>
          <button className="btn ghost icon" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="drawer-b">
          <div className="row tight" style={{ marginBottom: 14 }}>
            <span className={`av sm av-${acc.color}`}>{acc.name[0]}</span>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>{acc.name}</span>
            <span className="muted" style={{ fontSize: 11.5, marginLeft: 8 }}>主播 苏念 · 阿夏</span>
          </div>

          <div className="g4">
            <Tile2 label="GMV" value={`¥ ${TL.fmtMoney(live.gmv)}`} tone="success" sub={isLive ? '+ ¥ 4.2 万 / 小时' : '本场最终'} />
            <Tile2 label="观看人次" value={TL.fmtCount(live.viewers)} sub={`峰值 ${live.peak.toLocaleString()}`} />
            <Tile2 label="支付转化" value={`${(live.payRate*100).toFixed(1)}%`} sub="行业均值 2.4%" tone="success" />
            <Tile2 label="客单价" value={`¥ ${live.atv}`} sub={`退款率 ${(live.returns*100).toFixed(1)}%`} />
          </div>

          <div className="card mt-md">
            <div className="card-h"><h3>实时数据 · 每 5 分钟</h3>{isLive && <Chip tone="danger" dot>LIVE</Chip>}</div>
            <div className="card-b">
              <LineChart
                series={[
                  { name: 'GMV (元)', data: liveData.map(v => Math.round(v * 120)) },
                  { name: '在线人数', data: liveData.map((v, i) => Math.round(v * 8 + i * 4)) },
                ]}
                labels={Array.from({length: 24}, (_, i) => `${19 + Math.floor(i/4)}:${(i%4)*15 || '00'}`)}
                height={180}
              />
              <div className="row tight" style={{ marginTop: 4 }}>
                <span className="chip"><span className="dot" style={{ background: 'var(--c1)' }} /> GMV</span>
                <span className="chip"><span className="dot" style={{ background: 'var(--c2)' }} /> 在线人数</span>
              </div>
            </div>
          </div>

          <div className="g2 mt-md">
            <div className="card">
              <div className="card-h"><h3>讲解商品 · TOP</h3></div>
              <table className="tbl">
                <thead><tr><th>商品</th><th className="num">讲解时长</th><th className="num">GMV</th><th className="num">转化</th></tr></thead>
                <tbody>
                  {[
                    { t: '云杉 · 凉感防晒衣 男女款', d: '38 分钟', g: 124200, c: 4.8 },
                    { t: '云杉 · 速干T恤(3件装)', d: '24 分钟', g: 68400, c: 3.6 },
                    { t: '云杉 · 折叠遮阳帽', d: '12 分钟', g: 28600, c: 2.4 },
                    { t: '云杉 · 户外水壶 600ml', d: '8 分钟', g: 14200, c: 1.8 },
                  ].map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>{p.t}</td>
                      <td className="num mono">{p.d}</td>
                      <td className="num mono">¥ {TL.fmtMoney(p.g)}</td>
                      <td className="num mono">{p.c}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="card-h"><h3>流量结构</h3></div>
              <div className="card-b col" style={{ gap: 8 }}>
                {[
                  { k: '推荐流量', v: 58.4, c: 'var(--c1)' },
                  { k: '关注流量', v: 22.6, c: 'var(--c2)' },
                  { k: '千川投流', v: 12.4, c: 'var(--c4)' },
                  { k: '搜索流量', v: 4.8, c: 'var(--c3)' },
                  { k: '其他', v: 1.8, c: 'var(--c5)' },
                ].map(r => (
                  <div key={r.k} className="row" style={{ fontSize: 12.5 }}>
                    <span style={{ width: 76 }}>{r.k}</span>
                    <div className="bar grow"><div style={{ width: `${r.v}%`, background: r.c }} /></div>
                    <span className="mono" style={{ width: 50, textAlign: 'right' }}>{r.v}%</span>
                  </div>
                ))}
                <div className="divider" />
                <div className="row between" style={{ fontSize: 12 }}>
                  <span className="muted">本场投流花费</span>
                  <span className="mono" style={{ fontWeight: 600 }}>¥ 1.24 万 · ROI 3.84</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="drawer-f">
          <button className="btn ghost"><Icon name="share" size={13} /> 分享报告</button>
          <button className="btn" style={{ marginLeft: 'auto' }}>导出 PDF</button>
          <button className="btn primary">实时大屏全屏</button>
        </div>
      </div>
    </>
  );
};

function Tile2({ label, value, sub, tone }) {
  return (
    <div className="stat" style={{ padding: 12 }}>
      <div className="stat-label" style={{ fontSize: 11 }}>{label}</div>
      <div className="stat-value" style={{ fontSize: 18, color: tone === 'success' ? 'var(--success)' : 'inherit' }}>{value}</div>
      {sub && <div className="stat-delta" style={{ fontSize: 10.5 }}>{sub}</div>}
    </div>
  );
}

TL.LiveDrawer = LiveDrawer;
window.LiveDrawer = LiveDrawer;
