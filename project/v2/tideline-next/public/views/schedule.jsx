// 潮线 Tideline · 排期与发布计划

const Schedule = function Schedule() {
  const today = 11;
  const monthStart = new Date(2026, 4, 1);
  const offset = (monthStart.getDay() + 6) % 7; // mon = 0
  const days = [];
  // prev month tail
  for (let i = offset; i > 0; i--) days.push({ d: 30 - i + 1, out: true });
  for (let i = 1; i <= 31; i++) days.push({ d: i, out: false });
  while (days.length % 7 !== 0) days.push({ d: days.length - 31 - offset + 1, out: true });

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">排期与发布计划</h1>
            <p className="page-sub">2026 年 5 月 · 5 个账号 · 含 12 条视频 · 8 场直播</p>
          </div>
          <div className="page-actions">
            <div className="row tight">
              <button className="btn icon"><Icon name="chevL" size={13} /></button>
              <span className="mono" style={{ fontSize: 12.5, width: 70, textAlign: 'center' }}>2026 / 05</span>
              <button className="btn icon"><Icon name="chevR" size={13} /></button>
            </div>
            <select className="select" style={{ width: 'auto' }} defaultValue="all">
              <option value="all">全部账号</option>
              {TL.accounts.map(a => <option key={a.id}>{a.name}</option>)}
            </select>
            <button className="btn primary"><Icon name="plus" size={13} /> 新建排期</button>
          </div>
        </div>

        <div className="row tight" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <span className="chip"><span className="cal-evt t-video" style={{ width: 10, height: 10, padding: 0 }} /> 视频</span>
          <span className="chip"><span className="cal-evt t-livestream" style={{ width: 10, height: 10, padding: 0 }} /> 直播</span>
          <span className="chip"><span className="cal-evt t-image" style={{ width: 10, height: 10, padding: 0 }} /> 图文</span>
          <span className="chip"><span className="cal-evt t-event" style={{ width: 10, height: 10, padding: 0 }} /> 节点/活动</span>
        </div>

        <div className="cal-grid">
          {['周一','周二','周三','周四','周五','周六','周日'].map(d => <div key={d} className="cal-h">{d}</div>)}
          {days.map((day, i) => {
            const evts = day.out ? [] : TL.schedule.filter(e => e.day === day.d);
            const isToday = !day.out && day.d === today;
            return (
              <div key={i} className={`cal-cell ${day.out ? 'out' : ''} ${isToday ? 'today' : ''}`}>
                <div className="row between">
                  <span className="d mono">{day.d}</span>
                  {evts.length > 0 && <span className="muted mono" style={{ fontSize: 10 }}>{evts.length}</span>}
                </div>
                {evts.slice(0, 3).map((e, ei) => (
                  <div key={ei} className={`cal-evt t-${e.type}`}>{e.time} · {e.label}</div>
                ))}
                {evts.length > 3 && <span className="muted" style={{ fontSize: 10 }}>+{evts.length-3} 项</span>}
              </div>
            );
          })}
        </div>

        <div className="g2 mt-md">
          <div className="card">
            <div className="card-h"><h3>本月发布节奏</h3><span className="chip">按账号</span></div>
            <div className="card-b col" style={{ gap: 10 }}>
              {TL.accounts.map(a => {
                const v = a.video7d * 4, l = a.live7d * 4;
                return (
                  <div key={a.id} className="row" style={{ fontSize: 12 }}>
                    <div className="row tight" style={{ width: 160 }}>
                      <span className={`av sm av-${a.color}`}>{a.name[0]}</span>
                      <span>{a.name}</span>
                    </div>
                    <div className="row tight grow">
                      {Array.from({ length: 31 }, (_, i) => {
                        const has = ((i*7) + a.id.charCodeAt(1)) % 4 === 0;
                        const live = ((i*5) + a.id.charCodeAt(1)) % 9 === 0;
                        return <div key={i} style={{
                          width: 6, height: 14,
                          background: live ? 'var(--danger)' : has ? 'var(--accent)' : 'var(--bg-subtle)',
                          opacity: live || has ? 0.85 : 1,
                          marginRight: 1, borderRadius: 1
                        }} />;
                      })}
                    </div>
                    <span className="mono muted" style={{ fontSize: 11, width: 60, textAlign: 'right' }}>{v}视/{l}播</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3>未发布队列</h3><span className="chip">5 项待审 · 8 项排期中</span></div>
            <div style={{ padding: 4 }}>
              {[
                { acc: 'a1', title: '青朴 · 9月主推 v2', when: '5/11 18:00', s: '待审核' },
                { acc: 'a2', title: '林野直播预告片', when: '5/12 11:00', s: '已排期' },
                { acc: 'a4', title: '云杉防晒衣剧情', when: '5/15 12:00', s: '剪辑中' },
                { acc: 'a5', title: '北麓 N1 开箱测评', when: '5/16 18:30', s: '脚本中' },
                { acc: 'a3', title: '小鹿测评图文', when: '5/12 14:00', s: '已排期' },
              ].map((q, i) => {
                const a = TL.accountById(q.acc);
                return (
                  <div key={i} className="row" style={{ padding: '8px 12px', borderBottom: i < 4 ? '1px solid var(--divider)' : 'none' }}>
                    <span className={`av sm av-${a.color}`}>{a.name[0]}</span>
                    <div className="col tight grow">
                      <span style={{ fontSize: 12.5 }}>{q.title}</span>
                      <span className="muted mono" style={{ fontSize: 11 }}>{q.when}</span>
                    </div>
                    <Chip tone={q.s === '待审核' ? 'warn' : q.s === '剪辑中' ? 'info' : 'default'} dot>{q.s}</Chip>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

TL.Schedule = Schedule;
window.Schedule = Schedule;
