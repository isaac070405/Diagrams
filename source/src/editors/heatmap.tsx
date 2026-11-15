import { S } from '../sheet';
import { EmptyHint, num, Select, Seg, Spec, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const H = () => (window as any).SDHeat;
const C = () => (window as any).SDContour;
const RAMPS: [string, string][] = [['diverging', 'Diverging'], ['viridis', 'Viridis'], ['ocean', 'Ocean'], ['heat', 'Heat'], ['grey', 'Grey']];
const f2 = (v: number) => (+v.toPrecision(3)).toString();
const MAXCELLS = 6000;

function model(data: any) {
  const m = H().parse(data.text);
  if (!m) return null;
  const nr = m.rows.length, nc = m.cols.length;
  if (nr * nc > MAXCELLS) return { tooBig: true, nr, nc } as any;
  let rows = m.rows;
  if (data.scale === 'log') rows = rows.map((r: any) => ({ name: r.name, vals: r.vals.map((v: number) => (isFinite(v) ? Math.log10(Math.max(0, v) + 1) : NaN)) }));
  if (data.scale === 'row') rows = H().zRows(rows);
  const kind = data.dist === 'euclid' ? 'euclid' : 'corr', link = data.link || 'average';
  const rc = data.clusterRows !== false && nr > 1 ? H().cluster(rows.map((r: any) => r.vals), kind, link) : null;
  const colVecs = m.cols.map((c: string, j: number) => rows.map((r: any) => r.vals[j]));
  const cc = data.clusterCols !== false && nc > 1 ? H().cluster(colVecs, kind, link) : null;
  const rowOrder = rc ? rc.order : rows.map((_: any, i: number) => i), colOrder = cc ? cc.order : m.cols.map((_: any, j: number) => j);
  const all = rows.flatMap((r: any) => r.vals.filter(isFinite));
  return { m, rows, rc, cc, rowOrder, colOrder, nr, nc, lo: Math.min(...all), hi: Math.max(...all) };
}

function HeatSheet({ data }: { data: any }) {
  const md: any = model(data);
  if (!md) return <EmptyHint text="Paste a table: column names in the first row, row names in the first column." />;
  if (md.tooBig) return <EmptyHint text={'This matrix has ' + md.nr + ' x ' + md.nc + ' cells. The limit is ' + MAXCELLS + '. Use fewer rows or columns.'} />;
  const out: any[] = []; let n = 0; const k = () => 'h' + n++;
  const { m, rows, rc, cc, rowOrder, colOrder, nr, nc } = md;
  const cw = Math.max(7, Math.min(44, 500 / nc)), ch = Math.max(6, Math.min(26, 380 / nr)), fs = Math.max(8, Math.min(12, ch - 1));
  const showRowNames = ch >= 8.5, showColNames = cw >= 9, vals = data.values && cw >= 22 && ch >= 13;
  const rowLabW = showRowNames ? Math.min(150, Math.max(...rows.map((r: any) => r.name.length)) * (fs * 0.56) + 10) : 0, colLabH = showColNames ? Math.min(110, Math.max(...m.cols.map((c: string) => c.length)) * (fs * 0.56) + 10) : 0;
  const rdW = rc ? 70 : 0, cdH = cc ? 56 : 0, X0 = 14 + rdW, Y0 = 8 + cdH, W = nc * cw, Hh = nr * ch;
  const ramp = data.ramp || 'diverging', rev = !!data.reverse, fixed = data.min !== undefined && data.min !== '' && data.max !== undefined && data.max !== '';
  let lo = fixed ? num(data.min, md.lo) : md.lo, hi = fixed ? num(data.max, md.hi) : md.hi;
  if (!fixed && data.scale === 'row') { const lim = Math.min(3, Math.max(Math.abs(lo), Math.abs(hi))); lo = -lim; hi = lim; }
  if (!(hi > lo)) hi = lo + 1;
  const colorOf = (v: number) => C().color(ramp, (v - lo) / (hi - lo), rev);
  rowOrder.forEach((ri: number, y: number) => colOrder.forEach((cj: number, x: number) => {
    const v = rows[ri].vals[cj];
    out.push(<rect key={k()} className="hm-cell" x={X0 + x * cw} y={Y0 + y * ch} width={cw} height={ch} style={{ fill: isFinite(v) ? colorOf(v) : 'var(--neutral-200)' }} />);
    if (vals && isFinite(v)) { const t = (v - lo) / (hi - lo); out.push(<text key={k()} className="hm-val" x={X0 + x * cw + cw / 2} y={Y0 + y * ch + ch / 2 + 3.5} textAnchor="middle" style={{ fill: ramp === 'viridis' && t < 0.55 ? '#fff' : 'var(--ink)' }}>{f2(v)}</text>); }
  }));
  out.push(<rect key={k()} className="hm-frame" x={X0} y={Y0} width={W} height={Hh} />);
  if (showRowNames) rowOrder.forEach((ri: number, y: number) => out.push(<text key={k()} className="hm-lab" x={X0 + W + 6} y={Y0 + y * ch + ch / 2 + fs * 0.35} style={{ fontSize: fs }}>{rows[ri].name}</text>));
  if (showColNames) colOrder.forEach((cj: number, x: number) => out.push(<text key={k()} className="hm-lab" x={0} y={0} transform={`translate(${X0 + x * cw + cw / 2 + fs * 0.35} ${Y0 + Hh + 7}) rotate(90)`} style={{ fontSize: fs }}>{m.cols[cj]}</text>));
  /* dendrograms: root at the outer edge, leaves against the matrix */
  const dend = (tree: any, order: number[], horiz: boolean) => {
    const rank: any = {}; order.forEach((leaf, i) => { rank[leaf] = i; });
    let hmax = 0; (function mx(t: any) { if (t.leaf === undefined) { hmax = Math.max(hmax, t.h); mx(t.left); mx(t.right); } })(tree); if (!(hmax > 0)) hmax = 1;
    const span = (horiz ? rdW : cdH) - 6;
    const walk = (t: any): { pos: number; h: number } => {
      if (t.leaf !== undefined) return { pos: (rank[t.leaf] + 0.5) * (horiz ? ch : cw), h: 0 };
      const a = walk(t.left), b = walk(t.right), hh = t.h, pos = (a.pos + b.pos) / 2;
      const P = (h: number, p: number) => horiz ? [X0 - 3 - h / hmax * span, Y0 + p] : [X0 + p, Y0 - 3 - h / hmax * span];
      const pa = P(a.h, a.pos), pb = P(b.h, b.pos), pt1 = P(hh, a.pos), pt2 = P(hh, b.pos);
      out.push(<path key={k()} className="hm-dend" d={`M${pa[0]} ${pa[1]}L${pt1[0]} ${pt1[1]}L${pt2[0]} ${pt2[1]}L${pb[0]} ${pb[1]}`} />);
      return { pos, h: hh };
    };
    walk(tree);
  };
  if (rc && rc.tree && rc.tree.leaf === undefined) dend(rc.tree, rc.order, true);
  if (cc && cc.tree && cc.tree.leaf === undefined) dend(cc.tree, cc.order, false);
  /* colour bar */
  if (data.bar !== false) {
    const bx = X0 + W + rowLabW + 24, by = Y0, bh = Math.min(140, Hh), steps = 40;
    for (let i = 0; i < steps; i++) out.push(<rect key={k()} x={bx} y={by + bh - (i + 1) * bh / steps} width={12} height={bh / steps + 0.6} style={{ fill: colorOf(lo + (hi - lo) * (i + 0.5) / steps) }} />);
    out.push(<rect key={k()} className="hm-frame" x={bx} y={by} width={12} height={bh} />);
    [[hi, by], [(lo + hi) / 2, by + bh / 2], [lo, by + bh]].forEach(([v, y]: any) => out.push(<text key={k()} className="hm-tick" x={bx + 18} y={y + 4}>{f2(v)}</text>));
    out.push(<text key={k()} className="hm-tick hm-bold" x={bx} y={by - 8}>{data.barLabel || (data.scale === 'row' ? 'Row z-score' : data.scale === 'log' ? 'log10(x + 1)' : 'Value')}</text>);
  }
  return <g className="hm">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const md: any = model(data);
  return (
    <>
      <Spec id="hm-text" label="Matrix" rows={9} value={data.text || ''} help="Column names in the first row, row names in the first column. Tabs or commas. Paste straight from a spreadsheet. Missing values show grey."
        onChange={v => set({ text: v }, 'hm-text')} placeholder={'\tS1\tS2\tS3\nGeneA\t1.2\t3.4\t2.2'} />
      <S.Panel kicker="Values" help="Z-score puts every row on the same scale so patterns show, whatever the size of the values. Log suits counts.">
        <Seg value={data.scale || 'none'} options={[['none', 'As entered'], ['row', 'Row z-score'], ['log', 'log10(x+1)']]} onChange={v => set({ scale: v })} />
        <div className="mk-pair">
          <TextIn id="hm-min" label="Colour min" value={data.min} placeholder="auto" onChange={v => set({ min: v }, 'hm-min')} />
          <TextIn id="hm-max" label="Colour max" value={data.max} placeholder="auto" onChange={v => set({ max: v }, 'hm-max')} />
        </div>
      </S.Panel>
      <S.Panel kicker="Clustering" help="Rows or columns are reordered so similar ones sit together, with a tree on the edge. Correlation distance groups profiles that rise and fall together. Euclidean groups similar sizes.">
        <Toggle on={data.clusterRows !== false} label="Cluster the rows" onChange={v => set({ clusterRows: v })} />
        <Toggle on={data.clusterCols !== false} label="Cluster the columns" onChange={v => set({ clusterCols: v })} />
        <Seg value={data.dist === 'euclid' ? 'euclid' : 'corr'} options={[['corr', '1 − correlation'], ['euclid', 'Euclidean']]} onChange={v => set({ dist: v })} />
        <Seg value={data.link || 'average'} options={[['average', 'Average'], ['complete', 'Complete'], ['single', 'Single']]} onChange={v => set({ link: v })} />
      </S.Panel>
      <S.Panel kicker="Look">
        <Select id="hm-ramp" label="Colours" value={data.ramp || 'diverging'} options={RAMPS} onChange={v => set({ ramp: v })} />
        <Toggle on={!!data.reverse} label="Reverse the colours" onChange={v => set({ reverse: v })} />
        <Toggle on={!!data.values} label="Values in the cells (large cells)" onChange={v => set({ values: v })} />
        <Toggle on={data.bar !== false} label="Colour bar" onChange={v => set({ bar: v })} />
        <TextIn id="hm-bl" label="Colour bar title" value={data.barLabel} placeholder="Row z-score" onChange={v => set({ barLabel: v }, 'hm-bl')} />
      </S.Panel>
      {md && !md.tooBig ? <S.Panel kicker="Results" help="Row and column order after clustering.">
        <ul className="tr-results">
          <li>{md.nr} rows by {md.nc} columns</li>
          {md.rc ? <li>Row order: {md.rowOrder.slice(0, 14).map((i: number) => md.rows[i].name).join(', ')}{md.nr > 14 ? ', ...' : ''}</li> : null}
          {md.cc ? <li>Column order: {md.colOrder.slice(0, 14).map((j: number) => md.m.cols[j]).join(', ')}{md.nc > 14 ? ', ...' : ''}</li> : null}
        </ul>
      </S.Panel> : null}
    </>
  );
}

function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return { u, z: () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()) }; }
const table = (cols: string[], rows: [string, number[]][], dp = 2) => '\t' + cols.join('\t') + '\n' + rows.map(([n, v]) => n + '\t' + v.map(x => (Math.round(x * Math.pow(10, dp)) / Math.pow(10, dp))).join('\t')).join('\n');
function expression() {
  const g = rng(4), cols = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'], rows: [string, number[]][] = [];
  for (let i = 0; i < 30; i++) { const mod = i < 10 ? 1 : i < 20 ? -1 : 0, base = 6 + 2 * g.z(), amp = mod * (1.2 + 0.5 * g.u()); rows.push(['Gene' + String(i + 1).padStart(2, '0'), cols.map((c, j) => base + (j >= 6 ? amp : 0) + 0.45 * g.z())]); }
  rows.sort(() => g.u() - 0.5);
  return table(cols, rows);
}
function nutrientCor() {
  const g = rng(9), names = ['Energy', 'Protein', 'Fat', 'SFA', 'Carbohydrate', 'Sugars', 'Fibre', 'Vitamin C', 'Folate', 'Sodium'];
  const load = [[.8, .1, .1], [.5, .1, .6], [.7, .5, -.1], [.6, .6, -.2], [.6, -.4, .3], [.2, -.5, .1], [.2, -.4, .7], [-.1, -.3, .6], [.1, -.2, .7], [.5, .5, .1]];
  const n = 80, data = names.map(() => [] as number[]);
  for (let s = 0; s < n; s++) { const f = [g.z(), g.z(), g.z()]; names.forEach((_, i) => data[i].push(load[i][0] * f[0] + load[i][1] * f[1] + load[i][2] * f[2] + 0.55 * g.z())); }
  const cor = (a: number[], b: number[]) => { const ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
  return table(names, names.map((nm, i): [string, number[]] => [nm, names.map((_, j) => cor(data[i], data[j]))]));
}
const reef = '\tSite 1\tSite 2\tSite 3\tSite 4\tSite 5\tSite 6\tSite 7\tSite 8\nAcropora\t42\t38\t30\t6\t4\t2\t0\t1\nPorites\t20\t24\t22\t18\t16\t9\t4\t3\nPocillopora\t11\t14\t9\t3\t2\t1\t0\t0\nMontipora\t9\t7\t10\t12\t8\t3\t1\t0\nTurf algae\t4\t6\t9\t22\t26\t30\t28\t25\nMacroalgae\t1\t2\t3\t10\t14\t25\t32\t30\nCoralline algae\t6\t5\t8\t9\t11\t8\t6\t7\nSponges\t2\t1\t2\t4\t6\t12\t15\t14\nSoft coral\t3\t4\t6\t8\t9\t7\t4\t3\nSea urchins\t0\t1\t1\t3\t5\t9\t14\t16';

export const heatmap: EditorDef = {
  id: 'heatmap', num: '38', name: 'Clustered heatmap', field: 'Cells and measurement',
  blurb: 'A matrix as colours, with rows and columns reordered by hierarchical clustering and drawn with dendrograms.',
  hint: 'Paste a table with column names on top and row names on the left. Pick scaling and clustering on the left.',
  templates: [
    { name: 'Gene expression, clustered', desc: '30 genes in control and treated samples', title: 'Expression of 30 genes in control and treated samples',
      caption: 'Simulated log expression of 30 genes in six control (C) and six treated (T) samples, scaled by row (z-score) and clustered by 1 - correlation, average linkage. Sample data for practice.',
      data: { text: expression(), scale: 'row', ramp: 'diverging', dist: 'corr', link: 'average', barLabel: 'Row z-score' } },
    { name: 'Nutrient correlation matrix', desc: 'Pearson r between ten nutrients', title: 'Correlations among dietary nutrients',
      caption: 'Pearson correlation between ten nutrient intakes in 80 adults (simulated), clustered so related nutrients sit together. Sample data for practice.',
      data: { text: nutrientCor(), scale: 'none', ramp: 'diverging', min: '-1', max: '1', values: true, dist: 'corr', link: 'average', barLabel: 'Pearson r' } },
    { name: 'Reef cover by site', desc: 'Counts on a log scale', title: 'Benthic cover across eight reef sites',
      caption: 'Example percent cover of ten benthic groups at eight sites, log10(x + 1) scaled and clustered by Euclidean distance. Sample data for practice.',
      data: { text: reef, scale: 'log', ramp: 'ocean', dist: 'euclid', link: 'average', values: false } },
  ],
  blank: { text: '\tA\tB\tC\tD\nrow1\t1\t2\t3\t4\nrow2\t4\t3\t2\t1\nrow3\t1\t3\t3\t5\nrow4\t5\t4\t2\t1', scale: 'row', ramp: 'diverging', dist: 'corr', link: 'average' },
  stats: d => { const m: any = model(d); return m && !m.tooBig ? [[m.nr, 'rows'], [m.nc, 'columns']] : [[0, 'rows']]; },
  Controls,
  Render: ({ data }) => <HeatSheet data={data} />,
};
