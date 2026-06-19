// 潮线 Tideline · 选品中心 — 商品/样品库

const Products = function Products() {
  const [tab, setTab] = React.useState('catalog');
  const [picked, setPicked] = React.useState(null);
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">选品中心</h1>
            <p className="page-sub">在管商品 184 · 待选样 28 · 本周新上 12</p>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="upload" size={13} /> 导入商品</button>
            <button className="btn"><Icon name="link" size={13} /> 抖店关联</button>
            <button className="btn primary"><Icon name="plus" size={13} /> 新建商品</button>
          </div>
        </div>

        <div className="tabs">
          <div className={`tab ${tab === 'catalog' ? 'active' : ''}`} onClick={() => setTab('catalog')}>商品库</div>
          <div className={`tab ${tab === 'samples' ? 'active' : ''}`} onClick={() => setTab('samples')}>样品 / 寄样</div>
          <div className={`tab ${tab === 'commission' ? 'active' : ''}`} onClick={() => setTab('commission')}>佣金/合作</div>
        </div>

        {tab === 'catalog' && <Catalog onPick={setPicked} />}
        {tab === 'samples' && <Samples />}
        {tab === 'commission' && <Commission />}
      </div>

      {picked && <ProductDrawer product={picked} onClose={() => setPicked(null)} />}
    </div>
  );
};

const PRODUCTS = [
  { id: 'p1', name: '青朴山茶花修护精华液 30ml', brand: 'b1', cat: '美妆', price: 298, orig: 358, stock: 4280, sold30d: 1842, gmv30d: 548616, comm: 0.18, sample: 8, status: 'active', trend: 'up', score: 92 },
  { id: 'p2', name: '林野手剥松子 罐装 220g', brand: 'b2', cat: '食品', price: 68, orig: 89, stock: 6840, sold30d: 3284, gmv30d: 223312, comm: 0.22, sample: 6, status: 'active', trend: 'up', score: 84 },
  { id: 'p3', name: '小鹿真丝枕套 19姆米 单只', brand: 'b3', cat: '家居', price: 168, orig: 228, stock: 1240, sold30d: 642, gmv30d: 107856, comm: 0.25, sample: 4, status: 'active', trend: 'flat', score: 76 },
  { id: 'p4', name: '云杉凉感防晒衣 男女款', brand: 'b4', cat: '户外', price: 198, orig: 268, stock: 8420, sold30d: 4182, gmv30d: 828036, comm: 0.16, sample: 12, status: 'hot', trend: 'up', score: 95 },
  { id: 'p5', name: '云杉速干T恤 3 件装', brand: 'b4', cat: '户外', price: 128, orig: 168, stock: 5240, sold30d: 2148, gmv30d: 274944, comm: 0.18, sample: 6, status: 'active', trend: 'up', score: 88 },
  { id: 'p6', name: '北麓 N1 主动降噪耳机', brand: 'b5', cat: '3C', price: 399, orig: 499, stock: 820, sold30d: 218, gmv30d: 86982, comm: 0.12, sample: 2, status: 'active', trend: 'down', score: 64 },
  { id: 'p7', name: '青朴 · 母亲节限定礼盒', brand: 'b1', cat: '美妆', price: 588, orig: 698, stock: 320, sold30d: 184, gmv30d: 108192, comm: 0.20, sample: 4, status: 'new', trend: 'up', score: 86 },
  { id: 'p8', name: '林野山茶油 250ml', brand: 'b2', cat: '食品', price: 48, orig: 68, stock: 12480, sold30d: 1284, gmv30d: 61632, comm: 0.20, sample: 8, status: 'active', trend: 'flat', score: 72 },
];

function Catalog({ onPick }) {
  return (
    <>
      <div className="g4 mt-sm" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="stat-label">在管商品</div><div className="stat-value">184</div><div className="stat-delta up">+12 本周新增</div></div>
        <div className="stat"><div className="stat-label">30日 GMV</div><div className="stat-value">¥ 248.6 万</div><div className="stat-delta up">+18.4%</div></div>
        <div className="stat"><div className="stat-label">平均佣金</div><div className="stat-value">19.2%</div><div className="stat-delta">行业均值 16%</div></div>
        <div className="stat"><div className="stat-label">爆款 (周 GMV ≥ 10万)</div><div className="stat-value">8</div><div className="stat-delta up">+2 vs 上周</div></div>
      </div>

      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="row tight">
          <select className="select" style={{ width: 'auto' }}><option>全部品牌</option>{TL.brands.map(b => <option key={b.id}>{b.name}</option>)}</select>
          <select className="select" style={{ width: 'auto' }}><option>全部品类</option><option>美妆</option><option>食品</option><option>家居</option><option>户外</option><option>3C</option></select>
          <select className="select" style={{ width: 'auto' }}><option>全部状态</option><option>在售</option><option>新品</option><option>爆款</option></select>
        </div>
        <div className="row tight">
          <div className="tb-search" style={{ width: 200 }}>
            <Icon name="search" size={12} /><span style={{ fontSize: 12 }}>商品名 / SKU…</span>
          </div>
          <button className="btn ghost"><Icon name="sort" size={13} /></button>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>商品</th>
              <th>品牌 / 类目</th>
              <th className="num">售价</th>
              <th className="num">佣金</th>
              <th className="num">库存</th>
              <th className="num">30日销量</th>
              <th className="num">30日 GMV</th>
              <th className="num">AI 推荐</th>
              <th>状态</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map(p => {
              const b = TL.brandById(p.brand);
              return (
                <tr key={p.id} onClick={() => onPick(p)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="row tight">
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: `linear-gradient(135deg, oklch(0.92 0.05 ${258 + p.id.charCodeAt(1)*20}), oklch(0.86 0.08 ${200 + p.id.charCodeAt(1)*20}))`, flexShrink: 0 }} />
                      <div className="col tight">
                        <span style={{ fontWeight: 500, fontSize: 12.5 }}>{p.name}</span>
                        <span className="muted mono" style={{ fontSize: 10.5 }}>SKU · {p.id.toUpperCase()}-{p.cat}-{p.brand.toUpperCase()}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="col tight">
                      <span style={{ fontSize: 12 }}>{b?.name}</span>
                      <Chip>{p.cat}</Chip>
                    </div>
                  </td>
                  <td className="num">
                    <span className="mono" style={{ fontWeight: 600 }}>¥{p.price}</span>
                    <div className="muted mono" style={{ fontSize: 10.5, textDecoration: 'line-through' }}>¥{p.orig}</div>
                  </td>
                  <td className="num mono">{(p.comm*100).toFixed(0)}%</td>
                  <td className="num mono">{p.stock.toLocaleString()}</td>
                  <td className="num mono">{p.sold30d.toLocaleString()}</td>
                  <td className="num mono"><b>¥ {TL.fmtMoney(p.gmv30d)}</b></td>
                  <td className="num">
                    <div className="row tight" style={{ justifyContent: 'flex-end' }}>
                      <Icon name={p.trend === 'up' ? 'arrowUp' : p.trend === 'down' ? 'arrowDown' : 'arrowR'} size={11}
                            style={{ color: p.trend === 'up' ? 'var(--success)' : p.trend === 'down' ? 'var(--danger)' : 'var(--text-muted)' }} />
                      <span className="mono" style={{ width: 28 }}>{p.score}</span>
                    </div>
                  </td>
                  <td>
                    {p.status === 'hot' && <Chip tone="danger" dot>爆款</Chip>}
                    {p.status === 'new' && <Chip tone="accent" dot>新品</Chip>}
                    {p.status === 'active' && <Chip tone="success" dot>在售</Chip>}
                  </td>
                  <td><button className="btn ghost icon sm"><Icon name="chevR" size={12} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Samples() {
  const samples = [
    { id: 's1', who: '@小满日记', addr: '杭州市西湖区文三路 xx 号', items: '青朴山茶花精华 ×2', status: 'sent', when: '5/8 寄出', kuaidi: 'SF1284928374' },
    { id: 's2', who: '@山系阿K', addr: '北京市朝阳区望京 xx', items: '云杉防晒衣 男 L ×1', status: 'arrived', when: '5/9 已签收', kuaidi: 'SF8472831029' },
    { id: 's3', who: '@阿野的厨房', addr: '上海市浦东新区张江 xx', items: '林野手剥松子 ×3', status: 'pending', when: '审批中', kuaidi: '--' },
    { id: 's4', who: '@家有阿木', addr: '广州市天河区 xx', items: '小鹿真丝枕套 ×2', status: 'sent', when: '5/10 寄出', kuaidi: 'SF6428392019' },
    { id: 's5', who: '@极物Eva', addr: '深圳市南山区 xx', items: '北麓 N1 耳机 ×1', status: 'used', when: '5/3 已发视频', kuaidi: '--' },
  ];
  const tones = { sent: 'info', arrived: 'success', pending: 'warn', used: 'default' };
  const labels = { sent: '寄送中', arrived: '已签收', pending: '审批中', used: '已用于内容' };
  return (
    <>
      <div className="g4 mt-sm" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="stat-label">待审批</div><div className="stat-value">6</div></div>
        <div className="stat"><div className="stat-label">寄送中</div><div className="stat-value">14</div></div>
        <div className="stat"><div className="stat-label">已签收 (本月)</div><div className="stat-value">38</div></div>
        <div className="stat"><div className="stat-label">出片率</div><div className="stat-value">68%</div><div className="stat-delta up">+8pp</div></div>
      </div>
      <div className="card">
        <div className="card-h">
          <h3>寄样记录</h3>
          <div className="actions"><button className="btn sm"><Icon name="plus" size={12} /> 新寄样申请</button></div>
        </div>
        <table className="tbl">
          <thead><tr><th>达人</th><th>地址</th><th>样品</th><th>状态</th><th>动态</th><th className="num">快递单号</th><th></th></tr></thead>
          <tbody>
            {samples.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.who}</td>
                <td className="muted" style={{ fontSize: 12 }}>{s.addr}</td>
                <td style={{ fontSize: 12 }}>{s.items}</td>
                <td><Chip tone={tones[s.status]} dot>{labels[s.status]}</Chip></td>
                <td className="muted" style={{ fontSize: 11.5 }}>{s.when}</td>
                <td className="num mono" style={{ fontSize: 11.5 }}>{s.kuaidi}</td>
                <td><button className="btn ghost icon sm"><Icon name="more" size={12} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Commission() {
  return (
    <div className="g2">
      <div className="card">
        <div className="card-h"><h3>佣金阶梯</h3><span className="chip">按品牌</span></div>
        <table className="tbl">
          <thead><tr><th>品牌</th><th className="num">基础佣金</th><th className="num">爆款加成</th><th className="num">本月预估</th></tr></thead>
          <tbody>
            {TL.brands.map(b => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td className="num mono">{[18,22,25,16,12][TL.brands.indexOf(b)]}%</td>
                <td className="num mono">+ {[4,6,5,4,3][TL.brands.indexOf(b)]}%</td>
                <td className="num mono"><b>¥ {[42,28,12,68,8][TL.brands.indexOf(b)]}.{[6,4,2,4,2][TL.brands.indexOf(b)]} 万</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-h"><h3>合作条款 · 关键点</h3><span className="chip">5 个品牌</span></div>
        <div className="card-b col" style={{ gap: 10 }}>
          {[
            { b: '青朴自然护肤', items: ['18% 佣金 · 月结', '爆款单品 +4%', '独家直播专场 +3%', '退款率 ≤ 5%'] },
            { b: '云杉运动', items: ['16% 佣金 · 月结', '爆款单品 +4%', '618 / 双 11 期间 +2%', '退款率 ≤ 7%'] },
            { b: '林野鲜食', items: ['22% 佣金 · 双周结', '直播独家专场 +6%', '退款率 ≤ 6%'] },
          ].map((c, i) => (
            <div key={i} style={{ padding: 10, background: 'var(--bg-app)', borderRadius: 8, border: '1px solid var(--divider)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{c.b}</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                {c.items.map((it, j) => <li key={j} style={{ marginBottom: 2 }}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductDrawer({ product, onClose }) {
  const b = TL.brandById(product.brand);
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <div className="drawer" style={{ width: 580 }}>
        <div className="drawer-h">
          <Chip>{b?.name}</Chip>
          <Chip>{product.cat}</Chip>
          {product.status === 'hot' && <Chip tone="danger" dot>爆款</Chip>}
          <span className="muted mono" style={{ fontSize: 11, marginLeft: 'auto' }}>{product.id.toUpperCase()}-{product.cat}-{product.brand.toUpperCase()}</span>
          <button className="btn ghost icon" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="drawer-b">
          <div className="row" style={{ gap: 14 }}>
            <div style={{ width: 120, height: 120, borderRadius: 8, background: `linear-gradient(135deg, oklch(0.92 0.05 ${258 + product.id.charCodeAt(1)*20}), oklch(0.84 0.1 ${200 + product.id.charCodeAt(1)*20}))`, flexShrink: 0 }} />
            <div className="col tight grow">
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{product.name}</div>
              <div className="row tight" style={{ marginTop: 6 }}>
                <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>¥{product.price}</span>
                <span className="muted mono" style={{ textDecoration: 'line-through' }}>¥{product.orig}</span>
                <Chip tone="danger" dot>-{Math.round((1 - product.price / product.orig) * 100)}%</Chip>
              </div>
              <div className="row" style={{ marginTop: 8, gap: 16 }}>
                <div><span className="muted" style={{ fontSize: 11 }}>佣金</span> <span className="mono" style={{ fontWeight: 600 }}>{(product.comm*100).toFixed(0)}%</span></div>
                <div><span className="muted" style={{ fontSize: 11 }}>库存</span> <span className="mono">{product.stock.toLocaleString()}</span></div>
                <div><span className="muted" style={{ fontSize: 11 }}>样品</span> <span className="mono">{product.sample}</span></div>
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="g3" style={{ marginBottom: 14 }}>
            <div className="stat" style={{ padding: 10 }}>
              <div className="stat-label" style={{ fontSize: 10.5 }}>30日销量</div>
              <div className="stat-value" style={{ fontSize: 18 }}>{product.sold30d.toLocaleString()}</div>
            </div>
            <div className="stat" style={{ padding: 10 }}>
              <div className="stat-label" style={{ fontSize: 10.5 }}>30日 GMV</div>
              <div className="stat-value" style={{ fontSize: 18 }}>¥ {TL.fmtMoney(product.gmv30d)}</div>
            </div>
            <div className="stat" style={{ padding: 10 }}>
              <div className="stat-label" style={{ fontSize: 10.5 }}>AI 推荐分</div>
              <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>{product.score} / 100</div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>30 天 GMV 走势</h3></div>
            <div className="card-b">
              <Sparkline width={520} height={56} data={Array.from({length: 30}, (_,i) => 100 + Math.sin(i/3)*40 + i*5 + Math.random()*30)} />
            </div>
          </div>

          <div className="mt-md">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>核心卖点 · AI 已抽取</div>
            <div className="row tight" style={{ flexWrap: 'wrap' }}>
              {['天然植物萃取','敏感肌可用','母亲节大促','可溯源产地','30天回购率 36%'].map(t => <Chip key={t} tone="accent">{t}</Chip>)}
            </div>
          </div>

          <div className="mt-md">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>关联内容 · 6 条</div>
            <div className="col tight">
              {[
                { t: '"成分党看完都买了" · 精华液种草脚本', vv: '184k', gmv: '8.4万' },
                { t: '青朴 · 母亲节专场直播', vv: '64.1k', gmv: '25.6万' },
                { t: '为什么我说 30 岁后选精华要看溯源', vv: '224k', gmv: '16.8万' },
              ].map((c, i) => (
                <div key={i} className="row" style={{ padding: 10, border: '1px solid var(--divider)', borderRadius: 6 }}>
                  <Icon name="video" size={14} className="muted" />
                  <span style={{ fontSize: 12.5, flex: 1 }}>{c.t}</span>
                  <span className="muted mono" style={{ fontSize: 11 }}>{c.vv} 播放 · ¥{c.gmv} GMV</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="drawer-f">
          <button className="btn ghost"><Icon name="library" size={13} /> 加入素材库</button>
          <button className="btn" style={{ marginLeft: 'auto' }}>寄样申请</button>
          <button className="btn primary"><Icon name="sparkle" size={13} /> AI 生成视频</button>
        </div>
      </div>
    </>
  );
}

TL.Products = Products;
window.Products = Products;
