import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, Seg, startDrag, Swatches, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

/* ---------- dates: calendar years, millions of years ago, or a 12-month cycle ---------- */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthOf(s: string) { const m = s.toLowerCase().match(/[a-z]{3}/); return m ? MONTHS.indexOf(m[0]) : -1; }
export function parseDate(v: any, scale: string): number {
  const s = String(v == null ? '' : v).trim();
  if (!s) return NaN;
  if (scale === 'ma') return parseFloat(s.replace(/[^0-9.\-]/g, ''));
  if (scale === 'cycle') {
    const mi = monthOf(s), d = parseFloat((s.match(/\d+(\.\d+)?/) || ['1'])[0]);
    if (mi >= 0) return mi + (Math.min(31, Math.max(1, d)) - 1) / 30.5;
    return parseFloat(s) - 1;
  }
  let m = s.match(/^(\d{3,4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (m) return +m[1] + (+m[2] - 1) / 12 + (m[3] ? (+m[3] - 1) / 365 : 0);
  const y = s.match(/\b(\d{3,4})\b/), mi = monthOf(s);
  if (y) return +y[1] + (mi >= 0 ? mi / 12 : 0);
  return parseFloat(s);
}
function fmtDate(t: number, scale: string) {
  if (scale === 'ma') return (Math.round(t * 10) / 10) + ' Ma';
  if (scale === 'cycle') { const mi = Math.floor(((t % 12) + 12) % 12); return MON[mi] + ' ' + Math.max(1, Math.round((t - Math.floor(t)) * 30.5 + 1)); }
  const y = Math.floor(t), mi = Math.min(11, Math.round((t - y) * 12));
  return MON[mi] + ' ' + y;
}
const tickLabel = (t: number, scale: string) => scale === 'cycle' ? MON[((Math.round(t) % 12) + 12) % 12] : scale === 'ma' ? String(+t.toFixed(1)) : String(Math.round(t));

const GEO: [string, string, string, number, number][] = (window as any).SciDiagram.GEO_TIME;
const geoColor = (name: string) => 'var(--geo-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + ', var(--neutral-200))';
const LEVELS: [string, string][] = [['eon', 'Eons'], ['era', 'Eras'], ['period', 'Periods'], ['epoch', 'Epochs']];

/* ---------- layout ---------- */
const L = 900, R = 250;
/* bars on side b start past the tick labels; vertical bars are wide enough to hold a name */
const bandStart = (d: any) => (d.orient || 'h') === 'h' && d.tickLabels !== 'none' && d.tickLabels !== 'between' ? 32 : 14;
const bandT = (d: any) => (d.orient || 'h') === 'v' ? 78 : 18;
function geom(d: any) {
  const scale = d.scale || 'calendar', orient = d.orient || 'h';
  const t0 = scale === 'cycle' ? 0 : num(d.from, 2000), t1 = scale === 'cycle' ? 12 : num(d.to, 2010);
  const frac = (t: number) => (t - t0) / ((t1 - t0) || 1);
  const len = orient === 'v' ? num(d.length, 640) : L;
  /* u = distance along the axis, v = distance off it (negative = side a) */
  const P = (u: number, v: number): [number, number] => {
    if (orient === 'v') return [v, u];
    if (orient === 'c') { const a = -Math.PI / 2 + (u / len) * 2 * Math.PI, r = R - v; return [R + 60 + Math.cos(a) * r, R + 60 + Math.sin(a) * r]; }
    return [u, v];
  };
  const U = (t: number) => frac(t) * len;
  const inverse = (x: number, y: number) => {
    let f: number;
    if (orient === 'v') f = y / len;
    else if (orient === 'c') { let a = Math.atan2(y - (R + 60), x - (R + 60)) + Math.PI / 2; if (a < 0) a += 2 * Math.PI; f = a / (2 * Math.PI); }
    else f = x / len;
    return t0 + Math.max(0, Math.min(1, f)) * (t1 - t0);
  };
  return { scale, orient, t0, t1, len, P, U, inverse };
}
function eventLayout(d: any, g: any) {
  const ev = (d.events || []).map((e: any, i: number) => ({ ...e, i, t: parseDate(e.date, g.scale) })).filter((e: any) => isFinite(e.t));
  const T = bandT(d), geoDepth = bandStart(d) - 14 + (d.geo && g.scale === 'ma' ? (d.geoLevels || []).length * (T + 2) + 6 : 0) + (d.periods || []).reduce((m: number, p: any) => Math.max(m, (num(p.row, 0) + 1) * (T + 4)), 0);
  const placed: any = { a: [], b: [] };
  ev.sort((x: any, y: any) => g.U(x.t) - g.U(y.t));
  return ev.map((e: any, k: number) => {
    const side = e.side === 'a' || e.side === 'b' ? e.side : (k % 2 ? 'b' : 'a');
    const text = [e.label || '', d.showDate !== false ? (e.sub || e.date) : e.sub || ''].filter(Boolean);
    const w = Math.max(...text.map((s: string, j: number) => s.length * (j ? 6.4 : 7.6))) + 18, hh = 16 * text.length + 12;
    const u = g.U(e.t);
    const span = g.orient === 'v' ? [u - hh / 2 - 4, u + hh / 2 + 4] : [u - w / 2 - 6, u + w / 2 + 6];
    let lvl = 0; while (placed[side].some((q: any) => q.lvl === lvl && q.span[0] < span[1] && span[0] < q.span[1])) lvl++;
    placed[side].push({ lvl, span });
    const base = side === 'b' ? 14 + geoDepth : 14;
    void T;
    const off = g.orient === 'v' ? (side === 'a' ? -(48 + lvl * (w + 16)) : base + 20 + lvl * (w + 16)) : (side === 'a' ? -(30 + lvl * (hh + 14)) - hh : base + 20 + lvl * (hh + 14));
    return { ...e, side, text, w, hh, u, off, lvl };
  });
}

function TimelineSheet({ data }: { data: any }) {
  const g = geom(data);
  if (g.scale !== 'cycle' && !(g.t1 !== g.t0)) return <EmptyHint text="Set a start and an end for the timeline." />;
  const out: any[] = [];
  let k = 0; const K = () => 'k' + k++;
  const color = data.axisColor || 'var(--ink)';
  /* the axis */
  if (g.orient === 'c') out.push(<circle key={K()} cx={R + 60} cy={R + 60} r={R} className="tl-axis" style={{ stroke: color }} />);
  else { const a = g.P(-12, 0), b = g.P(g.len + 12, 0); out.push(<line key={K()} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="tl-axis" style={{ stroke: color }} />); }
  if (g.orient !== 'c' && data.arrows !== false) {
    [[-12, -1], [g.len + 12, 1]].forEach(([u, s]) => { const p = g.P(u, 0), q1 = g.P(u - s * 9, -5), q2 = g.P(u - s * 9, 5); out.push(<path key={K()} d={'M' + p + 'L' + q1 + 'L' + q2 + 'Z'} style={{ fill: color }} />); });
  }
  /* ticks */
  const step = Math.abs(num(data.step, g.scale === 'cycle' ? 1 : 1)) || 1, minor = Math.max(0, Math.round(num(data.minor, 0)));
  const lo = Math.min(g.t0, g.t1), hi = Math.max(g.t0, g.t1);
  const first = Math.ceil(lo / step - 1e-9) * step;
  for (let t = first, n = 0; t <= hi + 1e-9 && n < 400; t += step, n++) {
    if (g.orient === 'c' && t >= hi - 1e-9) break;
    const u = g.U(t), a = g.P(u, -7), b = g.P(u, 7);
    out.push(<line key={K()} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="tl-tick" style={{ stroke: color }} />);
    if (minor) for (let m = 1; m <= minor; m++) { const um = g.U(t + step * m / (minor + 1)); if (um > g.len + 0.5 || um < -0.5) continue; const c = g.P(um, -3.5), e = g.P(um, 3.5); out.push(<line key={K()} x1={c[0]} y1={c[1]} x2={e[0]} y2={e[1]} className="tl-tick" style={{ stroke: color }} />); }
    if (data.tickLabels !== 'none') {
      const between = data.tickLabels === 'between', tt = between ? t + step / 2 : t;
      if (between && tt > hi) continue;
      const uu = g.U(tt), lp = g.P(uu, g.orient === 'v' ? -12 : between ? -12 : g.orient === 'c' ? -18 : 20);
      const anchor = g.orient === 'v' ? 'end' : 'middle';
      out.push(<text key={K()} className={'tl-tlabel' + (between ? ' tl-between' : '')} x={g.orient === 'v' ? lp[0] - 6 : lp[0]} y={lp[1] + (g.orient === 'v' ? 4 : g.orient === 'c' ? 4 : 0)} textAnchor={anchor}>{tickLabel(t, g.scale)}</text>);
    }
  }
  /* geological rows and user periods, on side b */
  let depth = bandStart(data);
  const T = bandT(data);
  const band = (from: number, to: number, v0: number, h: number, fill: string, label: string, key: string, cls = 'tl-band') => {
    const ua = g.U(Math.max(lo, Math.min(hi, from))), ub = g.U(Math.max(lo, Math.min(hi, to)));
    if (Math.abs(ub - ua) < 0.3) return;
    if (g.orient === 'c') {
      const r = R - v0 - h / 2, a0 = -Math.PI / 2 + Math.min(ua, ub) / g.len * 2 * Math.PI, a1 = -Math.PI / 2 + Math.max(ua, ub) / g.len * 2 * Math.PI;
      const c = R + 60, big = a1 - a0 > Math.PI ? 1 : 0;
      out.push(<path key={key} className={cls} d={'M' + (c + Math.cos(a0) * r) + ',' + (c + Math.sin(a0) * r) + 'A' + r + ',' + r + ' 0 ' + big + ' 1 ' + (c + Math.cos(a1) * r) + ',' + (c + Math.sin(a1) * r)} style={{ stroke: fill, strokeWidth: h, fill: 'none' }} />);
      const am = (a0 + a1) / 2, room = (a1 - a0) * r;
      if (label && room > label.length * 6.2) out.push(<text key={key + 't'} className="tl-blabel" x={c + Math.cos(am) * r} y={c + Math.sin(am) * r + 4} textAnchor="middle">{label}</text>);
      return;
    }
    const p = g.P(Math.min(ua, ub), v0), q = g.P(Math.max(ua, ub), v0 + h);
    const x = Math.min(p[0], q[0]), y = Math.min(p[1], q[1]), w = Math.abs(q[0] - p[0]), hh = Math.abs(q[1] - p[1]);
    out.push(<rect key={key} className={cls} x={x} y={y} width={w} height={hh} style={{ fill }} />);
    const room = g.orient === 'v' ? Math.min(hh * 3, w) : w;
    if (label && room > label.length * 6.2 + 4 && (g.orient !== 'v' || hh > 13)) out.push(<text key={key + 't'} className="tl-blabel" x={x + w / 2} y={y + hh / 2 + 4} textAnchor="middle">{label}</text>);
  };
  if (data.geo && g.scale === 'ma') {
    (data.geoLevels || []).forEach((lv: string) => {
      GEO.filter(r => r[0] === lv).forEach(r => {
        const w = Math.abs(g.U(r[4]) - g.U(r[3]));
        const room = g.orient === 'v' ? (w > 13 ? T : 0) : w;
        band(r[3], r[4], depth, T, geoColor(r[1]), room > r[1].length * 6.4 + 6 ? r[1] : room > 18 ? r[2] : '', K(), 'tl-geo');
      });
      depth += T + 2;
    });
    depth += 6;
  }
  (data.periods || []).forEach((pd: any) => {
    const a = parseDate(pd.from, g.scale), b = parseDate(pd.to, g.scale); if (!isFinite(a) || !isFinite(b)) return;
    band(a, b, depth + num(pd.row, 0) * (T + 4), T, pd.color || 'var(--accent-200)', pd.label || '', K());
  });
  /* events: a leader from the axis to a label box */
  eventLayout(data, g).forEach((e: any) => {
    const c = e.color || 'var(--ink)';
    const tip = g.P(e.u, e.side === 'a' ? -2 : 2);
    if (g.orient === 'c') {
      const a = -Math.PI / 2 + e.u / g.len * 2 * Math.PI, ro = R + 46 + e.lvl * 46, cx = R + 60;
      const bx = cx + Math.cos(a) * ro, by = cy0(a, ro);
      const ax = Math.cos(a) >= 0.15 ? 'start' : Math.cos(a) <= -0.15 ? 'end' : 'middle';
      const x0 = ax === 'start' ? bx : ax === 'end' ? bx - e.w : bx - e.w / 2, y0 = by - e.hh / 2;
      const ap = [cx + Math.cos(a) * (R + 2), cx + Math.sin(a) * (R + 2)];
      out.push(<line key={K()} className="tl-lead" x1={bx} y1={by} x2={ap[0]} y2={ap[1]} style={{ stroke: c }} markerEnd="url(#tl-head)" />);
      out.push(<g key={K()} className={'tl-box' + (data.boxes === false ? ' tl-nobox' : '')}><rect x={x0} y={y0} width={e.w} height={e.hh} style={{ stroke: c }} />
        {e.text.map((s: string, j: number) => <text key={j} className={j ? 'tl-sub' : 'tl-elabel'} x={x0 + e.w / 2} y={y0 + 18 + j * 16} textAnchor="middle">{s}</text>)}</g>);
      return;
    }
    const along = g.orient === 'v';
    const boxNear = e.off + (e.side === 'a' ? (along ? 0 : e.hh) : 0);
    const a0 = g.P(e.u, boxNear);
    let x0: number, y0: number;
    if (along) { x0 = e.side === 'a' ? a0[0] - e.w : a0[0]; y0 = a0[1] - e.hh / 2; }
    else { x0 = a0[0] - e.w / 2; y0 = e.side === 'a' ? a0[1] - e.hh : a0[1]; }
    out.push(<line key={K()} className="tl-lead" x1={a0[0]} y1={a0[1]} x2={tip[0]} y2={tip[1]} style={{ stroke: c }} markerEnd="url(#tl-head)" />);
    out.push(<g key={K()} className={'tl-box' + (data.boxes === false ? ' tl-nobox' : '')}><rect x={x0} y={y0} width={e.w} height={e.hh} style={{ stroke: c }} />
      {e.text.map((s: string, j: number) => <text key={j} className={j ? 'tl-sub' : 'tl-elabel'} x={x0 + e.w / 2} y={y0 + 18 + j * 16} textAnchor="middle">{s}</text>)}</g>);
  });
  return <g className="tl"><defs><marker id="tl-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L10,5 L0,9 z" className="tl-headp" /></marker></defs>{out}</g>;
}
function cy0(a: number, ro: number) { return R + 60 + Math.sin(a) * ro; }

function Overlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const g = geom(data);
  return <>{eventLayout(data, g).map((e: any) => {
    const p = g.P(e.u, 0), on = sel && sel.kind === 'event' && sel.id === String(e.i);
    return <circle key={e.i} className={'mk-hit' + (on ? ' mk-on' : '')} cx={p[0]} cy={p[1]} r={9}
      onPointerDown={ev => {
        setSel({ kind: 'event', id: String(e.i) });
        startDrag(ev, toSvg, (_dx, _dy, at) => {
          const t = g.inverse(at[0], at[1]);
          set({ events: data.events.map((x: any, j: number) => j === e.i ? { ...x, date: fmtDate(t, g.scale) } : x) }, 'tl-drag-' + e.i);
        });
      }} />;
  })}</>;
}

const SIDE_OPTS: [string, string][] = [['auto', 'Alternate'], ['a', 'Above / left'], ['b', 'Below / right']];
function Controls({ data, set, sel, setSel }: EditProps) {
  const ev = data.events || [], pd = data.periods || [];
  const i = sel && sel.kind === 'event' ? +sel.id : -1, e = ev[i];
  const up = (patch: any, key?: string) => set({ events: ev.map((x: any, j: number) => j === i ? { ...x, ...patch } : x) }, key);
  const dateHelp = data.scale === 'ma' ? 'Millions of years ago, e.g. 66 or 251.9' : data.scale === 'cycle' ? 'A month and day, e.g. Nov 15' : 'e.g. 2010, 2010-03, or Mar 2010';
  return (
    <>
      {e ? (
        <S.Panel kicker="Selected event" help="Drag its dot along the line to move it in time.">
          <TextIn id="tl-elabel" label="Label" value={e.label} onChange={v => up({ label: v }, 'tl-l')} />
          <div className="mk-pair">
            <TextIn id="tl-edate" label="Date" value={e.date} placeholder={dateHelp} onChange={v => up({ date: v }, 'tl-d')} />
            <TextIn id="tl-esub" label="Second line" value={e.sub} placeholder="Shows the date if empty" onChange={v => up({ sub: v }, 'tl-s')} />
          </div>
          <Seg value={e.side || 'auto'} options={SIDE_OPTS} onChange={v => up({ side: v })} />
          <Swatches label="Colour" value={e.color} none="Ink" onChange={v => up({ color: v })} />
          <S.ToolButton onClick={() => { set({ events: ev.filter((_: any, j: number) => j !== i) }); setSel(null); }}>Delete event</S.ToolButton>
        </S.Panel>
      ) : null}
      <S.Panel kicker="Scale">
        <Seg value={data.scale} options={[['calendar', 'Years'], ['ma', 'Ma (geological)'], ['cycle', '12-month cycle']]}
          onChange={v => set(v === 'ma' ? { scale: v, from: 540, to: 0, step: 50 } : v === 'cycle' ? { scale: v, orient: 'c', step: 1 } : { scale: v, from: 2020, to: 2030, step: 1 })} />
        <Seg value={data.orient} options={[['h', 'Horizontal'], ['v', 'Vertical'], ['c', 'Circular']]} onChange={v => set({ orient: v })} />
        {data.scale !== 'cycle' ? <div className="mk-pair">
          <TextIn id="tl-from" label={data.scale === 'ma' ? 'Oldest (Ma)' : 'Start'} value={data.from} onChange={v => set({ from: v }, 'tl-from')} />
          <TextIn id="tl-to" label={data.scale === 'ma' ? 'Youngest (Ma)' : 'End'} value={data.to} onChange={v => set({ to: v }, 'tl-to')} />
        </div> : null}
        <div className="mk-pair">
          <TextIn id="tl-step" label="Tick every" value={data.step} onChange={v => set({ step: v }, 'tl-step')} />
          <TextIn id="tl-minor" label="Minor ticks" value={data.minor} onChange={v => set({ minor: v }, 'tl-minor')} />
        </div>
        <Seg value={data.tickLabels || 'ticks'} options={[['ticks', 'Label ticks'], ['between', 'Between ticks'], ['none', 'No labels']]} onChange={v => set({ tickLabels: v })} />
        {data.orient === 'v' ? <Range id="tl-len" label="Length" value={num(data.length, 640)} min={300} max={1400} step={20} onChange={v => set({ length: v }, 'tl-len')} /> : null}
        <Toggle on={data.showDate !== false} label="Show the date under each label" onChange={v => set({ showDate: v })} />
        <Toggle on={data.boxes !== false} label="Boxes around labels" onChange={v => set({ boxes: v })} />
        {data.orient !== 'c' ? <Toggle on={data.arrows !== false} label="Arrowheads on the line" onChange={v => set({ arrows: v })} /> : null}
        <Swatches label="Line colour" value={data.axisColor} none="Ink" colors={['var(--accent-700)', 'var(--edge-feedback-neg)', 'var(--edge-induce)', 'var(--swatch-16)']} onChange={v => set({ axisColor: v })} />
      </S.Panel>
      {data.scale === 'ma' ? (
        <S.Panel kicker="Geological timescale" help="ICS chart colours. Names shorten to their abbreviation where a unit is narrow.">
          <Toggle on={data.geo} label="Show timescale rows" onChange={v => set({ geo: v })} />
          {data.geo ? <div className="sd-row-btns" style={{ flexWrap: 'wrap' }}>{LEVELS.map(([lv, l]) => {
            const on = (data.geoLevels || []).includes(lv);
            return <S.ToolButton key={lv} compact on={on} onClick={() => set({ geoLevels: LEVELS.map(x => x[0]).filter(x => x === lv ? !on : (data.geoLevels || []).includes(x)) })}>{l}</S.ToolButton>;
          })}</div> : null}
        </S.Panel>
      ) : null}
      <Rows id="tl-ev" kicker="Events" help={'Dates: ' + dateHelp + '. Click a dot on the line to edit it.'} rows={ev}
        cols={[{ key: 'date', label: 'Date', w: '0.9fr' }, { key: 'label', label: 'Label', w: '1.3fr' }, { key: 'side', label: 'Side', type: 'select', options: [['auto', 'Auto'], ['a', 'Above'], ['b', 'Below']], w: '0.75fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ date: data.scale === 'ma' ? '100' : data.scale === 'cycle' ? 'Jun 1' : String(Math.round((num(data.from, 2020) + num(data.to, 2030)) / 2)), label: 'New event', side: 'auto' })}
        addLabel="+ Add event" onChange={(rows, key) => set({ events: rows }, key)} />
      <Rows id="tl-pd" kicker="Periods" help="Bars that span a range of dates. Row 0 sits nearest the line." rows={pd}
        cols={[{ key: 'from', label: 'From', w: '0.8fr' }, { key: 'to', label: 'To', w: '0.8fr' }, { key: 'label', label: 'Label', w: '1.2fr' }, { key: 'row', label: 'Row', type: 'num', w: '0.4fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ from: data.scale === 'cycle' ? 'Jan' : data.from, to: data.scale === 'cycle' ? 'Mar' : data.to, label: 'Period', row: 0, color: 'var(--swatch-3)' })}
        addLabel="+ Add period" onChange={(rows, key) => set({ periods: rows }, key)} />
    </>
  );
}

export const timeline: EditorDef = {
  id: 'timeline', num: '14', name: 'Timeline', field: 'Methods',
  blurb: 'Dated events and periods on a horizontal, vertical or circular line, with a detailed geological timescale.',
  hint: 'Click an event dot to edit it; drag it along the line to change its date.',
  templates: [
    { name: 'Research project', desc: 'Milestones above and below the line', title: 'Honours project timeline',
      data: { scale: 'calendar', orient: 'h', from: 2026, to: 2028, step: 1, minor: 3, tickLabels: 'between', showDate: true, boxes: true,
        events: [{ date: 'Feb 2026', label: 'Proposal', side: 'a' }, { date: 'Apr 2026', label: 'Ethics approval', side: 'b' }, { date: 'Jul 2026', label: 'Recruitment opens', side: 'a' },
          { date: 'Nov 2026', label: 'Data collection ends', side: 'b' }, { date: 'Mar 2027', label: 'Analysis', side: 'a' }, { date: 'Oct 2027', label: 'Thesis submitted', side: 'b', color: 'var(--accent-700)' }],
        periods: [] } },
    { name: 'Phanerozoic', desc: 'Mass extinctions over periods and eras', title: 'Major events of the Phanerozoic',
      caption: 'Dates in millions of years ago (Ma). Timescale colours follow the ICS chart.',
      data: { scale: 'ma', orient: 'h', from: 540, to: 0, step: 50, minor: 4, tickLabels: 'ticks', showDate: true, boxes: true, geo: true, geoLevels: ['period', 'era'],
        events: [{ date: '538.8', label: 'Cambrian explosion', side: 'a' }, { date: '443.8', label: 'End-Ordovician extinction', side: 'a' }, { date: '372', label: 'Late Devonian extinction', side: 'a' },
          { date: '251.9', label: 'End-Permian extinction', side: 'a', color: 'var(--edge-feedback-neg)' }, { date: '201.4', label: 'End-Triassic extinction', side: 'a' }, { date: '66', label: 'K–Pg extinction', side: 'a', color: 'var(--edge-feedback-neg)' }],
        periods: [] } },
    { name: 'Vertical Cenozoic', desc: 'Epochs down the page', title: 'The Cenozoic, epoch by epoch',
      data: { scale: 'ma', orient: 'v', length: 720, from: 66, to: 0, step: 5, minor: 4, tickLabels: 'ticks', showDate: true, boxes: true, geo: true, geoLevels: ['period', 'epoch'],
        events: [{ date: '66', label: 'K–Pg extinction', side: 'a' }, { date: '56', label: 'PETM warming', side: 'a' }, { date: '34', label: 'Antarctic ice sheet forms', side: 'a' }, { date: '7', label: 'First hominins', side: 'a' }, { date: '2.6', label: 'Ice ages begin', side: 'a' }],
        periods: [] } },
    { name: 'Reef year', desc: 'Circular 12-month cycle', title: 'A typical year on the Great Barrier Reef',
      data: { scale: 'cycle', orient: 'c', step: 1, minor: 0, tickLabels: 'between', showDate: false, boxes: true,
        events: [{ date: 'Nov 20', label: 'Coral mass spawning' }, { date: 'Jul 1', label: 'Humpbacks arrive' }, { date: 'Feb 15', label: 'Peak bleaching risk' }],
        periods: [{ from: 'Nov 1', to: 'Dec 31', label: 'Wet season', row: 0, color: 'var(--swatch-3)' }, { from: 'Jan 1', to: 'Apr 30', label: 'Wet season', row: 0, color: 'var(--swatch-3)' },
          { from: 'Jun 1', to: 'Oct 31', label: 'Whale season', row: 1, color: 'var(--swatch-15)' }] } }
  ],
  blank: { scale: 'calendar', orient: 'h', from: 2020, to: 2030, step: 1, minor: 0, tickLabels: 'ticks', showDate: true, boxes: true, events: [{ date: '2025', label: 'Event', side: 'auto' }], periods: [] },
  stats: d => [[(d.events || []).length, 'events'], [(d.periods || []).length, 'periods']],
  Controls, Overlay,
  Render: ({ data }) => <TimelineSheet data={data} />,
  findText: (d, text) => { const i = (d.events || []).findIndex((e: any) => e.label === text.trim()); return i >= 0 ? { kind: 'event', id: String(i) } : null; },
  remove: (d, sel) => sel.kind === 'event' ? { events: d.events.filter((_: any, j: number) => j !== +sel.id) } : null,
  duplicate: (d, sel) => { const e = d.events[+sel.id]; return e ? { patch: { events: [...d.events, { ...e, label: e.label + ' (copy)' }] }, sel: { kind: 'event', id: String(d.events.length) } } : null; },
  nudge: (d, sel, dx, dy) => {
    if (sel.kind !== 'event') return null;
    const g = geom(d), e = d.events[+sel.id]; if (!e) return null;
    const t = parseDate(e.date, g.scale); if (!isFinite(t)) return null;
    const du = g.orient === 'v' ? dy : dx; if (!du) return null;
    return { events: d.events.map((x: any, j: number) => j === +sel.id ? { ...x, date: fmtDate(t + du / g.len * (g.t1 - g.t0) * 5, g.scale) } : x) };
  },
};
void uid;
