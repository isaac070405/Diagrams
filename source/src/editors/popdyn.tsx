import { S } from '../sheet';
import { num, Range, Rows, Seg, startDrag, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

/* 21 · Population over time. Curves are solved from the standard models (RK4, 2000 steps):
   predation   Lotka–Volterra, with an optional prey carrying capacity
   competition Lotka–Volterra competition between two species
   isolated    logistic growth of one species in separate habitats
   single      logistic growth in one habitat, with an optional time lag */

const W = 760, H = 430, M = { top: 30, right: 30, bottom: 62, left: 84 };
const CAT = (i: number) => 'var(--cat-' + (i % 6 + 1) + ')';
const STEPS = 2000;
const f1 = (v: number) => (!isFinite(v) ? '–' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
const MODES: [string, string][] = [['predation', 'Predation'], ['competition', 'Competition'], ['isolated', 'Isolated groups'], ['single', 'Single population']];

function norm(d: any) {
  return { mode: 'single', tEnd: 30, xTitle: 'Time', yTitle: 'Population size (N)', phase: false, readout: true, legend: 'tr', ...d,
    pred: { prey: 'Prey', predator: 'Predator', r: '1', a: '0.02', b: '0.5', m: '0.8', N0: '40', P0: '9', K: '', ...(d.pred || {}) },
    comp: { n1: 'Species 1', n2: 'Species 2', r1: '0.8', r2: '0.6', K1: '500', K2: '400', a12: '0.5', a21: '0.6', N1: '20', N2: '20', ...(d.comp || {}) },
    single: { label: 'Population', r: '0.5', K: '1000', N0: '10', lag: '0', showExp: true, showK: true, showHalf: true, ...(d.single || {}) },
    groups: Array.isArray(d.groups) ? d.groups : [] };
}

/* RK4 for a system y' = f(y); values below zero are held at zero */
function rk4(f: (y: number[]) => number[], y0: number[], tEnd: number) {
  const dt = tEnd / STEPS, out: number[][] = [[0, ...y0]];
  let y = y0.slice();
  for (let i = 1; i <= STEPS; i++) {
    const k1 = f(y), k2 = f(y.map((v, j) => v + dt / 2 * k1[j])), k3 = f(y.map((v, j) => v + dt / 2 * k2[j])), k4 = f(y.map((v, j) => v + dt * k3[j]));
    y = y.map((v, j) => Math.max(0, v + dt / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])));
    out.push([i * dt, ...y]);
  }
  return out;
}
/* logistic with a time lag τ (Hutchinson): dN/dt = rN(1 − N(t−τ)/K), stepped with small Euler steps */
function lagged(r: number, K: number, N0: number, tau: number, tEnd: number) {
  const dt = tEnd / (STEPS * 4), lagN = Math.round(tau / dt), N: number[] = [N0], out: number[][] = [[0, N0]];
  for (let i = 1; i <= STEPS * 4; i++) {
    const past = i - 1 - lagN >= 0 ? N[i - 1 - lagN] : N0, n = N[i - 1];
    N.push(Math.max(0, n + dt * r * n * (1 - past / K)));
    if (i % 4 === 0) out.push([i * dt, N[i]]);
  }
  return out;
}

function solve(d: any) {
  const T = Math.max(1, num(d.tEnd, 30));
  if (d.mode === 'predation') {
    const p = d.pred, r = num(p.r, 1), a = num(p.a, 0.02), b = num(p.b, 0.5), m = num(p.m, 0.8), K = num(p.K, 0);
    const tr = rk4(([N, P]) => [r * N * (K > 0 ? 1 - N / K : 1) - a * N * P, b * a * N * P - m * P], [num(p.N0, 40), num(p.P0, 9)], T);
    return { tr, names: [p.prey || 'Prey', p.predator || 'Predator'], K: K > 0 ? K : null };
  }
  if (d.mode === 'competition') {
    const c = d.comp, r1 = num(c.r1, 0.8), r2 = num(c.r2, 0.6), K1 = num(c.K1, 500), K2 = num(c.K2, 400), a12 = num(c.a12, 0.5), a21 = num(c.a21, 0.6);
    const tr = rk4(([x, y]) => [r1 * x * (K1 - x - a12 * y) / K1, r2 * y * (K2 - y - a21 * x) / K2], [num(c.N1, 20), num(c.N2, 20)], T);
    return { tr, names: [c.n1 || 'Species 1', c.n2 || 'Species 2'], K1, K2, a12, a21 };
  }
  if (d.mode === 'isolated') {
    const gs = d.groups.map((g: any) => { const r = num(g.r, 0.5), K = num(g.K, 500); return rk4(([N]) => [r * N * (1 - N / K)], [num(g.N0, 10)], T); });
    return { tr: null, groups: gs };
  }
  const s = d.single, r = num(s.r, 0.5), K = num(s.K, 1000), N0 = num(s.N0, 10), tau = Math.max(0, num(s.lag, 0));
  return { tr: tau > 0 ? lagged(r, K, N0, tau, T) : rk4(([N]) => [r * N * (1 - N / K)], [N0], T), r, K, N0, tau };
}
/* which competitor wins, from the isoclines (Gause / Lotka–Volterra) */
function outcome(s: any) {
  const w1 = s.K1 > s.K2 / s.a21, w2 = s.K2 > s.K1 / s.a12;
  if (w1 && !w2) return s.names[0] + ' excludes ' + s.names[1];
  if (w2 && !w1) return s.names[1] + ' excludes ' + s.names[0];
  if (!w1 && !w2) return 'Stable coexistence';
  return 'Unstable: the winner depends on the starting numbers';
}
function peaks(tr: number[][], j: number) {
  const out: number[] = [];
  for (let i = 1; i < tr.length - 1; i++) if (tr[i][j] > tr[i - 1][j] && tr[i][j] >= tr[i + 1][j]) out.push(tr[i][0]);
  return out;
}

function frame(d: any, s: any) {
  const T = Math.max(1, num(d.tEnd, 30));
  let hi = 1;
  if (s.tr) s.tr.forEach((row: number[]) => row.slice(1).forEach(v => { hi = Math.max(hi, v); }));
  if (s.groups) s.groups.forEach((g: number[][]) => g.forEach(row => { hi = Math.max(hi, row[1]); }));
  if (d.mode === 'single' && s.K) hi = Math.max(hi, s.K);
  const st = S.xy.niceStep(hi, 6), yMax = Math.ceil(hi * 1.06 / st) * st;
  return { T, yDom: [0, yMax], sx: S.xy.makeScale('linear', [0, T], [M.left, W - M.right]), sy: S.xy.makeScale('linear', [0, yMax], [H - M.bottom, M.top]) };
}

function seriesOf(d: any, s: any, cap = Infinity) {
  if (d.mode === 'isolated') return d.groups.map((g: any, i: number) => ({ id: g.id, label: g.label, color: g.color || CAT(i), dash: S.xy.DASHES[i % 6], points: s.groups[i].map((r: number[]) => [r[0], r[1]]), markers: false }));
  if (d.mode === 'single') {
    const out: any[] = [{ id: 'N', label: d.single.label + (s.tau > 0 ? ' (lag ' + s.tau + ')' : ''), color: CAT(0), points: s.tr.map((r: number[]) => [r[0], r[1]]), markers: false }];
    if (d.single.showExp) out.push({ id: 'exp', label: 'Exponential (no limit)', color: 'var(--ink-muted)', dash: '7 4', fn: (t: number) => { const v = s.N0 * Math.exp(s.r * t); return v > cap ? NaN : v; } });
    /* the J-curve stops just past the top of the plot so the sheet does not grow to fit it */
    return out;
  }
  return [0, 1].map(j => ({ id: 's' + j, label: s.names[j], color: CAT(j * 4), dash: S.xy.DASHES[j], points: s.tr.map((r: number[]) => [r[0], r[1 + j]]), markers: false }));
}

function Phase({ d, s }: { d: any; s: any }) {
  if (!d.phase || !s.tr || (d.mode !== 'predation' && d.mode !== 'competition')) return null;
  const xs = s.tr.map((r: number[]) => r[1]), ys = s.tr.map((r: number[]) => r[2]);
  let xm = Math.max(...xs), ym = Math.max(...ys);
  const series: any[] = [{ id: 'traj', label: 'Trajectory', color: 'var(--accent-700)', points: s.tr.filter((_: any, i: number) => i % 4 === 0).map((r: number[]) => [r[1], r[2]]), markers: false }];
  const refLines: any[] = [];
  if (d.mode === 'competition') {
    xm = Math.max(xm, s.K1, s.K2 / s.a21); ym = Math.max(ym, s.K2, s.K1 / s.a12);
    series.push({ id: 'iso1', label: s.names[0] + ' isocline', color: CAT(0), dash: '7 4', points: [[s.K1, 0], [0, s.K1 / s.a12]], markers: false });
    series.push({ id: 'iso2', label: s.names[1] + ' isocline', color: CAT(4), dash: '2 3', points: [[0, s.K2], [s.K2 / s.a21, 0]], markers: false });
  } else {
    /* the prey and predator isoclines of the Lotka–Volterra model cross at the equilibrium */
    const p = d.pred, Ne = num(p.m, 0.8) / (num(p.b, 0.5) * num(p.a, 0.02)), Pe = num(p.r, 1) / num(p.a, 0.02) * (num(p.K, 0) > 0 ? 1 - Ne / num(p.K, 0) : 1);
    refLines.push({ axis: 'x', value: Ne, label: 'N*' }, { axis: 'y', value: Pe, label: 'P*' });
  }
  const nx = S.xy.niceStep(xm, 5), ny = S.xy.niceStep(ym, 5);
  return <g transform={`translate(${W + 20},0)`}>
    <S.XYAxis width={420} height={H} x={{ domain: [0, Math.ceil(xm * 1.05 / nx) * nx], title: s.names[0], ticks: 5 }} y={{ domain: [0, Math.ceil(ym * 1.05 / ny) * ny], title: s.names[1], ticks: 5, grid: true }}
      series={series} refLines={refLines} legend={series.length > 1 ? 'tr' : false} />
  </g>;
}

function Readout({ d, s }: { d: any; s: any }) {
  if (!d.readout) return null;
  let cols: string[] = [], rows: any[][] = [], note = '';
  const last = (j: number) => s.tr[s.tr.length - 1][j];
  if (d.mode === 'predation') {
    cols = ['Population', 'Lowest', 'Highest', 'At the end', 'Mean period'];
    rows = [0, 1].map(j => { const col = s.tr.map((r: number[]) => r[1 + j]), pk = peaks(s.tr, 1 + j); return [s.names[j], f1(Math.min(...col)), f1(Math.max(...col)), f1(last(1 + j)), pk.length > 1 ? f1((pk[pk.length - 1] - pk[0]) / (pk.length - 1)) : '–']; });
    const pk0 = peaks(s.tr, 1), pk1 = peaks(s.tr, 2);
    if (pk0.length && pk1.length) { const lag = pk1.find(t => t > pk0[0]); if (lag != null) note = 'Predator peaks lag prey peaks by about ' + f1(lag - pk0[0]) + ' time units.'; }
  } else if (d.mode === 'competition') {
    cols = ['Species', 'K', 'Competition coefficient', 'At the end'];
    rows = [[s.names[0], f1(s.K1), 'α_{12} = ' + s.a12, f1(last(1))], [s.names[1], f1(s.K2), 'α_{21} = ' + s.a21, f1(last(2))]];
    note = 'Outcome: ' + outcome(s) + '.';
  } else if (d.mode === 'isolated') {
    cols = ['Group', 'r', 'K', 'At the end', 'Time to 95% of K'];
    rows = d.groups.map((g: any, i: number) => { const tr = s.groups[i], K = num(g.K, 500), t95 = tr.find((r: number[]) => r[1] >= 0.95 * K); return [g.label, g.r, f1(K), f1(tr[tr.length - 1][1]), t95 ? f1(t95[0]) : 'not reached']; });
  } else {
    const half = s.tr.find((r: number[]) => r[1] >= s.K / 2);
    cols = ['r', 'K', 'Doubling time (ln 2 / r)', 'Time to K/2', 'At the end'];
    rows = [[f1(s.r), f1(s.K), f1(Math.LN2 / s.r), half ? f1(half[0]) : '–', f1(last(1))]];
    if (s.tau > 0) note = 'Time lag τ = ' + s.tau + ', so rτ = ' + f1(s.r * s.tau) + (s.r * s.tau > Math.PI / 2 ? ': above π/2, the population keeps cycling around K.' : s.r * s.tau > 1 / Math.E ? ': the population overshoots K and settles in damped oscillations.' : ': it approaches K smoothly.');
  }
  /* each column is as wide as its longest entry, so long headers such as 'Doubling time' never run into the next one */
  const len = (s: any) => String(s).replace(/[_^]\{([^}]*)\}/g, '$1').length;
  const widths = cols.map((c, j) => Math.max(len(c) * 7.4, ...rows.map(r => len(r[j]) * 7)) + 26);
  const xs = widths.map((_, j) => 84 + widths.slice(0, j).reduce((a, b) => a + b, 0));
  return <g className="sd-xy" transform={`translate(0,${H + 10})`}>
    <line className="sd-xy-tick" x1={84} x2={xs[xs.length - 1] + 120} y1={20} y2={20} />
    {cols.map((c, j) => <S.ChemText key={'h' + j} className="sd-xy-legend" x={xs[j]} y={12} style={{ fontWeight: 600 }}>{c}</S.ChemText>)}
    {rows.map((r, i) => r.map((v, j) => <S.ChemText key={i + ':' + j} className="sd-xy-legend" x={xs[j]} y={38 + i * 20}>{String(v)}</S.ChemText>))}
    {note ? <S.ChemText className="sd-xy-legend" x={84} y={38 + rows.length * 20 + 6} style={{ fontStyle: 'italic' }}>{note}</S.ChemText> : null}
  </g>;
}

function Render({ data }: any) {
  const d = norm(data), s = solve(d), f = frame(d, s);
  const refLines: any[] = [];
  if (d.mode === 'single') {
    if (d.single.showK) refLines.push({ axis: 'y', value: s.K, label: 'K = ' + f1(s.K) });
    if (d.single.showHalf) { const half = s.tr.find((r: number[]) => r[1] >= s.K / 2); if (half) refLines.push({ axis: 'x', value: half[0], label: 'K/2: fastest growth' }); }
  }
  if (d.mode === 'predation' && s.K) refLines.push({ axis: 'y', value: s.K, label: 'Prey K' });
  if (d.mode === 'isolated' && d.showK !== false) d.groups.forEach((g: any) => refLines.push({ axis: 'y', value: num(g.K, 500), label: 'K ' + g.label }));
  if (d.mode === 'competition' && d.showK !== false) refLines.push({ axis: 'y', value: s.K1, label: 'K_{1}' }, { axis: 'y', value: s.K2, label: 'K_{2}' });
  const series = seriesOf(d, s, f.yDom[1] * 1.02);
  return <>
    <S.XYAxis width={W} height={H} margin={M} x={{ domain: [0, f.T], title: d.xTitle }} y={{ domain: f.yDom, title: d.yTitle, grid: true }} series={series} refLines={refLines} legend={series.length > 1 ? d.legend : false} />
    <Phase d={d} s={s} />
    <Readout d={d} s={s} />
  </>;
}

function Overlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const d = norm(data), s = solve(d), f = frame(d, s), out: any[] = [];
  seriesOf(d, s, f.yDom[1] * 1.02).forEach((se: any) => {
    const pts = se.points || S.xy.sample(se.fn, [0, f.T], 'linear', 300), on = sel && sel.kind === 'series' && sel.id === se.id;
    out.push(<path key={se.id} className={'mk-hit-line' + (on ? ' mk-on' : '')} d={S.xy.pathFrom(pts.filter((_: any, i: number) => i % 5 === 0), f.sx, f.sy)} onPointerDown={ev => { ev.stopPropagation(); setSel({ kind: 'series', id: se.id }); }} />);
  });
  /* drag the carrying capacity line up or down */
  const dragK = (key: string, Y: number, apply: (v: number) => any) => out.push(<rect key={key} className="mk-hit" x={M.left} y={Y - 5} width={W - M.left - M.right} height={10}
    onPointerDown={ev => startDrag(ev, toSvg, (_dx, _dy, at) => { const v = Math.max(1, Math.round(f.sy.invert(at[1]))); set(apply(v), 'drag-' + key); })} />);
  if (d.mode === 'single' && d.single.showK) dragK('K', f.sy(s.K), v => ({ single: { ...d.single, K: String(v) } }));
  if (d.mode === 'isolated' && d.showK !== false) d.groups.forEach((g: any) => dragK('K' + g.id, f.sy(num(g.K, 500)), v => ({ groups: d.groups.map((x: any) => x === g ? { ...x, K: String(v) } : x) })));
  return <>{out}</>;
}

function Controls({ data, set, sel }: EditProps) {
  const d = norm(data);
  const S2 = (p: any, key?: string) => set({ ...d, ...p }, key);
  const P = (k: string) => (p: any, key?: string) => S2({ [k]: { ...d[k], ...p } }, key);
  const field = (obj: string, k: string, label: string, ph?: string) => <TextIn key={k} id={'pd-' + obj + k} label={label} value={d[obj][k]} placeholder={ph} onChange={v => P(obj)({ [k]: v }, obj + k)} />;
  const pair = (a: any, b: any) => <div className="mk-pair">{a}{b}</div>;
  const g = sel && sel.kind === 'series' && d.mode === 'isolated' ? d.groups.find((x: any) => x.id === sel.id) : null;
  return <>
    <S.Panel kicker="Model">
      <Seg wrap value={d.mode} options={MODES} onChange={v => S2({ mode: v })} />
      <p className="sd-help">{d.mode === 'predation' ? 'Lotka–Volterra: dN/dt = rN − aNP and dP/dt = baNP − mP. Give the prey a K to damp the cycles.'
        : d.mode === 'competition' ? 'Lotka–Volterra competition: dN₁/dt = r₁N₁(K₁ − N₁ − α₁₂N₂)/K₁, and the same for species 2.'
        : d.mode === 'isolated' ? 'One species in separate habitats. Each group grows logistically with its own r, K and starting number.'
        : 'Logistic growth dN/dt = rN(1 − N/K). A time lag τ uses N(t − τ) in the brake term and can make the population overshoot K.'}</p>
      <Range id="pd-t" label="Time axis length" value={num(d.tEnd, 30)} min={5} max={300} step={5} onChange={v => S2({ tEnd: v }, 'tend')} />
    </S.Panel>
    {d.mode === 'predation' ? <S.Panel kicker="Predator and prey">
      {pair(field('pred', 'prey', 'Prey name'), field('pred', 'predator', 'Predator name'))}
      {pair(field('pred', 'N0', 'Prey at start'), field('pred', 'P0', 'Predators at start'))}
      {pair(field('pred', 'r', 'Prey growth rate r'), field('pred', 'a', 'Attack rate a'))}
      {pair(field('pred', 'b', 'Conversion efficiency b'), field('pred', 'm', 'Predator death rate m'))}
      {field('pred', 'K', 'Prey carrying capacity K (blank for none)', 'e.g. 300')}
    </S.Panel> : null}
    {d.mode === 'competition' ? <S.Panel kicker="Competitors">
      {pair(field('comp', 'n1', 'Species 1 name'), field('comp', 'n2', 'Species 2 name'))}
      {pair(field('comp', 'N1', 'Species 1 at start'), field('comp', 'N2', 'Species 2 at start'))}
      {pair(field('comp', 'r1', 'r₁'), field('comp', 'r2', 'r₂'))}
      {pair(field('comp', 'K1', 'K₁'), field('comp', 'K2', 'K₂'))}
      {pair(field('comp', 'a12', 'α₁₂ (effect of 2 on 1)'), field('comp', 'a21', 'α₂₁ (effect of 1 on 2)'))}
      <p className="sd-help">Predicted outcome: {outcome(solve(d))}.</p>
    </S.Panel> : null}
    {d.mode === 'isolated' ? <>
      {g ? <S.Panel kicker={'Group · ' + g.label} help="Drag this group's K line on the sheet to change its carrying capacity.">
        {['label', 'r', 'K', 'N0'].map(k => <TextIn key={k} id={'pd-g' + k} label={{ label: 'Name', r: 'Growth rate r', K: 'Carrying capacity K', N0: 'Number at start' }[k]} value={g[k]} onChange={v => S2({ groups: d.groups.map((x: any) => x === g ? { ...x, [k]: v } : x) }, 'g' + k + g.id)} />)}
      </S.Panel> : null}
      <Rows id="pd-g" kicker="Groups" help="Up to 6 groups, each in its own habitat." rows={d.groups}
        cols={[{ key: 'label', label: 'Group', w: '1.5fr' }, { key: 'r', label: 'r', type: 'num', w: '0.6fr' }, { key: 'K', label: 'K', type: 'num', w: '0.7fr' }, { key: 'N0', label: 'N₀', type: 'num', w: '0.6fr' }, { key: 'color', label: 'Colour', type: 'color', colors: Array.from({ length: 6 }, (_, j) => CAT(j)) }]}
        blank={() => ({ id: uid('G', d.groups.map((x: any) => x.id)), label: 'Habitat ' + (d.groups.length + 1), r: '0.5', K: '500', N0: '10' })} addLabel={d.groups.length < 6 ? '+ Add group' : 'Six groups at most'}
        onChange={(rows, key) => S2({ groups: rows.slice(0, 6) }, key)} />
    </> : null}
    {d.mode === 'single' ? <S.Panel kicker="Population" help="Drag the K line on the sheet to change the carrying capacity.">
      {field('single', 'label', 'Name')}
      {pair(field('single', 'N0', 'Number at start'), field('single', 'r', 'Growth rate r'))}
      {pair(field('single', 'K', 'Carrying capacity K'), field('single', 'lag', 'Time lag τ (0 for none)'))}
      <Toggle on={d.single.showExp} label="Exponential curve for comparison" onChange={v => P('single')({ showExp: v })} />
      <Toggle on={d.single.showK} label="K line" onChange={v => P('single')({ showK: v })} />
      <Toggle on={d.single.showHalf} label="Mark K/2, where growth is fastest" onChange={v => P('single')({ showHalf: v })} />
    </S.Panel> : null}
    <S.Panel kicker="Plot">
      {d.mode === 'predation' || d.mode === 'competition' ? <Toggle on={d.phase} label={d.mode === 'predation' ? 'Phase plot (predators against prey)' : 'Phase plot with isoclines'} onChange={v => S2({ phase: v })} /> : null}
      {d.mode === 'isolated' || d.mode === 'competition' ? <Toggle on={d.showK !== false} label="K lines" onChange={v => S2({ showK: v })} /> : null}
      <Toggle on={d.readout} label="Readout table under the plot" onChange={v => S2({ readout: v })} />
      <TextIn id="pd-xt" label="Time axis title" value={d.xTitle} placeholder="e.g. Time (years)" onChange={v => S2({ xTitle: v }, 'xt')} />
      <TextIn id="pd-yt" label="Population axis title" value={d.yTitle} onChange={v => S2({ yTitle: v }, 'yt')} />
      <Seg value={d.legend} options={[['tr', 'Legend top right'], ['tl', 'Top left'], ['br', 'Bottom right'], ['bl', 'Bottom left']]} onChange={v => S2({ legend: v })} />
    </S.Panel>
  </>;
}

export const popdyn: EditorDef = {
  id: 'population-time', num: '21', name: 'Population over time', field: 'Ecology',
  blurb: 'Population curves solved from the models: predator and prey cycles, competition, isolated groups, and logistic growth with K.',
  hint: 'Pick a model, then type its rates. Click a curve to select it; drag a K line to change the carrying capacity.',
  normalize: norm,
  templates: [
    { name: 'Predator and prey', desc: 'Lotka–Volterra cycles with a phase plot', title: 'Predator–prey population cycles',
      caption: 'Lotka–Volterra model, r = 1, a = 0.02, b = 0.5, m = 0.8. Predator numbers peak after prey numbers, and the cycle repeats with a fixed period.',
      data: norm({ mode: 'predation', tEnd: 40, xTitle: 'Time (years)', phase: true, pred: { prey: 'Hare', predator: 'Lynx' } }) },
    { name: 'Damped predation', desc: 'Prey limited by K: cycles shrink', title: 'Predator–prey cycles damped by prey carrying capacity',
      caption: 'With a prey carrying capacity of 300, the oscillations shrink towards a stable equilibrium.',
      data: norm({ mode: 'predation', tEnd: 60, xTitle: 'Time (years)', phase: true, pred: { K: '300' } }) },
    { name: 'Coexistence', desc: 'Weak competition: both species persist', title: 'Competition with stable coexistence',
      caption: 'Each species limits itself more than it limits the other (α₁₂ = 0.5, α₂₁ = 0.6), so both persist below their own K.',
      data: norm({ mode: 'competition', tEnd: 40, xTitle: 'Time (days)', phase: true, legend: 'tl' }) },
    { name: 'Competitive exclusion', desc: 'One species drives the other out', title: 'Competitive exclusion',
      caption: 'Species 1 has a strong effect on species 2 (α₂₁ = 1.4) and a weak one from it (α₁₂ = 0.4), so species 2 is driven to extinction.',
      data: norm({ mode: 'competition', tEnd: 80, xTitle: 'Time (days)', phase: true, legend: 'tl', comp: { n1: 'Paramecium aurelia', n2: 'P. caudatum', a12: '0.4', a21: '1.4' } }) },
    { name: 'Isolated habitats', desc: 'One species, three separate groups', title: 'One species in three isolated habitats',
      caption: 'The same species grows logistically in three habitats that differ in carrying capacity and growth rate.',
      data: norm({ mode: 'isolated', tEnd: 40, xTitle: 'Time (years)', legend: 'tl', groups: [{ id: 'G1', label: 'Lake A', r: '0.5', K: '800', N0: '10' }, { id: 'G2', label: 'Lake B', r: '0.5', K: '400', N0: '10' }, { id: 'G3', label: 'Lake C', r: '0.25', K: '600', N0: '10' }] }) },
    { name: 'Logistic growth', desc: 'S-curve against the exponential J-curve', title: 'Logistic and exponential growth of one population',
      caption: 'In a fixed habitat the population follows an S-shaped curve to the carrying capacity K. Growth is fastest at K/2. Without limits it would grow exponentially.',
      data: norm({ mode: 'single', tEnd: 30, xTitle: 'Time (days)', legend: 'br' }) },
    { name: 'Overshoot with a time lag', desc: 'Delayed density dependence', title: 'Overshoot and damped oscillation around K',
      caption: 'When the brake on growth acts with a delay τ, the population overshoots K and oscillates before it settles.',
      data: norm({ mode: 'single', tEnd: 40, xTitle: 'Time (days)', single: { r: '0.8', lag: '1.6', N0: '20', showExp: false } }) },
  ],
  stats: data => { const d = norm(data); return [[d.mode === 'isolated' ? d.groups.length : d.mode === 'single' ? 1 : 2, d.mode === 'isolated' ? 'groups' : 'populations']]; },
  Controls, Overlay, Render,
  remove: (data, sel) => { const d = norm(data); return d.mode === 'isolated' && sel.kind === 'series' ? { ...d, groups: d.groups.filter((x: any) => x.id !== sel.id) } : null; },
  blank: norm({ mode: 'single' }),
};
