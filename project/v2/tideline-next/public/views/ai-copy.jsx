// 潮线 Tideline · AI 文案/标题生成

const AiCopy = function AiCopy() {
  const [picked, setPicked] = React.useState('c1');
  const [input, setInput] = React.useState('青朴山茶花修护精华液 · 30ml · 大促价 ¥298 · 28-35 都市白领');
  const [results, setResults] = React.useState(defaultResults);
  const [gen, setGen] = React.useState(false);
  const regen = () => {
    setGen(true);
    setTimeout(() => { setGen(false); setResults(defaultResults.slice().reverse()); }, 800);
  };
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">AI 文案 & 标题</h1>
            <p className="page-sub">基于模板与历史爆款数据生成 · 一键带入到任务</p>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="library" size={13} /> 模板库</button>
            <button className="btn"><Icon name="clock" size={13} /> 历史</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
          <div>
            <div className="muted" style={{ fontSize: 11, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>模板</div>
            <div className="col tight">
              {TL.copyTemplates.map(c => (
                <div key={c.id}
                  onClick={() => setPicked(c.id)}
                  style={{
                    padding: 10, borderRadius: 'var(--r-md)', cursor: 'pointer',
                    border: '1px solid ' + (picked === c.id ? 'var(--accent)' : 'var(--border)'),
                    background: picked === c.id ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                    boxShadow: picked === c.id ? '0 0 0 3px var(--accent-subtle)' : 'none',
                  }}>
                  <div className="row between">
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</span>
                    <span className="muted mono" style={{ fontSize: 10.5 }}>{c.usage}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="card">
              <div className="card-h"><Icon name="sparkle" size={13} /><h3>输入</h3></div>
              <div className="card-b col" style={{ gap: 10 }}>
                <div>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>商品 / 主题</div>
                  <textarea className="textarea" rows={2} value={input} onChange={e => setInput(e.target.value)} />
                </div>
                <div className="row" style={{ gap: 12 }}>
                  <div className="grow">
                    <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>目标人群</div>
                    <input className="input" defaultValue="28-35 都市白领 · 中性肌" />
                  </div>
                  <div className="grow">
                    <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>情绪基调</div>
                    <select className="select"><option>专业理性</option><option>种草分享</option><option>反差冲突</option><option>幽默轻松</option></select>
                  </div>
                  <div style={{ width: 100 }}>
                    <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>生成数量</div>
                    <select className="select"><option>4</option><option>6</option><option>8</option></select>
                  </div>
                </div>
                <div className="row between">
                  <div className="row tight">
                    <Chip dot>标题</Chip>
                    <Chip dot>正文文案</Chip>
                    <Chip dot>话题标签</Chip>
                  </div>
                  <button className="btn primary" onClick={regen}><Icon name="sparkle" size={13} /> {gen ? '生成中…' : '一键生成'}</button>
                </div>
              </div>
            </div>

            <div className="card mt-md">
              <div className="card-h">
                <Icon name="fileText" size={13} />
                <h3>生成结果</h3>
                <div className="actions row tight">
                  <button className="btn ghost sm"><Icon name="refresh" size={12} /> 再来一组</button>
                  <button className="btn ghost sm"><Icon name="copy" size={12} /> 全部复制</button>
                </div>
              </div>
              <div style={{ padding: 4 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ padding: 12, borderBottom: i < results.length - 1 ? '1px solid var(--divider)' : 'none' }}>
                    <div className="row between">
                      <div className="row tight">
                        <Chip tone={r.tone}>{r.kind}</Chip>
                        <span className="muted mono" style={{ fontSize: 11 }}>预估完播 {r.fr}% · 点赞率 {r.lr}%</span>
                      </div>
                      <div className="row tight">
                        <button className="btn ghost icon sm"><Icon name="heart" size={12} /></button>
                        <button className="btn ghost icon sm"><Icon name="copy" size={12} /></button>
                        <button className="btn sm">采用</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginTop: 8, letterSpacing: '-0.005em' }}>{r.title}</div>
                    {r.body && <div className="muted" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.6 }}>{r.body}</div>}
                    {r.tags && <div className="row tight" style={{ marginTop: 8, flexWrap: 'wrap', gap: 4 }}>
                      {r.tags.map(t => <span key={t} className="chip" style={{ fontSize: 10.5, color: 'var(--accent)', background: 'var(--accent-subtle)', borderColor: 'var(--accent-border)' }}>#{t}</span>)}
                    </div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const defaultResults = [
  {
    kind: '标题', tone: 'accent', fr: 42, lr: 7.2,
    title: '"用了 10 年精华才发现 · 真正的修护，是让皮肤先安静下来"',
    tags: ['成分党','精华液测评','修护','母亲节送礼']
  },
  {
    kind: '标题', tone: 'accent', fr: 38, lr: 6.8,
    title: '油皮换季选错精华 = 烧钱毁脸 · 这瓶我测了 28 天',
    tags: ['油皮','换季护肤','成分溯源']
  },
  {
    kind: '正文文案', tone: 'default', fr: 36, lr: 6.4,
    title: '为什么我说山茶花精华是 30 岁后的"安全感"',
    body: '我皮肤敏感很多年，每次换季都被各种"猛药精华"折磨。直到上个月开始用青朴山茶花精华，连续 28 天，脸上的小红点真的安静下来了。它没用什么花哨的成分，但每一项都来自浙江临安基地的可溯源原料——这种把"老实事"做到底的品牌，30 岁以后我才学会珍惜。',
    tags: ['敏感肌','换季护肤','成分溯源','30岁']
  },
  {
    kind: '直播话术', tone: 'warn', fr: null, lr: null,
    title: '黄金 1 分钟开场 · 留人 +42 秒模板',
    body: '"姐妹们先别走，今晚 19:30 我们这场只做一件事——把这瓶我自己用了 28 天的山茶花精华，掰开揉碎给你看清楚。前 100 单加赠正装小样，3、2、1 上链接。"',
    tags: ['直播话术','开场','留人']
  },
];

TL.AiCopy = AiCopy;
window.AiCopy = AiCopy;
