// 潮线 Tideline · AI 文案/标题生成

const { useState: _useState, useRef: _useRef } = React;

const AiCopy = function AiCopy() {
  const [picked, setPicked] = _useState('c1');
  const [input, setInput] = _useState('青朴山茶花修护精华液 · 30ml · 大促价 ¥298 · 28-35 都市白领');
  const [audience, setAudience] = _useState('28-35 都市白领 · 中性肌');
  const [tone, setTone] = _useState('专业理性');
  const [count, setCount] = _useState('4');
  const [results, setResults] = _useState(defaultResults);
  const [gen, setGen] = _useState(false);
  const [error, setError] = _useState('');

  const regen = async () => {
    setGen(true);
    setError('');
    try {
      const template = TL.copyTemplates?.find(c => c.id === picked);
      const storeName = template?.name ?? '品牌门店';
      const r = await fetch('/api/ai/creative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName, product: input, audience, tone, count: parseInt(count) }),
      });
      const d = await r.json();
      if (d.data) {
        const { titles = [], bodies = [], videoScript, sellingPoints = [], tags = [] } = d.data;
        const mapped = [
          ...titles.slice(0, parseInt(count) || 4).map((t, i) => ({
            kind: '标题', tone: 'accent', fr: t.predictedCtr ? Math.round(t.predictedCtr * 10) / 10 : null, lr: null,
            title: t.text, tags: i === 0 ? tags.slice(0, 4) : undefined,
          })),
          ...bodies.map(b => ({
            kind: '正文文案', tone: 'default', fr: null, lr: null,
            title: b.slice(0, 40) + (b.length > 40 ? '…' : ''), body: b,
            tags: sellingPoints.slice(0, 3),
          })),
          ...(videoScript ? [{
            kind: '视频脚本', tone: 'warn', fr: null, lr: null,
            title: '视频脚本 · 分镜版', body: videoScript,
          }] : []),
        ].slice(0, (parseInt(count) || 4) + 2);
        setResults(mapped.length > 0 ? mapped : defaultResults);
      } else {
        setError(d.error || '生成失败');
        setResults(defaultResults);
      }
    } catch (e) {
      setError('请求失败: ' + e.message);
      setResults(defaultResults);
    } finally {
      setGen(false);
    }
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

        <DailyReportNL />

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
                    <input className="input" value={audience} onChange={e => setAudience(e.target.value)} />
                  </div>
                  <div className="grow">
                    <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>情绪基调</div>
                    <select className="select" value={tone} onChange={e => setTone(e.target.value)}>
                      <option>专业理性</option><option>种草分享</option><option>反差冲突</option><option>幽默轻松</option>
                    </select>
                  </div>
                  <div style={{ width: 100 }}>
                    <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>生成数量</div>
                    <select className="select" value={count} onChange={e => setCount(e.target.value)}>
                      <option>4</option><option>6</option><option>8</option>
                    </select>
                  </div>
                </div>
                {error && <div style={{ color: 'var(--danger)', fontSize: 12, padding: '4px 0' }}>{error}</div>}
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
                        {(r.fr !== null || r.lr !== null) && <span className="muted mono" style={{ fontSize: 11 }}>
                        {r.fr !== null ? `预估完播 ${r.fr}%` : ''}{r.fr !== null && r.lr !== null ? ' · ' : ''}{r.lr !== null ? `点赞率 ${r.lr}%` : ''}
                      </span>}
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

// ---- AI 日报助手：自然语言「帮我生成XX今天日报」→ 打开日报弹窗 -------------
function DailyReportNL() {
  const [q, setQ] = _useState('');
  const [hint, setHint] = _useState('');

  const parse = () => {
    const text = q.trim();
    if (!text) return;
    // 匹配品牌：用品牌名/账户名子串匹配
    const brands = TL.brands || [];
    const accounts = TL.accounts || [];
    const matched = brands.find(b => {
      const a = accounts.find(x => x.brand === b.id);
      const name = TL.displayBrandName ? TL.displayBrandName(b, a) : b.name;
      // 取品牌名前 2-4 字做宽松匹配
      return text.includes(name) || (name && name.length >= 2 && text.includes(name.slice(0, 2)))
        || (b.name && text.includes(b.name.slice(0, 2)));
    });
    if (!matched) { setHint('没找到匹配的品牌，请在「日报中心」手动选择，或换个说法（如「生成亿滋今天日报」）。'); return; }
    // 解析日期
    const today = new Date(Date.now() + 8 * 3600e3);
    let d = new Date(today);
    if (text.includes('昨天') || text.includes('昨日')) d.setDate(d.getDate() - 1);
    else if (text.includes('前天')) d.setDate(d.getDate() - 2);
    const mdy = text.match(/(\d{1,2})[.\-月](\d{1,2})/);
    let dateStr;
    if (mdy) dateStr = `${today.getFullYear()}-${String(+mdy[1]).padStart(2, '0')}-${String(+mdy[2]).padStart(2, '0')}`;
    else dateStr = d.toISOString().slice(0, 10);
    setHint('');
    TL.openDailyReport(matched.id, dateStr);
  };

  return (
    <div className="card" style={{ padding: 14, marginBottom: 16, background: 'var(--accent-subtle, #f4f0ff)' }}>
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Icon name="sparkle" size={14} />
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>AI 日报助手</span>
        <span className="muted" style={{ fontSize: 11 }}>用自然语言生成经营日报（辅助入口）</span>
        <div className="tb-spacer" style={{ flex: 1 }} />
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <input className="input grow" placeholder="例如：帮我生成亿滋今天日报 / 永和大王 6.16 日报"
          value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && parse()} />
        <button className="btn" onClick={parse}><Icon name="fileText" size={13} /> 生成日报</button>
      </div>
      {hint && <div className="muted" style={{ fontSize: 11.5, marginTop: 6, color: 'var(--warn, #ad6800)' }}>{hint}</div>}
    </div>
  );
}

TL.AiCopy = AiCopy;
window.AiCopy = AiCopy;
