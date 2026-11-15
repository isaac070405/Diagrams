import { S } from '../sheet';
import { EmptyHint, num, Range, Seg, Spec, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const R = () => (window as any).SDReg;
const SP = () => (window as any).SDSpecial;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const fm = (v: number) => (isFinite(v) ? (+v.toPrecision(3)).toString() : '');
const sg = (v: number) => (v < 0 ? '−' : '') + fm(Math.abs(v));

/* sheet geometry */
const L = 80, T = 20, PW = 520, PH = 380;
function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }

/* lines "x, y" or "x, y, group"; a header or text-only line is skipped */
function parse(text: string) {
  const out: { x: number; y: number; g: string }[] = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    const f = line.trim().split(/[,\t;]+|\s+/).filter(s => s !== '');
    if (f.length < 2) return;
    const x = parseFloat(f[0]), y = parseFloat(f[1]);
    if (isFinite(x) && isFinite(y)) out.push({ x, y, g: f.slice(2).join(' ') });
  });
  return out;
}

function model(data: any) {
  const pts = parse(data.text), names: string[] = [];
  pts.forEach(p => { if (names.indexOf(p.g) < 0) names.push(p.g); });
  const groups = names.map((g, i) => ({ name: g, color: col(i), pts: pts.filter(p => p.g === g) }));
  const mode = data.fit || 'pooled';
  const sets = mode === 'none' ? [] : mode === 'each' && groups.length > 1 ? groups.map(g => ({ name: g.name, color: g.color, pts: g.pts })) : [{ name: '', color: 'var(--ink)', pts }];
  const fits = sets.map(s => { const xy = s.pts.map(p => [p.x, p.y]); return { ...s, fit: R().linear(xy), rho: R().spearman(xy) }; }).filter(f => f.fit);
  return { pts, groups, fits };
}

function ScatterSheet({ data }: { data: any }) {
  const { pts, groups, fits } = model(data);
  if (pts.length < 3) return <EmptyHint text={'Paste at least 3 rows of x, y (and an optional group), one per line.'} />;
  const out: any[] = []; let n = 0; const k = () => 's' + n++;
  const px = pts.map(p => p.x), py = pts.map(p => p.y);
  let x0 = Math.min(...px), x1 = Math.max(...px), y0 = Math.min(...py), y1 = Math.max(...py);
  const padx = (x1 - x0) * 0.06 || 1, pady = (y1 - y0) * 0.08 || 1; x0 -= padx; x1 += padx; y0 -= pady; y1 += pady;
  const ox0 = num(data.x0, NaN), ox1 = num(data.x1, NaN), oy0 = num(data.y0, NaN), oy1 = num(data.y1, NaN);
  if (isFinite(ox0)) x0 = ox0; if (isFinite(ox1)) x1 = ox1; if (isFinite(oy0)) y0 = oy0; if (isFinite(oy1)) y1 = oy1;
  if (!(x1 > x0)) x1 = x0 + 1; if (!(y1 > y0)) y1 = y0 + 1;
  const X = (v: number) => L + (v - x0) / (x1 - x0) * PW, Y = (v: number) => T + PH - (v - y0) / (y1 - y0) * PH;
  const xs = niceStep(x1 - x0, 8), ys = niceStep(y1 - y0, 7);
  for (let v = Math.ceil(x0 / xs - 1e-9) * xs; v <= x1 + 1e-9; v += xs) { const r = +v.toPrecision(10); if (data.grid) out.push(<line key={k()} className="km-grid" x1={X(r)} y1={T} x2={X(r)} y2={T + PH} />); out.push(<g key={k()} className="km-tick"><line x1={X(r)} y1={T + PH} x2={X(r)} y2={T + PH + 5} /><text x={X(r)} y={T + PH + 19} textAnchor="middle">{r}</text></g>); }
  for (let v = Math.ceil(y0 / ys - 1e-9) * ys; v <= y1 + 1e-9; v += ys) { const r = +v.toPrecision(10); if (data.grid) out.push(<line key={k()} className="km-grid" x1={L} y1={Y(r)} x2={L + PW} y2={Y(r)} />); out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>); }
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + 42} textAnchor="middle">{data.xlabel || 'x'}</text>);
  out.push(<text key={k()} className="km-title" x={22} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 22 ' + (T + PH / 2) + ')'}>{data.ylabel || 'y'}</text>);
  const clip = 'sc-clip';
  out.push(<clipPath key={k()} id={clip}><rect x={L} y={T} width={PW} height={PH} /></clipPath>);
  const inner: any[] = [];
  /* bands, then lines, then points */
  fits.forEach(f => {
    const a = Math.min(...f.pts.map((p: any) => p.x)), b = Math.max(...f.pts.map((p: any) => p.x)), N = 40;
    const grid = Array.from({ length: N + 1 }, (_, i) => a + (b - a) * i / N);
    const band = (kind: string) => { const up = grid.map(x => { const q = R().at(f.fit, x, kind); return [x, q.y + q.half]; }), dn = grid.map(x => { const q = R().at(f.fit, x, kind); return [x, q.y - q.half]; }); return { up, dn }; };
    if (data.ci !== false) { const { up, dn } = band('mean'); inner.push(<polygon key={k()} className="sc-ci" points={[...up, ...dn.reverse()].map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')} style={{ fill: f.color }} />); }
    if (data.pred) { const { up, dn } = band('pred'); [up, dn].forEach(l => inner.push(<polyline key={k()} className="sc-pred" points={l.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')} style={{ stroke: f.color }} />)); }
    if (data.line !== false) inner.push(<line key={k()} className="sc-line" x1={X(a)} y1={Y(f.fit.intercept + f.fit.slope * a)} x2={X(b)} y2={Y(f.fit.intercept + f.fit.slope * b)} style={{ stroke: f.color }} />);
  });
  const r = num(data.size, 4);
  groups.forEach(g => g.pts.forEach((p: any) => inner.push(<circle key={k()} className="sc-pt" cx={X(p.x)} cy={Y(p.y)} r={r} style={{ fill: g.color }} />)));
  out.push(<g key={k()} clipPath={'url(#' + clip + ')'}>{inner}</g>);
  /* equation and statistics */
  /* the corner above the data: top right for a falling line, top left for a rising one */
  const right = fits.length > 0 && fits[0].fit.slope < 0, ax = right ? L + PW - 10 : L + 10, an = right ? 'end' : 'start';
  let ty = T + 18;
  if (data.eq !== false || data.stats !== false) fits.forEach(f => {
    const eq = 'y = ' + sg(f.fit.slope) + 'x ' + (f.fit.intercept < 0 ? '− ' : '+ ') + fm(Math.abs(f.fit.intercept)), st = 'r = ' + fm(f.fit.r) + ', R² = ' + fm(f.fit.r2) + ', ' + SP().fmtP(f.fit.p) + ', n = ' + f.fit.n;
    const head = f.name ? f.name + ': ' : '';
    if (data.eq !== false) { out.push(<text key={k()} className="sc-eq" x={ax} y={ty} textAnchor={an} style={{ fill: f.name ? f.color : undefined }}>{head}{eq}</text>); ty += 16; }
    if (data.stats !== false) { out.push(<text key={k()} className="km-note" x={ax} y={ty} textAnchor={an}>{st}</text>); ty += 17; }
  });
  if (groups.length > 1 && data.legend !== false) groups.forEach((g, i) => out.push(<circle key={k()} className="sc-pt" cx={L + PW + 18} cy={T + 12 + i * 20} r={5} style={{ fill: g.color }} />, <text key={k()} className="km-name" x={L + PW + 30} y={T + 16 + i * 20}>{g.name || 'group'}</text>));
  return <g className="sc">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const { pts, groups, fits } = model(data);
  return (
    <>
      <Spec id="sc-text" label="x, y and an optional group" rows={8} value={data.text || ''} help="One point per row: x, y, then an optional group name. Commas, tabs or spaces. Paste two or three spreadsheet columns straight in. A header row is skipped."
        onChange={v => set({ text: v }, 'sc-text')} placeholder={'3.1, 12.4, Female'} />
      <S.Panel kicker="Axes" help="Leave the limits blank to fit the data.">
        <TextIn id="sc-xl" label="x title" value={data.xlabel} placeholder="x" onChange={v => set({ xlabel: v }, 'sc-xl')} />
        <TextIn id="sc-yl" label="y title" value={data.ylabel} placeholder="y" onChange={v => set({ ylabel: v }, 'sc-yl')} />
        <div className="mk-pair"><TextIn id="sc-x0" label="x min" value={data.x0} placeholder="auto" onChange={v => set({ x0: v }, 'sc-x0')} /><TextIn id="sc-x1" label="x max" value={data.x1} placeholder="auto" onChange={v => set({ x1: v }, 'sc-x1')} /></div>
        <div className="mk-pair"><TextIn id="sc-y0" label="y min" value={data.y0} placeholder="auto" onChange={v => set({ y0: v }, 'sc-y0')} /><TextIn id="sc-y1" label="y max" value={data.y1} placeholder="auto" onChange={v => set({ y1: v }, 'sc-y1')} /></div>
      </S.Panel>
      <S.Panel kicker="Regression" help="Least squares line with Student's t intervals. The shaded band is the 95% confidence interval of the line. The dashed band is the 95% prediction interval for a new point. With groups, fit one line to all points or one per group.">
        <Seg value={data.fit || 'pooled'} options={[['pooled', 'One line'], ['each', 'Per group'], ['none', 'None']]} onChange={v => set({ fit: v })} />
        <Toggle on={data.line !== false} label="Regression line" onChange={v => set({ line: v })} />
        <Toggle on={data.ci !== false} label="95% confidence band" onChange={v => set({ ci: v })} />
        <Toggle on={!!data.pred} label="95% prediction band" onChange={v => set({ pred: v })} />
        <Toggle on={data.eq !== false} label="Equation on the figure" onChange={v => set({ eq: v })} />
        <Toggle on={data.stats !== false} label="r, R², p and n on the figure" onChange={v => set({ stats: v })} />
      </S.Panel>
      <S.Panel kicker="Look">
        <Toggle on={data.legend !== false} label="Group legend" onChange={v => set({ legend: v })} />
        <Toggle on={!!data.grid} label="Grid lines" onChange={v => set({ grid: v })} />
        <Range id="sc-sz" label="Point size" value={num(data.size, 4)} min={2} max={8} step={0.5} onChange={v => set({ size: v }, 'sc-sz')} />
      </S.Panel>
      {fits.length ? <S.Panel kicker="Results" help="Association does not show cause. Spearman rho uses ranks, so it suits curved but steadily rising or falling data.">
        <ul className="tr-results">
          {fits.map((f: any, i: number) => <li key={i}><b>{f.name || 'All points'}</b>: n = {f.fit.n}; slope {sg(f.fit.slope)} ± {fm(f.fit.seSlope)} (95% CI {sg(f.fit.slopeCI[0])} to {sg(f.fit.slopeCI[1])}); intercept {sg(f.fit.intercept)} (95% CI {sg(f.fit.interceptCI[0])} to {sg(f.fit.interceptCI[1])}); r = {fm(f.fit.r)}{f.fit.rCI ? ' (95% CI ' + fm(f.fit.rCI[0]) + ' to ' + fm(f.fit.rCI[1]) + ')' : ''}; R² = {fm(f.fit.r2)}; {SP().fmtP(f.fit.p)}; residual SD {fm(f.fit.s)}{f.rho ? '; Spearman rho = ' + fm(f.rho.rho) + ', ' + SP().fmtP(f.rho.p) : ''}</li>)}
        </ul>
      </S.Panel> : pts.length >= 3 ? null : null}
    </>
  );
}

function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return { u, z: () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()) }; }
const r2 = (v: number, dp = 1) => Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp);
function fibre() { const g = rng(3), rows: string[] = []; for (let i = 0; i < 60; i++) { const x = Math.max(6, 24 + 8 * g.z()); rows.push(r2(x) + ', ' + r2(4.3 - 0.034 * x + 0.42 * g.z(), 2)); } return rows.join('\n'); }
function fish() { const g = rng(7), rows: string[] = []; for (let i = 0; i < 44; i++) { const f = i % 2 === 0, L = (f ? 24 : 22) + 16 * g.u(), W = (f ? 17 : 14) * L - (f ? 330 : 255) + 38 * g.z(); rows.push(r2(L) + ', ' + Math.round(W) + ', ' + (f ? 'Female' : 'Male')); } return rows.join('\n'); }
function vitD() { const g = rng(11), rows: string[] = []; for (let i = 0; i < 45; i++) { const d = 12 + 80 * g.u(), p = 14 + 70 * Math.exp(-d / 28) + 5 * g.z(); rows.push(r2(d) + ', ' + r2(p)); } return rows.join('\n'); }

export const scatter: EditorDef = {
  id: 'scatter-regression', num: '40', name: 'Scatter plot with regression', field: 'Methods',
  blurb: 'Points with a least squares line, 95% confidence and prediction bands, the equation, r, R² and p, with one line or one per group.',
  hint: 'Paste x, y (and an optional group) on each row. The line, bands and statistics are worked out for you.',
  templates: [
    { name: 'Fibre intake and LDL', desc: '60 adults, one line', title: 'Dietary fibre and LDL cholesterol',
      caption: 'LDL cholesterol (mmol/L) against fibre intake (g/day) in 60 adults (simulated). Line: least squares fit. Shaded band: 95% confidence interval of the line. Sample data for practice.',
      data: { text: fibre(), xlabel: 'Fibre intake (g/day)', ylabel: 'LDL cholesterol (mmol/L)', fit: 'pooled', ci: true } },
    { name: 'Fish length and weight', desc: 'Two groups, a line each', title: 'Weight against length in male and female fish',
      caption: 'Body weight (g) against total length (cm) in 22 female and 22 male fish (simulated), with a regression line for each sex and 95% prediction bands. Sample data for practice.',
      data: { text: fish(), xlabel: 'Total length (cm)', ylabel: 'Weight (g)', fit: 'each', ci: true, pred: true } },
    { name: 'Vitamin D and PTH', desc: 'A curved relationship, Spearman rho', title: 'Parathyroid hormone against vitamin D',
      caption: 'Plasma PTH (pmol/L) against serum 25(OH)D (nmol/L) in 45 adults (simulated). The relationship curves, so Spearman rho in the Results panel describes it better than the straight line. Sample data for practice.',
      data: { text: vitD(), xlabel: '25(OH)D (nmol/L)', ylabel: 'PTH (pmol/L)', fit: 'pooled', ci: true } },
  ],
  blank: { text: '1, 2.1\n2, 3.9\n3, 6.2\n4, 7.8\n5, 10.1\n6, 12.2\n7, 13.8', xlabel: 'x', ylabel: 'y', fit: 'pooled', ci: true },
  stats: d => { const m = model(d); return m.pts.length >= 3 && m.fits.length ? [[m.pts.length, 'points'], [+m.fits[0].fit.r.toFixed(2), 'r'], [+m.fits[0].fit.r2.toFixed(2), 'R²']] : [[m.pts.length, 'points']]; },
  Controls,
  Render: ({ data }) => <ScatterSheet data={data} />,
};
