// 潮线 Tideline · 数据分析看板 (账号 + 直播子流程)

const Data = function Data({ subView, setSubView, openLive }) {
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">数据分析</h1>
            <p className="page-sub">跨账号 GMV 与流量监控 · 最后同步 2 分钟前</p>
          </div>
          <div className="page-actions">
            <div className="row tight">
              <select className="select" style={{ width: 'auto' }} defaultValue="7">
                <option value="7">最近 7 天</option>
                <option value="14">最近 14 天</option>
                <option value="30">最近 30 天</option>
              </select>
              <button className="btn"><Icon name="refresh" size={13} /> 同步</button>
              <button className="btn"><Icon name="download" size={13} /> 导出</button>
            </div>
          </div>
        </div>

        <div className="tabs">
          {[
            { id: 'overview', label: '总览' },
            { id: 'accounts', label: '账号分析' },
            { id: 'lives',    label: '直播数据' },
            { id: 'content',  label: '内容数据' },
            { id: 'traffic',  label: '流量来源' },
          ].map(t => (
            <div key={t.id} className={`tab ${subView === t.id ? 'active' : ''}`} onClick={() => setSubView(t.id)}>
              {t.label}
            </div>
          ))}
        </div>

        {subView === 'overview' && <OverviewTab />}
        {subView === 'accounts' && <AccountsTab />}
        {subView === 'lives' && <LivesTab openLive={openLive} />}
        {subView === 'content' && <ContentTab />}
        {subView === 'traffic' && <TrafficTab />}
      </div>
    </div>
  );
};

// ---- Overview --------------------------------------------------------------
function OverviewTab() {
  const totalGmv = TL.accounts.reduce((s, a) => s + a.gmv7d, 0);
  const totalFans = TL.accounts.reduce((s, a) => s + a.followers, 0);
  const labels = Array.from({ length: 14 }, (_, i) => `${4 + Math.floor((i+27)/30)}/${((i+27)%30)+1}`);
  return (
    <>
      <div className="stat-row">
        <Stat label="7日 GMV 合计" value={`¥ ${TL.fmtMoney(totalGmv)}`} delta="+12.6%" sub="vs 上周" />
        <Stat label="累计粉丝" value={TL.fmtCount(totalFans)} delta="+5.4%" sub="净增 6.8万" />
        <Stat label="本周直播场次" value={38} delta="+4 场" sub="平均时长 3.4h" />
        <Stat label="本周视频" value={73} delta="+18" sub="完播率 32.8%" />
      </div>

      <div className="g2 mt-md">
        <div className="card">
          <div className="card-h">
            <h3>GMV 趋势 · 14 天</h3>
            <div className="actions row tight">
              <span className="chip accent dot">总GMV</span>
              <span className="chip"><span className="dot" style={{ background: 'var(--c2)' }} /> 同比</span>
              <button className="btn ghost icon sm"><Icon name="more" size={12} /></button>
            </div>
          </div>
          <div className="card-b">
            <LineChart
              series={[
                { name: '本期', data: TL.gmvTrend.map(v => v * 1000) },
                { name: '同比', data: TL.gmvTrend.map((v, i) => v * 1000 * (0.78 + i * 0.005)) },
              ]}
              labels={labels}
              height={220}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>品类 GMV 占比</h3>
            <div className="actions"><span className="chip">5 个品牌</span></div>
          </div>
          <div className="card-b row" style={{ gap: 24 }}>
            <Donut
              size={160}
              thickness={22}
              data={[
                { value: 2087, color: 'var(--c1)' },
                { value: 1284, color: 'var(--c2)' },
                { value: 826,  color: 'var(--c3)' },
                { value: 412,  color: 'var(--c4)' },
                { value: 184,  color: 'var(--c5)' },
              ]}
            />
            <div className="grow col" style={{ gap: 8 }}>
              {[
                { c: 'var(--c1)', n: '云杉运动', v: '¥208.7万', p: '43.5%' },
                { c: 'var(--c2)', n: '青朴自然', v: '¥128.5万', p: '26.8%' },
                { c: 'var(--c3)', n: '林野鲜食', v: '¥82.6万', p: '17.2%' },
                { c: 'var(--c4)', n: '小鹿家居', v: '¥41.3万', p: '8.6%' },
                { c: 'var(--c5)', n: '北麓数码', v: '¥18.5万', p: '3.9%' },
              ].map((r, i) => (
                <div key={i} className="row" style={{ fontSize: 12.5 }}>
                  <span className="dot" style={{ background: r.c, width: 8, height: 8 }} />
                  <span>{r.n}</span>
                  <span className="muted mono" style={{ marginLeft: 'auto' }}>{r.v}</span>
                  <span className="mono" style={{ width: 50, textAlign: 'right' }}>{r.p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-md">
        <div className="card-h">
          <h3>关键指标矩阵</h3>
          <div className="actions"><span className="muted" style={{ fontSize: 11 }}>账号 × 指标</span></div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>账号</th>
              <th className="num">粉丝</th>
              <th className="num">7日增粉</th>
              <th className="num">GMV (7d)</th>
              <th className="num">视频数</th>
              <th className="num">直播</th>
              <th className="num">平均 VV</th>
              <th className="num">CTR</th>
              <th className="num">CVR</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {TL.accounts.map(a => (
              <tr key={a.id}>
                <td>
                  <div className="row tight">
                    <span className={`av sm av-${a.color}`}>{a.name[0]}</span>
                    <span style={{ fontWeight: 500 }}>{a.name}</span>
                  </div>
                </td>
                <td className="num mono">{TL.fmtCount(a.followers)}</td>
                <td className="num mono">
                  <span style={{ color: a.growth7d >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {TL.fmtPct(a.growth7d)}
                  </span>
                </td>
                <td className="num mono">¥ {TL.fmtMoney(a.gmv7d)}</td>
                <td className="num mono">{a.video7d}</td>
                <td className="num mono">{a.live7d}</td>
                <td className="num mono">{TL.fmtCount(a.avgVV)}</td>
                <td className="num mono">{(a.ctr*100).toFixed(1)}%</td>
                <td className="num mono">{(a.cvr*100).toFixed(1)}%</td>
                <td><button className="btn ghost icon sm"><Icon name="chevR" size={12} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---- Account analysis ------------------------------------------------------
function AccountsTab() {
  const [picked, setPicked] = React.useState(TL.accounts[3].id);
  const a = TL.accountById(picked);
  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        {TL.accounts.map(acc => (
          <div key={acc.id}
               onClick={() => setPicked(acc.id)}
               style={{
                 padding: '8px 12px', borderRadius: 'var(--r-md)',
                 background: picked === acc.id ? 'var(--bg-elevated)' : 'var(--bg-app)',
                 border: '1px solid ' + (picked === acc.id ? 'var(--accent)' : 'var(--border)'),
                 boxShadow: picked === acc.id ? '0 0 0 3px var(--accent-subtle)' : 'none',
                 cursor: 'pointer',
                 minWidth: 180,
               }}>
            <div className="row tight">
              <span className={`av sm av-${acc.color}`}>{acc.name[0]}</span>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{acc.name}</span>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <span className="muted mono" style={{ fontSize: 11 }}>{TL.fmtCount(acc.followers)}</span>
              <span className="mono" style={{
                fontSize: 11, marginLeft: 'auto',
                color: acc.growth7d >= 0 ? 'var(--success)' : 'var(--danger)'
              }}>{TL.fmtPct(acc.growth7d)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="stat-row">
        <Stat label="粉丝总数" value={TL.fmtCount(a.followers)} delta={TL.fmtPct(a.growth7d)} sub="近 7 天" />
        <Stat label="GMV (7d)" value={'¥ ' + TL.fmtMoney(a.gmv7d)} delta="+18.4%" sub="客单价 ¥168" />
        <Stat label="主页访问→关注率" value="6.8%" delta="+0.9pp" sub="行业 5.2%" />
        <Stat label="作品发布" value={`${a.video7d}视频 / ${a.live7d}场直播`} sub="均频率 / 周" />
      </div>

      <div className="g2 mt-md">
        <div className="card">
          <div className="card-h">
            <h3>粉丝增长 · 14 天</h3>
            <span className="chip">日新增</span>
          </div>
          <div className="card-b">
            <BarChart data={TL.followerTrend.map(v => v * 100)} labels={['','','','','','','7','','','','','','','14']} height={220} />
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <h3>粉丝画像</h3>
            <span className="chip">{TL.fmtCount(a.followers)}</span>
          </div>
          <div className="card-b col" style={{ gap: 14 }}>
            <DistRow label="性别 · 女 / 男" values={[68, 32]} colors={['var(--c2)','var(--c1)']} labels={['68%','32%']} />
            <div>
              <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>年龄分布</div>
              <div className="row" style={{ gap: 6 }}>
                {[
                  { k: '18-23', v: 14 },
                  { k: '24-30', v: 38 },
                  { k: '31-40', v: 32 },
                  { k: '41-50', v: 12 },
                  { k: '50+',   v: 4 },
                ].map(g => (
                  <div key={g.k} style={{ flex: 1 }}>
                    <div style={{ height: 60, background: 'var(--bg-subtle)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${g.v*1.4}%`, background: 'var(--accent)', opacity: 0.85 }} />
                    </div>
                    <div className="muted mono" style={{ fontSize: 10.5, textAlign: 'center', marginTop: 3 }}>{g.k}</div>
                    <div className="mono" style={{ fontSize: 11, textAlign: 'center' }}>{g.v}%</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>地域 · TOP 5</div>
              <div className="col tight">
                {[
                  { k: '广东', v: 18.4 },
                  { k: '浙江', v: 12.6 },
                  { k: '江苏', v: 10.8 },
                  { k: '北京', v: 8.4 },
                  { k: '上海', v: 7.9 },
                ].map(g => (
                  <div key={g.k} className="row" style={{ fontSize: 12 }}>
                    <span style={{ width: 40 }}>{g.k}</span>
                    <div className="bar grow"><div style={{ width: `${g.v * 4}%` }} /></div>
                    <span className="mono" style={{ width: 44, textAlign: 'right' }}>{g.v}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-md">
        <div className="card-h">
          <h3>近期作品表现 · {a.name}</h3>
          <div className="actions row tight">
            <button className="btn ghost sm">视频</button>
            <button className="btn ghost sm">图文</button>
            <button className="btn ghost sm">直播</button>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>作品</th>
              <th>发布</th>
              <th className="num">播放</th>
              <th className="num">完播</th>
              <th className="num">点赞</th>
              <th className="num">评论</th>
              <th className="num">GMV</th>
              <th className="num">转化率</th>
            </tr>
          </thead>
          <tbody>
            {[
              { t: '夏日防晒衣 vs 普通防晒衣实测', d: '5/10 12:00', vv: 184200, fr: 0.412, lk: 8420, cm: 642, gmv: 84600, cvr: 0.052 },
              { t: '徒步老炮的衣柜 · 季抛清单', d: '5/9 18:30', vv: 96400, fr: 0.382, lk: 4218, cm: 384, gmv: 42800, cvr: 0.048 },
              { t: '为什么我家防晒比别人更轻？', d: '5/8 08:00', vv: 224800, fr: 0.486, lk: 12260, cm: 1042, gmv: 168400, cvr: 0.062 },
              { t: '"户外人"的早八通勤', d: '5/7 22:30', vv: 38400, fr: 0.342, lk: 1820, cm: 142, gmv: 12600, cvr: 0.028 },
              { t: '云杉618清单 · 6 件不踩坑', d: '5/6 15:00', vv: 142600, fr: 0.392, lk: 6240, cm: 524, gmv: 64200, cvr: 0.046 },
            ].map((v, i) => (
              <tr key={i}>
                <td>
                  <div className="row tight">
                    <div style={{ width: 28, height: 36, borderRadius: 4, background: 'linear-gradient(135deg, oklch(0.85 0.04 258), oklch(0.85 0.04 200))' }} />
                    <span style={{ fontWeight: 500 }}>{v.t}</span>
                  </div>
                </td>
                <td className="muted mono" style={{ fontSize: 11.5 }}>{v.d}</td>
                <td className="num mono">{TL.fmtCount(v.vv)}</td>
                <td className="num mono">{(v.fr*100).toFixed(1)}%</td>
                <td className="num mono">{TL.fmtCount(v.lk)}</td>
                <td className="num mono">{v.cm}</td>
                <td className="num mono">¥ {TL.fmtMoney(v.gmv)}</td>
                <td className="num mono">{(v.cvr*100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DistRow({ label, values, colors, labels }) {
  const total = values.reduce((s, v) => s + v, 0);
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div className="row" style={{ height: 12, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-subtle)' }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: v / total, background: colors[i] }} />
        ))}
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        {labels.map((l, i) => (
          <span key={i} className="row tight muted" style={{ fontSize: 11, marginRight: 12 }}>
            <span className="dot" style={{ background: colors[i] }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Lives ------------------------------------------------------------------
function LivesTab({ openLive }) {
  const live = TL.lives[0];
  return (
    <>
      <div className="card" style={{ marginBottom: 16, padding: 0, borderColor: 'oklch(0.85 0.08 25)', background: 'linear-gradient(180deg, oklch(0.99 0.02 25), var(--bg-elevated))' }}>
        <div className="row" style={{ padding: 16, gap: 16 }}>
          <div style={{
            width: 88, height: 156,
            borderRadius: 10,
            background: 'linear-gradient(180deg, oklch(0.4 0.06 25), oklch(0.25 0.04 25))',
            position: 'relative', overflow: 'hidden', flexShrink: 0,
            color: 'white', padding: 8,
            display: 'flex', flexDirection: 'column'
          }}>
            <div className="row tight" style={{ fontSize: 10, fontWeight: 600 }}>
              <span className="dot live" /> LIVE
            </div>
            <div style={{ marginTop: 'auto', fontSize: 10, opacity: 0.85 }}>
              <div className="mono">8.4w 观看</div>
              <div className="mono">¥ 31.8 万</div>
            </div>
          </div>
          <div className="grow">
            <div className="row tight">
              <Chip tone="danger" dot>实时</Chip>
              <span className="muted" style={{ fontSize: 11.5 }}>已开播 4小时12分钟</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{live.title}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>云杉运动 OUTDOOR · 主播 苏念 + 阿夏</div>
            <div className="row" style={{ marginTop: 12, gap: 24 }}>
              <Tile label="实时 GMV" value="¥ 31.8 万" delta="+ ¥ 4.2 万 / 小时" tone="success" />
              <Tile label="在线观看" value="4,126" delta="峰值 6,820" />
              <Tile label="支付转化率" value="3.8%" delta="行业 2.4%" tone="success" />
              <Tile label="客单价" value="¥ 198" delta="目标 ¥180" />
              <Tile label="本场退款率" value="4.6%" delta="低于均值" tone="success" />
            </div>
          </div>
          <button className="btn primary" onClick={() => openLive(live)}>
            <Icon name="live" size={13} /> 实时大屏
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>近期直播</h3>
          <div className="actions row tight">
            <button className="btn ghost sm">全部账号</button>
            <button className="btn ghost sm">最近 30 天</button>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>直播</th>
              <th>账号</th>
              <th className="num">时长</th>
              <th className="num">GMV</th>
              <th className="num">观看人次</th>
              <th className="num">峰值在线</th>
              <th className="num">支付转化</th>
              <th className="num">客单价</th>
              <th className="num">退款率</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {TL.lives.map(l => {
              const acc = TL.accountById(l.acc);
              return (
                <tr key={l.id} onClick={() => openLive(l)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{l.title}</div>
                    <div className="muted mono" style={{ fontSize: 11 }}>{l.date}</div>
                  </td>
                  <td>
                    <div className="row tight">
                      <span className={`av sm av-${acc.color}`}>{acc.name[0]}</span>
                      <span style={{ fontSize: 12 }}>{acc.name}</span>
                    </div>
                  </td>
                  <td className="num mono">{l.dur}</td>
                  <td className="num mono"><b>¥ {TL.fmtMoney(l.gmv)}</b></td>
                  <td className="num mono">{TL.fmtCount(l.viewers)}</td>
                  <td className="num mono">{l.peak.toLocaleString()}</td>
                  <td className="num mono">{(l.payRate*100).toFixed(1)}%</td>
                  <td className="num mono">¥ {l.atv}</td>
                  <td className="num mono">{(l.returns*100).toFixed(1)}%</td>
                  <td>{l.status === 'ongoing' ? <Chip tone="danger" dot>进行中</Chip> : <Chip>已结束</Chip>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ContentTab() {
  const labels = Array.from({ length: 14 }, (_, i) => `${4 + Math.floor((i+27)/30)}/${((i+27)%30)+1}`);
  return (
    <>
      <div className="stat-row">
        <Stat label="视频总曝光" value="284.6 万" delta="+18%" sub="近 7 天" />
        <Stat label="平均完播率" value="32.8%" delta="+2.4pp" sub="行业均值 24%" />
        <Stat label="作品点赞率" value="6.4%" delta="+0.8pp" sub="" />
        <Stat label="评论 / 收藏 / 转发" value="4.2万 · 1.8万 · 8420" sub="互动总量 7.4 万" />
      </div>
      <div className="g2 mt-md">
        <div className="card">
          <div className="card-h"><h3>每日播放量 (VV)</h3></div>
          <div className="card-b"><BarChart data={TL.videoVV} labels={labels.slice(-14)} height={200} /></div>
        </div>
        <div className="card">
          <div className="card-h"><h3>视频时长 vs 完播率</h3></div>
          <div className="card-b col" style={{ gap: 8 }}>
            {[
              { t: '0-15s', vv: 0.42, cnt: 18 },
              { t: '15-30s', vv: 0.38, cnt: 26 },
              { t: '30-60s', vv: 0.32, cnt: 19 },
              { t: '60-90s', vv: 0.24, cnt: 8 },
              { t: '90s+',   vv: 0.18, cnt: 2 },
            ].map(r => (
              <div key={r.t} className="row" style={{ fontSize: 12.5 }}>
                <span style={{ width: 56 }} className="mono">{r.t}</span>
                <div className="bar grow"><div style={{ width: `${r.vv*180}%`, background: 'var(--c2)' }} /></div>
                <span className="mono" style={{ width: 60, textAlign: 'right' }}>{(r.vv*100).toFixed(0)}%</span>
                <span className="muted mono" style={{ width: 40, textAlign: 'right' }}>{r.cnt}条</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function TrafficTab() {
  return (
    <div className="g2">
      <div className="card">
        <div className="card-h"><h3>流量来源拆解</h3></div>
        <div className="card-b col" style={{ gap: 10 }}>
          {[
            { k: '推荐流量', v: 64.2, c: 'var(--c1)' },
            { k: '关注流量', v: 18.4, c: 'var(--c2)' },
            { k: '搜索流量', v: 8.6, c: 'var(--c3)' },
            { k: '同城流量', v: 4.2, c: 'var(--c4)' },
            { k: '千川投流', v: 3.8, c: 'var(--c5)' },
            { k: '其他', v: 0.8, c: 'var(--c6)' },
          ].map(r => (
            <div key={r.k} className="row">
              <span style={{ width: 80, fontSize: 12.5 }}>{r.k}</span>
              <div className="bar grow"><div style={{ width: `${r.v}%`, background: r.c }} /></div>
              <span className="mono" style={{ width: 50, textAlign: 'right', fontSize: 12 }}>{r.v}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h3>千川投流 ROI</h3><span className="chip">本周</span></div>
        <div className="card-b">
          <div className="g3" style={{ marginBottom: 16 }}>
            <Stat label="花费" value="¥ 4.82 万" sub="vs ¥ 4.2 万" />
            <Stat label="GMV" value="¥ 14.6 万" sub="" />
            <Stat label="ROI" value="3.02" delta="+0.34" sub="目标 2.8" tone="success" />
          </div>
          <LineChart
            series={[{ name: 'ROI', data: [2.4, 2.6, 2.8, 2.7, 2.9, 3.1, 3.0, 3.02] }]}
            labels={['5/4','5/5','5/6','5/7','5/8','5/9','5/10','5/11']}
            height={140}
            colors={['var(--c3)']}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, delta, sub, tone }) {
  const isDown = delta && delta.includes('-');
  const cls = tone === 'success' ? 'up' : isDown ? 'down' : 'up';
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-delta ${delta ? cls : ''}`}>
        {delta && <><Icon name={isDown ? 'arrowDown' : 'arrowUp'} size={10} /> {delta}{sub ? ' · ' : ''}</>}
        {sub}
      </div>
    </div>
  );
}

function Tile({ label, value, delta, tone }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11 }}>{label}</div>
      <div className="num" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{value}</div>
      {delta && <div style={{ fontSize: 11, color: tone === 'success' ? 'var(--success)' : 'var(--text-muted)', marginTop: 2 }}>{delta}</div>}
    </div>
  );
}

TL.Data = Data;
window.Data = Data;
