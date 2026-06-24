// 潮线 Tideline · 经营日报 v2
// 数据分层：绿色=平台自动（statQuery/来客明细）/ 蓝色=来客经营概览（周期不确定）
//           黄色=待补充（暂无接口）/ 灰色=用户手动录入
// 入口：TL.openDailyReport(brandId, date?)  /  DailyReportHost 事件监听
window.TL = window.TL || {};
TL.openDailyReport = function (brandId, date) {
  const d = date || new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  window.dispatchEvent(new CustomEvent('tl:open-daily-report', { detail: { brandId, date: d } }));
};

(function () {
  const { useState, useEffect, useCallback } = React;

  // ── 工具函数 ────────────────────────────────────────────────────────────────
  const fen = (n) => ((n || 0) / 1e4 >= 1 ? ((n || 0) / 1e4).toFixed(2) + ' 万' : (n || 0).toLocaleString());
  const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) + '%' : '—');
  const dateLabel = (d) => { const [, m, dd] = (d || '').split('-'); return `${+m}.${+dd}`; };
  const isNil = (v) => v === null || v === undefined;

  // ── 数据来源徽标 ─────────────────────────────────────────────────────────────
  const SRC_CONFIG = {
    platform:       { color: '#389e0d', bg: 'rgba(56,158,13,0.10)', label: '平台自动拉取' },
    laike_sales:    { color: '#389e0d', bg: 'rgba(56,158,13,0.10)', label: '来客明细' },
    laike_overview: { color: '#0958d9', bg: 'rgba(9,88,217,0.08)',  label: '来客概览（周期不确定）' },
    business:       { color: '#0958d9', bg: 'rgba(9,88,217,0.08)',  label: '生意经经营数据' },
    insight:        { color: '#8c8c8c', bg: 'rgba(0,0,0,0.05)',     label: '周期洞察，仅供参考' },
    manual:         { color: '#8c8c8c', bg: 'rgba(0,0,0,0.05)',     label: '手动录入' },
    pending:        { color: '#d48806', bg: 'rgba(212,136,6,0.10)', label: '待补充' },
  };
  function SrcBadge({ src }) {
    const cfg = SRC_CONFIG[src] || SRC_CONFIG.pending;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 500,
        padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
      }}>{cfg.label}</span>
    );
  }
  function SectionBadge({ src, style }) {
    const cfg = SRC_CONFIG[src] || SRC_CONFIG.pending;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 500,
        padding: '2px 8px', borderRadius: 10, background: cfg.bg, color: cfg.color, ...style,
      }}>{cfg.label}</span>
    );
  }
  function SectionTitle({ title, sub, badge }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 18 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
        {sub && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{sub}</span>}
        {badge && <SectionBadge src={badge} />}
        <div style={{ flex: 1, borderBottom: '1px solid var(--border)', marginLeft: 4 }} />
      </div>
    );
  }

  // ── 可编辑数字单元格 ─────────────────────────────────────────────────────────
  // null → 显示「待补充」占位，可编辑；number → 正常数字
  function NumCell({ value, onChange, readOnly, bold, src }) {
    const nil = isNil(value);
    if (readOnly) {
      return (
        <td className="num" style={{ fontWeight: bold ? 600 : 400 }}>
          {nil ? <span style={{ color: '#d48806', fontSize: 11 }}>待补充</span> : (value || 0).toLocaleString()}
          {src && !nil && <span style={{ marginLeft: 3 }}><SrcBadge src={src} /></span>}
        </td>
      );
    }
    return (
      <td className="num" style={{ padding: 0 }}>
        <input
          type="number"
          value={nil || value === 0 ? '' : value}
          placeholder={nil ? '待补充' : '0'}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          style={{
            width: '100%', border: 'none', background: 'transparent', textAlign: 'right',
            padding: '8px 10px', font: 'inherit', color: nil ? '#d48806' : 'inherit',
            outline: 'none', MozAppearance: 'textfield',
          }}
        />
      </td>
    );
  }

  // ── 投放数据卡片 (statQuery) ─────────────────────────────────────────────────
  function AdSpendCard({ adSpend }) {
    if (!adSpend) return null;
    const items = [
      { label: '全域消耗',   value: `¥${(adSpend.totalSpent || 0).toLocaleString()}` },
      { label: '直播消耗',   value: `¥${(adSpend.liveSpent || 0).toLocaleString()}` },
      { label: '短视频消耗', value: `¥${(adSpend.videoSpent || 0).toLocaleString()}` },
      { label: '直播 ROI',   value: (adSpend.liveRoi || 0).toFixed(2) },
      { label: '短视频 ROI', value: (adSpend.videoRoi || 0).toFixed(2) },
    ];
    return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="投放数据" sub={adSpend.period} badge="platform" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {items.map(it => (
            <div key={it.label} className="card" style={{ flex: '1 1 120px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{it.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{it.label}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ── 来客成交汇总卡片 ─────────────────────────────────────────────────────────
  function LaikeSalesCard({ laikeSales }) {
    if (!laikeSales) return null;
    const items = [
      { label: '总成交',   value: `¥${fen(laikeSales.totalGmv)}` },
      { label: '有效订单', value: `${laikeSales.validOrderCount} 单` },
      { label: '直播渠道', value: `¥${fen(laikeSales.liveGmv)}` },
      { label: '搜索渠道', value: `¥${fen(laikeSales.searchGmv)}` },
      { label: '其他渠道', value: `¥${fen(laikeSales.otherGmv)}` },
      { label: '退款',     value: `¥${fen(laikeSales.refundGmv)}` },
    ];
    return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="来客成交汇总" sub={`${laikeSales.startDate} 明细`} badge="laike_sales" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {items.map(it => (
            <div key={it.label} className="card" style={{ flex: '1 1 100px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{it.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{it.label}</div>
            </div>
          ))}
        </div>
        {/* 渠道明细 */}
        {Object.keys(laikeSales.byChannel).length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(laikeSales.byChannel).map(([ch, amt]) => (
              <span key={ch} style={{ fontSize: 11.5, padding: '2px 8px', background: 'var(--bg-subtle)', borderRadius: 4 }}>
                {ch} ¥{(amt || 0).toLocaleString()}
              </span>
            ))}
          </div>
        )}
      </section>
    );
  }

  // ── 来客核销概览卡片 ─────────────────────────────────────────────────────────
  function LaikeOverviewCard({ laikeOverview }) {
    if (!laikeOverview) return null;
    const items = [
      { label: '核销金额',   value: `¥${fen(laikeOverview.verifyAmount)}` },
      { label: '核销券数',   value: `${(laikeOverview.verifyCertCnt || 0).toLocaleString()} 张` },
      { label: '成交金额',   value: `¥${fen(laikeOverview.payAmount)}` },
      { label: '成交券数',   value: `${(laikeOverview.payCertCnt || 0).toLocaleString()} 张` },
      { label: '退款金额',   value: `¥${fen(laikeOverview.refundAmount)}` },
      { label: '商品访问人', value: `${(laikeOverview.productViewUv || 0).toLocaleString()}` },
    ];
    return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="核销概览" sub="抖音来客 data_overview" badge="laike_overview" />
        <div style={{ padding: '7px 12px', background: 'rgba(9,88,217,0.06)', borderRadius: 8, fontSize: 11.5, color: '#0958d9', marginBottom: 8 }}>
          ⚠️ 以下数据来自抖音来客当前展示周期，非指定日期昨日数据，仅供参考。精确核销明细接口（view_verify_record）待接入。
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {items.map(it => (
            <div key={it.label} className="card" style={{ flex: '1 1 100px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{it.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{it.label}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ── 来客核销明细卡片（精确核销，coupon_verify_record）─────────────────────────
  function LaikeVerifyCard({ laikeVerify }) {
    if (!laikeVerify) return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="精确核销" sub="抖音来客 verify_record_list" badge="laike_sales" />
        <div style={{ padding: '10px 14px', background: '#fafafa', borderRadius: 8, fontSize: 12, color: '#8c8c8c' }}>
          待接入 — 请在 .env 配置 LAIKE_VERIFY_URL=https://life.douyin.com 及 LAIKE_COOKIE
        </div>
      </section>
    );
    const v = laikeVerify;
    const amt = (x) => isNil(x) ? <span style={{ color: '#d48806', fontSize: 13 }}>待接入</span> : `¥${(x || 0).toLocaleString()}`;
    const cnt = (x) => isNil(x) ? <span style={{ color: '#d48806', fontSize: 13 }}>待接入</span> : `${(x || 0).toLocaleString()} 单`;
    const items = [
      { label: '昨日核销金额（用户实付）', value: amt(v.yesterdayAmount) },
      { label: '昨日商家实收', value: amt(v.yesterdayMerchantAmount) },
      { label: '昨日核销订单', value: cnt(v.yesterdayOrderCnt) },
      { label: '本月核销金额（用户实付）', value: amt(v.monthAmount) },
      { label: '本月商家实收', value: amt(v.monthMerchantAmount) },
      { label: '本月核销订单', value: cnt(v.monthOrderCnt) },
    ];
    return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="精确核销" sub="抖音来客 verify_record_list · 按核销时间" badge="laike_sales" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {items.map(it => (
            <div key={it.label} className="card" style={{ flex: '1 1 130px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{it.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{it.label}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ── 商品排行卡片 ─────────────────────────────────────────────────────────────
  function ProductCard({ laikeSales }) {
    if (!laikeSales?.byProduct?.length) return null;
    return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="商品成交排行" sub={`TOP ${laikeSales.byProduct.length}`} badge="laike_sales" />
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>商品名称</th>
                <th className="num">成交金额</th>
                <th className="num">订单数</th>
              </tr>
            </thead>
            <tbody>
              {laikeSales.byProduct.map((p, i) => (
                <tr key={i}>
                  <td style={{ color: i < 3 ? '#d4380d' : 'var(--text-muted)', fontWeight: i < 3 ? 700 : 400, width: 30 }}>{i + 1}</td>
                  <td>{p.name}</td>
                  <td className="num">¥{(p.gmv || 0).toLocaleString()}</td>
                  <td className="num">{p.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // ── 生意经流量成交拆分 ───────────────────────────────────────────────────────
  function BusinessTradeCard({ businessTrade }) {
    if (!businessTrade) return null;
    const t = businessTrade;
    const items = [
      { label: '直播渠道 GMV', value: `¥${fen(t.liveGmv)}`, note: '生意经直播场景，非达播' },
      { label: '视频渠道 GMV', value: `¥${fen(t.videoGmv)}` },
      { label: '搜索场景 GMV', value: `¥${fen(t.searchSceneGmv)}` },
      { label: '推荐分享场景', value: `¥${fen(t.recommendSceneGmv)}` },
      { label: '团购商城场景', value: `¥${fen(t.groupbuySceneGmv)}` },
      { label: '获客卡 GMV',   value: `¥${fen(t.leadCardGmv)}` },
      { label: '搜索结果卡',   value: `¥${fen(t.searchResultCardGmv)}` },
    ];
    return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="生意经流量成交拆分" sub="按流量场景 / 成交体裁" badge="business" />
        <div style={{ padding: '6px 10px', background: 'rgba(9,88,217,0.06)', borderRadius: 7, fontSize: 11.5, color: '#0958d9', marginBottom: 8 }}>
          ⚠️ 「直播渠道 GMV」仅表示成交来自直播场景，无法区分达人直播 / 商家自播，不等于「达播 GMV」。
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {items.map(it => (
            <div key={it.label} className="card" style={{ flex: '1 1 110px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{it.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{it.label}</div>
              {it.note && <div style={{ fontSize: 9.5, color: '#d48806', marginTop: 1 }}>{it.note}</div>}
            </div>
          ))}
        </div>
        {t.rows?.length > 0 && (
          <div className="card" style={{ overflow: 'auto', marginTop: 8 }}>
            <table className="tbl">
              <thead><tr><th>流量场景 × 体裁</th><th className="num">成交金额</th></tr></thead>
              <tbody>
                {t.rows.map((r, i) => (
                  <tr key={i}><td>{r.name}</td><td className="num">¥{(r.gmv || 0).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  // ── 生意经曝光拆分 ───────────────────────────────────────────────────────────
  function BusinessExposureCard({ businessExposure }) {
    if (!businessExposure?.rows?.length) return null;
    return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="流量曝光拆分" sub="生意经 show_cnt_1d" badge="business" />
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>流量场景</th><th className="num">曝光次数</th><th className="num">曝光占比</th></tr></thead>
            <tbody>
              {businessExposure.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.scene}</td>
                  <td className="num">{isNil(r.showCnt) ? <span style={{ color: '#d48806', fontSize: 11 }}>—</span> : r.showCnt.toLocaleString()}</td>
                  <td className="num">{isNil(r.rate) ? '—' : (r.rate * 100).toFixed(2) + '%'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // ── 生意经营销表现 ────────────────────────────────────────────────────────────
  function BusinessMarketingCard({ businessMarketing }) {
    if (!businessMarketing) return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="生意经营销表现" sub="coupon_pay_gmv / 平台补贴 / 商家补贴" badge="business" />
        <div style={{ padding: '10px 14px', background: '#fafafa', borderRadius: 8, fontSize: 12, color: '#8c8c8c' }}>
          待接入 — 未配置生意经营销概览接口（BUSINESS_FLOW_MARKETING_OVERVIEW_URL）
        </div>
      </section>
    );
    const m = businessMarketing;
    const fmt = (v) => isNil(v) ? '待接入' : `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const cmp = m.compare;
    const ratioTxt = cmp ? ((cmp.ratio >= 0 ? '+' : '') + (cmp.ratio * 100).toFixed(1) + '%') : null;
    return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="生意经营销表现" sub="coupon_pay_gmv · 不含总GMV/达播GMV/POI GMV" badge="business" />
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: cmp || (m.trend?.length > 0) ? 12 : 0 }}>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>生意经营销成交金额</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>{fmt(m.couponPayGmv)}</div>
              {cmp && <div style={{ fontSize: 11, color: cmp.ratio >= 0 ? '#389e0d' : '#cf1322', marginTop: 2 }}>
                较上周期 {ratioTxt}（{cmp.diff >= 0 ? '+' : ''}{fmt(cmp.diff)}）
              </div>}
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>营销平台补贴金额</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#0958d9' }}>{fmt(m.platAmt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>营销商家补贴金额</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#531dab' }}>{fmt(m.merAmt)}</div>
            </div>
          </div>
          {m.trend?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>营销成交趋势</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead><tr>
                    {m.trend.map(r => <th key={r.date} className="num" style={{ fontSize: 11 }}>{r.date.slice(5)}</th>)}
                  </tr></thead>
                  <tbody><tr>
                    {m.trend.map(r => <td key={r.date} className="num" style={{ fontSize: 12 }}>{fmt(r.gmv)}</td>)}
                  </tr></tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  // ── 生意经直播分析（达播）──────────────────────────────────────────────────────
  function BusinessLiveCard({ businessLive }) {
    if (!businessLive) return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="生意经达播分析" sub="达播 GMV / 场次 / 时长 / 达人数量" badge="business" />
        <div style={{ padding: '10px 14px', background: '#fafafa', borderRadius: 8, fontSize: 12, color: '#8c8c8c' }}>
          待接入 — 未配置生意经直播分析接口（BUSINESS_FLOW_LIVE_URL）或暂无达播数据
        </div>
      </section>
    );
    const bl = businessLive;
    const fmtY = (v) => isNil(v) ? '—' : `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtN = (v) => isNil(v) ? '—' : Number(v).toLocaleString('zh-CN');
    const fmtDur = (sec) => {
      if (isNil(sec) || sec === 0) return '—';
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };
    return (
      <section style={{ marginBottom: 16 }}>
        <SectionTitle title="生意经达播分析" sub={`来源：生意经 dito/query TALENT · ${bl.fetchedAt?.slice(0,10) ?? ''}`} badge="business" />
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: bl.rooms?.length ? 12 : 0 }}>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>达播成交 GMV</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>{fmtY(bl.daboGmv)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>达播场次</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>{fmtN(bl.daboCnt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>达播时长</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>{fmtDur(bl.daboDurationSec)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>达人数量</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#0958d9' }}>{fmtN(bl.authorCnt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>成交券数</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>{fmtN(bl.payCertCnt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>退款金额</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: bl.refundAmount > 0 ? '#cf1322' : '#8c8c8c' }}>{fmtY(bl.refundAmount)}</div>
            </div>
          </div>
          {bl.rooms?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>达播场次明细（Top {bl.rooms.length}）</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead><tr>
                    <th>直播类型</th>
                    <th className="num">GMV</th>
                    <th className="num">时长</th>
                    <th className="num">核销券数</th>
                    <th className="num">成交券数</th>
                    <th className="num">成交人数</th>
                  </tr></thead>
                  <tbody>
                    {bl.rooms.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12 }}>{r.roomTypeTag || '—'}</td>
                        <td className="num" style={{ fontSize: 12 }}>{fmtY(r.gmv)}</td>
                        <td className="num" style={{ fontSize: 12 }}>{fmtDur(r.durationSec)}</td>
                        <td className="num" style={{ fontSize: 12 }}>{fmtN(r.verifyCertNum)}</td>
                        <td className="num" style={{ fontSize: 12 }}>{fmtN(r.payCertNum)}</td>
                        <td className="num" style={{ fontSize: 12 }}>{fmtN(r.payUser)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  // ── 平台经营洞察（来客 + 生意经）─────────────────────────────────────────────
  function InsightBlock({ laikeInsight, businessInsight }) {
    const items = [];
    if (businessInsight?.conclusion) items.push({ title: '生意经平台洞察', ins: businessInsight, badge: 'business' });
    if (laikeInsight?.conclusion)    items.push({ title: '来客经营洞察',   ins: laikeInsight,   badge: 'laike_overview' });
    if (!items.length) return null;
    return (
      <>
        {items.map((it, i) => (
          <section key={i} style={{ marginBottom: 16 }}>
            <SectionTitle title={it.title} sub={`${it.ins.startDate}～${it.ins.endDate}`} badge={it.badge} />
            <div style={{ padding: '12px 14px', background: 'rgba(9,88,217,0.05)', borderRadius: 8, fontSize: 13, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
              {it.ins.conclusion}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <SrcBadge src="insight" /> 数据周期：{it.ins.startDate}～{it.ins.endDate}，非昨日数据，仅供经营复盘参考。
            </div>
          </section>
        ))}
      </>
    );
  }

  // ── 成交/核销分板块表 ────────────────────────────────────────────────────────
  function SectorTable({ title, rows, valueLabels, onRowChange, timeProgress, onTimeProgress, tone }) {
    const safeNum = (v) => (isNil(v) ? 0 : v);
    const totals = rows.reduce(
      (s, r) => ({
        history: s.history + safeNum(r.history),
        yesterday: s.yesterday + safeNum(r.yesterday),
        month: s.month + safeNum(r.month),
        target: s.target + safeNum(r.target),
      }),
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
                  <td style={{ fontWeight: 500 }}>
                    <div>{r.label}</div>
                    {r.src?.yesterday && <SrcBadge src={r.src.yesterday} />}
                  </td>
                  <NumCell value={r.history}   onChange={(v) => onRowChange(i, 'history', v)} src={r.src?.history} />
                  <NumCell value={r.yesterday} onChange={(v) => onRowChange(i, 'yesterday', v)} src={r.src?.yesterday} />
                  <NumCell value={r.month}     onChange={(v) => onRowChange(i, 'month', v)} src={r.src?.month} />
                  <NumCell value={r.target}    onChange={(v) => onRowChange(i, 'target', v)} />
                  <td className="num" style={{ color: 'var(--text-muted)' }}>{pct(safeNum(r.month), safeNum(r.target))}</td>
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

  // ── 直播板块明细 ─────────────────────────────────────────────────────────────
  function LiveDetailTable({ liveDetail, onChange }) {
    const COLS = [
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
          <input type="number"
            value={isNil(v) || v === 0 ? '' : v}
            placeholder={isNil(v) ? '待补充' : '0'}
            onChange={(e) => onChange(block, period, field, e.target.value === '' ? null : Number(e.target.value))}
            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'right',
              padding: '8px 8px', font: 'inherit', color: isNil(v) ? '#d48806' : 'inherit', outline: 'none' }} />
        </td>
      );
    };
    const hourGmv = (block, period) => {
      const c = liveDetail[block][period];
      return (c.duration && c.gmv) ? Math.round(c.gmv / c.duration).toLocaleString() : '—';
    };
    return (
      <section style={{ marginBottom: 20 }}>
        <SectionTitle title="直播板块明细" sub="场次 / GMV / 时长 / 单小时GMV" badge="pending" />
        <div style={{ fontSize: 11.5, color: '#d48806', padding: '6px 10px', background: 'rgba(212,136,6,0.06)', borderRadius: 7, marginBottom: 8 }}>
          直播场次、时长、达播数据暂无平台接口，请手动录入。
        </div>
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: 90 }}>项目</th>
                <th colSpan={3} style={{ textAlign: 'center', background: 'var(--bg-subtle)' }}>自播板块</th>
                <th colSpan={3} style={{ textAlign: 'center', background: 'var(--bg-subtle)' }}>达播板块 <SrcBadge src="pending" /></th>
              </tr>
              <tr>{COLS.map((c, i) => <th key={i} className="num">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              <tr><td style={{ fontWeight: 500 }}>直播场次</td>{COLS.map(c => inp(c.block, c.period, 'sessions'))}</tr>
              <tr><td style={{ fontWeight: 500 }}>直播GMV</td>{COLS.map(c => inp(c.block, c.period, 'gmv'))}</tr>
              <tr><td style={{ fontWeight: 500 }}>直播时长(h)</td>{COLS.map(c => inp(c.block, c.period, 'duration'))}</tr>
              <tr>
                <td style={{ fontWeight: 500 }}>单小时GMV</td>
                {COLS.map((c, i) => <td className="num" key={i} style={{ color: 'var(--text-muted)' }}>{hourGmv(c.block, c.period)}</td>)}
              </tr>
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
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={3}
          placeholder={`填写${label}相关计划与进展…`}
          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 9px', font: 'inherit', resize: 'vertical', background: 'var(--bg-app, #fff)' }} />
      </div>
    );
  }

  // ── 复制文本 ─────────────────────────────────────────────────────────────────
  function toText(rep) {
    const L = [];
    L.push(`${rep.brandName}日报（${dateLabel(rep.date)}）`);
    if (rep.adSpend) {
      L.push(`\n【投放数据】（${rep.adSpend.period}）`);
      L.push(`· 全域消耗：¥${(rep.adSpend.totalSpent || 0).toLocaleString()}`);
      L.push(`· 直播 ROI：${(rep.adSpend.liveRoi || 0).toFixed(2)}`);
    }
    if (rep.laikeSales) {
      L.push(`\n【来客成交】（${rep.laikeSales.startDate}）`);
      L.push(`· 总成交：¥${fen(rep.laikeSales.totalGmv)} / ${rep.laikeSales.validOrderCount} 单`);
      L.push(`· 直播 ¥${fen(rep.laikeSales.liveGmv)} / 搜索 ¥${fen(rep.laikeSales.searchGmv)}`);
    }
    const sectorText = (title, rows, labels) => {
      L.push(`\n【${title}】（${labels[1]} / ${labels[2]} / 目标 / 进度）`);
      rows.forEach(r => L.push(`· ${r.label}：${isNil(r.yesterday) ? '待补充' : (r.yesterday || 0).toLocaleString()} / ${isNil(r.month) ? '待补充' : (r.month || 0).toLocaleString()} / ${isNil(r.target) ? '—' : (r.target || 0).toLocaleString()} / ${pct(r.month || 0, r.target || 0)}`));
    };
    sectorText('成交数据', rep.gmvRows, ['历史GMV', '昨日GMV', '本月GMV']);
    sectorText('核销数据', rep.redeemRows, ['历史核销', '昨日核销', '本月核销']);
    if (rep.businessMarketing) {
      const mk = rep.businessMarketing;
      L.push(`\n【生意经营销表现】`);
      L.push(`· 生意经营销成交金额：¥${fen(mk.couponPayGmv)}`);
      L.push(`· 营销平台补贴：¥${fen(mk.platAmt)} / 营销商家补贴：¥${fen(mk.merAmt)}`);
      if (mk.compare) L.push(`· 较上周期：${mk.compare.ratio >= 0 ? '+' : ''}${(mk.compare.ratio * 100).toFixed(1)}%`);
    }
    if (rep.businessTrade) {
      const t = rep.businessTrade;
      L.push(`\n【生意经流量成交拆分】`);
      L.push(`· 直播渠道 ¥${fen(t.liveGmv)}（非达播）/ 视频渠道 ¥${fen(t.videoGmv)}`);
      L.push(`· 搜索场景 ¥${fen(t.searchSceneGmv)} / 推荐分享 ¥${fen(t.recommendSceneGmv)} / 团购商城 ¥${fen(t.groupbuySceneGmv)}`);
    }
    if (rep.businessInsight) L.push(`\n【生意经洞察（${rep.businessInsight.startDate}~${rep.businessInsight.endDate}）】\n${rep.businessInsight.conclusion}`);
    if (rep.laikeInsight) L.push(`\n【来客洞察（${rep.laikeInsight.startDate}~${rep.laikeInsight.endDate}）】\n${rep.laikeInsight.conclusion}`);
    if (rep.notes?.dabo) L.push(`\n达播：${rep.notes.dabo}`);
    if (rep.notes?.official) L.push(`\n官号：${rep.notes.official}`);
    if (rep.notes?.officialVideo) L.push(`\n官号短视频：${rep.notes.officialVideo}`);
    return L.join('\n');
  }

  // ── 主弹窗 ───────────────────────────────────────────────────────────────────
  function DailyReportModal({ brandId, date, onClose }) {
    const [rep, setRep] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tip, setTip] = useState('');
    const [curDate, setCurDate] = useState(date);

    const load = useCallback((d) => {
      setLoading(true);
      fetch(`/api/reports?brand=${encodeURIComponent(brandId)}&date=${d}`)
        .then(r => r.json())
        .then(j => setRep(j.data))
        .finally(() => setLoading(false));
    }, [brandId]);

    useEffect(() => { load(curDate); }, [load, curDate]);

    const patch = (fn) => setRep(prev => { const n = JSON.parse(JSON.stringify(prev)); fn(n); return n; });
    const rowChange  = (which, idx, field, v) => patch(n => { n[which][idx][field] = v; });
    const liveChange = (block, period, field, v) => patch(n => { n.liveDetail[block][period][field] = v; });

    const save = async () => {
      setSaving(true); setTip('');
      try {
        const r = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rep) });
        const j = await r.json();
        if (j.data) { setRep(j.data); setTip('已保存'); setTimeout(() => setTip(''), 2500); }
      } catch { setTip('保存失败'); }
      setSaving(false);
    };

    const copy = async () => {
      try { await navigator.clipboard.writeText(toText(rep)); setTip('已复制文本'); setTimeout(() => setTip(''), 2500); }
      catch { setTip('复制失败'); }
    };

    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(20,20,28,0.45)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'auto', padding: '4vh 16px' }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 920, background: 'var(--bg-elevated, #fff)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: 24, marginBottom: 32 }}>

          {/* 顶栏 */}
          <div className="row between" style={{ alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                {rep ? `${rep.brandName}日报（${dateLabel(curDate)}）` : '经营日报'}
              </h2>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <SrcBadge src="platform" />
                <SrcBadge src="business" />
                <SrcBadge src="insight" />
                <SrcBadge src="pending" />
              </div>
            </div>
            <button className="btn ghost icon" onClick={onClose}><Icon name="x" size={16} /></button>
          </div>

          {/* 日期 + 操作 */}
          <div className="row" style={{ gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={curDate} onChange={e => setCurDate(e.target.value)}
              style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', font: 'inherit' }} />
            <div style={{ flex: 1 }} />
            {tip && <span style={{ fontSize: 12, color: 'var(--success, #389e0d)' }}>{tip}</span>}
            <button className="btn ghost sm" onClick={copy} disabled={!rep}><Icon name="copy" size={12} /> 复制文本</button>
            <button className="btn sm" onClick={save} disabled={!rep || saving}><Icon name="check" size={12} /> {saving ? '保存中…' : '保存日报'}</button>
          </div>

          {loading || !rep ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>生成日报中，正在拉取平台数据…</div>
          ) : (
            <>
              {/* 数据来源说明 */}
              {rep.seedNote && (
                <div style={{ fontSize: 11.5, lineHeight: 1.65, padding: '8px 12px', borderRadius: 8, marginBottom: 16,
                  background: rep.seeded ? 'rgba(56,158,13,0.07)' : 'var(--bg-subtle)',
                  color: rep.seeded ? '#389e0d' : 'var(--text-muted)' }}>
                  {rep.seedNote}
                </div>
              )}

              {/* 投放数据 */}
              <AdSpendCard adSpend={rep.adSpend} />

              {/* 来客成交汇总 */}
              <LaikeSalesCard laikeSales={rep.laikeSales} />

              {/* 成交数据表（自播/达播/POI/短视频）— 自播+短视频有平台数据，其余待补充 */}
              <SectorTable title="成交数据" rows={rep.gmvRows}
                valueLabels={['历史GMV', '昨日GMV', '本月GMV']}
                tone="#fdeecb" timeProgress={rep.timeProgress}
                onTimeProgress={(v) => patch(n => { n.timeProgress = v; })}
                onRowChange={(i, f, v) => rowChange('gmvRows', i, f, v)} />

              {/* 来客核销概览 */}
              <LaikeOverviewCard laikeOverview={rep.laikeOverview} />

              {/* 精确核销明细（coupon_verify_record）*/}
              <LaikeVerifyCard laikeVerify={rep.laikeVerify} />

              {/* 核销数据表 */}
              <SectorTable title="核销数据" rows={rep.redeemRows}
                valueLabels={['历史核销', '昨日核销', '本月核销']}
                tone="#e6f4ff" timeProgress={rep.timeProgress}
                onTimeProgress={(v) => patch(n => { n.timeProgress = v; })}
                onRowChange={(i, f, v) => rowChange('redeemRows', i, f, v)} />

              {/* 商品排行 */}
              <ProductCard laikeSales={rep.laikeSales} />

              {/* 生意经营销表现 */}
              <BusinessMarketingCard businessMarketing={rep.businessMarketing} />

              {/* 生意经达播分析 */}
              <BusinessLiveCard businessLive={rep.businessLive} />

              {/* 生意经流量成交拆分 */}
              <BusinessTradeCard businessTrade={rep.businessTrade} />

              {/* 生意经曝光拆分 */}
              <BusinessExposureCard businessExposure={rep.businessExposure} />

              {/* 直播板块明细 */}
              <LiveDetailTable liveDetail={rep.liveDetail} onChange={liveChange} />

              {/* 平台经营洞察（来客 + 生意经）*/}
              <InsightBlock laikeInsight={rep.laikeInsight} businessInsight={rep.businessInsight} />

              {/* 经营备注 */}
              <section>
                <SectionTitle title="经营备注" sub="达播 / 官号 / 官号短视频" />
                <NoteBlock label="达播" value={rep.notes?.dabo} onChange={(v) => patch(n => { n.notes.dabo = v; })} />
                <NoteBlock label="官号" value={rep.notes?.official} onChange={(v) => patch(n => { n.notes.official = v; })} />
                <NoteBlock label="官号短视频" value={rep.notes?.officialVideo} onChange={(v) => patch(n => { n.notes.officialVideo = v; })} />
              </section>
            </>
          )}
        </div>
      </div>
    );
  }

  // 事件宿主
  function DailyReportHost() {
    const [open, setOpen] = useState(null);
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
