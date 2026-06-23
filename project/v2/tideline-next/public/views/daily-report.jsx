// 潮线 Tideline · 经营日报（结构对齐运营手工日报，如「永和大王日报」）
// - 成交数据 / 核销数据：分板块（自播/达播/POI/短视频）表，平台回填「昨日」全域成交，
//   其余目标/历史/本月累计/核销为可编辑字段。
// - 直播板块明细：自播/达播 的 场次/GMV/时长/单小时GMV。
// - 文字备注：达播 / 官号 / 官号短视频。
// 可从品牌详情页、数据分析「日报中心」、AI 工作台自然语言三处打开（统一事件入口）。

window.TL = window.TL || {};

// 全局打开入口：任何视图都可调用 TL.openDailyReport(brandId, date?)
TL.openDailyReport = function (brandId, date) {
  const d = date || new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  window.dispatchEvent(new CustomEvent('tl:open-daily-report', { detail: { brandId, date: d } }));
};

(function () {
  const { useState, useEffect, useCallback } = React;
  const yi = (n) => (n >= 1e4 ? (n / 1e4).toFixed(1) + ' 万' : (n || 0).toLocaleString());
  const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) + '%' : '—');
  const dateLabel = (d) => { const [, m, dd] = d.split('-'); return `${+m}.${+dd}`; };

  // 可编辑数字单元格
  function NumCell({ value, onChange, readOnly, bold }) {
    if (readOnly) {
      return <td className="num" style={{ fontWeight: bold ? 600 : 400 }}>{(value || 0).toLocaleString()}</td>;
    }
    return (
      <td className="num" style={{ padding: 0 }}>
        <input
          type="number"
          value={value === 0 ? '' : value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          style={{
            width: '100%', border: 'none', background: 'transparent', textAlign: 'right',
            padding: '8px 10px', font: 'inherit', color: 'inherit', outline: 'none',
            MozAppearance: 'textfield',
          }}
        />
      </td>
    );
  }

  // 分板块成交/核销表
  function SectorTable({ title, rows, valueLabels, onRowChange, timeProgress, onTimeProgress, tone }) {
    const totals = rows.reduce(
      (s, r) => ({ history: s.history + r.history, yesterday: s.yesterday + r.yesterday, month: s.month + r.month, target: s.target + r.target }),
      { history: 0, yesterday: 0, month: 0, target: 0 },
    );
    return (
      <section style={{ marginBottom: 20 }}>
        <div style={{ background: tone, fontWeight: 600, textAlign: 'center', padding: '7px 0', borderRadius: '8px 8px 0 0', fontSize: 13 }}>{title}</div>
        <div className="card" style={{ borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 70 }}>板块</th>
                <th className="num">{valueLabels[0]}</th>
                <th className="num">{valueLabels[1]}</th>
                <th className="num">{valueLabels[2]}</th>
                <th className="num">目标</th>
                <th className="num">完成进度</th>
                <th className="num" style={{ width: 80 }}>时间进度</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td style={{ fontWeight: 500 }}>{r.label}</td>
                  <NumCell value={r.history}   onChange={(v) => onRowChange(i, 'history', v)} />
                  <NumCell value={r.yesterday} onChange={(v) => onRowChange(i, 'yesterday', v)} />
                  <NumCell value={r.month}     onChange={(v) => onRowChange(i, 'month', v)} />
                  <NumCell value={r.target}    onChange={(v) => onRowChange(i, 'target', v)} />
                  <td className="num" style={{ color: 'var(--text-muted)' }}>{pct(r.month, r.target)}</td>
                  {i === 0 && (
                    <td className="num" rowSpan={rows.length + 1} style={{ verticalAlign: 'middle', padding: 0 }}>
                      <input
                        type="number" value={timeProgress === 0 ? '' : timeProgress} placeholder="0"
                        onChange={(e) => onTimeProgress(e.target.value === '' ? 0 : Number(e.target.value))}
                        style={{ width: 56, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', textAlign: 'center', padding: '4px 2px', font: 'inherit', color: 'inherit' }}
                      />
                      <span style={{ marginLeft: 1 }}>%</span>
                    </td>
                  )}
                </tr>
              ))}
              <tr style={{ color: 'var(--danger, #d4380d)', fontWeight: 600 }}>
                <td>合计</td>
                <td className="num">{totals.history.toLocaleString()}</td>
                <td className="num">{totals.yesterday.toLocaleString()}</td>
                <td className="num">{totals.month.toLocaleString()}</td>
                <td className="num">{totals.target.toLocaleString()}</td>
                <td className="num">{pct(totals.month, totals.target)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // 直播板块明细
  function LiveDetailTable({ liveDetail, onChange }) {
    const cols = [
      { block: 'zibo', period: 'history',   label: '历史数据' },
      { block: 'zibo', period: 'yesterday', label: '昨日数据' },
      { block: 'zibo', period: 'month',     label: '本月数据' },
      { block: 'dabo', period: 'history',   label: '历史数据' },
      { block: 'dabo', period: 'yesterday', label: '昨日数据' },
      { block: 'dabo', period: 'month',     label: '本月数据' },
    ];
    const inp = (block, period, field) => {
      const v = liveDetail[block][period][field];
      return (
        <td className="num" style={{ padding: 0 }} key={block + period + field}>
          <input type="number" value={v === 0 ? '' : v} placeholder="0"
            onChange={(e) => onChange(block, period, field, e.target.value === '' ? 0 : Number(e.target.value))}
            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'right', padding: '8px 8px', font: 'inherit', color: 'inherit', outline: 'none' }} />
        </td>
      );
    };
    const hourGmv = (block, period) => {
      const c = liveDetail[block][period];
      return c.duration > 0 ? Math.round(c.gmv / c.duration).toLocaleString() : '/';
    };
    return (
      <section style={{ marginBottom: 20 }}>
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: 90 }}>项目</th>
                <th colSpan={3} style={{ textAlign: 'center', background: 'var(--bg-subtle)' }}>自播板块</th>
                <th colSpan={3} style={{ textAlign: 'center', background: 'var(--bg-subtle)' }}>达播板块</th>
              </tr>
              <tr>{cols.map((c, i) => <th key={i} className="num">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              <tr><td style={{ fontWeight: 500 }}>直播场次</td>{cols.map(c => inp(c.block, c.period, 'sessions'))}</tr>
              <tr><td style={{ fontWeight: 500 }}>直播GMV</td>{cols.map(c => inp(c.block, c.period, 'gmv'))}</tr>
              <tr><td style={{ fontWeight: 500 }}>直播时长(h)</td>{cols.map(c => inp(c.block, c.period, 'duration'))}</tr>
              <tr><td style={{ fontWeight: 500 }}>单小时GMV</td>{cols.map((c, i) => <td className="num" key={i} style={{ color: 'var(--text-muted)' }}>{hourGmv(c.block, c.period)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function NoteBlock({ label, value, onChange }) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 4 }}>{label}</div>
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
          placeholder={`填写${label}相关计划与进展…`}
          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 9px', font: 'inherit', resize: 'vertical', background: 'var(--bg-app, #fff)' }} />
      </div>
    );
  }

  // 生成纯文本（便于复制粘贴到群里）
  function toText(rep) {
    const L = [];
    L.push(`${rep.brandName}日报（${dateLabel(rep.date)}）`);
    const sectorText = (title, rows, labels) => {
      L.push(`\n【${title}】（${labels[1]} / ${labels[2]} / 目标 / 进度）`);
      rows.forEach(r => L.push(`· ${r.label}：${r.yesterday.toLocaleString()} / ${r.month.toLocaleString()} / ${r.target.toLocaleString()} / ${pct(r.month, r.target)}`));
      const t = rows.reduce((s, r) => ({ y: s.y + r.yesterday, m: s.m + r.month, tg: s.tg + r.target }), { y: 0, m: 0, tg: 0 });
      L.push(`· 合计：${t.y.toLocaleString()} / ${t.m.toLocaleString()} / ${t.tg.toLocaleString()} / ${pct(t.m, t.tg)}`);
    };
    sectorText('成交数据', rep.gmvRows, ['历史GMV', '昨日GMV', '本月GMV']);
    sectorText('核销数据', rep.redeemRows, ['历史核销', '昨日核销', '本月核销']);
    if (rep.notes.dabo) L.push(`\n达播：${rep.notes.dabo}`);
    if (rep.notes.official) L.push(`\n官号：${rep.notes.official}`);
    if (rep.notes.officialVideo) L.push(`\n官号短视频：${rep.notes.officialVideo}`);
    return L.join('\n');
  }

  function DailyReportModal({ brandId, date, onClose }) {
    const [rep, setRep] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedTip, setSavedTip] = useState('');
    const [curDate, setCurDate] = useState(date);

    const load = useCallback((d) => {
      setLoading(true);
      fetch(`/api/reports?brand=${encodeURIComponent(brandId)}&date=${d}`)
        .then(r => r.json())
        .then(j => setRep(j.data))
        .finally(() => setLoading(false));
    }, [brandId]);

    useEffect(() => { load(curDate); }, [load, curDate]);

    const patch = (updater) => setRep(prev => { const n = JSON.parse(JSON.stringify(prev)); updater(n); return n; });
    const rowChange = (which, idx, field, v) => patch(n => { n[which][idx][field] = v; });
    const liveChange = (block, period, field, v) => patch(n => { n.liveDetail[block][period][field] = v; });

    const save = async () => {
      setSaving(true); setSavedTip('');
      try {
        const r = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rep) });
        const j = await r.json();
        if (j.data) { setRep(j.data); setSavedTip('已保存'); setTimeout(() => setSavedTip(''), 2000); }
      } catch { setSavedTip('保存失败'); }
      setSaving(false);
    };

    const copy = async () => {
      try { await navigator.clipboard.writeText(toText(rep)); setSavedTip('已复制文本'); setTimeout(() => setSavedTip(''), 2000); }
      catch { setSavedTip('复制失败'); }
    };

    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(20,20,28,0.45)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'auto', padding: '4vh 16px' }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 880, background: 'var(--bg-elevated, #fff)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: 24 }}>
          {/* header */}
          <div className="row between" style={{ alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                {rep ? `${rep.brandName}日报（${dateLabel(curDate)}）` : '经营日报'}
              </h2>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>结构化经营日报 · 平台回填 + 手动补充</div>
            </div>
            <button className="btn ghost icon" onClick={onClose}><Icon name="x" size={16} /></button>
          </div>

          {/* date + actions */}
          <div className="row" style={{ gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={curDate} onChange={e => setCurDate(e.target.value)}
              style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', font: 'inherit' }} />
            <div className="tb-spacer" style={{ flex: 1 }} />
            {savedTip && <span style={{ fontSize: 12, color: 'var(--success, #389e0d)' }}>{savedTip}</span>}
            <button className="btn ghost sm" onClick={copy} disabled={!rep}><Icon name="copy" size={12} /> 复制文本</button>
            <button className="btn sm" onClick={save} disabled={!rep || saving}><Icon name="check" size={12} /> {saving ? '保存中…' : '保存日报'}</button>
          </div>

          {loading || !rep ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>加载中…</div>
          ) : (
            <>
              {/* seed note */}
              <div style={{ fontSize: 11.5, lineHeight: 1.6, padding: '8px 12px', borderRadius: 8, marginBottom: 16,
                background: rep.seeded ? 'rgba(56,158,13,0.08)' : 'var(--bg-subtle, #f2f2f4)',
                color: rep.seeded ? 'var(--success, #389e0d)' : 'var(--text-muted)' }}>
                {rep.seedNote}
              </div>

              <SectorTable title="成交数据" rows={rep.gmvRows} valueLabels={['历史GMV', '昨日GMV', '本月GMV']}
                tone="#fdeecb" timeProgress={rep.timeProgress} onTimeProgress={(v) => patch(n => { n.timeProgress = v; })}
                onRowChange={(i, f, v) => rowChange('gmvRows', i, f, v)} />

              <SectorTable title="核销数据" rows={rep.redeemRows} valueLabels={['历史核销', '昨日核销', '本月核销']}
                tone="#fdeecb" timeProgress={rep.timeProgress} onTimeProgress={(v) => patch(n => { n.timeProgress = v; })}
                onRowChange={(i, f, v) => rowChange('redeemRows', i, f, v)} />

              <LiveDetailTable liveDetail={rep.liveDetail} onChange={liveChange} />

              <section>
                <SectionTitle title="经营备注" sub="达播 / 官号 / 官号短视频" />
                <NoteBlock label="达播" value={rep.notes.dabo} onChange={(v) => patch(n => { n.notes.dabo = v; })} />
                <NoteBlock label="官号" value={rep.notes.official} onChange={(v) => patch(n => { n.notes.official = v; })} />
                <NoteBlock label="官号短视频" value={rep.notes.officialVideo} onChange={(v) => patch(n => { n.notes.officialVideo = v; })} />
              </section>
            </>
          )}
        </div>
      </div>
    );
  }

  // 事件宿主：挂在 App 内，监听打开事件
  function DailyReportHost() {
    const [open, setOpen] = useState(null); // { brandId, date }
    useEffect(() => {
      const onOpen = (e) => setOpen(e.detail);
      window.addEventListener('tl:open-daily-report', onOpen);
      return () => window.removeEventListener('tl:open-daily-report', onOpen);
    }, []);
    if (!open) return null;
    return <DailyReportModal brandId={open.brandId} date={open.date} onClose={() => setOpen(null)} />;
  }

  TL.DailyReportModal = DailyReportModal;
  TL.DailyReportHost = DailyReportHost;
  window.DailyReportHost = DailyReportHost;
})();
