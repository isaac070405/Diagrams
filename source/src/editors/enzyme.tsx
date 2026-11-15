import { S } from '../sheet';
import { EmptyHint, num, Rows, Seg, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const E = () => (window as any).SDEnz;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const key = (id: string) => 'v_' + id;
const short = (n: any) => String(n || '').slice(0, 9);
const fm = (v: number) => (isFinite(v) ? (+v.toPrecision(3)).toString() : '');
const VIEWS: [string, string][] = [['mm', 'Michaelis-Menten'], ['lb', 'Lineweaver-Burk'], ['eh', 'Eadie-Hofstee'], ['hw', 'Hanes-Woolf']];

/* sheet geometry */
const L = 84, T = 20, PW = 520, PH = 360;
function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }

function model(data: any) {
  const rows = data.rows || [];
  const series = (data.series || []).filter((s: any) => s && s.id).map((s: any, i: number) => {
    const S_ = rows.map((r: any) => r.S), V = rows.map((r: any) => r[key(s.id)]);
    const pts = E().clean(S_, V), fit = E().fit(S_, V);
    return { ...s, color: s.color || col(i), pts, fit, lb: E().lineFit(pts, 'lb'), eh: E().lineFit(pts, 'eh'), hw: E().lineFit(pts, 'hw') };
  }).filter((s: any) => s.pts.length);
  return { series };
}

function EnzSheet({ data }: { data: any }) {
  const { series } = model(data), view = data.view || 'mm';
  if (!series.length) return <EmptyHint text="Add a series and at least 3 rows with a substrate concentration above 0 and a rate." />;
  const out: any[] = []; let n = 0; const k = () => 'e' + n++;
  const su = data.sUnit || 'mM', vu = data.vUnit || 'µmol/min', fitted = series.filter((s: any) => s.fit);
  /* the points and lines to draw, on the axes of the chosen view */
  const tp = (s: any, p: number[]) => view === 'mm' ? [p[0], p[1]] : view === 'lb' ? [1 / p[0], 1 / p[1]] : view === 'eh' ? [p[1] / p[0], p[1]] : [p[0], p[0] / p[1]];
  const pts = series.map((s: any) => ({ s, xy: s.pts.filter((p: number[]) => view === 'mm' || p[1] > 0).map((p: number[]) => tp(s, p)) }));
  const lineOf = (s: any) => { const l = s[view]; return view === 'mm' ? null : l; };
  let xa = Math.min(0, ...pts.flatMap((q: any) => q.xy.map((p: number[]) => p[0]))), xb = Math.max(...pts.flatMap((q: any) => q.xy.map((p: number[]) => p[0])));
  let ya = Math.min(0, ...pts.flatMap((q: any) => q.xy.map((p: number[]) => p[1]))), yb = Math.max(...pts.flatMap((q: any) => q.xy.map((p: number[]) => p[1])));
  /* the straight-line views run back to the x axis crossing, which gives -1/Km (Lineweaver-Burk) or -Km (Hanes-Woolf) */
  if (view === 'lb' || view === 'hw') series.forEach((s: any) => { const l = lineOf(s); if (l && isFinite(l.intercept) && l.slope !== 0) { const xi = -l.intercept / l.slope; if (isFinite(xi)) xa = Math.min(xa, xi * 1.08); ya = Math.min(ya, l.intercept * 1.08); } });
  if (view === 'mm') fitted.forEach((s: any) => { yb = Math.max(yb, s.fit.Vmax * 1.04); });
  xb *= 1.05; yb *= 1.08;
  if (!(xb > xa)) xb = xa + 1; if (!(yb > ya)) yb = ya + 1;
  const X = (v: number) => L + (v - xa) / (xb - xa) * PW, Y = (v: number) => T + PH - (v - ya) / (yb - ya) * PH;
  const xs = niceStep(xb - xa, 8), ys = niceStep(yb - ya, 7);
  for (let v = Math.ceil(xa / xs - 1e-9) * xs; v <= xb + 1e-9; v += xs) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={X(r)} y1={T + PH} x2={X(r)} y2={T + PH + 5} /><text x={X(r)} y={T + PH + 19} textAnchor="middle">{r}</text></g>); }
  for (let v = Math.ceil(ya / ys - 1e-9) * ys; v <= yb + 1e-9; v += ys) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>); }
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  if (xa < 0 && xb > 0) out.push(<line key={k()} className="en-zero" x1={X(0)} y1={T} x2={X(0)} y2={T + PH} />);
  if (ya < 0 && yb > 0) out.push(<line key={k()} className="en-zero" x1={L} y1={Y(0)} x2={L + PW} y2={Y(0)} />);
  const xt = view === 'mm' ? 'Substrate (' + su + ')' : view === 'lb' ? '1 / [S] (1/' + su + ')' : view === 'eh' ? 'v / [S] (' + vu + ' per ' + su + ')' : 'Substrate [S] (' + su + ')';
  const yt = view === 'mm' ? 'Rate v (' + vu + ')' : view === 'lb' ? '1 / v (1/' + vu + ')' : view === 'eh' ? 'Rate v (' + vu + ')' : '[S] / v';
  out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + 42} textAnchor="middle">{data.xlabel || xt}</text>);
  out.push(<text key={k()} className="km-title" x={24} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 24 ' + (T + PH / 2) + ')'}>{data.ylabel || yt}</text>);
  const inner: any[] = [];
  series.forEach((s: any) => {
    if (view === 'mm' && s.fit) {
      const f = s.fit, xm = xb, N = 80, path = Array.from({ length: N + 1 }, (_, i) => { const x = xm * i / N; return (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(f.Vmax * x / (f.Km + x)).toFixed(1); }).join('');
      inner.push(<path key={k()} className="en-curve" d={path} style={{ stroke: s.color }} />);
      if (data.marks !== false) {
        inner.push(<line key={k()} className="en-vmax" x1={L} y1={Y(f.Vmax)} x2={L + PW} y2={Y(f.Vmax)} style={{ stroke: s.color }} />);
        inner.push(<path key={k()} className="en-km" d={`M${L} ${Y(f.Vmax / 2)}H${X(f.Km)}V${T + PH}`} style={{ stroke: s.color }} />);
      }
    }
    const l = lineOf(s);
    if (l && isFinite(l.slope) && isFinite(l.intercept)) {
      const a = (view === 'lb' || view === 'hw') && l.slope !== 0 ? Math.min(xa, -l.intercept / l.slope) : Math.min(...s.pts.map((p: number[]) => tp(s, p)[0]));
      const b = Math.max(...s.pts.filter((p: number[]) => p[1] > 0).map((p: number[]) => tp(s, p)[0]));
      inner.push(<line key={k()} className="en-curve" x1={X(a)} y1={Y(l.intercept + l.slope * a)} x2={X(b)} y2={Y(l.intercept + l.slope * b)} style={{ stroke: s.color }} />);
    }
  });
  pts.forEach((q: any) => q.xy.forEach((p: number[]) => inner.push(<circle key={k()} className="en-pt" cx={X(p[0])} cy={Y(p[1])} r={4.6} style={{ fill: q.s.color }} />)));
  out.push(<clipPath key={k()} id="en-clip"><rect x={L} y={T} width={PW} height={PH} /></clipPath>, <g key={k()} clipPath="url(#en-clip)">{inner}</g>);
  /* labels: the constants of each series */
  if (data.labels !== false) {
    let y = T + PH - 14 - (series.length - 1) * 17;
    series.forEach((s: any) => {
      const src = view === 'mm' ? s.fit : s[view]; if (!src) return;
      const V = src.Vmax, K = src.Km, e = view === 'mm' && isFinite(src.seVmax) ? ' ± ' + fm(src.seVmax) : '', e2 = view === 'mm' && isFinite(src.seKm) ? ' ± ' + fm(src.seKm) : '';
      out.push(<text key={k()} className="km-name" x={L + PW - 8} y={y} textAnchor="end" style={{ fill: s.color }}>{(series.length > 1 ? s.name + ': ' : '')}Vmax = {fm(V)}{e}, Km = {fm(K)}{e2}</text>); y += 17;
    });
  }
  if (series.length > 1 && data.legend !== false) series.forEach((s: any, i: number) => out.push(<circle key={k()} className="en-pt" cx={L + 16} cy={T + 16 + i * 18} r={4.6} style={{ fill: s.color }} />, <text key={k()} className="km-name" x={L + 26} y={T + 20 + i * 18}>{s.name}</text>));
  return <g className="en">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const series = data.series || [], rows = data.rows || [], { series: sm } = model(data), E_ = num(data.enz, 0);
  return (
    <>
      <S.Panel kicker="Units" help="Used on the axes and in the results.">
        <div className="mk-pair"><TextIn id="en-su" label="Substrate unit" value={data.sUnit} placeholder="mM" onChange={v => set({ sUnit: v }, 'en-su')} /><TextIn id="en-vu" label="Rate unit" value={data.vUnit} placeholder="µmol/min" onChange={v => set({ vUnit: v }, 'en-vu')} /></div>
        <TextIn id="en-e" label="Enzyme concentration (optional, same amount unit as the rate)" value={data.enz} placeholder="blank to skip kcat" onChange={v => set({ enz: v }, 'en-e')} />
      </S.Panel>
      <S.Panel kicker="Plot" help="The curve view shows the nonlinear fit. The other views plot straight lines through transformed data. They make Vmax and Km easy to read and inhibition easy to classify, but they weight the points unevenly, so quote the nonlinear fit.">
        <Seg wrap value={data.view || 'mm'} options={VIEWS} onChange={v => set({ view: v })} />
      </S.Panel>
      <Rows id="en-s" kicker="Series" help="One series per condition, for example without and with an inhibitor." rows={series}
        cols={[{ key: 'name', label: 'Name', w: '1.6fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ id: uid('s', series.map((s: any) => s.id)), name: 'Series ' + (series.length + 1), color: col(series.length) })}
        addLabel="+ Add series" onChange={(r, kk) => set({ series: r.map((x, i) => ({ ...x, id: x.id || uid('s', series.map((s: any) => s.id)), color: x.color || col(i) })) }, kk)} />
      <Rows id="en-r" kicker="Rates" help="One row per substrate concentration, then the rate in each series. Leave a cell blank to skip it." rows={rows}
        cols={[{ key: 'S', label: '[S]', type: 'num', w: '0.8fr' }, ...series.map((s: any) => ({ key: key(s.id), label: short(s.name), type: 'num' as const, w: '0.8fr' }))]}
        blank={() => ({ S: '' })} addLabel="+ Add row" onChange={(r, kk) => set({ rows: r }, kk)} />
      <S.Panel kicker="Look">
        <Toggle on={data.marks !== false} label="Mark Vmax and Km on the curve view" onChange={v => set({ marks: v })} />
        <Toggle on={data.labels !== false} label="Vmax and Km on the figure" onChange={v => set({ labels: v })} />
        <Toggle on={data.legend !== false} label="Legend" onChange={v => set({ legend: v })} />
      </S.Panel>
      {sm.length ? <S.Panel kicker="Results" help="Nonlinear fit by Levenberg-Marquardt, with standard errors from the Jacobian and 95% intervals from Student's t. Km is the substrate level at half Vmax. kcat = Vmax / [enzyme].">
        <ul className="tr-results">
          {sm.map((s: any) => s.fit ? <li key={s.id}><b>{s.name}</b>: Vmax {fm(s.fit.Vmax)} ± {fm(s.fit.seVmax)} (95% CI {fm(s.fit.VmaxCI[0])} to {fm(s.fit.VmaxCI[1])}); Km {fm(s.fit.Km)} ± {fm(s.fit.seKm)} (95% CI {fm(s.fit.KmCI[0])} to {fm(s.fit.KmCI[1])}); R² {fm(s.fit.r2)}; n = {s.fit.n}{E_ > 0 ? '; kcat ' + fm(s.fit.Vmax / E_) + ', kcat/Km ' + fm(s.fit.Vmax / E_ / s.fit.Km) : ''}. Straight-line estimates: Lineweaver-Burk {s.lb ? fm(s.lb.Vmax) + ' and ' + fm(s.lb.Km) : 'n/a'}, Eadie-Hofstee {s.eh ? fm(s.eh.Vmax) + ' and ' + fm(s.eh.Km) : 'n/a'}, Hanes-Woolf {s.hw ? fm(s.hw.Vmax) + ' and ' + fm(s.hw.Km) : 'n/a'}.</li> : <li key={s.id}><b>{s.name}</b>: needs 3 or more points above 0.</li>)}
        </ul>
      </S.Panel> : null}
    </>
  );
}

function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()); }
const SUB = [0.5, 1, 2, 4, 8, 16, 32, 64];
function rates(seed: number, V: number, K: number, rel = 0.04) { const z = rng(seed); return SUB.map(s => String(Math.round(V * s / (K + s) * (1 + rel * z()) * 10) / 10)); }
const mk = (cols: string[][]) => SUB.map((s, i) => { const r: any = { S: String(s) }; cols.forEach((c, j) => { r['v_s' + j] = c[i]; }); return r; });
const ser = (names: string[]) => names.map((name, i) => ({ id: 's' + i, name, color: col(i) }));

export const enzyme: EditorDef = {
  id: 'enzyme-kinetics', num: '41', name: 'Enzyme kinetics', field: 'Cells and measurement',
  blurb: 'Michaelis-Menten fit with Vmax, Km and their intervals, plus Lineweaver-Burk, Eadie-Hofstee and Hanes-Woolf plots for inhibition.',
  hint: 'Enter rates at each substrate concentration, one column per condition. The fit and the plots are worked out for you.',
  templates: [
    { name: 'One enzyme', desc: 'Saturation curve, simulated', title: 'Michaelis-Menten kinetics of an enzyme',
      caption: 'Initial rate against substrate concentration, fitted to v = Vmax[S] / (Km + [S]) by nonlinear least squares (simulated data: Vmax 120, Km 6). Dashed lines mark Vmax and Km. Sample data for practice.',
      data: { sUnit: 'mM', vUnit: 'µmol/min', view: 'mm', series: ser(['Enzyme']), rows: mk([rates(5, 120, 6)]) } },
    { name: 'Competitive inhibitor', desc: 'Km rises, Vmax unchanged', title: 'Competitive inhibition',
      caption: 'Rates without and with an inhibitor (simulated: Vmax 100 for both, Km 4 and 12). In the Lineweaver-Burk view the lines meet on the y axis, the sign of competitive inhibition. Sample data for practice.',
      data: { sUnit: 'mM', vUnit: 'µmol/min', view: 'lb', series: ser(['Control', '+ Inhibitor']), rows: mk([rates(8, 100, 4), rates(9, 100, 12)]) } },
    { name: 'Non-competitive inhibitor', desc: 'Vmax falls, Km unchanged', title: 'Non-competitive inhibition',
      caption: 'Rates without and with an inhibitor (simulated: Km 6 for both, Vmax 100 and 55). In the Lineweaver-Burk view the lines meet on the x axis, the sign of non-competitive inhibition. Sample data for practice.',
      data: { sUnit: 'mM', vUnit: 'µmol/min', view: 'lb', series: ser(['Control', '+ Inhibitor']), rows: mk([rates(12, 100, 6), rates(13, 55, 6)]) } },
  ],
  blank: { sUnit: 'mM', vUnit: 'µmol/min', view: 'mm', series: ser(['Enzyme']), rows: [[1, 15], [2, 26], [5, 45], [10, 60], [20, 74], [50, 88]].map(([s, v]) => ({ S: String(s), v_s0: String(v) })) },
  stats: d => { const m = model(d); const f = m.series.find((s: any) => s.fit); return f ? [[m.series.length, 'series'], [+f.fit.Vmax.toPrecision(3), 'Vmax'], [+f.fit.Km.toPrecision(3), 'Km']] : [[m.series.length, 'series']]; },
  Controls,
  Render: ({ data }) => <EnzSheet data={data} />,
};
