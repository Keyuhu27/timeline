// 潮线 Tideline · 竞品/达人监控

const Monitor = function Monitor() {
  const [tab, setTab] = React.useState('competitors');
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">竞品 & 达人监控</h1>
            <p className="page-sub">跨平台对标账号与达人池 · 数据每 6 小时同步</p>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="filter" size={13} /> 筛选</button>
            <button className="btn primary"><Icon name="plus" size={13} /> 添加监控</button>
          </div>
        </div>
        <div className="tabs">
          <div className={`tab ${tab === 'competitors' ? 'active' : ''}`} onClick={() => setTab('competitors')}>竞品账号</div>
          <div className={`tab ${tab === 'kols' ? 'active' : ''}`} onClick={() => setTab('kols')}>达人池</div>
          <div className={`tab ${tab === 'hot' ? 'active' : ''}`} onClick={() => setTab('hot')}>爆款雷达</div>
        </div>

        {tab === 'competitors' && (
          <div className="card">
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <Icon name="radar" size={32} className="muted" />
              <div style={{ marginTop: 12, fontWeight: 500, fontSize: 14 }}>竞品监控待接入</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12.5, maxWidth: 320, margin: '6px auto 0' }}>
                请通过"添加监控"绑定竞品账号后，系统将每 6 小时自动同步粉丝、GMV 及爆款内容数据。
              </div>
              <button className="btn primary" style={{ marginTop: 16 }}>
                <Icon name="plus" size={13} /> 添加竞品账号
              </button>
            </div>
          </div>
        )}

        {tab === 'kols' && (
          <>
            <div className="g4" style={{ marginBottom: 16 }}>
              {[
                { l: '在合作中', v: 6 },
                { l: '已邀约', v: 12 },
                { l: '待档期', v: 24 },
                { l: '历史合作', v: 86 },
              ].map((s, i) => <div key={i} className="stat"><div className="stat-label">{s.l}</div><div className="stat-value">{s.v}</div></div>)}
            </div>
            <div className="card">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>达人</th>
                    <th>品类</th>
                    <th className="num">粉丝</th>
                    <th className="num">平均 VV</th>
                    <th className="num">CPE (元)</th>
                    <th className="num">契合度</th>
                    <th>状态</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {TL.kols.map((k, i) => (
                    <tr key={i}>
                      <td>
                        <div className="row tight">
                          <span className={`av sm av-c${(i%6)+1}`}>{k.name[1]}</span>
                          <div className="col tight">
                            <span style={{ fontWeight: 500 }}>{k.name}</span>
                            <span className="muted" style={{ fontSize: 11 }}>{k.tag}</span>
                          </div>
                        </div>
                      </td>
                      <td><Chip>{k.cat}</Chip></td>
                      <td className="num mono">{TL.fmtCount(k.followers)}</td>
                      <td className="num mono">{TL.fmtCount(k.avgVV)}</td>
                      <td className="num mono">¥{k.cpe}</td>
                      <td className="num">
                        <div className="row tight" style={{ justifyContent: 'flex-end' }}>
                          <div className="bar" style={{ width: 60 }}>
                            <div style={{ width: `${k.fit}%`, background: k.fit >= 90 ? 'var(--success)' : 'var(--accent)' }} />
                          </div>
                          <span className="mono" style={{ width: 32 }}>{k.fit}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{k.status}</td>
                      <td><button className="btn sm">查看</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'hot' && (
          <div className="g3">
            {[
              { t: '"成分溯源"短剧 · 美妆赛道爆发', cat: '美妆', vv: '1,240 万', delta: '+128%', tone: 'danger' },
              { t: '工厂直播间转型实拍流', cat: '食品', vv: '680 万', delta: '+92%', tone: 'warn' },
              { t: '"户外人的早八"通勤化', cat: '户外', vv: '480 万', delta: '+74%', tone: 'warn' },
              { t: 'ASMR 拆机评测', cat: '3C', vv: '320 万', delta: '+58%', tone: 'accent' },
              { t: '床品质检对比图文', cat: '家居', vv: '220 万', delta: '+42%', tone: 'accent' },
              { t: '"打工人的下午茶"场景', cat: '食品', vv: '198 万', delta: '+38%', tone: 'accent' },
            ].map((h, i) => (
              <div key={i} className="card" style={{ padding: 14 }}>
                <div className="row between">
                  <Chip tone={h.tone} dot>趋势</Chip>
                  <Chip>{h.cat}</Chip>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10, letterSpacing: '-0.01em' }}>{h.t}</div>
                <div className="row between" style={{ marginTop: 12 }}>
                  <span className="muted" style={{ fontSize: 11 }}>近 7 天播放</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{h.vv}</span>
                </div>
                <div className="row between" style={{ marginTop: 4 }}>
                  <span className="muted" style={{ fontSize: 11 }}>环比</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--success)' }}>{h.delta}</span>
                </div>
                <button className="btn sm mt-sm" style={{ width: '100%', justifyContent: 'center' }}>
                  <Icon name="sparkle" size={12} /> AI 生成对应方案
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

TL.Monitor = Monitor;
window.Monitor = Monitor;
