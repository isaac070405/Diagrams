import { S } from '../sheet';
import { EmptyHint, num, Range, Spec, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const P = () => (window as any).SDPCA;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const fm = (v: number, d = 3) => (isFinite(v) ? (+v.toPrecision(d)).toString() : 'n/a');

/* sheet geometry */
const L = 76, T = 20, PW = 520, PH = 420;
function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }

/* header row of variable names; first column the sample name; an optional second column of group names */
function parse(text: string) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 4) return null;
  const sep = lines[0].indexOf('\t') >= 0 ? /\t/ : /[,;]/, cells = (l: string) => l.split(sep).map(s => s.trim());
  const head = cells(lines[0]), body = lines.slice(1).map(cells).filter(r => r.length >= 3);
  const isNum = (s: string) => s !== '' && isFinite(parseFloat(s)) && /^-?[\d.]/.test(s);
  const hasGroup = body.some(r => !isNum(r[1] || ''));
  const first = hasGroup ? 2 : 1, vars = head.slice(first).map((h, j) => h || 'V' + (j + 1));
  if (vars.length < 2) return null;
  return { names: body.map(r => r[0]), groups: hasGroup ? body.map(r => r[1]) : null, vars, rows: body.map(r => vars.map((_, j) => { const v = parseFloat(r[first + j]); return isFinite(v) ? v : NaN; })) };
}

function model(data: any) {
  const m = parse(data.text); if (!m) return null;
  const res = P().run(m.rows, data.scale !== false); if (!res) return null;
  const k = res.values.length, px = Math.min(k, Math.max(1, Math.round(num(data.px, 1)))) - 1;
  let py = Math.min(k, Math.max(1, Math.round(num(data.py, 2)))) - 1; if (py === px) py = px === 0 ? 1 : 0;
  const keep: number[] = res.keep, names = keep.map((i: number) => m.names[i]), groups = m.groups ? keep.map((i: number) => m.groups![i]) : null;
  const gl: string[] = []; if (groups) groups.forEach((g: string) => { if (gl.indexOf(g) < 0) gl.push(g); });
  return { m, res, px, py, names, groups, gl, k };
}

function PcaSheet({ data }: { data: any }) {
  const md = model(data);
  if (!md) return <EmptyHint text="Paste a table: names down the side, variables across the top, at least 3 samples and 2 variables. An optional second column of group names." />;
  const { res, px, py, names, groups, gl, m } = md;
  const out: any[] = []; let n = 0; const k = () => 'p' + n++;
  const sc = res.scores.map((s: number[]) => [s[px], s[py]]);
  let x0 = Math.min(...sc.map((p: number[]) => p[0])), x1 = Math.max(...sc.map((p: number[]) => p[0])), y0 = Math.min(...sc.map((p: number[]) => p[1])), y1 = Math.max(...sc.map((p: number[]) => p[1]));
  const ells = data.ellipses !== false && groups ? gl.map((g: string) => ({ g, e: P().ellipse(sc.filter((_: any, i: number) => groups[i] === g), 0.95, 60) })).filter((q: any) => q.e) : [];
  ells.forEach((q: any) => q.e.points.forEach((p: number[]) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }));
  const px_ = (x1 - x0) * 0.08 || 1, py_ = (y1 - y0) * 0.08 || 1; x0 -= px_; x1 += px_; y0 -= py_; y1 += py_;
  const s = Math.min(PW / (x1 - x0), PH / (y1 - y0)), xc = (x0 + x1) / 2, yc = (y0 + y1) / 2;
  const X = (v: number) => L + PW / 2 + (v - xc) * s, Y = (v: number) => T + PH / 2 - (v - yc) * s;
  const vx0 = xc - PW / 2 / s, vx1 = xc + PW / 2 / s, vy0 = yc - PH / 2 / s, vy1 = yc + PH / 2 / s, st = niceStep(Math.max(vx1 - vx0, vy1 - vy0), 8);
  for (let v = Math.ceil(vx0 / st - 1e-9) * st; v <= vx1 + 1e-9; v += st) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={X(r)} y1={T + PH} x2={X(r)} y2={T + PH + 5} /><text x={X(r)} y={T + PH + 19} textAnchor="middle">{r}</text></g>); }
  for (let v = Math.ceil(vy0 / st - 1e-9) * st; v <= vy1 + 1e-9; v += st) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>); }
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  if (vx0 < 0 && vx1 > 0) out.push(<line key={k()} className="pa-zero" x1={X(0)} y1={T} x2={X(0)} y2={T + PH} />);
  if (vy0 < 0 && vy1 > 0) out.push(<line key={k()} className="pa-zero" x1={L} y1={Y(0)} x2={L + PW} y2={Y(0)} />);
  out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + 42} textAnchor="middle">PC{px + 1} ({fm(res.share[px] * 100, 3)}%)</text>);
  out.push(<text key={k()} className="km-title" x={22} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 22 ' + (T + PH / 2) + ')'}>PC{py + 1} ({fm(res.share[py] * 100, 3)}%)</text>);
  const inner: any[] = [];
  ells.forEach((q: any, i: number) => inner.push(<polygon key={k()} className="pa-ell" points={q.e.points.map((p: number[]) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')} style={{ fill: col(gl.indexOf(q.g)), stroke: col(gl.indexOf(q.g)) }} />));
  sc.forEach((p: number[], i: number) => inner.push(<circle key={k()} className="pa-pt" cx={X(p[0])} cy={Y(p[1])} r={num(data.size, 4.6)} style={{ fill: groups ? col(gl.indexOf(groups[i])) : col(0) }} />));
  if (data.labels) sc.forEach((p: number[], i: number) => inner.push(<text key={k()} className="pa-lab" x={X(p[0]) + 6} y={Y(p[1]) - 5}>{names[i]}</text>));
  if (data.arrows !== false) {
    const L2 = res.loadings.map((r: number[]) => [r[px], r[py]]), longest = Math.max(...L2.map((a: number[]) => Math.hypot(a[0], a[1]))) || 1, f = 0.78 * Math.min((vx1 - vx0) / 2, (vy1 - vy0) / 2) / longest;
    L2.forEach((a: number[], j: number) => {
      const ex = X(a[0] * f), ey = Y(a[1] * f), ang = Math.atan2(ey - Y(0), ex - X(0));
      inner.push(<line key={k()} className="pa-arrow" x1={X(0)} y1={Y(0)} x2={ex} y2={ey} />, <polygon key={k()} className="pa-head" points={`${ex},${ey} ${ex - 8 * Math.cos(ang - 0.4)},${ey - 8 * Math.sin(ang - 0.4)} ${ex - 8 * Math.cos(ang + 0.4)},${ey - 8 * Math.sin(ang + 0.4)}`} />);
      inner.push(<text key={k()} className="pa-var" x={ex + 5 * Math.cos(ang)} y={ey + 5 * Math.sin(ang) + 4} textAnchor={Math.cos(ang) >= 0 ? 'start' : 'end'}>{m.vars[j]}</text>);
    });
  }
  out.push(<clipPath key={k()} id="pa-clip"><rect x={L} y={T} width={PW} height={PH} /></clipPath>, <g key={k()} clipPath="url(#pa-clip)">{inner}</g>);
  if (groups && data.legend !== false) gl.forEach((g: string, i: number) => out.push(<circle key={k()} className="pa-pt" cx={L + PW + 18} cy={T + 12 + i * 20} r={5} style={{ fill: col(i) }} />, <text key={k()} className="km-name" x={L + PW + 30} y={T + 16 + i * 20}>{g}</text>));
  return <g className="pa">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const md = model(data);
  return (
    <>
      <Spec id="pa-text" label="Data table" rows={10} value={data.text || ''} help="First row: variable names. First column: sample names. An optional second column of group names colours the points. Tabs or commas. Paste straight from a spreadsheet. Rows with a missing value are left out."
        onChange={v => set({ text: v }, 'pa-text')} placeholder={'Sample\\tGroup\\tLength\\tDepth\\nF1\\tSite A\\t24.1\\t8.3'} />
      <S.Panel kicker="Analysis" help="Scaling gives every variable the same weight (a correlation matrix), which suits variables in different units. Switch it off for variables in one unit, such as percent cover, so that large values keep their weight.">
        <Toggle on={data.scale !== false} label="Scale variables to unit variance" onChange={v => set({ scale: v })} />
        {md ? <>
          <Range id="pa-x" label={'Horizontal axis: PC' + (md.px + 1)} value={md.px + 1} min={1} max={md.k} onChange={v => set({ px: v }, 'pa-x')} />
          <Range id="pa-y" label={'Vertical axis: PC' + (md.py + 1)} value={md.py + 1} min={1} max={md.k} onChange={v => set({ py: v }, 'pa-y')} />
        </> : null}
      </S.Panel>
      <S.Panel kicker="Look">
        <Toggle on={data.arrows !== false} label="Variable arrows (biplot)" onChange={v => set({ arrows: v })} />
        <Toggle on={data.ellipses !== false} label="95% ellipse for each group" onChange={v => set({ ellipses: v })} />
        <Toggle on={!!data.labels} label="Sample names beside points" onChange={v => set({ labels: v })} />
        <Toggle on={data.legend !== false} label="Group legend" onChange={v => set({ legend: v })} />
        <Range id="pa-sz" label="Point size" value={num(data.size, 4.6)} min={2} max={8} step={0.5} onChange={v => set({ size: v }, 'pa-sz')} />
      </S.Panel>
      {md ? <S.Panel kicker="Results" help="Share of the total variance for each component, and the loadings (for scaled data, the correlation of each variable with the component). Arrows are scaled to fit the plot, so their lengths compare with each other but not with the points.">
        <ul className="tr-results">
          <li>{md.res.n} samples, {md.res.p} variables{md.res.n < md.m.rows.length ? ' (' + (md.m.rows.length - md.res.n) + ' left out for missing values)' : ''}</li>
          <li>Variance explained: {md.res.share.slice(0, 6).map((v: number, i: number) => 'PC' + (i + 1) + ' ' + fm(v * 100, 3) + '%').join(', ')}{md.res.share.length > 6 ? ', ...' : ''}. First two: {fm((md.res.share[0] + md.res.share[1]) * 100, 3)}%</li>
          {[md.px, md.py].map(c => <li key={c}><b>PC{c + 1} loadings</b>: {md.m.vars.map((v: string, j: number) => v + ' ' + fm(md.res.loadings[j][c], 2)).join(', ')}</li>)}
        </ul>
      </S.Panel> : null}
    </>
  );
}

function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()); }
const f2 = (v: number, d = 1) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
function build(head: string[], groups: [string, number][], gen: (g: number, i: number, z: () => number) => number[], seed: number, dp = 1) {
  const z = rng(seed), lines = ['Sample\tGroup\t' + head.join('\t')]; let c = 0;
  groups.forEach(([name, cnt], g) => { for (let i = 0; i < cnt; i++) lines.push(name.slice(0, 1) + (++c) + '\t' + name + '\t' + gen(g, i, z).map(v => f2(v, dp)).join('\t')); });
  return lines.join('\n');
}
const fish = build(['Length', 'Depth', 'Head', 'Eye', 'Fin'], [['Site A', 18], ['Site B', 18]], (g, _i, z) => { const size = 25 + 4 * z(); return [size, size * (0.32 + 0.03 * g) + 0.8 * z(), size * (0.26 - 0.02 * g) + 0.5 * z(), 3.2 + 0.07 * size + 0.35 * z() - 0.5 * g, size * (0.2 + 0.03 * g) + 0.7 * z()]; }, 5);
const foods = build(['Protein', 'Fat', 'Iron', 'Calcium', 'Fibre', 'Vitamin C'], [['Meat and fish', 10], ['Dairy', 10], ['Plants', 10]], (g, _i, z) => { const m = [[22, 12, 2.6, 25, 0, 1], [8, 9, 0.2, 240, 0, 1.5], [6, 2, 2.1, 60, 5.5, 28]][g]; const sd = [4, 4, 0.9, 20, 1.5, 9]; return m.map((v, j) => Math.max(0, v + sd[j] * z())); }, 9);
const reef = build(['Hard coral', 'Soft coral', 'Turf algae', 'Macroalgae', 'Sand', 'Sponge'], [['Lagoon', 6], ['Reef flat', 6], ['Reef slope', 6]], (g, _i, z) => { const m = [[12, 4, 22, 14, 40, 8], [22, 6, 34, 14, 18, 6], [46, 14, 14, 4, 12, 10]][g]; return m.map(v => Math.max(0, v + 4 * z())); }, 3);

export const pca: EditorDef = {
  id: 'pca-plot', num: '46', name: 'PCA plot', field: 'Methods',
  blurb: 'Many variables reduced to two axes: samples as points, variables as arrows, groups with 95% ellipses and the share of variance on each axis.',
  hint: 'Paste a table of samples by variables, with an optional group column. Components, arrows and ellipses are worked out for you.',
  templates: [
    { name: 'Fish body shape, two sites', desc: '36 fish, 5 measurements, scaled', title: 'Body shape of fish from two sites',
      caption: 'PCA of five body measurements of 36 fish from two sites (simulated), scaled to unit variance. Ellipses are 95% for each site. Arrows show the correlation of each measurement with the axes. Sample data for practice.',
      data: { text: fish, scale: true, px: 1, py: 2, arrows: true, ellipses: true } },
    { name: 'Nutrient profiles of foods', desc: '30 foods in three groups, 6 nutrients', title: 'Nutrient profiles of three food groups',
      caption: 'PCA of six nutrients per 100 g in 30 foods (simulated values, three food groups), scaled to unit variance. Sample data for practice.',
      data: { text: foods, scale: true, px: 1, py: 2, arrows: true, ellipses: true } },
    { name: 'Reef communities by zone', desc: '18 sites, percent cover, unscaled', title: 'Benthic communities in three reef zones',
      caption: 'PCA of percent cover of six benthic groups at 18 sites in three zones (simulated). Variables are in the same unit, so they are not scaled. Sample data for practice.',
      data: { text: reef, scale: false, px: 1, py: 2, arrows: true, ellipses: true } },
  ],
  blank: { text: 'Sample\tGroup\tX1\tX2\tX3\nA1\tG1\t2.1\t4.0\t1.1\nA2\tG1\t2.8\t5.2\t1.9\nA3\tG1\t3.1\t5.9\t1.4\nA4\tG1\t3.9\t7.8\t2.6\nB1\tG2\t6.2\t3.1\t5.2\nB2\tG2\t6.9\t3.8\t6.1\nB3\tG2\t7.4\t4.6\t5.8\nB4\tG2\t8.8\t4.2\t7.9', scale: true, px: 1, py: 2 },
  stats: d => { const m = model(d); return m ? [[m.res.n, 'samples'], [m.res.p, 'variables'], [+(m.res.share[0] * 100).toFixed(1), 'PC1 %']] : [[0, 'samples']]; },
  Controls,
  Render: ({ data }) => <PcaSheet data={data} />,
};
