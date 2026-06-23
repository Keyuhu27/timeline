// 潮线 Tideline · App shell

const { useState, useEffect } = React;

// 导航分组：工作台不再平铺，按职能分 4 组
const NAV_GROUPS = [
  {
    id: 'workflow',
    label: '工作流',
    items: [
      { id: 'home',     label: '工作流首页', icon: 'workflow' },
      { id: 'data',     label: '数据分析',   icon: 'chart' },
    ],
  },
  {
    id: 'content',
    label: '内容 & 投放',
    items: [
      { id: 'aiVideo',  label: 'AI 视频工作台', icon: 'sparkle', badge: 'AI' },
      { id: 'aiCopy',   label: 'AI 文案/标题', icon: 'pen' },
      { id: 'library',  label: '内容素材库',   icon: 'library' },
      { id: 'ads',      label: '千川投流',     icon: 'target' },
      { id: 'monitor',  label: '竞品/达人监控', icon: 'radar' },
    ],
  },
  {
    id: 'biz',
    label: '经营',
    items: [
      { id: 'products', label: '选品中心', icon: 'cart' },
      { id: 'finance',  label: '结算中心', icon: 'wallet' },
    ],
  },
  {
    id: 'org',
    label: '组织',
    items: [
      { id: 'team',     label: '团队 & 权限', icon: 'team' },
    ],
  },
];

const NAV_BY_ID = NAV_GROUPS.flatMap(g => g.items).reduce((m, it) => (m[it.id] = it, m), {});

// 显示所有品牌（动态从 TL.brands 读取）
const PINNED_BRANDS = null; // null = 显示全部

const DEFAULT_MODULE_ORDER = ['today', 'campaigns', 'activityLogs', 'aiDecisions'];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "homeOrder": ["today", "campaigns", "activityLogs", "aiDecisions"]
}/*EDITMODE-END*/;

function App() {
  const [view, setView] = useState('home');
  const [dataSubView, setDataSubView] = useState('overview');
  const [brandId, setBrandId] = useState(null);
  const [task, setTask] = useState(null);
  const [live, setLive] = useState(null);
  // 直播大屏：独立全屏覆盖层，不占用工作区版心
  const [liveScreenOpen, setLiveScreenOpen] = useState(false);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // 侧边栏品牌列表（响应式，API 加载后更新）
  const [brands, setBrands] = useState(TL.brands || []);
  useEffect(() => {
    TL._loadFromApi().then(() => setBrands([...TL.brands]));
    const onUpdate = () => setBrands([...TL.brands]);
    window.addEventListener('tl:brands-updated', onUpdate);
    return () => window.removeEventListener('tl:brands-updated', onUpdate);
  }, []);

  useEffect(() => {
    if (!Array.isArray(tweaks.homeOrder) || tweaks.homeOrder.length === 0) {
      setTweak('homeOrder', DEFAULT_MODULE_ORDER);
    }
  }, []);

  // 面包屑：动态合成"组 › 视图"，子视图自定义
  const groupOf = (id) => NAV_GROUPS.find(g => g.items.some(it => it.id === id));
  const navItem = NAV_BY_ID[view];
  const baseCrumb = navItem ? [groupOf(view).label, navItem.label] : ['工作台'];

  const breadcrumb = {
    data: ['工作流', '数据分析', { overview: '总览', accounts: '账号分析', lives: '直播数据', content: '内容数据', traffic: '流量来源', reports: '日报中心' }[dataSubView]],
    aiVideo: ['内容 & 投放', 'AI 视频工作台', '会话 · #4128'],
    aiCopy: ['内容 & 投放', 'AI 文案/标题', '基础模板'],
    brandDetail: ['工作流', '在管品牌', TL.displayBrandName(TL.brandById && TL.brandById(brandId), (TL.accounts || []).find(a => a.brand === brandId))],
  }[view] || baseCrumb;

  return (
    <div className="app" data-screen-label={`${view}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sb-brand">
          <div className="sb-brand-mark">潮</div>
          <span className="sb-brand-name">潮线</span>
          <span className="sb-brand-sub">v3.2</span>
        </div>
        <div className="sb-org">
          <div className="sb-org-logo">潮</div>
          <div className="col tight grow">
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>潮线本地推</span>
            <span className="muted" style={{ fontSize: 10.5 }}>{brands.length} 品牌 · {(TL.accounts || []).length} 账户</span>
          </div>
          <Icon name="chevD" size={12} className="muted" />
        </div>

        {NAV_GROUPS.map(group => (
          <React.Fragment key={group.id}>
            <div className="sb-section-title">{group.label}</div>
            {group.items.map(n => (
              <div key={n.id}
                   className={`sb-item ${view === n.id ? 'active' : ''}`}
                   onClick={() => setView(n.id)}>
                <Icon name={n.icon} size={15} className="sb-item-icon" />
                <span>{n.label}</span>
                {n.badge && <span className="sb-item-badge">{n.badge}</span>}
              </div>
            ))}
          </React.Fragment>
        ))}

        <div className="sb-section-title">在管品牌</div>
        {brands.map(b => {
          const acc = (TL.accounts || []).find(a => a.brand === b.id);
          const name = TL.displayBrandName(b, acc);
          return (
            <div key={b.id} className={`sb-item ${view === 'brandDetail' && brandId === b.id ? 'active' : ''}`}
                 onClick={() => { setBrandId(b.id); setView('brandDetail'); }} style={{ cursor: 'pointer' }}>
              <span style={{ width: 15, height: 15, borderRadius: 4, background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600 }}>{b.logo || name.slice(0, 1)}</span>
              <span>{name}</span>
            </div>
          );
        })}
        <div className="sb-item muted">
          <Icon name="plus" size={15} className="sb-item-icon" />
          <span>添加品牌</span>
        </div>

        <div className="sb-bottom">
          <div className="sb-item">
            <Icon name="settings" size={15} className="sb-item-icon" />
            <span>设置</span>
          </div>
          <div className="sb-item">
            <Avatar user="u1" size="sm" />
            <div className="col tight grow">
              <span style={{ fontSize: 12.5 }}>陈思远</span>
              <span className="muted" style={{ fontSize: 10.5 }}>主理人</span>
            </div>
            <Icon name="chevR" size={12} className="muted" />
          </div>
        </div>
      </aside>

      {/* Workspace */}
      <main className="workspace">
        <header className="topbar">
          <div className="crumb">
            {breadcrumb.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <Icon name="chevR" size={10} className="crumb-sep" />}
                <span className={i === breadcrumb.length - 1 ? 'crumb-current' : ''}>{c}</span>
              </React.Fragment>
            ))}
          </div>
          <div className="tb-spacer" />
          {/* 数据-直播数据视图下，提供"打开实时大屏"快捷入口 */}
          {(view === 'data' && dataSubView === 'lives') && (
            <button className="tb-btn outline" onClick={() => setLiveScreenOpen(true)}>
              <Icon name="live" size={13} /> 实时大屏
            </button>
          )}
          <div className="tb-search">
            <Icon name="search" size={12} />
            <span>搜索任务、素材、达人…</span>
            <kbd>⌘K</kbd>
          </div>
          <button className="tb-btn"><Icon name="bell" size={14} /></button>
          <button className="tb-btn"><Icon name="inbox" size={14} /></button>
          <button className="tb-btn outline"><Icon name="sparkle" size={13} /> Ask Tide</button>
        </header>

        {view === 'home' && <Home moduleOrder={tweaks.homeOrder || DEFAULT_MODULE_ORDER} openTask={setTask} />}

        {view === 'data' && <Data subView={dataSubView} setSubView={setDataSubView} openLive={setLive} />}
        {view === 'brandDetail' && <BrandDetail brandId={brandId} onBack={() => setView('home')} />}
        {view === 'aiVideo' && <AiVideo />}
        {view === 'aiCopy' && <AiCopy />}
        {view === 'library' && <Library />}
        {view === 'schedule' && <Schedule />}
        {view === 'monitor' && <Monitor />}
        {view === 'ads' && <Ads />}
        {view === 'products' && <Products />}
        {view === 'finance' && <Finance />}
        {view === 'team' && <Team />}
      </main>

      {task && <TaskDrawer task={task} onClose={() => setTask(null)} />}
      {live && <LiveDrawer live={live} onClose={() => setLive(null)} />}

      {/* 直播大屏全屏覆盖层 */}
      {liveScreenOpen && (
        <LiveScreenOverlay onClose={() => setLiveScreenOpen(false)} />
      )}

      <HomeTweaks tweaks={tweaks} setTweak={setTweak} />

      {/* 经营日报弹窗宿主（任意视图通过 TL.openDailyReport 打开）*/}
      <DailyReportHost />
    </div>
  );
}

// ---- LiveScreen 全屏覆盖层 ------------------------------------------------
// 把直播大屏作为独立的全屏体验呈现。支持 ESC 退出。
// 返回按钮放在顶部居中位置，避开 LiveScreen 自带的左上 logo 和右上结束按钮。
function LiveScreenOverlay({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'oklch(0.12 0.02 258)',
      overflow: 'auto',
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10000,
          padding: '5px 10px', borderRadius: 999,
          background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
          fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          backdropFilter: 'blur(8px)',
        }}>
        <Icon name="chevL" size={10} /> 返回工作台 <kbd style={{
          marginLeft: 4, padding: '0 5px', fontSize: 10,
          background: 'rgba(255,255,255,0.10)', borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>ESC</kbd>
      </button>
      <LiveScreen />
    </div>
  );
}

// ---- Tweaks panel for home module order -----------------------------------
function HomeTweaks({ tweaks, setTweak }) {
  const MOD_LABEL = {
    today: '今日数据卡',
    campaigns: '本地推计划表',
    activityLogs: '规则引擎动态',
    aiDecisions: 'AI 决策',
  };
  const order = tweaks.homeOrder || DEFAULT_MODULE_ORDER;
  const move = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const a = order.slice();
    [a[idx], a[target]] = [a[target], a[idx]];
    setTweak('homeOrder', a);
  };
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="首页模块顺序" desc="拖动或点击箭头调整工作流首页内 6 个模块的展示顺序。仅影响首页。">
        <div className="col tight">
          {order.map((id, i) => (
            <div key={id} className="row" style={{
              padding: '6px 8px',
              background: 'var(--bg-app, #F7F7F8)',
              border: '1px solid var(--border, #E7E7EA)',
              borderRadius: 6,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', width: 18 }}>{i+1}</span>
              <span style={{ fontSize: 12.5, flex: 1 }}>{MOD_LABEL[id]}</span>
              <button className="btn ghost icon sm" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="arrowUp" size={11} /></button>
              <button className="btn ghost icon sm" disabled={i === order.length - 1} onClick={() => move(i, 1)}><Icon name="arrowDown" size={11} /></button>
            </div>
          ))}
        </div>
        <button className="btn ghost sm mt-sm" onClick={() => setTweak('homeOrder', DEFAULT_MODULE_ORDER)}>
          <Icon name="refresh" size={11} /> 恢复默认顺序
        </button>
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
