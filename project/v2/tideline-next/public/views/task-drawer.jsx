// 潮线 Tideline · Task detail drawer

const TaskDrawer = function TaskDrawer({ task, onClose }) {
  if (!task) return null;
  const b = TL.brandById(task.brand);
  const u = TL.userById(task.assignee);
  const stage = TL.stages.find(s => s.id === task.stage);
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-h">
          <Chip>{b?.name}</Chip>
          <Chip tone="default" dot>{stage?.name}</Chip>
          <span className="muted mono" style={{ fontSize: 11, marginLeft: 'auto' }}>{task.id}</span>
          <button className="btn ghost icon" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="drawer-b">
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8 }}>{task.title}</div>
          <div className="row tight">
            <Chip tone={task.priority === 'high' ? 'danger' : task.priority === 'med' ? 'warn' : 'default'}>
              {task.priority === 'high' ? 'P1 · 高优' : task.priority === 'med' ? 'P2 · 中' : 'P3 · 低'}
            </Chip>
            <span className="muted" style={{ fontSize: 11.5 }}><Icon name="clock" size={11} /> {task.due}</span>
          </div>

          <div className="divider" />

          <div className="g2" style={{ gap: 10 }}>
            <FieldRow label="负责人">
              <div className="row tight"><Avatar user={u} size="sm" /> <span style={{ fontSize: 12.5 }}>{u.name}</span><span className="muted" style={{ fontSize: 11 }}>· {u.role}</span></div>
            </FieldRow>
            <FieldRow label="协作">
              <AvatarStack users={['u1', 'u3', 'u5']} />
            </FieldRow>
            <FieldRow label="账号">
              <div className="row tight">
                <span className={`av sm av-c4`}>云</span>
                <span style={{ fontSize: 12.5 }}>云杉运动 OUTDOOR</span>
              </div>
            </FieldRow>
            <FieldRow label="计划发布"><span style={{ fontSize: 12.5 }} className="mono">2026/05/15 12:00</span></FieldRow>
            <FieldRow label="AI 综合评分">
              <div className="row tight">
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{task.score}</span>
                <div className="bar" style={{ width: 80 }}><div style={{ width: `${task.score}%` }} /></div>
              </div>
            </FieldRow>
            <FieldRow label="预估 GMV"><span style={{ fontSize: 12.5 }} className="mono">¥ 32,000 - 58,000</span></FieldRow>
          </div>

          <div className="divider" />

          <div className="row between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>子任务 · 4 / 6 完成</span>
            <button className="btn ghost sm"><Icon name="plus" size={12} /> 子任务</button>
          </div>
          <div className="col tight">
            {[
              { t: '确定卖点 + 目标人群', d: true, who: 'u1' },
              { t: '撰写脚本 v1', d: true, who: 'u2' },
              { t: '脚本评审', d: true, who: 'u1' },
              { t: '拍摄 / AI 生成', d: true, who: 'u3' },
              { t: '剪辑 v1', d: false, who: 'u3' },
              { t: '主理人审核 + 发布', d: false, who: 'u1' },
            ].map((s, i) => (
              <div key={i} className="row" style={{ padding: '6px 0', borderBottom: i < 5 ? '1px solid var(--divider)' : 'none' }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 4,
                  border: '1.5px solid ' + (s.d ? 'var(--success)' : 'var(--border-strong)'),
                  background: s.d ? 'var(--success)' : 'transparent',
                  display: 'grid', placeItems: 'center', color: 'white'
                }}>{s.d && <Icon name="check" size={9} />}</span>
                <span style={{ fontSize: 12.5, flex: 1, textDecoration: s.d ? 'line-through' : 'none', color: s.d ? 'var(--text-muted)' : 'var(--text)' }}>{s.t}</span>
                <Avatar user={s.who} size="sm" />
              </div>
            ))}
          </div>

          <div className="divider" />

          <span style={{ fontSize: 13, fontWeight: 600 }}>动态</span>
          <div className="col" style={{ marginTop: 10, gap: 14 }}>
            {[
              { who: 'u2', t: '已提交脚本 v2 给评审', when: '今天 10:24', body: '主要调整：开头钩子换成"凉感对比"，结尾加入了价格锚点。' },
              { who: 'u1', t: '评论了脚本', when: '今天 10:30', body: '钩子改得不错。结尾的价格锚点可以再短促一点，3 秒内交代。' },
              { who: 'u3', t: 'AI 生成了 3 条分镜', when: '昨天 18:42', body: null },
              { who: 'u2', t: '提交了脚本 v1', when: '昨天 14:18', body: null },
            ].map((c, i) => {
              const usr = TL.userById(c.who);
              return (
                <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
                  <Avatar user={usr} size="sm" />
                  <div className="grow">
                    <div className="row tight">
                      <b style={{ fontSize: 12.5, fontWeight: 600 }}>{usr.name}</b>
                      <span className="muted" style={{ fontSize: 11 }}>{c.t}</span>
                      <span className="muted mono" style={{ fontSize: 10.5, marginLeft: 'auto' }}>{c.when}</span>
                    </div>
                    {c.body && <div style={{
                      fontSize: 12.5, marginTop: 4, padding: '6px 10px',
                      background: 'var(--bg-app)', borderRadius: 6, border: '1px solid var(--divider)'
                    }}>{c.body}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="drawer-f">
          <input className="input grow" placeholder="评论或 @ 同事…" />
          <button className="btn ghost icon"><Icon name="paperclip" size={13} /></button>
          <button className="btn primary"><Icon name="send" size={13} /></button>
        </div>
      </div>
    </>
  );
};

function FieldRow({ label, children }) {
  return (
    <div className="row" style={{ padding: '4px 0' }}>
      <span className="muted" style={{ width: 80, fontSize: 11.5 }}>{label}</span>
      {children}
    </div>
  );
}

TL.TaskDrawer = TaskDrawer;
window.TaskDrawer = TaskDrawer;
