import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, Seg, Select, startDrag, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

/* Templates 17 and 18 of the pharmacy plan. Both draw on SciDiagram.XYAxis (src/lib/xyaxis.js) and
   pass it explicit domains, so the annotation layer and the overlay can rebuild the same scales. */

const W = 780, H = 440;
const CAT = (i: number) => 'var(--cat-' + (i % 6 + 1) + ')';
const LN2 = Math.log(2);
const sig = (v: number, n = 3) => (isFinite(v) ? Number(v.toPrecision(n)) : 0);
const f1 = (v: number) => (isFinite(v) ? Number.isInteger(v) ? String(v) : (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)) : '–');
const sup = (s: string) => s.replace(/-/g, '⁻').replace(/[0-9]/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
/* 3.2e-7 → "3.2 × 10⁻⁷" for panels and the readout */
function sci(v: number) {
  if (!(v > 0)) return '–';
  const e = Math.floor(Math.log10(v)), m = sig(v / Math.pow(10, e), 2);
  return (m === 1 ? '' : m + ' × ') + '10' + sup(String(e));
}
/* the same number in ChemText syntax, for labels drawn on the sheet */
function sciChem(v: number) {
  if (!(v > 0)) return '–';
  const e = Math.floor(Math.log10(v)), m = sig(v / Math.pow(10, e), 2);
  return (m === 1 ? '' : m + ' × ') + '10^{' + e + '}';
}
function scales(xType: string, xDom: number[], yType: string, yDom: number[], M: any) {
  const xy = S.xy;
  return { sx: xy.makeScale(xType, xDom, [M.left, W - M.right]), sy: xy.makeScale(yType, yDom, [H - M.bottom, M.top]) };
}
function niceMax(v: number) { const st = S.xy.niceStep(v, 6); return Math.ceil(v * 1.08 / st) * st; }

/* ===================================================================== */
/* 17 · Plasma concentration–time curve                                   */
/* ===================================================================== */

const ROUTES: [string, string][] = [['oral', 'Oral'], ['iv', 'IV bolus'], ['infusion', 'IV infusion'], ['iv2', 'IV, 2 compartments']];
/* two-compartment IV bolus: C = D/V1·(A·e^(−αt) + B·e^(−βt)), with α + β = k12 + k21 + k10 and αβ = k21·k10 */
function hybrid(r: any) {
  const k12 = num(r.k12, 0.5), k21 = num(r.k21, 0.3), k10 = num(r.ke, 0.12), s = k12 + k21 + k10, q = Math.sqrt(Math.max(0, s * s - 4 * k21 * k10));
  const al = (s + q) / 2, be = (s - q) / 2;
  return { al, be, A: (al - k21) / (al - be || 1e-9), B: (k21 - be) / (al - be || 1e-9) };
}
const terminalK = (r: any) => r.route === 'iv2' ? hybrid(r).be : num(r.ke, 0.12);

/* One dose given at t = 0. Units: dose mg, V L, rate constants h⁻¹, so C is mg L⁻¹. */
function oneDose(r: any, t: number) {
  if (t < 0) return 0;
  const D = num(r.dose, 500), V = num(r.V, 40), ke = num(r.ke, 0.12);
  if (r.route === 'iv') return D / V * Math.exp(-ke * t);
  if (r.route === 'iv2') { const h = hybrid(r); return D / V * (h.A * Math.exp(-h.al * t) + h.B * Math.exp(-h.be * t)); }
  if (r.route === 'infusion') {
    const T = Math.max(0.01, num(r.tinf, 1)), R = D / T;
    return t <= T ? R / (V * ke) * (1 - Math.exp(-ke * t)) : R / (V * ke) * (1 - Math.exp(-ke * T)) * Math.exp(-ke * (t - T));
  }
  const F = num(r.F, 1), ka = num(r.ka, 1.2);
  if (Math.abs(ka - ke) < 1e-9) return F * D * ke * t * Math.exp(-ke * t) / V;
  return F * D * ka / (V * (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t));
}
const doses = (d: any, r: any) => d.mode === 'multiple' ? Math.max(1, Math.round(num(r.n, 6))) : 1;
/* superposition: every dose adds its own curve, shifted by k·τ */
function conc(d: any, r: any, t: number) {
  const n = doses(d, r), tau = num(r.tau, 8); let c = 0;
  for (let k = 0; k < n; k++) c += oneDose(r, t - k * tau);
  return c;
}
function pkStats(d: any, r: any) {
  const ke = num(r.ke, 0.12), F = r.route === 'oral' ? num(r.F, 1) : 1, D = num(r.dose, 500), V = num(r.V, 40), tEnd = num(d.tEnd, 24);
  let cmax = -1, tmax = 0;
  const N = 4000;
  for (let i = 0; i <= N; i++) { const t = tEnd * i / N, c = conc(d, r, t); if (c > cmax) { cmax = c; tmax = t; } }
  /* a single oral dose has an exact tmax; use it so the readout is not limited by sampling */
  if (d.mode !== 'multiple' && r.route === 'oral') { const ka = num(r.ka, 1.2); if (Math.abs(ka - ke) > 1e-9) { tmax = Math.log(ka / ke) / (ka - ke); cmax = oneDose(r, tmax); } }
  const out: any = { cmax, tmax, auc: doses(d, r) * F * D / (V * ke), thalf: LN2 / terminalK(r) };
  if (d.mode === 'multiple') {
    const tau = num(r.tau, 8), K = Math.min(400, Math.ceil(14 / (terminalK(r) * tau)) + 4);
    let hi = -1, lo = Infinity;
    for (let i = 0; i <= 300; i++) { const t = tau * i / 300; let c = 0; for (let k = 0; k <= K; k++) c += oneDose(r, t + k * tau); hi = Math.max(hi, c); lo = Math.min(lo, c); }
    out.cssMax = hi; out.cssMin = lo;
  }
  return out;
}
function crossings(d: any, r: any, level: number) {
  const tEnd = num(d.tEnd, 24), N = 4000; let on: number | null = null, off: number | null = null, prev = conc(d, r, 0);
  for (let i = 1; i <= N; i++) {
    const t = tEnd * i / N, c = conc(d, r, t);
    if (prev < level && c >= level && on == null) on = t;
    if (prev >= level && c < level) off = t;
    prev = c;
  }
  return { on, off };
}

const PK_SHOW = { cmax: true, tmax: true, auc: false, window: true, toxic: false, onset: false, phases: false, thalf: false, css: true, readout: true };
function pkNorm(d: any) {
  return {
    mode: 'single', tEnd: 24, yScale: 'linear', mec: 4, msc: 9, toxic: 12, legend: 'tr', cdx: 46, cdy: -8,
    xTitle: 'Time (h)', yTitle: 'Plasma concentration (mg L^{-1})', ...d,
    show: { ...PK_SHOW, ...(d.show || {}) }, regimens: Array.isArray(d.regimens) ? d.regimens : []
  };
}
const REG = (id: string, label: string, route: string, p: any = {}) => ({ id, label, route, dose: '500', F: '1', V: '40', ka: '1.2', ke: '0.12', thalf: '5.78', tau: '8', n: '6', tinf: '1', ...p });

function pkFrame(d: any) {
  const M = { top: d.show.phases && d.mode !== 'multiple' ? 58 : 30, right: 30, bottom: 62, left: 84 };
  const tEnd = Math.max(0.5, num(d.tEnd, 24));
  let hi = 0;
  d.regimens.forEach((r: any) => { const st = pkStats(d, r); hi = Math.max(hi, st.cmax); });
  if (d.show.window) hi = Math.max(hi, num(d.msc, 0));
  if (d.show.toxic) hi = Math.max(hi, num(d.toxic, 0));
  const log = d.yScale === 'log';
  const yDom = log ? [Math.pow(10, Math.floor(Math.log10(Math.max(1e-3, hi / 1000)))), Math.pow(10, Math.ceil(Math.log10(Math.max(1e-3, hi * 1.05))))] : [0, niceMax(Math.max(hi, 0.1))];
  const { sx, sy } = scales('linear', [0, tEnd], log ? 'log' : 'linear', yDom, M);
  return { M, tEnd, yDom, sx, sy, log, focus: d.regimens[0] };
}

function PKLayer({ d, f, focus }: { d: any; f: any; focus: any }) {
  if (!focus) return null;
  const out: any[] = []; let k = 0; const K = () => 'p' + k++;
  const { sx, sy, M } = f, st = pkStats(d, focus), single = d.mode !== 'multiple';
  const py0 = H - M.bottom, py1 = M.top;
  const bracket = (x0: number, x1: number, y: number, label: string, down = true) => {
    const t = down ? 5 : -5;
    out.push(<path key={K()} className="sd-xy-leader" d={`M${x0},${y + t}V${y}H${x1}V${y + t}`} />);
    out.push(<S.ChemText key={K()} className="sd-xy-reflab sd-xy-halo" x={(x0 + x1) / 2} y={y - 5} textAnchor="middle">{label}</S.ChemText>);
  };
  if (d.show.phases && single && focus.route !== 'iv' && focus.route !== 'iv2') {
    const tm = focus.route === 'infusion' ? num(focus.tinf, 1) : st.tmax, yb = py1 - 20;
    bracket(sx(0), sx(tm), yb, focus.route === 'infusion' ? 'Infusion' : 'Absorption phase');
    bracket(sx(tm), sx(f.tEnd), yb, 'Elimination phase');
  }
  if (d.show.thalf && single) {
    const th = LN2 / terminalK(focus), tA = (focus.route === 'iv' || focus.route === 'iv2' ? 0 : st.tmax) + Math.max(0.5, th * 0.5), tB = tA + th;
    if (tB < f.tEnd) {
      const cA = conc(d, focus, tA), cB = conc(d, focus, tB), xa = sx(tA), xb = sx(tB), ya = sy(cA), yb = sy(cB);
      out.push(<path key={K()} className="sd-xy-ref" d={`M${xa},${ya}H${xb}V${yb}`} />);
      out.push(<circle key={K()} className="sd-xy-dot" cx={xa} cy={ya} r={3} />, <circle key={K()} className="sd-xy-dot" cx={xb} cy={yb} r={3} />);
      out.push(<S.ChemText key={K()} className="sd-xy-legend sd-xy-halo" x={(xa + xb) / 2} y={ya - 7} textAnchor="middle">{'t_{½} = ' + f1(th) + ' h'}</S.ChemText>);
      out.push(<S.ChemText key={K()} className="sd-xy-reflab sd-xy-halo" x={xb + 6} y={(ya + yb) / 2 + 4}>C/2</S.ChemText>);
    }
  }
  if (d.show.onset && d.show.window) {
    const mec = num(d.mec, 4), cr = crossings(d, focus, mec), Y = sy(mec);
    if (cr.on != null && isFinite(Y)) {
      const x0 = sx(cr.on), x1 = sx(cr.off != null ? cr.off : f.tEnd);
      out.push(<circle key={K()} className="sd-xy-dot" cx={x0} cy={Y} r={3.4} />);
      out.push(<S.ChemText key={K()} className="sd-xy-reflab sd-xy-halo" x={x0} y={Math.min(py0 - 6, Y + 32)} textAnchor="middle">Onset</S.ChemText>);
      if (cr.off != null) {
        out.push(<circle key={K()} className="sd-xy-dot" cx={x1} cy={Y} r={3.4} />);
        out.push(<S.ChemText key={K()} className="sd-xy-reflab sd-xy-halo" x={x1} y={Math.min(py0 - 6, Y + 32)} textAnchor="middle">Termination</S.ChemText>);
      }
      bracket(x0, x1, Math.min(py0 - 30, Y + 16), 'Duration of action ' + f1((cr.off != null ? cr.off : f.tEnd) - cr.on) + ' h', false);
    }
  }
  return <g className="sd-xy">{out}</g>;
}

function PKReadout({ d, top }: { d: any; top: number }) {
  if (!d.show.readout || !d.regimens.length) return null;
  const multi = d.mode === 'multiple';
  const cols = ['Regimen', 'C_{max} (mg L^{-1})', 't_{max} (h)', 'AUC_{0–∞} (mg h L^{-1})', 't_{½} (h)', ...(multi ? ['C_{ss,max}', 'C_{ss,min}'] : [])];
  const xs = multi ? [84, 300, 420, 510, 650, 720, 800] : [84, 320, 460, 570, 720];
  const rows = d.regimens.map((r: any, i: number) => { const st = pkStats(d, r); return [r.label || 'Regimen ' + (i + 1), f1(st.cmax), f1(st.tmax), f1(st.auc), f1(st.thalf), ...(multi ? [f1(st.cssMax), f1(st.cssMin)] : [])]; });
  return <g className="sd-xy" transform={`translate(0,${top})`}>
    <line className="sd-xy-tick" x1={84} x2={xs[xs.length - 1] + 60} y1={20} y2={20} />
    {cols.map((c, j) => <S.ChemText key={'h' + j} className="sd-xy-legend" x={xs[j] + (j ? 0 : 34)} y={12} style={{ fontWeight: 600 }}>{c}</S.ChemText>)}
    {rows.map((row: any[], i: number) => <g key={'r' + i}>
      <line className="sd-xy-series" x1={84} x2={110} y1={38 + i * 20 - 4} y2={38 + i * 20 - 4} style={{ stroke: d.regimens[i].color || CAT(i), strokeDasharray: S.xy.DASHES[i % 6] || undefined }} />
      {row.map((v, j) => <S.ChemText key={j} className="sd-xy-legend" x={xs[j] + (j ? 0 : 34)} y={38 + i * 20}>{v}</S.ChemText>)}
    </g>)}
  </g>;
}

function pkRender({ data }: any) {
  const d = pkNorm(data);
  if (!d.regimens.length) return <EmptyHint text="Add a dosing regimen in the sidebar." />;
  const f = pkFrame(d), focus = f.focus, st = pkStats(d, focus);
  const series = d.regimens.map((r: any, i: number) => ({ id: r.id, label: r.label, color: r.color || CAT(i), dash: S.xy.DASHES[i % 6], fn: (t: number) => conc(d, r, t) }));
  const refLines: any[] = [], bands: any[] = [], areas: any[] = [], callouts: any[] = [];
  if (d.show.window) { bands.push({ y0: num(d.mec, 4), y1: num(d.msc, 9), label: 'Therapeutic window' }); refLines.push({ axis: 'y', value: num(d.msc, 9), label: 'MSC' }, { axis: 'y', value: num(d.mec, 4), label: 'MEC' }); }
  if (d.show.toxic) refLines.push({ axis: 'y', value: num(d.toxic, 12), label: 'Toxic level' });
  if (d.show.tmax) refLines.push({ axis: 'x', value: st.tmax, label: 't_{max}' });
  if (d.show.css && d.mode === 'multiple' && st.cssMax != null) refLines.push({ axis: 'y', value: st.cssMax, label: 'C_{ss,max}' }, { axis: 'y', value: st.cssMin, label: 'C_{ss,min}' });
  if (d.show.auc) areas.push({ series: focus.id, x0: 0, x1: f.tEnd, label: 'AUC' });
  if (d.show.cmax) callouts.push({ x: st.tmax, y: st.cmax, text: 'C_{max} ' + f1(st.cmax) + ' mg L^{-1}', dx: num(d.cdx, 46), dy: num(d.cdy, -8) });
  return <>
    <S.XYAxis width={W} height={H} margin={f.M} x={{ domain: [0, f.tEnd], title: d.xTitle }} y={{ type: f.log ? 'log' : 'linear', domain: f.yDom, title: d.yTitle, grid: true }}
      series={series} refLines={refLines} bands={bands} areas={areas} callouts={callouts} legend={d.regimens.length > 1 ? d.legend : false} />
    <PKLayer d={d} f={f} focus={focus} />
    <PKReadout d={d} top={H + 10} />
  </>;
}

function pkOverlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const d = pkNorm(data);
  if (!d.regimens.length) return null;
  const f = pkFrame(d), st = pkStats(d, f.focus);
  const S2 = (p: any, key?: string) => set({ ...d, ...p }, key);
  const out: any[] = [];
  d.regimens.forEach((r: any) => {
    const pts = S.xy.sample((t: number) => conc(d, r, t), [0, f.tEnd], 'linear', 400);
    const on = sel && sel.kind === 'series' && sel.id === r.id;
    out.push(<path key={'s' + r.id} className={'mk-hit-line' + (on ? ' mk-on' : '')} d={S.xy.pathFrom(pts, f.sx, f.sy)} onPointerDown={ev => { ev.stopPropagation(); setSel({ kind: 'series', id: r.id }); }} />);
  });
  if (d.show.window) (['mec', 'msc'] as const).forEach(key => {
    const Y = f.sy(num(d[key], 0)); if (!isFinite(Y)) return;
    const on = sel && sel.kind === 'line' && sel.id === key;
    out.push(<rect key={key} className={'mk-hit' + (on ? ' mk-on' : '')} x={f.M.left} y={Y - 5} width={W - f.M.left - f.M.right} height={10}
      onPointerDown={ev => { setSel({ kind: 'line', id: key }); startDrag(ev, toSvg, (_dx, _dy, at) => { const v = sig(f.sy.invert(at[1]), 3); if (v > 0) S2({ [key]: String(v) }, 'drag-' + key); }); }} />);
  });
  if (d.show.cmax) {
    const X = f.sx(st.tmax), Y = f.sy(st.cmax), dx0 = num(d.cdx, 46), dy0 = num(d.cdy, -8);
    out.push(<rect key="callout" className="mk-hit" x={X + dx0 - 4} y={Y + dy0 - 8} width={150} height={24}
      onPointerDown={ev => startDrag(ev, toSvg, (dx, dy) => S2({ cdx: Math.round(dx0 + dx), cdy: Math.round(dy0 + dy) }, 'callout'))} />);
  }
  return <>{out}</>;
}

function pkControls({ data, set, sel, setSel }: EditProps) {
  const d = pkNorm(data);
  const S2 = (p: any, key?: string) => set({ ...d, ...p }, key);
  const r = sel && sel.kind === 'series' ? d.regimens.find((x: any) => x.id === sel.id) : d.regimens[0];
  const upR = (p: any, key?: string) => r && S2({ regimens: d.regimens.map((x: any) => x === r ? { ...x, ...p } : x) }, key);
  const sh = (k: string) => (v: boolean) => S2({ show: { ...d.show, [k]: v } });
  const i = d.regimens.indexOf(r);
  return <>
    {r ? <S.Panel kicker={'Regimen · ' + (r.label || 'Regimen ' + (i + 1))} help="The first regimen carries the annotations. Click a curve on the sheet to edit it. Drag MEC or MSC, or the Cmax label, to move them.">
      <TextIn id="pk-label" label="Label" value={r.label} onChange={v => upR({ label: v }, 'lab-' + r.id)} />
      <Seg value={r.route} options={ROUTES} onChange={v => upR({ route: v })} />
      <div className="mk-pair">
        <TextIn id="pk-dose" label="Dose (mg)" value={r.dose} onChange={v => upR({ dose: v }, 'dose-' + r.id)} />
        <TextIn id="pk-V" label="V (L)" value={r.V} onChange={v => upR({ V: v }, 'V-' + r.id)} />
      </div>
      {r.route === 'oral' ? <div className="mk-pair">
        <TextIn id="pk-F" label="F (0–1)" value={r.F} onChange={v => upR({ F: v }, 'F-' + r.id)} />
        <TextIn id="pk-ka" label="ka (h⁻¹)" value={r.ka} onChange={v => upR({ ka: v }, 'ka-' + r.id)} />
      </div> : null}
      {r.route === 'iv2' ? <div className="mk-pair">
        <TextIn id="pk-k12" label="k12 (h⁻¹)" value={r.k12} placeholder="0.5" onChange={v => upR({ k12: v }, 'k12-' + r.id)} />
        <TextIn id="pk-k21" label="k21 (h⁻¹)" value={r.k21} placeholder="0.3" onChange={v => upR({ k21: v }, 'k21-' + r.id)} />
      </div> : null}
      {r.route === 'iv2' ? <p className="sd-help">ke is k10, elimination from the central compartment. t½ in the readout is the terminal (β) half-life. V is V1.</p> : null}
      {r.route === 'infusion' ? <TextIn id="pk-tinf" label="Infusion time (h)" value={r.tinf} onChange={v => upR({ tinf: v }, 'tinf-' + r.id)} /> : null}
      <div className="mk-pair">
        <TextIn id="pk-ke" label="ke (h⁻¹)" value={r.ke} onChange={v => upR({ ke: v, thalf: num(v, 0) > 0 ? String(sig(LN2 / num(v, 1))) : r.thalf }, 'ke-' + r.id)} />
        <TextIn id="pk-th" label="t½ (h)" value={r.thalf} onChange={v => upR({ thalf: v, ke: num(v, 0) > 0 ? String(sig(LN2 / num(v, 1))) : r.ke }, 'th-' + r.id)} />
      </div>
      {d.mode === 'multiple' ? <div className="mk-pair">
        <TextIn id="pk-tau" label="Dosing interval τ (h)" value={r.tau} onChange={v => upR({ tau: v }, 'tau-' + r.id)} />
        <TextIn id="pk-n" label="Number of doses" value={r.n} onChange={v => upR({ n: v }, 'n-' + r.id)} />
      </div> : null}
      {i > 0 ? <S.ToolButton compact onClick={() => S2({ regimens: [r, ...d.regimens.filter((x: any) => x !== r)] })}>Annotate this regimen</S.ToolButton> : null}
    </S.Panel> : null}
    <Rows id="pk-r" kicker="Regimens" help="Up to 3 regimens, for comparing routes, doses or intervals." rows={d.regimens}
      cols={[{ key: 'label', label: 'Label', w: '2fr' }, { key: 'route', label: 'Route', type: 'select', options: ROUTES, w: '1.2fr' }, { key: 'color', label: 'Colour', type: 'color', colors: Array.from({ length: 6 }, (_, j) => CAT(j)) }]}
      blank={() => REG(uid('R', d.regimens.map((x: any) => x.id)), 'Regimen ' + (d.regimens.length + 1), 'oral')} addLabel={d.regimens.length < 3 ? '+ Add regimen' : 'Three regimens at most'}
      onChange={(rows, key) => S2({ regimens: rows.slice(0, 3) }, key)} />
    <S.Panel kicker="Dosing and axes">
      <Seg value={d.mode} options={[['single', 'Single dose'], ['multiple', 'Multiple dosing']]} onChange={v => S2({ mode: v, tEnd: v === 'multiple' && num(d.tEnd, 24) <= 24 ? 72 : d.tEnd })} />
      <Range id="pk-tend" label="Time axis length (h)" value={num(d.tEnd, 24)} min={2} max={240} step={2} onChange={v => S2({ tEnd: v }, 'tend')} />
      <Seg value={d.yScale} options={[['linear', 'Linear y'], ['log', 'Semi-log y']]} onChange={v => S2({ yScale: v })} />
      <TextIn id="pk-xt" label="Time axis title" value={d.xTitle} onChange={v => S2({ xTitle: v }, 'xt')} />
      <TextIn id="pk-yt" label="Concentration axis title" value={d.yTitle} onChange={v => S2({ yTitle: v }, 'yt')} />
    </S.Panel>
    <S.Panel kicker="Annotations" help="Annotations follow the first regimen.">
      <Toggle on={d.show.cmax} label="Cmax label" onChange={sh('cmax')} />
      <Toggle on={d.show.tmax} label="tmax line" onChange={sh('tmax')} />
      <Toggle on={d.show.auc} label="AUC shading" onChange={sh('auc')} />
      <Toggle on={d.show.window} label="Therapeutic window (MEC to MSC)" onChange={sh('window')} />
      {d.show.window ? <div className="mk-pair">
        <TextIn id="pk-mec" label="MEC (mg L⁻¹)" value={d.mec} onChange={v => S2({ mec: v }, 'mec')} />
        <TextIn id="pk-msc" label="MSC (mg L⁻¹)" value={d.msc} onChange={v => S2({ msc: v }, 'msc')} />
      </div> : null}
      <Toggle on={d.show.toxic} label="Toxic level" onChange={sh('toxic')} />
      {d.show.toxic ? <TextIn id="pk-tox" label="Toxic level (mg L⁻¹)" value={d.toxic} onChange={v => S2({ toxic: v }, 'tox')} /> : null}
      {d.show.window ? <Toggle on={d.show.onset} label="Onset, duration and termination of action" onChange={sh('onset')} /> : null}
      {d.mode !== 'multiple' ? <Toggle on={d.show.phases} label="Absorption and elimination phases" onChange={sh('phases')} /> : null}
      {d.mode !== 'multiple' ? <Toggle on={d.show.thalf} label="t½ marker" onChange={sh('thalf')} /> : null}
      {d.mode === 'multiple' ? <Toggle on={d.show.css} label="Steady state Css,max and Css,min" onChange={sh('css')} /> : null}
      <Toggle on={d.show.readout} label="Readout table under the plot" onChange={sh('readout')} />
      {d.regimens.length > 1 ? <Select id="pk-leg" label="Legend" value={d.legend} options={[['tr', 'Top right'], ['tl', 'Top left'], ['br', 'Bottom right'], ['bl', 'Bottom left']]} onChange={v => S2({ legend: v })} /> : null}
    </S.Panel>
  </>;
}

export const pkcurve: EditorDef = {
  id: 'pk-curve', num: '17', name: 'Concentration–time curve', field: 'Pharmacology',
  blurb: 'Plasma concentration over time from dose, F, V, ka and ke: single or multiple dosing with Cmax, AUC and the therapeutic window.',
  hint: 'Click a curve to edit its regimen. Drag the MEC or MSC line, or the Cmax label.',
  normalize: pkNorm,
  templates: [
    { name: 'Single oral dose', desc: 'Annotated curve with phases and therapeutic window', title: 'Plasma concentration after a single oral dose',
      caption: 'One-compartment oral model, 500 mg, F = 1, V = 40 L, ka = 1.2 h⁻¹, ke = 0.12 h⁻¹. The shaded band is the therapeutic window between the minimum effective (MEC) and minimum toxic (MSC) concentrations.',
      data: pkNorm({ regimens: [REG('R1', 'Oral, 500 mg', 'oral')], show: { cmax: true, tmax: true, auc: true, window: true, onset: true, phases: true, thalf: true, readout: true } }) },
    { name: 'Multiple dosing', desc: 'Accumulation to steady state', title: 'Accumulation to steady state with repeated oral doses',
      caption: '250 mg every 8 h for 9 doses. Concentrations rise over about 4 to 5 half-lives until peaks and troughs level off at steady state.',
      data: pkNorm({ mode: 'multiple', tEnd: 80, mec: 3, msc: 9, regimens: [REG('R1', '250 mg every 8 h', 'oral', { dose: '250', n: '9' })], show: { cmax: false, tmax: false, window: true, css: true, readout: true } }) },
    { name: 'Routes compared', desc: 'IV bolus, IV infusion and oral', title: 'Plasma concentration by route of administration',
      caption: 'The same 500 mg dose given as an IV bolus, a 2 h IV infusion and an oral dose with F = 0.7.',
      data: pkNorm({ tEnd: 24, legend: 'tr', regimens: [REG('R1', 'IV bolus', 'iv'), REG('R2', 'IV infusion, 2 h', 'infusion', { tinf: '2' }), REG('R3', 'Oral, F = 0.7', 'oral', { F: '0.7' })], show: { cmax: false, tmax: false, window: true, readout: true } }) },
  ],
  stats: data => { const d = pkNorm(data); return [[d.regimens.length, 'regimens']]; },
  Controls: pkControls,
  Overlay: pkOverlay,
  Render: pkRender,
  findText: (data, text) => { const d = pkNorm(data), t = text.toLowerCase().trim(); const r = d.regimens.find((x: any) => String(x.label || '').toLowerCase() === t); return r ? { kind: 'series', id: r.id } : null; },
  remove: (data, sel) => { const d = pkNorm(data); return sel.kind === 'series' ? { ...d, regimens: d.regimens.filter((x: any) => x.id !== sel.id) } : null; },
  duplicate: (data, sel) => {
    const d = pkNorm(data), r = sel.kind === 'series' && d.regimens.find((x: any) => x.id === sel.id);
    if (!r || d.regimens.length >= 3) return null;
    const id = uid('R', d.regimens.map((x: any) => x.id));
    return { patch: { ...d, regimens: [...d.regimens, { ...r, id, label: r.label + ' (copy)', color: undefined }] }, sel: { kind: 'series', id } };
  },
  blank: pkNorm({ regimens: [REG('R1', 'Oral dose', 'oral')] }),
};

/* ===================================================================== */
/* 18 · Dose–response curve                                               */
/* ===================================================================== */

/* E = E0 + (Emax − E0)·[A]ⁿ / (EC50ⁿ + [A]ⁿ). With an antagonist [B] and its KB, a competitive
   antagonist moves EC50 right by the dose ratio DR = 1 + [B]/KB (Gaddum–Schild). */
const ec50Of = (d: any, c: any) => num(c.ec50, 1e-7) * (num(c.b, 0) > 0 && num(d.kb, 0) > 0 ? 1 + num(c.b, 0) / num(d.kb, 1) : 1);
const hill = (d: any, c: any) => { const e0 = num(c.e0, 0), em = num(c.emax, 100), n = num(c.n, 1), ec = ec50Of(d, c); return (A: number) => e0 + (em - e0) * Math.pow(A, n) / (Math.pow(ec, n) + Math.pow(A, n)); };
const DR_SHOW = { ec50: true, emax: false, schild: false, readout: true };
function drNorm(d: any) {
  return { xMin: -10, xMax: -3, kb: '1e-8', legend: 'tl', xTitle: '[A] (M)', yTitle: 'Response (% E_{max})', ...d, show: { ...DR_SHOW, ...(d.show || {}) }, curves: Array.isArray(d.curves) ? d.curves : [] };
}
const CUR = (id: string, label: string, p: any = {}) => ({ id, label, emax: '100', e0: '0', ec50: '1e-7', n: '1', b: '', ...p });

function drFrame(d: any) {
  const M = { top: 30, right: 30, bottom: 62, left: 84 };
  const xMin = Math.round(num(d.xMin, -10)), xMax = Math.max(xMin + 1, Math.round(num(d.xMax, -3)));
  let lo = 0, hi = 100;
  d.curves.forEach((c: any) => { lo = Math.min(lo, num(c.e0, 0), num(c.emax, 100)); hi = Math.max(hi, num(c.e0, 0), num(c.emax, 100)); });
  const yDom = [lo < 0 ? -niceMax(-lo) : 0, niceMax(hi) > hi * 1.12 ? Math.ceil(hi / 10) * 10 : niceMax(hi)];
  const xDom = [Math.pow(10, xMin), Math.pow(10, xMax)];
  return { M, xDom, yDom, ...scales('log', xDom, 'linear', yDom, M) };
}
/* Schild: log(DR − 1) against log[B] for every curve with an antagonist, relative to the first curve without one */
function schildPoints(d: any) {
  const ref = d.curves.find((c: any) => !(num(c.b, 0) > 0)); if (!ref) return { ref: null, pts: [] as number[][] };
  const pts = d.curves.filter((c: any) => num(c.b, 0) > 0).map((c: any) => { const dr = ec50Of(d, c) / ec50Of(d, ref); return dr > 1 ? [Math.log10(num(c.b, 0)), Math.log10(dr - 1)] : null; }).filter(Boolean) as number[][];
  return { ref, pts };
}
function fit(pts: number[][]) {
  const n = pts.length; if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0); if (!(sxx > 0)) return null;
  const m = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx, b = my - m * mx;
  return { m, b, pA2: -b / m };
}

function DRLayer({ d, f, focus }: { d: any; f: any; focus: any }) {
  if (!focus) return null;
  const out: any[] = []; let k = 0; const K = () => 'd' + k++;
  const ec = ec50Of(d, focus), e0 = num(focus.e0, 0), em = num(focus.emax, 100), mid = (e0 + em) / 2;
  const X = f.sx(ec), Y = f.sy(mid), px0 = f.M.left, py0 = H - f.M.bottom;
  if (d.show.ec50 && isFinite(X) && X >= px0 && X <= W - f.M.right) {
    out.push(<path key={K()} className="sd-xy-ref" d={`M${px0},${Y}H${X}V${py0}`} />);
    out.push(<circle key={K()} className="sd-xy-dot" cx={X} cy={Y} r={3.4} />);
    out.push(<S.ChemText key={K()} className="sd-xy-legend sd-xy-halo" x={X + 8} y={Y + 16}>{'EC_{50} = ' + sciChem(ec) + ' M'}</S.ChemText>);
  }
  if (d.show.emax) {
    const Ye = f.sy(em);
    out.push(<line key={K()} className="sd-xy-ref" x1={px0} x2={W - f.M.right} y1={Ye} y2={Ye} />);
    out.push(<S.ChemText key={K()} className="sd-xy-reflab sd-xy-halo" x={W - f.M.right - 4} y={Ye - 5} textAnchor="end">{'E_{max} ' + f1(em) + ' %'}</S.ChemText>);
  }
  return <g className="sd-xy">{out}</g>;
}

function DRReadout({ d, top }: { d: any; top: number }) {
  if (!d.show.readout || !d.curves.length) return null;
  const ref = schildPoints(d).ref;
  const anyB = d.curves.some((c: any) => num(c.b, 0) > 0);
  const cols = ['Curve', 'E_{max} (%)', 'EC_{50} (M)', 'pEC_{50}', 'Hill n', ...(anyB ? ['[B] (M)', 'Dose ratio'] : [])];
  const xs = anyB ? [84, 300, 390, 500, 580, 650, 740] : [84, 330, 440, 570, 680];
  return <g className="sd-xy" transform={`translate(0,${top})`}>
    <line className="sd-xy-tick" x1={84} x2={xs[xs.length - 1] + 70} y1={20} y2={20} />
    {cols.map((c, j) => <S.ChemText key={'h' + j} className="sd-xy-legend" x={xs[j] + (j ? 0 : 34)} y={12} style={{ fontWeight: 600 }}>{c}</S.ChemText>)}
    {d.curves.map((c: any, i: number) => {
      const ec = ec50Of(d, c), b = num(c.b, 0);
      const row = [c.label || 'Curve ' + (i + 1), f1(num(c.emax, 100)), sciChem(ec), (-Math.log10(ec)).toFixed(2), f1(num(c.n, 1)), ...(anyB ? [b > 0 ? sciChem(b) : '–', b > 0 && ref ? f1(ec / ec50Of(d, ref)) : '–'] : [])];
      return <g key={'r' + i}>
        <line className="sd-xy-series" x1={84} x2={110} y1={34 + i * 20} y2={34 + i * 20} style={{ stroke: c.color || CAT(i), strokeDasharray: S.xy.DASHES[i % 6] || undefined }} />
        {row.map((v, j) => <S.ChemText key={j} className="sd-xy-legend" x={xs[j] + (j ? 0 : 34)} y={38 + i * 20}>{v}</S.ChemText>)}
      </g>;
    })}
  </g>;
}

function Schild({ d }: { d: any }) {
  const { pts } = schildPoints(d), ft = fit(pts);
  if (!pts.length) return <g className="sd-xy"><text x={W + 60} y={H / 2} className="sd-xy-reflab">Schild plot: give two or more curves an antagonist [B].</text></g>;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const xd = [Math.floor(Math.min(...xs) - 0.5), Math.ceil(Math.max(...xs) + 0.5)], yd = [Math.floor(Math.min(0, ...ys) - 0.5), Math.ceil(Math.max(...ys) + 0.5)];
  const series: any[] = [{ id: 'pts', points: pts, color: 'var(--ink)', markers: true, dash: '0 1000' }];
  if (ft) series.push({ id: 'fit', label: 'Fit: slope ' + ft.m.toFixed(2), fn: (x: number) => ft.m * x + ft.b, color: 'var(--accent-700)' });
  return <g transform={`translate(${W + 20},0)`}>
    <S.XYAxis width={420} height={H} x={{ domain: xd, title: 'log [B] (M)', ticks: 5 }} y={{ domain: yd, title: 'log (DR − 1)', ticks: 5, grid: true }} series={series} legend="tl"
      refLines={ft && ft.pA2 > xd[0] && ft.pA2 < xd[1] ? [{ axis: 'x', value: ft.pA2, label: 'pA_{2} = ' + (-ft.pA2).toFixed(2) + ', slope ' + ft.m.toFixed(2) }] : []} />
  </g>;
}

function drRender({ data }: any) {
  const d = drNorm(data);
  if (!d.curves.length) return <EmptyHint text="Add a curve in the sidebar." />;
  const f = drFrame(d), focus = d.curves[0];
  const series = d.curves.map((c: any, i: number) => ({ id: c.id, label: c.label, color: c.color || CAT(i), dash: S.xy.DASHES[i % 6], fn: hill(d, c) }));
  return <>
    <S.XYAxis width={W} height={H} margin={f.M} x={{ type: 'log', domain: f.xDom, title: d.xTitle }} y={{ domain: f.yDom, title: d.yTitle, grid: true }} series={series} legend={d.curves.length > 1 ? d.legend : false} />
    <DRLayer d={d} f={f} focus={focus} />
    {d.show.schild ? <Schild d={d} /> : null}
    <DRReadout d={d} top={H + 10} />
  </>;
}

function drOverlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const d = drNorm(data);
  if (!d.curves.length) return null;
  const f = drFrame(d);
  const up = (c: any, p: any, key: string) => set({ ...d, curves: d.curves.map((x: any) => x === c ? { ...x, ...p } : x) }, key);
  const out: any[] = [];
  d.curves.forEach((c: any) => {
    const pts = S.xy.sample(hill(d, c), f.xDom, 'log', 300), on = sel && sel.kind === 'series' && sel.id === c.id;
    out.push(<path key={'s' + c.id} className={'mk-hit-line' + (on ? ' mk-on' : '')} d={S.xy.pathFrom(pts, f.sx, f.sy)} onPointerDown={ev => { ev.stopPropagation(); setSel({ kind: 'series', id: c.id }); }} />);
  });
  d.curves.forEach((c: any) => {
    const on = sel && sel.kind === 'series' && sel.id === c.id; if (!on) return;
    const ec = ec50Of(d, c), shift = ec / num(c.ec50, 1e-7), mid = (num(c.e0, 0) + num(c.emax, 100)) / 2;
    /* EC50 handle: drag sideways along the log axis */
    out.push(<circle key={'ec' + c.id} className="mk-hit mk-handle" cx={f.sx(ec)} cy={f.sy(mid)} r={8}
      onPointerDown={ev => startDrag(ev, toSvg, (_dx, _dy, at) => { const v = f.sx.invert(at[0]) / shift; if (v > 0) up(c, { ec50: v.toExponential(2) }, 'ec-' + c.id); })} />);
    /* Emax handle on the plateau near the right edge: drag up or down */
    const xr = W - f.M.right - 24;
    out.push(<rect key={'em' + c.id} className="mk-hit mk-handle" x={xr - 7} y={f.sy(hill(d, c)(f.sx.invert(xr))) - 7} width={14} height={14}
      onPointerDown={ev => startDrag(ev, toSvg, (_dx, _dy, at) => up(c, { emax: String(Math.round(f.sy.invert(at[1]))) }, 'em-' + c.id))} />);
  });
  return <>{out}</>;
}

function drControls({ data, set, sel, setSel }: EditProps) {
  const d = drNorm(data);
  const S2 = (p: any, key?: string) => set({ ...d, ...p }, key);
  const c = sel && sel.kind === 'series' ? d.curves.find((x: any) => x.id === sel.id) : d.curves[0];
  const upC = (p: any, key?: string) => c && S2({ curves: d.curves.map((x: any) => x === c ? { ...x, ...p } : x) }, key);
  const sh = (k: string) => (v: boolean) => S2({ show: { ...d.show, [k]: v } });
  const i = d.curves.indexOf(c);
  return <>
    {c ? <S.Panel kicker={'Curve · ' + (c.label || 'Curve ' + (i + 1))} help="Click a curve to edit it. On the sheet, drag its round handle sideways to move EC50 and its square handle up or down to change Emax.">
      <TextIn id="dr-label" label="Label" value={c.label} onChange={v => upC({ label: v }, 'lab-' + c.id)} />
      <div className="mk-pair">
        <TextIn id="dr-emax" label="Emax (%)" value={c.emax} onChange={v => upC({ emax: v }, 'em-' + c.id)} />
        <TextIn id="dr-e0" label="Baseline E0 (%)" value={c.e0} onChange={v => upC({ e0: v }, 'e0-' + c.id)} />
      </div>
      <div className="mk-pair">
        <TextIn id="dr-ec" label="EC50 (M), e.g. 1e-7" value={c.ec50} onChange={v => upC({ ec50: v }, 'ec-' + c.id)} />
        <TextIn id="dr-n" label="Hill slope n" value={c.n} onChange={v => upC({ n: v }, 'n-' + c.id)} />
      </div>
      <TextIn id="dr-b" label="Competitive antagonist [B] (M), blank for none" value={c.b} placeholder="e.g. 1e-7" onChange={v => upC({ b: v }, 'b-' + c.id)} />
      {num(c.b, 0) > 0 ? <p className="sd-help">This curve's EC50 is moved right by the dose ratio 1 + [B]/KB = {f1(1 + num(c.b, 0) / num(d.kb, 1))}. Its EC50 shows as {sci(ec50Of(d, c))} M.</p> : null}
      {i > 0 ? <S.ToolButton compact onClick={() => S2({ curves: [c, ...d.curves.filter((x: any) => x !== c)] })}>Annotate this curve</S.ToolButton> : null}
    </S.Panel> : null}
    <Rows id="dr-c" kicker="Curves" help="Up to 6 curves. Each has its own dash pattern, so colour never carries meaning alone." rows={d.curves}
      cols={[{ key: 'label', label: 'Label', w: '2.2fr' }, { key: 'emax', label: 'Emax', type: 'num', w: '0.8fr' }, { key: 'color', label: 'Colour', type: 'color', colors: Array.from({ length: 6 }, (_, j) => CAT(j)) }]}
      blank={() => CUR(uid('C', d.curves.map((x: any) => x.id)), 'Curve ' + (d.curves.length + 1))} addLabel={d.curves.length < 6 ? '+ Add curve' : 'Six curves at most'}
      onChange={(rows, key) => S2({ curves: rows.slice(0, 6) }, key)} />
    <S.Panel kicker="Axes and antagonist">
      <Range id="dr-xmin" label={'Lowest [A]: 10' + sup(String(Math.round(num(d.xMin, -10)))) + ' M'} value={num(d.xMin, -10)} min={-14} max={-2} onChange={v => S2({ xMin: Math.min(v, num(d.xMax, -3) - 1) }, 'xmin')} />
      <Range id="dr-xmax" label={'Highest [A]: 10' + sup(String(Math.round(num(d.xMax, -3)))) + ' M'} value={num(d.xMax, -3)} min={-12} max={0} onChange={v => S2({ xMax: Math.max(v, num(d.xMin, -10) + 1) }, 'xmax')} />
      <TextIn id="dr-kb" label="Antagonist KB (M)" value={d.kb} onChange={v => S2({ kb: v }, 'kb')} />
      <TextIn id="dr-xt" label="Concentration axis title" value={d.xTitle} onChange={v => S2({ xTitle: v }, 'xt')} />
      <TextIn id="dr-yt" label="Response axis title" value={d.yTitle} onChange={v => S2({ yTitle: v }, 'yt')} />
    </S.Panel>
    <S.Panel kicker="Annotations" help="Drop lines follow the first curve.">
      <Toggle on={d.show.ec50} label="EC50 drop line" onChange={sh('ec50')} />
      <Toggle on={d.show.emax} label="Emax line" onChange={sh('emax')} />
      <Toggle on={d.show.schild} label="Schild plot beside the curves" onChange={sh('schild')} />
      <Toggle on={d.show.readout} label="Readout table under the plot" onChange={sh('readout')} />
      {d.curves.length > 1 ? <Select id="dr-leg" label="Legend" value={d.legend} options={[['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']]} onChange={v => S2({ legend: v })} /> : null}
    </S.Panel>
  </>;
}

export const doseresponse: EditorDef = {
  id: 'dose-response', num: '18', name: 'Dose–response curve', field: 'Pharmacology',
  blurb: 'Sigmoid Hill curves on a log concentration axis: agonists, partial agonists, competitive and non-competitive antagonists, with a Schild plot.',
  hint: 'Click a curve, then drag its round handle to move EC50 or its square handle to change Emax.',
  normalize: drNorm,
  templates: [
    { name: 'Full and partial agonist', desc: 'Same EC50, different maximum', title: 'Full and partial agonist at the same receptor',
      caption: 'Both agonists have EC₅₀ = 10⁻⁷ M. The partial agonist cannot reach the full response however high its concentration.',
      data: drNorm({ curves: [CUR('C1', 'Full agonist'), CUR('C2', 'Partial agonist', { emax: '55' })], show: { ec50: true, emax: true } }) },
    { name: 'Competitive antagonist', desc: 'Parallel right shift with a Schild plot', title: 'Competitive antagonism and the Schild plot',
      caption: 'A competitive antagonist (KB = 10⁻⁸ M) moves the agonist curve right in parallel by the dose ratio 1 + [B]/KB, with no fall in Emax. The Schild plot has slope 1 and gives pA₂ = 8.',
      data: drNorm({ kb: '1e-8', show: { ec50: true, schild: true }, curves: [CUR('C1', 'Agonist alone'), CUR('C2', '+ antagonist 10^{-8} M', { b: '1e-8' }), CUR('C3', '+ antagonist 10^{-7} M', { b: '1e-7' }), CUR('C4', '+ antagonist 10^{-6} M', { b: '1e-6' })] }) },
    { name: 'Non-competitive antagonist', desc: 'Emax falls, EC50 stays', title: 'Non-competitive antagonism lowers the maximum response',
      caption: 'Rising concentrations of a non-competitive antagonist lower Emax. Adding more agonist cannot overcome the block.',
      data: drNorm({ show: { ec50: false, emax: false }, curves: [CUR('C1', 'Agonist alone'), CUR('C2', '+ low antagonist', { emax: '70' }), CUR('C3', '+ medium antagonist', { emax: '45' }), CUR('C4', '+ high antagonist', { emax: '20' })] }) },
    { name: 'Inverse agonist', desc: 'Activity below the baseline', title: 'Agonist, neutral antagonist and inverse agonist',
      caption: 'The receptor has 20% constitutive activity. An agonist raises it, a neutral antagonist leaves it, and an inverse agonist lowers it below baseline.',
      data: drNorm({ show: { ec50: false }, curves: [CUR('C1', 'Agonist', { e0: '20' }), CUR('C2', 'Neutral antagonist', { e0: '20', emax: '20' }), CUR('C3', 'Inverse agonist', { e0: '20', emax: '0' })] }) },
    { name: 'Hill slope', desc: 'Steepness from n = 0.5 to 2', title: 'Effect of the Hill coefficient on curve steepness',
      caption: 'All curves share EC₅₀ = 10⁻⁷ M. A larger Hill coefficient n gives a steeper curve.',
      data: drNorm({ show: { ec50: true }, curves: [CUR('C1', 'n = 1'), CUR('C2', 'n = 0.5', { n: '0.5' }), CUR('C3', 'n = 2', { n: '2' })] }) },
  ],
  stats: data => { const d = drNorm(data); return [[d.curves.length, 'curves']]; },
  Controls: drControls,
  Overlay: drOverlay,
  Render: drRender,
  findText: (data, text) => { const d = drNorm(data), t = text.toLowerCase().trim(); const c = d.curves.find((x: any) => String(x.label || '').toLowerCase() === t); return c ? { kind: 'series', id: c.id } : null; },
  remove: (data, sel) => { const d = drNorm(data); return sel.kind === 'series' ? { ...d, curves: d.curves.filter((x: any) => x.id !== sel.id) } : null; },
  duplicate: (data, sel) => {
    const d = drNorm(data), c = sel.kind === 'series' && d.curves.find((x: any) => x.id === sel.id);
    if (!c || d.curves.length >= 6) return null;
    const id = uid('C', d.curves.map((x: any) => x.id));
    return { patch: { ...d, curves: [...d.curves, { ...c, id, label: c.label + ' (copy)', color: undefined }] }, sel: { kind: 'series', id } };
  },
  blank: drNorm({ curves: [CUR('C1', 'Agonist')] }),
};
