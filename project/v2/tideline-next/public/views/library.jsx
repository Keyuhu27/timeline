// 潮线 Tideline · 内容素材库

const Library = function Library() {
  const [filter, setFilter] = React.useState('all');
  const items = TL.library.filter(it => filter === 'all' || it.kind === filter);
  const kinds = [
    { id: 'all', label: '全部', icon: 'library' },
    { id: 'script', label: '脚本', icon: 'fileText' },
    { id: 'topic', label: '选题', icon: 'flag' },
    { id: 'hook', label: '钩子', icon: 'zap' },
    { id: 'image', label: '图片素材', icon: 'image' },
  ];
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">内容素材库</h1>
            <p className="page-sub">脚本 · 选题 · 钩子 · 图文素材 · 团队共建</p>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="upload" size={13} /> 上传</button>
            <button className="btn primary"><Icon name="plus" size={13} /> 新建素材</button>
          </div>
        </div>

        <div className="row between" style={{ marginBottom: 16 }}>
          <div className="row tight">
            {kinds.map(k => (
              <button key={k.id}
                className="btn"
                style={{
                  background: filter === k.id ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  color: filter === k.id ? 'var(--accent)' : 'var(--text-secondary)',
                  borderColor: filter === k.id ? 'var(--accent-border)' : 'var(--border-strong)',
                }}
                onClick={() => setFilter(k.id)}>
                <Icon name={k.icon} size={12} /> {k.label}
              </button>
            ))}
          </div>
          <div className="row tight">
            <div className="tb-search" style={{ width: 200 }}>
              <Icon name="search" size={12} />
              <span style={{ fontSize: 12 }}>搜索素材…</span>
            </div>
            <button className="btn ghost"><Icon name="sort" size={13} /></button>
          </div>
        </div>

        <div className="g4" style={{ alignItems: 'stretch' }}>
          {items.map(it => <LibCard key={it.id} item={it} />)}
        </div>
      </div>
    </div>
  );
};

function LibCard({ item }) {
  const colors = {
    script: ['oklch(0.92 0.05 258)','oklch(0.84 0.08 258)'],
    topic:  ['oklch(0.94 0.05 70)','oklch(0.86 0.1 70)'],
    hook:   ['oklch(0.92 0.06 25)','oklch(0.84 0.12 25)'],
    image:  ['oklch(0.93 0.05 152)','oklch(0.84 0.1 152)'],
  }[item.kind];
  const kindLabel = { script: '脚本', topic: '选题', hook: '钩子', image: '图片素材' }[item.kind];
  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        aspectRatio: '4/3',
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        padding: 14, position: 'relative',
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="row between">
          <Chip>{kindLabel}</Chip>
          {item.fav ? <Icon name="starF" size={14} style={{ color: 'oklch(0.72 0.14 70)' }} /> : <Icon name="star" size={14} className="muted" />}
        </div>
        <div style={{ marginTop: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(0,0,0,0.4)', textAlign: 'right' }}>
          {item.kind === 'image' ? 'IMAGE' : item.kind === 'script' ? 'SCRIPT' : item.kind === 'topic' ? 'TOPIC' : 'HOOK'}
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.4, minHeight: 34 }}>{item.title}</div>
        <div className="row tight" style={{ marginTop: 6, flexWrap: 'wrap', gap: 4 }}>
          {item.tags.map(t => <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>)}
        </div>
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="muted" style={{ fontSize: 11 }}>使用 {item.uses} 次</span>
          <span className="muted mono" style={{ fontSize: 11 }}>{item.updated}</span>
        </div>
      </div>
    </div>
  );
}

TL.Library = Library;
window.Library = Library;
