// 潮线 Tideline · Shared UI primitives
// All components are written as inline-SVG icons (no hand-drawn imagery).
// Each Icon path is a simple stroke-only line icon (Lucide-style).

window.TL = window.TL || {};

// ---- Icon registry ---------------------------------------------------------
// Each entry is the inner content of a 24×24 viewBox SVG.
TL.icons = {
  home: '<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 4h14l2 9v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  chevL: '<path d="m15 6-6 6 6 6"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  filter: '<path d="M3 4h18l-7 9v6l-4 2v-8z"/>',
  sort: '<path d="M3 6h13M3 12h9M3 18h5"/><path d="m17 9 4 4-4 4"/><path d="M21 13H10"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
  // nav
  workflow: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h8a3 3 0 0 1 3 3v6"/><circle cx="18" cy="6" r="1.5"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 14 3-3 3 3 5-6"/>',
  sparkle: '<path d="m12 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 14v4M17 16h4"/>',
  library: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="m12 12 5-5"/>',
  pen: '<path d="m16 3 5 5L8 21H3v-5z"/>',
  team: '<circle cx="9" cy="9" r="3"/><path d="M3 19a6 6 0 0 1 12 0"/><circle cx="17" cy="7" r="2.5"/><path d="M21 17a4 4 0 0 0-5-3.9"/>',
  // status
  check: '<path d="m5 12 5 5L20 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  zap: '<path d="m13 2-10 12h7l-1 8 10-12h-7z"/>',
  star: '<path d="m12 3 2.7 5.6 6.3.9-4.5 4.4 1 6.1-5.5-2.9-5.5 2.9 1-6.1L3 9.5l6.3-.9z"/>',
  starF: '<path d="m12 3 2.7 5.6 6.3.9-4.5 4.4 1 6.1-5.5-2.9-5.5 2.9 1-6.1L3 9.5l6.3-.9z" fill="currentColor"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  paperclip: '<path d="m21 11-9.5 9.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5L9.5 18.5a2 2 0 0 1-3-3L16 6"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  play: '<path d="m6 4 14 8-14 8z"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  live: '<circle cx="12" cy="12" r="3"/><path d="M16.5 7.5a6 6 0 0 1 0 9M7.5 16.5a6 6 0 0 1 0-9M19.5 4.5a10 10 0 0 1 0 15M4.5 19.5a10 10 0 0 1 0-15"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2 13h13l2-9H6"/>',
  tag: '<path d="M20 12 12 20a2 2 0 0 1-3 0L2 13V3h10z"/><circle cx="7" cy="8" r="1.5"/>',
  trending: '<path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  arrowR: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  command: '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/>',
  wallet: '<path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1"/><path d="M22 13h-5a2 2 0 0 0 0 4h5z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  workflow2: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="9" width="6" height="6" rx="1"/><path d="M9 6h3a3 3 0 0 1 3 3v0M9 18h3a3 3 0 0 0 3-3"/>',
};

TL.Icon = function Icon({ name, size = 16, className = '', style = {}, stroke = 1.5 }) {
  const path = TL.icons[name];
  if (!path) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
};

const Icon = TL.Icon;

// ---- Avatar -----------------------------------------------------------------
TL.Avatar = function Avatar({ user, size = 'md' }) {
  const u = typeof user === 'string' ? TL.userById(user) : user;
  if (!u) return null;
  const cls = `av ${size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : ''} ${u.av || ''}`;
  return <span className={cls} title={u.name}>{u.initial}</span>;
};

TL.AvatarStack = function AvatarStack({ users, max = 4 }) {
  const list = users.slice(0, max).map(u => typeof u === 'string' ? TL.userById(u) : u).filter(Boolean);
  const more = users.length - list.length;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: 6 }}>
      {list.map((u, i) => (
        <span key={u.id} className={`av sm ${u.av} ${i ? 'stack' : ''}`}>{u.initial}</span>
      ))}
      {more > 0 && <span className="av sm stack" style={{ background: 'var(--bg-subtle)' }}>+{more}</span>}
    </span>
  );
};

// ---- Chip / Tag -------------------------------------------------------------
TL.Chip = function Chip({ tone = 'default', dot = false, children }) {
  const cls = `chip ${dot ? 'dot' : ''} ${tone}`;
  return <span className={cls}>{children}</span>;
};

// ---- Sparkline (SVG, polyline only) -----------------------------------------
TL.Sparkline = function Sparkline({ data, width = 120, height = 32, color = 'var(--accent)', fill = true }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((d, i) => [i * stepX, height - ((d - min) / range) * (height - 4) - 2]);
  const line = points.map(p => p.join(',')).join(' ');
  const area = `${line} ${width},${height} 0,${height}`;
  return (
    <svg width={width} height={height} className="sparkline" viewBox={`0 0 ${width} ${height}`}>
      {fill && <polygon points={area} fill={color} opacity="0.08" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ---- Bar chart --------------------------------------------------------------
TL.BarChart = function BarChart({ data, labels, width = 520, height = 180, color = 'var(--accent)' }) {
  const max = Math.max(...data) * 1.1;
  const padL = 32, padB = 22, padT = 8, padR = 8;
  const innerW = width - padL - padR;
  const innerH = height - padB - padT;
  const bw = innerW / data.length * 0.62;
  const gap = innerW / data.length;
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(p => ({ y: padT + innerH * (1 - p), v: Math.round(max * p) }));
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padL} y1={g.y} x2={width - padR} y2={g.y} stroke="var(--divider)" strokeWidth="1" />
          <text x={padL - 6} y={g.y + 3} fontSize="9.5" fill="var(--text-subtle)" textAnchor="end" fontFamily="var(--font-mono)">{g.v}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const h = (d / max) * innerH;
        const x = padL + i * gap + (gap - bw) / 2;
        const y = padT + innerH - h;
        return <rect key={i} x={x} y={y} width={bw} height={h} fill={color} rx="2" />;
      })}
      {labels && labels.map((l, i) => (
        <text key={i} x={padL + i * gap + gap / 2} y={height - 6} fontSize="9.5" fill="var(--text-muted)" textAnchor="middle" fontFamily="var(--font-mono)">{l}</text>
      ))}
    </svg>
  );
};

// ---- Line chart -------------------------------------------------------------
TL.LineChart = function LineChart({ series, labels, width = 560, height = 200, colors = ['var(--c1)','var(--c2)','var(--c3)'], fill = true }) {
  const all = series.flatMap(s => s.data);
  const max = Math.max(...all) * 1.08;
  const min = Math.min(0, Math.min(...all));
  const range = max - min || 1;
  const padL = 36, padB = 22, padT = 8, padR = 12;
  const innerW = width - padL - padR;
  const innerH = height - padB - padT;
  const n = series[0].data.length;
  const stepX = innerW / (n - 1);
  const toPt = (d, i) => [padL + i * stepX, padT + innerH - ((d - min) / range) * innerH];
  const grid = [0, 0.25, 0.5, 0.75, 1].map(p => ({ y: padT + innerH * (1 - p), v: (max * p).toFixed(0) }));
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {grid.map((g, i) => (
        <g key={i}>
          <line x1={padL} y1={g.y} x2={width - padR} y2={g.y} stroke="var(--divider)" strokeWidth="1" />
          <text x={padL - 6} y={g.y + 3} fontSize="9.5" fill="var(--text-subtle)" textAnchor="end" fontFamily="var(--font-mono)">{g.v}</text>
        </g>
      ))}
      {labels && labels.map((l, i) => i % Math.ceil(n/7) === 0 && (
        <text key={i} x={padL + i * stepX} y={height - 6} fontSize="9.5" fill="var(--text-muted)" textAnchor="middle" fontFamily="var(--font-mono)">{l}</text>
      ))}
      {series.map((s, si) => {
        const c = colors[si % colors.length];
        const pts = s.data.map(toPt);
        const line = pts.map(p => p.join(',')).join(' ');
        const area = `${line} ${pts[pts.length-1][0]},${padT+innerH} ${pts[0][0]},${padT+innerH}`;
        return (
          <g key={si}>
            {fill && <polygon points={area} fill={c} opacity="0.08" />}
            <polyline points={line} fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.2" fill="var(--bg-elevated)" stroke={c} strokeWidth="1.5" />)}
          </g>
        );
      })}
    </svg>
  );
};

// ---- Donut ------------------------------------------------------------------
TL.Donut = function Donut({ data, size = 120, thickness = 18 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const r = size/2 - thickness/2;
  const C = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-subtle)" strokeWidth={thickness} />
      {data.map((d, i) => {
        const seg = (d.value / total) * C;
        const off = (acc / total) * C;
        acc += d.value;
        return (
          <circle key={i}
            cx={size/2} cy={size/2} r={r}
            fill="none" stroke={d.color} strokeWidth={thickness}
            strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-off}
          />
        );
      })}
    </svg>
  );
};

// ---- Section title ---------------------------------------------------------
TL.SectionTitle = function SectionTitle({ title, sub, actions }) {
  return (
    <div className="row between" style={{ marginBottom: 12, marginTop: 4 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
        {sub && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
      {actions && <div className="row tight">{actions}</div>}
    </div>
  );
};

Object.assign(window, {
  Icon: TL.Icon,
  Avatar: TL.Avatar,
  AvatarStack: TL.AvatarStack,
  Chip: TL.Chip,
  Sparkline: TL.Sparkline,
  BarChart: TL.BarChart,
  LineChart: TL.LineChart,
  Donut: TL.Donut,
  SectionTitle: TL.SectionTitle,
});
