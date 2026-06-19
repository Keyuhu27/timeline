// 潮线 Tideline · 独立直播实时大屏

const LiveScreen = function LiveScreen() {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 4000);
    return () => clearInterval(i);
  }, []);
  // simulated rising data
  const series = React.useMemo(() => Array.from({ length: 24 }, (_, i) =>
    1200 + Math.sin(i/2 + tick*0.3) * 800 + i*180 + Math.random()*200
  ), [tick]);
  const onlineSeries = React.useMemo(() => Array.from({ length: 24 }, (_, i) =>
    1800 + Math.sin(i/3 + tick*0.4) * 400 + i*60 + Math.random()*120
  ), [tick]);

  return (
    <div className="page" style={{ background: 'oklch(0.12 0.02 258)', color: '#fff' }}>
      <div style={{ padding: '20px 24px', maxWidth: 1600, margin: '0 auto' }}>
        {/* Header */}
        <div className="row" style={{ marginBottom: 20 }}>
          <div className="row tight">
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent), oklch(0.7 0.14 200))', display: 'grid', placeItems: 'center', color: 'white', fontWeight: 700 }}>潮</div>
            <div className="col tight">
              <div style={{ fontSize: 11, opacity: 0.6, fontFamily: 'var(--font-mono)' }}>TIDELINE · LIVE COCKPIT</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>直播实时大屏</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div className="row tight" style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: 999 }}>
            <span className="dot live" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>LIVE · 4h 16m</span>
            <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8, fontFamily: 'var(--font-mono)' }}>2026-05-12 23:46:{String(28 + tick % 60).padStart(2,'0')}</span>
          </div>
          <div className="row tight" style={{ marginLeft: 12 }}>
            <button style={dkBtn}><Icon name="settings" size={13} /></button>
            <button style={{ ...dkBtn, background: 'var(--danger)', color: 'white', borderColor: 'transparent' }}><Icon name="x" size={13} /> 结束直播</button>
          </div>
        </div>

        {/* Title row */}
        <div className="row" style={{ marginBottom: 16 }}>
          <div className="col tight">
            <div className="row tight">
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'oklch(0.4 0.1 25)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>云</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>云杉运动 OUTDOOR · 夏日防晒衣场专场</div>
                <div style={{ fontSize: 11, opacity: 0.6, fontFamily: 'var(--font-mono)' }}>主播 苏念 + 阿夏 · 切片官 周一航</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div className="row tight">
            {['GMV 目标 ¥40万','直播间转化 4%','在线峰值 7,000'].map((t,i) => (
              <span key={i} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, opacity: 0.85 }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Hero row */}
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 380px', gap: 16, marginBottom: 16 }}>
          {/* GMV big tile */}
          <div style={tileBig}>
            <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: '0.04em' }}>实时 GMV</div>
            <div style={{ fontSize: 56, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.04em', marginTop: 6, lineHeight: 1 }}>
              <span style={{ fontSize: 24, opacity: 0.7, fontWeight: 500 }}>¥</span>
              <span> {(328400 + tick * 380).toLocaleString()}</span>
            </div>
            <div className="row" style={{ marginTop: 8, fontSize: 12 }}>
              <span style={{ color: 'oklch(0.78 0.16 152)' }}>↑ ¥ 4.2 万 / 小时</span>
              <span style={{ marginLeft: 'auto', opacity: 0.6 }}>目标完成 82%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '82%', background: 'linear-gradient(90deg, var(--accent), oklch(0.78 0.16 152))', borderRadius: 999 }} />
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="row" style={{ marginBottom: 10 }}>
                {[
                  { k: '订单数', v: '1,842' },
                  { k: '退款率', v: '4.6%' },
                  { k: '客单价', v: '¥ 198' },
                ].map(s => (
                  <div key={s.k} style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>{s.k}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: 2 }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GMV/online chart */}
          <div style={tile}>
            <div className="row between">
              <div style={{ fontSize: 12, opacity: 0.7 }}>GMV / 在线人数走势</div>
              <div className="row tight">
                <span style={chip}>● GMV</span>
                <span style={{ ...chip, background: 'oklch(0.45 0.14 200 / 0.2)' }}>● 在线</span>
              </div>
            </div>
            <DkLineChart series={[
              { name: 'GMV', data: series, color: 'oklch(0.78 0.18 152)' },
              { name: '在线', data: onlineSeries, color: 'oklch(0.75 0.14 200)' },
            ]} height={210} />
          </div>

          {/* Online tile */}
          <div style={tile}>
            <div style={{ fontSize: 11, opacity: 0.6 }}>当前在线</div>
            <div style={{ fontSize: 44, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', marginTop: 4 }}>
              {(4126 + (tick % 80) - 40).toLocaleString()}
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>峰值 6,820 · 已离开人次 8.4万</div>
            <div style={{ marginTop: 18 }}>
              <div className="row between" style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
                <span>流量来源</span><span>本场累计</span>
              </div>
              {[
                { k: '推荐', v: 58.4, c: 'oklch(0.7 0.14 258)' },
                { k: '关注', v: 22.6, c: 'oklch(0.72 0.13 200)' },
                { k: '千川', v: 12.4, c: 'oklch(0.72 0.14 70)' },
                { k: '搜索', v: 4.8, c: 'oklch(0.7 0.13 152)' },
                { k: '其他', v: 1.8, c: 'oklch(0.65 0.14 320)' },
              ].map(s => (
                <div key={s.k} className="row" style={{ fontSize: 11, padding: '3px 0' }}>
                  <span style={{ width: 40, opacity: 0.7 }}>{s.k}</span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.v}%`, background: s.c, borderRadius: 999 }} />
                  </div>
                  <span style={{ width: 40, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{s.v}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 380px', gap: 16 }}>
          {/* Products table */}
          <div style={tile}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>讲解商品 · TOP 6</div>
              <span style={{ ...chip, background: 'oklch(0.6 0.18 25 / 0.2)', color: 'oklch(0.85 0.12 25)' }}>当前讲解 → 凉感防晒衣 男L</span>
            </div>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px' }}>商品</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right' }}>讲解</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right' }}>订单</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right' }}>GMV</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right' }}>转化</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { t: '云杉 · 凉感防晒衣 男L', d: '38分', o: 642, g: 124200, c: 4.8, hot: true },
                  { t: '云杉 · 速干T恤(3件)', d: '24分', o: 384, g: 68400, c: 3.6 },
                  { t: '云杉 · 折叠遮阳帽', d: '12分', o: 226, g: 28600, c: 2.4 },
                  { t: '云杉 · 户外水壶 600ml', d: '8分', o: 142, g: 14200, c: 1.8 },
                  { t: '云杉 · 速干裤 男', d: '14分', o: 168, g: 32400, c: 2.6 },
                  { t: '云杉 · 防晒衣 女M', d: '22分', o: 218, g: 42600, c: 3.4 },
                ].map((p, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '8px' }}>
                      <div className="row tight">
                        <div style={{ width: 24, height: 24, borderRadius: 4, background: `oklch(0.5 0.1 ${i*30+200})` }} />
                        <span>{p.t}</span>
                        {p.hot && <span style={{ ...chip, background: 'oklch(0.6 0.18 25 / 0.2)', color: 'oklch(0.85 0.12 25)', fontSize: 9, padding: '0 6px' }}>讲解中</span>}
                      </div>
                    </td>
                    <td style={{ padding: 8, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{p.d}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{p.o}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>¥ {TL.fmtMoney(p.g)}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{p.c}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Conversion funnel */}
          <div style={tile}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>本场转化漏斗</div>
            {[
              { k: '进入直播间',   v: 84200, p: 100, c: 'oklch(0.65 0.14 258)' },
              { k: '观看 > 60s',  v: 38400, p: 45.6, c: 'oklch(0.68 0.14 230)' },
              { k: '点击商品',    v: 12420, p: 14.8, c: 'oklch(0.7 0.14 200)' },
              { k: '加入购物车',  v: 6280, p: 7.4, c: 'oklch(0.72 0.13 170)' },
              { k: '完成支付',    v: 1842, p: 2.2, c: 'oklch(0.74 0.16 152)' },
            ].map((s, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div className="row between" style={{ fontSize: 11, marginBottom: 4 }}>
                  <span style={{ opacity: 0.8 }}>{s.k}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{s.v.toLocaleString()} <span style={{ opacity: 0.5 }}>· {s.p}%</span></span>
                </div>
                <div style={{ height: 18, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${s.p}%`, height: '100%',
                    background: `linear-gradient(90deg, ${s.c}, ${s.c}80)`,
                    borderRadius: 4,
                  }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: 10, background: 'oklch(0.6 0.18 152 / 0.1)', borderRadius: 6, border: '1px solid oklch(0.6 0.18 152 / 0.3)' }}>
              <div style={{ fontSize: 11, opacity: 0.75 }}>AI 建议</div>
              <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>"观看 → 点击" 转化偏低（应 18-20%），建议主播在 15 分钟内重复一次"今晚 19:30 起，限时秒杀价 ¥198"。</div>
            </div>
          </div>

          {/* Comments stream */}
          <div style={tile}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>评论流 / 关键词</div>
              <span style={chip}>• 实时</span>
            </div>
            <div className="col tight" style={{ marginBottom: 12, flexWrap: 'wrap', flexDirection: 'row', display: 'flex', gap: 6 }}>
              {[
                { k: '便宜', n: 248, t: 'positive' },
                { k: '能洗吗', n: 184, t: 'question' },
                { k: '尺码', n: 142, t: 'question' },
                { k: '凉快', n: 96, t: 'positive' },
                { k: '正品', n: 82, t: 'question' },
                { k: '老粉了', n: 68, t: 'positive' },
              ].map(t => (
                <span key={t.k} style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: t.t === 'positive' ? 'oklch(0.6 0.18 152 / 0.15)' : 'oklch(0.7 0.14 70 / 0.15)',
                  color: t.t === 'positive' ? 'oklch(0.85 0.14 152)' : 'oklch(0.85 0.14 70)'
                }}>{t.k} ·{t.n}</span>
              ))}
            </div>
            <div className="col tight" style={{ maxHeight: 280, overflow: 'hidden' }}>
              {[
                { u: '小满**', c: '尺码问下，168/55 选 L 还是 M？' },
                { u: '夏天**', c: '这个看着真凉快，老板冲！' },
                { u: '老李**', c: '能洗吗会缩水吗' },
                { u: '阿****', c: '上链接上链接！' },
                { u: '糯****', c: '比上次直播便宜了 20 吧' },
                { u: '宝****', c: '主播好看' },
                { u: '飞**', c: '正品保证吗？' },
                { u: '林娜**', c: '我买过了，男的女的都能穿，确实凉快' },
              ].map((c, i) => (
                <div key={i+tick} className="row tight" style={{
                  padding: '6px 8px', borderRadius: 4,
                  background: i === 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
                  fontSize: 11.5,
                  opacity: 1 - i*0.08,
                  animation: i === 0 ? 'fadeInUp .3s ease' : undefined,
                }}>
                  <span style={{ opacity: 0.6, width: 60 }}>{c.u}</span>
                  <span>{c.c}</span>
                </div>
              ))}
            </div>
            <style>{'@keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'}</style>
          </div>
        </div>
      </div>
    </div>
  );
};

const tile = {
  background: 'oklch(0.18 0.02 258)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 10,
  padding: 16,
};
const tileBig = {
  ...tile,
  background: 'linear-gradient(160deg, oklch(0.22 0.05 258), oklch(0.16 0.03 258))',
};
const chip = {
  fontSize: 10.5,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.7)',
};
const dkBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 10px', borderRadius: 6,
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.85)',
  border: '1px solid rgba(255,255,255,0.08)',
  fontSize: 12,
  cursor: 'pointer',
};

// Dark-theme line chart variant
function DkLineChart({ series, height = 220 }) {
  const all = series.flatMap(s => s.data);
  const max = Math.max(...all) * 1.08;
  const min = Math.min(...all) * 0.92;
  const range = max - min || 1;
  const W = 720, padL = 8, padR = 12, padT = 8, padB = 24;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const n = series[0].data.length;
  const stepX = innerW / (n - 1);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`} style={{ display: 'block', marginTop: 12 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1={padL} x2={W - padR} y1={padT + innerH * (1 - p)} y2={padT + innerH * (1 - p)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {series.map((s, si) => {
        const pts = s.data.map((d, i) => [padL + i * stepX, padT + innerH - ((d - min) / range) * innerH]);
        const line = pts.map(p => p.join(',')).join(' ');
        const area = `${line} ${pts[pts.length-1][0]},${padT+innerH} ${pts[0][0]},${padT+innerH}`;
        return (
          <g key={si}>
            <polygon points={area} fill={s.color} opacity="0.12" />
            <polyline points={line} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

TL.LiveScreen = LiveScreen;
window.LiveScreen = LiveScreen;
