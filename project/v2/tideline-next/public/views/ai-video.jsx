// 潮线 Tideline · AI 视频生成 · 对话式工作台

const AiVideo = function AiVideo() {
  const [messages, setMessages] = React.useState(initialMessages);
  const [input, setInput] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, generating]);

  const send = (text) => {
    if (!text.trim()) return;
    const u = { role: 'user', content: text };
    setMessages(m => [...m, u]);
    setInput('');
    setGenerating(true);
    setTimeout(() => {
      setMessages(m => [...m, {
        role: 'ai',
        content: '已为你产出 3 条分镜方案，命中目标人群 28-35 岁都市白领，主推「成分溯源 + 实测对比」叙事，预计完播率 40%+。',
        attachments: [
          { kind: 'storyboard', items: ['钩子 · 反差冲突 0-3s', '成分溯源 · 实拍 3-12s', '产品演示 · 上脸对比 12-22s', '促单引导 · 价格锚点 22-30s'] },
          { kind: 'videos', items: [
            { title: 'A 方案 · 反差钩子', dur: '00:31', score: 88, status: 'ready' },
            { title: 'B 方案 · 成分党', dur: '00:28', score: 82, status: 'ready' },
            { title: 'C 方案 · 场景化', dur: '00:34', score: 76, status: 'rendering' },
          ]},
        ]
      }]);
      setGenerating(false);
    }, 1400);
  };

  return (
    <div className="page">
      <div className="page-inner" style={{ paddingBottom: 24 }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">AI 视频工作台 <span className="chip accent" style={{ verticalAlign: 'middle', marginLeft: 8 }}>Tide-1.6</span></h1>
            <p className="page-sub">对话式生成 · 输入商品/卖点/人群 → 自动产出脚本、分镜与可投放视频</p>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="library" size={13} /> 模板</button>
            <button className="btn"><Icon name="clock" size={13} /> 历史</button>
            <button className="btn outline"><Icon name="plus" size={13} /> 新会话</button>
          </div>
        </div>

        <div className="chat-shell">
          <div className="chat-main">
            <div className="chat-scroll" ref={scrollRef}>
              {messages.map((m, i) => <Msg key={i} msg={m} />)}
              {generating && <GenStream />}
            </div>
            <div className="chat-input">
              <div className="row tight" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                {TL.aiSuggest.map((s, i) => (
                  <button key={i} className="chip" style={{ cursor: 'pointer' }} onClick={() => setInput(s)}>
                    <Icon name="sparkle" size={10} /> {s.length > 36 ? s.slice(0, 36) + '…' : s}
                  </button>
                ))}
              </div>
              <div className="chat-input-row">
                <button className="btn ghost icon"><Icon name="paperclip" size={14} /></button>
                <button className="btn ghost icon"><Icon name="link" size={14} /></button>
                <textarea
                  rows={1}
                  placeholder="描述你想要的视频 · 也可粘贴商品链接或 @素材库内素材"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }}}
                />
                <div className="row tight">
                  <select className="select" style={{ width: 'auto', padding: '4px 8px', fontSize: 11.5 }}>
                    <option>15s · 短钩子</option>
                    <option>30s · 标准</option>
                    <option>60s · 长种草</option>
                  </select>
                  <button className="btn primary" onClick={() => send(input)} disabled={!input.trim()}>
                    <Icon name="send" size={13} /> 生成
                  </button>
                </div>
              </div>
            </div>
          </div>

          <RightPane />
        </div>
      </div>
    </div>
  );
};

const initialMessages = [
  {
    role: 'ai',
    content: '你好，我是 Tide 视频助手。可以告诉我你想为哪个商品做视频？也可以从右侧选择当前在跑的项目，我会自动带入商品信息与品牌调性。',
  },
  {
    role: 'user',
    content: '为青朴山茶花精华生成 1 条 30 秒种草视频，目标人群是 28-35 岁都市白领，强调成分溯源。',
  },
  {
    role: 'ai',
    content: '收到。我已检索素材库中关于「山茶花精华」的 7 个脚本片段、12 张产品图、3 段品牌主理人讲解视频。建议采用「反差钩子 + 成分溯源 + 上脸对比」三段式结构。是否要我加入价格锚点（5/12 母亲节专场 ¥298）？',
    attachments: [
      { kind: 'plan', items: [
        { label: '商品', value: '青朴山茶花修护精华液 30ml' },
        { label: '目标人群', value: '28-35 都市白领 · 中性肌 · 注重成分' },
        { label: '叙事结构', value: '反差钩子 → 成分 → 实测 → 促单' },
        { label: '匹配模板', value: '«成分党 30s» · 命中 92%' },
      ]},
    ]
  },
  {
    role: 'user',
    content: '加上价格锚点，再生成 3 个备选分镜。',
  },
];

function Msg({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="msg user">
        <span className="av sm av-c1">陈</span>
        <div>
          <div className="name" style={{ textAlign: 'right' }}>陈思远 · 主理人</div>
          <div className="bubble">{msg.content}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="msg">
      <span className="av sm" style={{ background: 'linear-gradient(135deg, var(--accent), oklch(0.7 0.14 200))', color: 'white', border: 'none' }}>T</span>
      <div style={{ maxWidth: 720, flex: 1 }}>
        <div className="name">Tide · AI 助手 <span className="muted" style={{ marginLeft: 6 }}>· {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2,'0')}</span></div>
        <div className="bubble">{msg.content}</div>
        {msg.attachments && msg.attachments.map((a, i) => (
          <div key={i} style={{ marginTop: 10 }}>
            {a.kind === 'plan' && <PlanCard items={a.items} />}
            {a.kind === 'storyboard' && <Storyboard items={a.items} />}
            {a.kind === 'videos' && <VideoResults items={a.items} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanCard({ items }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-h" style={{ padding: '8px 12px' }}>
        <Icon name="layers" size={13} />
        <h3 style={{ fontSize: 12.5 }}>创作方案</h3>
      </div>
      <div style={{ padding: '4px 0' }}>
        {items.map((it, i) => (
          <div key={i} className="row" style={{
            padding: '6px 12px',
            borderBottom: i < items.length - 1 ? '1px solid var(--divider)' : 'none',
            fontSize: 12.5,
          }}>
            <span className="muted" style={{ width: 80 }}>{it.label}</span>
            <span>{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Storyboard({ items }) {
  return (
    <div className="row" style={{ gap: 8, marginBottom: 10, overflowX: 'auto', paddingBottom: 4 }}>
      {items.map((it, i) => (
        <div key={i} style={{
          width: 140, flexShrink: 0,
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          overflow: 'hidden', background: 'var(--bg-elevated)',
        }}>
          <div style={{ aspectRatio: '9/16', background: `linear-gradient(135deg, oklch(${0.85 - i*0.04} 0.06 ${258 - i*30}), oklch(0.75 0.08 ${200 - i*30}))`, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 4, left: 6, fontSize: 9, color: 'white', fontWeight: 600, background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 3 }}>
              分镜 {i+1}
            </div>
            <div style={{ position: 'absolute', bottom: 4, left: 6, right: 6, fontSize: 9, color: 'white', fontFamily: 'var(--font-mono)' }}>
              {i*8}-{(i+1)*8}s
            </div>
          </div>
          <div style={{ padding: 8, fontSize: 11, lineHeight: 1.4 }}>{it}</div>
        </div>
      ))}
    </div>
  );
}

function VideoResults({ items }) {
  return (
    <div className="col tight">
      {items.map((v, i) => (
        <div key={i} className="gen-card">
          <div className="gen-thumb" style={{
            background: i === 0 ? 'linear-gradient(135deg, oklch(0.4 0.06 25), oklch(0.6 0.14 25))'
                     : i === 1 ? 'linear-gradient(135deg, oklch(0.45 0.1 258), oklch(0.65 0.14 258))'
                              : 'linear-gradient(135deg, oklch(0.45 0.1 152), oklch(0.65 0.14 152))',
          }}>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'white' }}>
              <Icon name="play" size={16} />
            </div>
            {v.status === 'rendering' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.2)' }}>
              <div style={{ height: '100%', width: '62%', background: 'white' }} />
            </div>}
          </div>
          <div className="col tight">
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{v.title}</div>
            <div className="row tight muted" style={{ fontSize: 11 }}>
              <span className="mono">{v.dur}</span>
              <span>·</span>
              <span>AI 评分 <b style={{ color: 'var(--accent)' }}>{v.score}</b></span>
              <span>·</span>
              <span>{v.status === 'ready' ? <Chip tone="success" dot>就绪</Chip> : <Chip tone="warn" dot>渲染 62%</Chip>}</span>
            </div>
          </div>
          <div className="row tight">
            <button className="btn ghost sm" disabled={v.status !== 'ready'}><Icon name="eye" size={12} /></button>
            <button className="btn sm" disabled={v.status !== 'ready'}><Icon name="download" size={12} /></button>
            <button className="btn primary sm" disabled={v.status !== 'ready'}>采用</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function GenStream() {
  return (
    <div className="msg">
      <span className="av sm" style={{ background: 'linear-gradient(135deg, var(--accent), oklch(0.7 0.14 200))', color: 'white', border: 'none' }}>T</span>
      <div>
        <div className="name">Tide · AI 助手</div>
        <div className="bubble">
          <div className="row tight">
            <Spinner /> 正在生成 3 条分镜方案…
          </div>
          <div className="col tight" style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
            <div>✓ 调用商品信息接口</div>
            <div>✓ 命中模板 «成分党 30s»</div>
            <div>✓ 检索素材库 (7 脚本 / 12 图片)</div>
            <div className="row tight"><Spinner small /> 渲染分镜画面…</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner({ small }) {
  const s = small ? 10 : 12;
  return (
    <span style={{ width: s, height: s, borderRadius: '50%', border: `1.5px solid var(--accent)`, borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </span>
  );
}

function RightPane() {
  return (
    <div className="preview-pane">
      <div className="card">
        <div className="card-h" style={{ padding: '10px 14px' }}>
          <Icon name="cart" size={13} />
          <h3 style={{ fontSize: 12.5 }}>当前商品</h3>
          <button className="btn ghost sm" style={{ marginLeft: 'auto' }}>切换</button>
        </div>
        <div className="card-b" style={{ padding: 12 }}>
          <div className="row tight">
            <div style={{ width: 56, height: 56, borderRadius: 6, background: 'linear-gradient(135deg, oklch(0.94 0.04 152), oklch(0.88 0.06 200))', flexShrink: 0 }} />
            <div className="col tight">
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>青朴山茶花修护精华液 30ml</div>
              <div className="muted" style={{ fontSize: 11 }}>青朴自然护肤 · 美妆个护</div>
              <div className="row tight" style={{ fontSize: 11 }}>
                <span className="mono" style={{ fontWeight: 600 }}>¥ 298</span>
                <span className="muted">原价 ¥ 358</span>
                <Chip tone="danger" dot>大促</Chip>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card grow" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="card-h" style={{ padding: '10px 14px' }}>
          <Icon name="eye" size={13} />
          <h3 style={{ fontSize: 12.5 }}>实时预览 · A 方案</h3>
          <button className="btn ghost sm" style={{ marginLeft: 'auto' }}><Icon name="refresh" size={12} /></button>
        </div>
        <div style={{ flex: 1, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.16 0.02 258)' }}>
          <div className="phone" style={{ maxWidth: 220 }}>
            <div style={{ position: 'absolute', top: 40, left: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Chip tone="danger" dot>预览</Chip>
            </div>
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <Icon name="play" size={28} />
              <div style={{ fontSize: 10, marginTop: 6, opacity: 0.7 }}>分镜 1 · 0-3s</div>
              <div style={{ fontSize: 13, marginTop: 8, padding: '0 24px' }}>"用了 10 年精华，才发现自己买错了…"</div>
            </div>
            <div style={{ position: 'absolute', right: 8, bottom: 60, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', color: 'white' }}>
              {[{i:'heart',n:'4.2w'},{i:'msg',n:'382'},{i:'share',n:'128'},{i:'cart',n:''}].map((c,i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <Icon name={c.i} size={20} />
                  <div style={{ fontSize: 9, marginTop: 2 }}>{c.n}</div>
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', left: 12, right: 60, bottom: 24, fontSize: 10, opacity: 0.9 }}>
              @青朴自然·官方旗舰
              <div style={{ fontSize: 9, opacity: 0.7, marginTop: 4 }}>♪ 原创音频</div>
            </div>
          </div>
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--divider)' }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="muted" style={{ fontSize: 11 }}>AI 投放评分</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>88 / 100</span>
          </div>
          <div className="col tight">
            {[
              { k: '完播率预测', v: 92 },
              { k: '转化率预测', v: 78 },
              { k: '人群匹配',   v: 95 },
              { k: '审核通过率', v: 88 },
            ].map(r => (
              <div key={r.k} className="row" style={{ fontSize: 11 }}>
                <span className="muted" style={{ width: 80 }}>{r.k}</span>
                <div className="bar grow"><div style={{ width: `${r.v}%` }} /></div>
                <span className="mono" style={{ width: 32, textAlign: 'right' }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

TL.AiVideo = AiVideo;
window.AiVideo = AiVideo;
