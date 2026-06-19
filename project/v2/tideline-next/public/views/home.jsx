// 潮线 Tideline · 首页 — 任务/工作流
// Modules can be reordered via Tweaks.

window.TL = window.TL || {};

const Home = function Home({ moduleOrder, openTask }) {
  const modules = {
    today:    <TodayBlock key="today" />,
    kanban:   <KanbanBlock key="kanban" openTask={openTask} />,
    activity: <ActivityBlock key="activity" />,
    quickAi:  <QuickAiBlock key="quickAi" />,
    brands:   <BrandsBlock key="brands" />,
    schedule: <SchedulePeek key="schedule" />,
  };
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">早上好，思远</h1>
            <p className="page-sub">今天有 <b style={{color:'var(--text)'}}>7</b> 个待办，2 场直播预计于今天 19:30 起开播。</p>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="filter" size={13} /> 筛选</button>
            <button className="btn primary"><Icon name="plus" size={13} /> 新建任务</button>
          </div>
        </div>

        {moduleOrder.map(key => modules[key]).filter(Boolean)}
      </div>
    </div>
  );
};

function TodayBlock() {
  const stats = [
    { label: '今日待办', value: 7, sub: '其中 3 项截止于今天', icon: 'inbox', delta: null },
    { label: '本周已发布', value: 18, sub: '视频 12 · 图文 4 · 直播 2', icon: 'check', delta: '+24%' },
    { label: '本周 GMV', value: '¥ 28.4 万', sub: '5 个账号合计', icon: 'cart', delta: '+12.6%' },
    { label: '生成中的视频', value: 4, sub: 'AI 工作台运行中', icon: 'sparkle', delta: null },
  ];
  return (
    <section style={{ marginBottom: 20 }}>
      <div className="stat-row">
        {stats.map((s, i) => (
          <div className="stat" key={i}>
            <div className="stat-label"><Icon name={s.icon} size={13} /> {s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={`stat-delta ${s.delta && s.delta[0] === '+' ? 'up' : ''}`}>
              {s.delta ? <><Icon name="arrowUp" size={10} /> {s.delta} vs 上周 · </> : null}{s.sub}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function KanbanBlock({ openTask }) {
  const stages = TL.stages;
  const grouped = stages.map(s => ({ ...s, tasks: TL.tasks.filter(t => t.stage === s.id) }));
  return (
    <section style={{ marginBottom: 24 }}>
      <SectionTitle
        title="工作流看板"
        sub="按阶段查看 · 全部品牌"
        actions={<>
          <button className="btn ghost sm"><Icon name="sort" size={12} /> 排序</button>
          <button className="btn ghost sm"><Icon name="more" size={12} /></button>
        </>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {grouped.map(stage => (
          <div className="kb-col" key={stage.id}>
            <div className="kb-col-head">
              <span className="dot" style={{ background: stage.color }} />
              {stage.name}
              <span style={{ marginLeft: 'auto' }} className="muted mono">{stage.tasks.length}</span>
              <button className="btn ghost icon sm"><Icon name="plus" size={11} /></button>
            </div>
            {stage.tasks.map(t => (
              <KanbanCard key={t.id} task={t} onClick={() => openTask(t)} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function KanbanCard({ task, onClick }) {
  const b = TL.brandById(task.brand);
  const u = TL.userById(task.assignee);
  const prTone = task.priority === 'high' ? 'danger' : task.priority === 'med' ? 'warn' : 'default';
  const prLabel = task.priority === 'high' ? 'P1' : task.priority === 'med' ? 'P2' : 'P3';
  return (
    <div className="kb-card" onClick={onClick}>
      <div className="row tight" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        <Icon name={task.cover === 'image' ? 'image' : task.cover === 'doc' ? 'fileText' : 'video'} size={12} />
        <span>{b?.name}</span>
        <Chip tone={prTone}>{prLabel}</Chip>
      </div>
      <div className="title">{task.title}</div>
      <div className="row between">
        <div className="row tight muted" style={{ fontSize: 11 }}>
          <Icon name="clock" size={11} /> {task.due}
        </div>
        <div className="row tight">
          {task.score && <span className="muted mono" style={{ fontSize: 11 }}>AI {task.score}</span>}
          <Avatar user={u} size="sm" />
        </div>
      </div>
    </div>
  );
}

function ActivityBlock() {
  return (
    <section style={{ marginBottom: 24 }}>
      <div className="g2">
        <div className="card">
          <div className="card-h">
            <Icon name="zap" size={14} />
            <h3>团队动态</h3>
            <div className="actions"><button className="btn ghost sm">全部</button></div>
          </div>
          <div className="card-b" style={{ padding: 0 }}>
            {TL.activity.map((a, i) => {
              const u = TL.userById(a.who);
              return (
                <div key={i} className="row" style={{ padding: '10px 16px', borderBottom: i < TL.activity.length-1 ? '1px solid var(--divider)' : 'none' }}>
                  <Avatar user={u} size="sm" />
                  <div style={{ fontSize: 12.5, flex: 1 }}>
                    <b style={{ fontWeight: 500 }}>{u.name}</b> <span className="muted">{a.what}</span> <span>{a.obj}</span>
                  </div>
                  <span className="muted mono" style={{ fontSize: 11 }}>{a.when}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <Icon name="trending" size={14} />
            <h3>本周节点 & 提醒</h3>
            <div className="actions"><span className="chip">5/12 · 周一</span></div>
          </div>
          <div className="card-b">
            <ReminderList />
          </div>
        </div>
      </div>
    </section>
  );
}

function ReminderList() {
  const items = [
    { tag: '今天', tone: 'danger', text: '青朴 · 9月主推脚本 v2 截稿 18:00', meta: '林玥' },
    { tag: '今天', tone: 'danger', text: '云杉防晒衣大场开播 19:30', meta: '苏念' },
    { tag: '明天', tone: 'warn', text: '林野直播脚本评审 10:00', meta: '陈思远 · 苏念' },
    { tag: '5/14', tone: 'default', text: '团队周会复盘 10:00', meta: '全员' },
    { tag: '5/17', tone: 'accent', text: '618 预热启动节点', meta: '全员' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((it, i) => (
        <div key={i} className="row" style={{ padding: '8px 0', borderBottom: i < items.length-1 ? '1px solid var(--divider)' : 'none' }}>
          <Chip tone={it.tone} dot>{it.tag}</Chip>
          <div className="grow" style={{ fontSize: 12.5 }}>{it.text}</div>
          <span className="muted" style={{ fontSize: 11 }}>{it.meta}</span>
        </div>
      ))}
    </div>
  );
}

function QuickAiBlock() {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{
        background: 'linear-gradient(135deg, oklch(0.97 0.02 258), oklch(0.97 0.02 200))',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--r-xl)',
        padding: '18px 20px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 16,
        alignItems: 'center',
      }}>
        <div>
          <div className="row tight" style={{ marginBottom: 6 }}>
            <Icon name="sparkle" size={14} style={{ color: 'var(--accent)' }} />
            <span className="chip accent">AI · 工作台</span>
            <span className="muted" style={{ fontSize: 11 }}>Beta · 模型 Tide-1.6</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>
            一句话生成可用素材
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            输入商品链接 / 卖点 / 目标人群，AI 会自动产出脚本、分镜、标题与可投放视频。
          </div>
          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 6 }}>
            {TL.aiSuggest.slice(0, 3).map((s, i) => (
              <button key={i} className="chip" style={{ cursor: 'pointer' }}>
                <Icon name="zap" size={10} /> {s.length > 28 ? s.slice(0, 28) + '…' : s}
              </button>
            ))}
          </div>
        </div>
        <div className="row tight">
          <button className="btn outline"><Icon name="library" size={13} /> 模板</button>
          <button className="btn primary"><Icon name="sparkle" size={13} /> 打开工作台</button>
        </div>
      </div>
    </section>
  );
}

function BrandsBlock() {
  return (
    <section style={{ marginBottom: 24 }}>
      <SectionTitle
        title="在管品牌"
        sub="5 个品牌 · 12 个抖音号在运营"
        actions={<button className="btn ghost sm"><Icon name="plus" size={12} /> 添加品牌</button>}
      />
      <div className="g3">
        {TL.brands.map(b => {
          const accs = TL.accounts.filter(a => a.brand === b.id);
          const gmv7 = accs.reduce((s, a) => s + a.gmv7d, 0);
          return (
            <div key={b.id} className="card" style={{ padding: 14 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  display: 'grid', placeItems: 'center',
                  fontWeight: 600, color: 'var(--text-secondary)'
                }}>{b.logo}</div>
                <div className="col tight grow">
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{b.cat} · {accs.length} 账号</div>
                </div>
                <button className="btn ghost icon"><Icon name="more" size={13} /></button>
              </div>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span className="muted" style={{ fontSize: 11 }}>7日 GMV</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>¥ {TL.fmtMoney(gmv7)}</span>
              </div>
              <Sparkline data={TL.gmvTrend.slice(-10).map((v, i) => v + i * (b.id === 'b4' ? 4 : 1))} width={300} height={28} />
            </div>
          );
        })}
        <div className="card" style={{ padding: 14, display: 'grid', placeItems: 'center', color: 'var(--text-muted)', minHeight: 116, border: '1px dashed var(--border-strong)', boxShadow: 'none' }}>
          <div className="col" style={{ alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={18} />
            <span style={{ fontSize: 12 }}>添加新品牌</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SchedulePeek() {
  const days = ['一','二','三','四','五','六','日'];
  const today = 11; // visualize as today
  return (
    <section style={{ marginBottom: 24 }}>
      <SectionTitle
        title="本周排期速览"
        sub="5月12日 - 5月18日"
        actions={<button className="btn ghost sm"><Icon name="calendar" size={12} /> 打开日历</button>}
      />
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((d, i) => {
            const dayNum = 12 + i;
            const evts = TL.schedule.filter(e => e.day === dayNum);
            const isToday = dayNum === today + 1;
            return (
              <div key={i} style={{
                borderRight: i < 6 ? '1px solid var(--divider)' : 'none',
                padding: '10px 12px',
                minHeight: 130,
                background: isToday ? 'var(--accent-subtle)' : 'transparent'
              }}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>周{d}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text)' }}>{dayNum}</span>
                </div>
                <div className="col tight">
                  {evts.slice(0, 3).map((e, ei) => (
                    <div key={ei} className={`cal-evt t-${e.type}`} title={e.label}>{e.time} · {e.label}</div>
                  ))}
                  {evts.length > 3 && <div className="muted" style={{ fontSize: 10.5 }}>+ {evts.length - 3} 项</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

TL.Home = Home;
window.Home = Home;
