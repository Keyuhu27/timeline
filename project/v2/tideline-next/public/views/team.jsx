// 潮线 Tideline · 团队 & 权限

const Team = function Team() {
  const [tab, setTab] = React.useState('members');
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">团队 & 权限</h1>
            <p className="page-sub">南极星 MCN · 32 名成员 · 4 个角色</p>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="upload" size={13} /> 批量导入</button>
            <button className="btn primary"><Icon name="plus" size={13} /> 邀请成员</button>
          </div>
        </div>

        <div className="tabs">
          <div className={`tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>成员</div>
          <div className={`tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>角色与权限</div>
          <div className={`tab ${tab === 'workload' ? 'active' : ''}`} onClick={() => setTab('workload')}>工作量看板</div>
          <div className={`tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>操作日志</div>
        </div>

        {tab === 'members' && <Members />}
        {tab === 'roles' && <Roles />}
        {tab === 'workload' && <Workload />}
        {tab === 'audit' && <Audit />}
      </div>
    </div>
  );
};

const MEMBERS = [
  { id: 'u1', name: '陈思远', email: 'chen@nanji.cn', role: '主理人 / Owner', dept: '管理层', brands: ['全部'], status: '在线', last: '5分钟前', av: 'av-c1', initial: '陈' },
  { id: 'u2', name: '林玥',   email: 'lin@nanji.cn',  role: '编导', dept: '内容', brands: ['青朴','云杉'], status: '在线', last: '刚才', av: 'av-c2', initial: '林' },
  { id: 'u3', name: '周一航', email: 'zhou@nanji.cn', role: '剪辑师', dept: '内容', brands: ['云杉','林野'], status: '在线', last: '12分钟前', av: 'av-c3', initial: '周' },
  { id: 'u4', name: '宋知夏', email: 'song@nanji.cn', role: '数据分析师', dept: '数据', brands: ['全部'], status: '离线', last: '昨天 18:20', av: 'av-c4', initial: '宋' },
  { id: 'u5', name: '苏念',   email: 'su@nanji.cn',   role: '直播运营', dept: '直播', brands: ['云杉','青朴'], status: '在线', last: '直播中', av: 'av-c5', initial: '苏' },
  { id: 'u6', name: '黎明',   email: 'li@nanji.cn',   role: '投放', dept: '投放', brands: ['全部'], status: '在线', last: '8分钟前', av: 'av-c6', initial: '黎' },
  { id: 'u7', name: '何雨彤', email: 'he@nanji.cn',   role: '编导', dept: '内容', brands: ['林野','小鹿'], status: '离线', last: '昨天 22:15', av: 'av-c1', initial: '何' },
  { id: 'u8', name: '罗子谦', email: 'luo@nanji.cn',  role: '商务', dept: '商务', brands: ['全部'], status: '在线', last: '32分钟前', av: 'av-c2', initial: '罗' },
];

function Members() {
  return (
    <div className="card">
      <div className="card-h">
        <h3>成员列表 · 32 人</h3>
        <div className="actions row tight">
          <div className="tb-search" style={{ width: 200 }}>
            <Icon name="search" size={12} /><span style={{ fontSize: 12 }}>姓名 / 邮箱…</span>
          </div>
          <select className="select" style={{ width: 'auto' }}><option>全部部门</option><option>内容</option><option>数据</option><option>直播</option><option>投放</option><option>商务</option></select>
          <select className="select" style={{ width: 'auto' }}><option>全部状态</option></select>
        </div>
      </div>
      <table className="tbl">
        <thead><tr><th>姓名</th><th>邮箱</th><th>角色</th><th>部门</th><th>授权品牌</th><th>状态</th><th></th></tr></thead>
        <tbody>
          {MEMBERS.map(m => (
            <tr key={m.id}>
              <td>
                <div className="row tight">
                  <span className={`av ${m.av}`}>{m.initial}</span>
                  <div className="col tight">
                    <span style={{ fontWeight: 500 }}>{m.name}</span>
                    <span className="muted" style={{ fontSize: 10.5 }}>{m.role}</span>
                  </div>
                </div>
              </td>
              <td className="mono" style={{ fontSize: 11.5 }}>{m.email}</td>
              <td>{m.role}</td>
              <td><Chip>{m.dept}</Chip></td>
              <td>
                <div className="row tight" style={{ flexWrap: 'wrap', gap: 4 }}>
                  {m.brands.map(b => <span key={b} className="chip" style={{ fontSize: 10 }}>{b}</span>)}
                </div>
              </td>
              <td>
                <div className="row tight">
                  <span className="dot" style={{ background: m.status === '在线' ? 'var(--success)' : m.status === '直播中' ? 'var(--danger)' : 'var(--text-subtle)' }} />
                  <span style={{ fontSize: 12 }}>{m.status === '直播中' ? <b style={{color:'var(--danger)'}}>直播中</b> : m.status}</span>
                  <span className="muted" style={{ fontSize: 11 }}>· {m.last}</span>
                </div>
              </td>
              <td className="row tight">
                <button className="btn ghost icon sm"><Icon name="msg" size={11} /></button>
                <button className="btn ghost icon sm"><Icon name="more" size={11} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Roles() {
  const roles = [
    { name: '主理人 / Owner', count: 1, color: 'var(--c4)', perms: { 'all': '管理员' } },
    { name: '主管 / Admin', count: 3, color: 'var(--c1)' },
    { name: '编导 / 剪辑',  count: 12, color: 'var(--c2)' },
    { name: '直播运营',    count: 5, color: 'var(--c3)' },
    { name: '数据 / 投放', count: 6, color: 'var(--c5)' },
    { name: '商务 / 选品', count: 4, color: 'var(--c6)' },
    { name: '访客 (只读)', count: 1, color: 'var(--text-subtle)' },
  ];
  const perms = [
    { k: '查看数据看板', vals: ['✓','✓','✓','✓','✓','✓','✓'] },
    { k: '查看 GMV / 收入', vals: ['✓','✓','—','—','✓','✓','—'] },
    { k: '创建/编辑任务', vals: ['✓','✓','✓','✓','—','✓','—'] },
    { k: '调用 AI 视频生成', vals: ['✓','✓','✓','—','—','—','—'] },
    { k: '编辑内容素材库', vals: ['✓','✓','✓','—','—','—','—'] },
    { k: '管理千川投流', vals: ['✓','✓','—','—','—','✓','—'] },
    { k: '管理寄样 / 商务', vals: ['✓','✓','—','—','—','✓','—'] },
    { k: '结算 / 提现', vals: ['✓','—','—','—','—','—','—'] },
    { k: '成员 / 权限管理', vals: ['✓','—','—','—','—','—','—'] },
  ];
  return (
    <div className="card">
      <div className="card-h"><h3>角色权限矩阵</h3><button className="btn sm"><Icon name="plus" size={11} /> 新建角色</button></div>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 200 }}>权限</th>
            {roles.map(r => (
              <th key={r.name} style={{ textAlign: 'center' }}>
                <div className="col tight" style={{ alignItems: 'center' }}>
                  <span className="dot" style={{ background: r.color, width: 8, height: 8 }} />
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.name}</span>
                  <span className="muted mono" style={{ fontSize: 10 }}>{r.count} 人</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {perms.map((p, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{p.k}</td>
              {p.vals.map((v, j) => (
                <td key={j} style={{ textAlign: 'center' }}>
                  {v === '✓' ? <Icon name="check" size={14} style={{ color: 'var(--success)' }} /> : <span className="muted">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Workload() {
  const items = MEMBERS.slice(0, 8).map((m, i) => ({
    ...m, doing: [4,7,3,2,5,3,6,2][i], done: [12,18,9,6,10,8,14,7][i], hours: [38,42,36,28,46,32,40,30][i],
    loadPct: [62, 92, 58, 38, 76, 52, 84, 48][i],
  }));
  return (
    <div className="g2">
      <div className="card">
        <div className="card-h"><h3>本周成员负载</h3></div>
        <div className="card-b col" style={{ gap: 10 }}>
          {items.map(m => (
            <div key={m.id} className="row" style={{ fontSize: 12.5 }}>
              <div className="row tight" style={{ width: 130 }}>
                <span className={`av sm ${m.av}`}>{m.initial}</span>
                <span>{m.name}</span>
              </div>
              <div className="bar grow" style={{ height: 10 }}>
                <div style={{
                  width: `${m.loadPct}%`,
                  background: m.loadPct >= 85 ? 'var(--danger)' : m.loadPct >= 70 ? 'var(--warning)' : 'var(--accent)'
                }} />
              </div>
              <span className="mono" style={{ width: 36, textAlign: 'right' }}>{m.loadPct}%</span>
              <span className="muted mono" style={{ width: 80, textAlign: 'right', fontSize: 11 }}>{m.hours}h / 40h</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h3>本周交付</h3></div>
        <table className="tbl">
          <thead><tr><th>成员</th><th className="num">进行中</th><th className="num">已完成</th><th className="num">投入工时</th><th className="num">质量分</th></tr></thead>
          <tbody>
            {items.map(m => (
              <tr key={m.id}>
                <td><div className="row tight"><span className={`av sm ${m.av}`}>{m.initial}</span><span>{m.name}</span></div></td>
                <td className="num mono">{m.doing}</td>
                <td className="num mono">{m.done}</td>
                <td className="num mono">{m.hours}h</td>
                <td className="num mono"><b style={{ color: 'var(--accent)' }}>{[88, 92, 84, 78, 96, 86, 90, 82][items.indexOf(m)]}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Audit() {
  const logs = [
    { who: 'u1', t: '修改了角色「投放」权限', when: '今天 14:32', ip: '116.62.x.x', detail: '+管理千川投流' },
    { who: 'u4', t: '导出了《4月数据报告》PDF', when: '今天 11:08', ip: '116.62.x.x', detail: '账号 a1, a4' },
    { who: 'u6', t: '暂停了 c05 计划', when: '今天 10:42', ip: '125.34.x.x', detail: 'ROI 1.56 触发预警' },
    { who: 'u8', t: '新增寄样申请 ×4', when: '今天 09:18', ip: '116.62.x.x', detail: '阿野的厨房、家有阿木 等' },
    { who: 'u1', t: '邀请了「罗子谦」加入', when: '昨天 18:24', ip: '116.62.x.x', detail: '角色 = 商务' },
    { who: 'u4', t: '查看了「云杉运动」结算明细', when: '昨天 17:08', ip: '116.62.x.x', detail: '账单 B202605-003' },
    { who: 'u2', t: 'AI 生成了 6 条分镜', when: '昨天 15:42', ip: '125.34.x.x', detail: '云杉防晒衣分镜' },
  ];
  return (
    <div className="card">
      <div className="card-h"><h3>操作日志</h3><div className="actions row tight"><select className="select" style={{ width: 'auto' }}><option>最近 7 天</option></select></div></div>
      <table className="tbl">
        <thead><tr><th>成员</th><th>操作</th><th>详情</th><th>IP</th><th>时间</th></tr></thead>
        <tbody>
          {logs.map((l, i) => {
            const u = TL.userById(l.who);
            return (
              <tr key={i}>
                <td><div className="row tight"><Avatar user={u} size="sm" /><span>{u.name}</span></div></td>
                <td>{l.t}</td>
                <td className="muted" style={{ fontSize: 12 }}>{l.detail}</td>
                <td className="mono muted" style={{ fontSize: 11.5 }}>{l.ip}</td>
                <td className="muted mono" style={{ fontSize: 11.5 }}>{l.when}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

TL.Team = Team;
window.Team = Team;
