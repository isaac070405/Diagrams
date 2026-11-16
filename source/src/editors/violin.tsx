import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, Seg, Spec, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const B = () => (window as any).SDBox;
const V = () => (window as any).SDViolin;
const SP = () => (window as any).SDSpecial;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const fm = (v: number) => (isFinite(v) ? (+v.toPrecision(3)).toString() : '');

/* sheet geometry */
const L = 80, T = 30, PW = 520, PH = 360;
function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }

function model(data: any) {
  const groups = (data.groups || []).filter((g: any) => g && g.id).map((g: any, i: number) => {
    const vals = B().parse(g.text), s = vals.length ? B().summary(vals, true) : null;
    return { id: g.id, name: g.name || '', color: g.color || col(i), vals, s, k: vals.length >= 2 ? V().kde(vals, num(data.bw, 1), data.trim !== false) : null };
  }).filter((g: any) => g.s);
  const res = data.test === 'none' ? null : groups.length >= 2 ? B().test(groups.map((g: any) => g.vals), data.test === 'rank' ? 'rank' : 'param') : null;
  return { groups, res };
}

function ViolinSheet({ data }: { data: any }) {
  const { groups, res } = model(data);
  if (!groups.length) return <EmptyHint text="Add a group and paste its values (numbers separated by spaces, commas or new lines). A violin needs at least 2 values." />;
  const out: any[] = []; let n = 0; const k = () => 'v' + n++;
  const ng = groups.length, slot = PW / ng, wmax = slot * 0.42, cx = (i: number) => L + slot * (i + 0.5), scale = data.scale || 'area';
  let lo = Math.min(...groups.map((g: any) => (g.k ? g.k.xs[0] : g.s.min))), hi = Math.max(...groups.map((g: any) => (g.k ? g.k.xs[g.k.xs.length - 1] : g.s.max)));
  if (data.zero && lo > 0) lo = 0;
  const pad = (hi - lo) * 0.05 || 1; if (!(data.zero && lo === 0)) lo -= pad; hi += pad + (res && ng === 2 && data.bracket !== false ? (hi - lo) * 0.12 : 0);
  const st = niceStep(hi - lo, 7), y0 = Math.floor(lo / st) * st, y1 = Math.ceil(hi / st) * st, Y = (v: number) => T + PH - (v - y0) / (y1 - y0) * PH;
  for (let v = y0; v <= y1 + 1e-9; v += st) { const r = +v.toPrecision(10); if (data.grid) out.push(<line key={k()} className="km-grid" x1={L} y1={Y(r)} x2={L + PW} y2={Y(r)} />); out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>); }
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  out.push(<text key={k()} className="km-title" x={22} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 22 ' + (T + PH / 2) + ')'}>{data.ylabel || 'Value'}</text>);
  /* a common density scale for area (equal area) and count (area follows n); width fits each violin to the slot */
  const dmax = Math.max(...groups.map((g: any) => (g.k ? Math.max(...g.k.ys) : 0))) || 1, cmax = Math.max(...groups.map((g: any) => (g.k ? Math.max(...g.k.ys) * g.s.n : 0))) || 1;
  groups.forEach((g: any, i: number) => {
    const x = cx(i), s = g.s;
    if (g.k) {
      const gm = scale === 'width' ? Math.max(...g.k.ys) : scale === 'count' ? cmax / g.s.n : dmax, hw = (d: number) => d / gm * wmax;
      const right = g.k.xs.map((v: number, j: number) => [x + hw(g.k.ys[j]), Y(v)]), left = g.k.xs.map((v: number, j: number) => [x - hw(g.k.ys[j]), Y(v)]).reverse();
      out.push(<polygon key={k()} className="vl-body" points={[...right, ...left].map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')} style={{ fill: g.color, fillOpacity: num(data.fillStrength, 0.55) }} />);
    }
    if (data.points) g.vals.forEach((v: number, j: number) => { const jit = (((j * 37 + i * 11) % 19) / 19 - 0.5) * wmax * 0.9; out.push(<circle key={k()} className="bx-pt" cx={x + jit} cy={Y(v)} r={2.8} style={{ fill: g.color }} />); });
    if (data.inner !== false) {
      out.push(<line key={k()} className="vl-whisk" x1={x} y1={Y(s.lo)} x2={x} y2={Y(s.hi)} />, <rect key={k()} className="vl-iqr" x={x - 4.5} y={Y(s.q3)} width={9} height={Math.max(1, Y(s.q1) - Y(s.q3))} />, <circle key={k()} className="vl-med" cx={x} cy={Y(s.median)} r={3.4} />);
    }
    if (data.mean) out.push(<polygon key={k()} className="bx-mean" points={`${x},${Y(s.mean) - 5} ${x + 5},${Y(s.mean)} ${x},${Y(s.mean) + 5} ${x - 5},${Y(s.mean)}`} />);
    out.push(<text key={k()} className="km-name" x={x} y={T + PH + 19} textAnchor="middle">{g.name}</text>);
    if (data.showN !== false) out.push(<text key={k()} className="km-note" x={x} y={T + PH + 34} textAnchor="middle">n = {s.n}</text>);
  });
  if (res && data.pvalue !== false) {
    if (ng === 2 && data.bracket !== false) {
      const top = Math.max(groups[0].k ? groups[0].k.xs[groups[0].k.xs.length - 1] : groups[0].s.max, groups[1].k ? groups[1].k.xs[groups[1].k.xs.length - 1] : groups[1].s.max), by = Y(top + (y1 - y0) * 0.04);
      out.push(<path key={k()} className="bx-brk" d={`M${cx(0)} ${by + 6}V${by}H${cx(1)}V${by + 6}`} />, <text key={k()} className="km-note" x={(cx(0) + cx(1)) / 2} y={by - 6} textAnchor="middle">{SP().fmtP(res.p)}</text>);
    } else out.push(<text key={k()} className="km-note" x={L + 8} y={T + 16}>{res.name + ', ' + SP().fmtP(res.p)}</text>);
  }
  return <g className="vl">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const groups = data.groups || [], { groups: gm, res } = model(data);
  const upd = (id: string, patch: any, kk: string) => set({ groups: groups.map((g: any) => (g.id === id ? { ...g, ...patch } : g)) }, kk);
  return (
    <>
      <S.Panel kicker="Axis">
        <TextIn id="vl-yl" label="Value title" value={data.ylabel} placeholder="Value" onChange={v => set({ ylabel: v }, 'vl-yl')} />
        <Toggle on={!!data.zero} label="Start the axis at 0" onChange={v => set({ zero: v })} />
      </S.Panel>
      <Rows id="vl-g" kicker="Groups" help="One violin per group. Paste its values below." rows={groups}
        cols={[{ key: 'name', label: 'Name', w: '1.6fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ id: uid('g', groups.map((g: any) => g.id)), name: 'Group ' + (groups.length + 1), color: col(groups.length), text: '' })}
        addLabel="+ Add group" onChange={(r, kk) => set({ groups: r.map((x, i) => ({ ...x, id: x.id || uid('g', groups.map((g: any) => g.id)), color: x.color || col(i) })) }, kk)} />
      {groups.map((g: any) => <S.Panel key={g.id} kicker={'Values: ' + (g.name || 'group')} help="Numbers separated by spaces, commas or new lines. Paste a spreadsheet column straight in.">
        <Spec id={'vl-t-' + g.id} label="Values" rows={4} value={g.text || ''} onChange={v => upd(g.id, { text: v }, 'vl-t-' + g.id)} />
      </S.Panel>)}
      <S.Panel kicker="Violin" help="Each violin is a kernel density estimate (Gaussian, Silverman bandwidth): it is widest where the values are most common. A smoother violin has a larger bandwidth. Equal area gives every group the same area, width fills each slot, count makes area follow the sample size. Trimming stops the shape at the smallest and largest value.">
        <Seg wrap value={data.scale || 'area'} options={[['area', 'Equal area'], ['width', 'Equal width'], ['count', 'By count']]} onChange={v => set({ scale: v })} />
        <Range id="vl-bw" label={'Bandwidth: ' + fm(num(data.bw, 1)) + ' x the default'} value={num(data.bw, 1)} min={0.3} max={3} step={0.1} onChange={v => set({ bw: v }, 'vl-bw')} />
        <Toggle on={data.trim !== false} label="Trim the ends to the data" onChange={v => set({ trim: v })} />
      </S.Panel>
      <S.Panel kicker="Statistics" help="Two groups: Welch t-test or Mann-Whitney U. Three or more: one-way ANOVA or Kruskal-Wallis. One overall p value, with no adjustment for several comparisons.">
        <Seg value={data.test || 'param'} options={[['param', 'Means (t, ANOVA)'], ['rank', 'Ranks (U, K-W)'], ['none', 'None']]} onChange={v => set({ test: v })} />
        <Toggle on={data.pvalue !== false} label="Show the p value" onChange={v => set({ pvalue: v })} />
        <Toggle on={data.bracket !== false} label="Bracket between two groups" onChange={v => set({ bracket: v })} />
      </S.Panel>
      <S.Panel kicker="Look">
        <Toggle on={data.inner !== false} label="Median and quartiles inside" onChange={v => set({ inner: v })} />
        <Toggle on={!!data.points} label="Show every data point" onChange={v => set({ points: v })} />
        <Toggle on={!!data.mean} label="Mean (diamond)" onChange={v => set({ mean: v })} />
        <Toggle on={data.showN !== false} label="Sample size under each violin" onChange={v => set({ showN: v })} />
        <Toggle on={!!data.grid} label="Grid lines" onChange={v => set({ grid: v })} />
        <Range id="vl-op" label="Fill strength" value={num(data.fillStrength, 0.55)} min={0.1} max={1} step={0.05} onChange={v => set({ fillStrength: v }, 'vl-op')} />
      </S.Panel>
      {gm.length ? <S.Panel kicker="Results" help="Median, quartiles (R type 7), mean and SD for each group, and the bandwidth used.">
        <ul className="tr-results">
          {gm.map((g: any) => <li key={g.id}><b>{g.name}</b>: n = {g.s.n}, median {fm(g.s.median)} (IQR {fm(g.s.q1)} to {fm(g.s.q3)}), mean {fm(g.s.mean)}{isFinite(g.s.sd) ? ' ± ' + fm(g.s.sd) : ''}{g.k ? ', bandwidth ' + fm(g.k.h) : ', too few values for a violin'}</li>)}
          {res ? <li>{res.name}: {res.text}, {SP().fmtP(res.p)}</li> : null}
        </ul>
      </S.Panel> : null}
    </>
  );
}

function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()); }
const sample = (n: number, seed: number, mu: number, sd: number, dp = 1) => { const z = rng(seed), f = Math.pow(10, dp); return Array.from({ length: n }, () => String(Math.round((mu + sd * z()) * f) / f)).join(' '); };
const bimodal = (n: number, seed: number, a: number, b: number, sd: number, dp = 1) => { const z = rng(seed), f = Math.pow(10, dp); return Array.from({ length: n }, (_, i) => String(Math.round(((i % 3 ? a : b) + sd * z()) * f) / f)).join(' '); };
const grp = (name: string, text: string, i: number) => ({ id: 'g' + i, name, color: col(i), text });

export const violin: EditorDef = {
  id: 'violin-plot', num: '35', name: 'Violin plot', field: 'Methods',
  blurb: 'Distribution by group as a smoothed density shape, with the median, quartiles, every data point and a group test.',
  hint: 'Paste each group\'s values. The density shapes, quartiles and the test are worked out for you.',
  templates: [
    { name: 'Gut transit time, two diets', desc: 'Two skewed groups with a t-test', title: 'Gut transit time on two diets',
      caption: 'Whole-gut transit time (hours) in 30 adults per group after 4 weeks on a low-fibre or high-fibre diet (simulated). Violin: kernel density. Inner box: quartiles and median. Welch t-test. Sample data for practice.',
      data: { ylabel: 'Transit time (hours)', test: 'param', groups: [grp('Low fibre', sample(30, 3, 58, 14), 0), grp('High fibre', sample(30, 9, 42, 11), 1)] } },
    { name: 'Two clusters in one group', desc: 'Shows what a box plot hides', title: 'Body length of a fish species at three sites',
      caption: 'Total length (cm) of fish at three sites, 36 per site (simulated). Site B holds two size classes, which a box plot would hide. Points are individual fish. Kruskal-Wallis test. Sample data for practice.',
      data: { ylabel: 'Total length (cm)', test: 'rank', points: true, groups: [grp('Site A', sample(36, 4, 28, 4), 0), grp('Site B', bimodal(36, 8, 22, 36, 2.6), 1), grp('Site C', sample(36, 12, 30, 5), 2)] } },
    { name: 'Four treatments', desc: 'Four groups, equal width', title: 'Cell viability after four treatments',
      caption: 'Cell viability (% of control) in 24 wells per treatment (simulated). Violins use equal width. One-way ANOVA. Sample data for practice.',
      data: { ylabel: 'Viability (% of control)', test: 'param', scale: 'width', groups: [grp('Control', sample(24, 2, 100, 7, 0), 0), grp('Drug A', sample(24, 6, 82, 9, 0), 1), grp('Drug B', sample(24, 10, 64, 12, 0), 2), grp('A + B', sample(24, 14, 41, 10, 0), 3)] } },
  ],
  blank: { ylabel: 'Value', test: 'param', groups: [grp('Group A', '4.1 5.2 5.8 6.0 6.4 7.1 8.3 5.5 6.2 6.9', 0), grp('Group B', '5.5 6.8 7.2 7.9 8.4 9.0 11.5 7.0 8.1 8.8', 1)] },
  stats: d => { const m = model(d); return m.groups.length ? [[m.groups.length, 'groups'], [m.groups.reduce((s: number, g: any) => s + g.s.n, 0), 'values']] : [[0, 'groups']]; },
  Controls,
  Render: ({ data }) => <ViolinSheet data={data} />,
};
