import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, Seg, Spec, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const B = () => (window as any).SDBox;
const SP = () => (window as any).SDSpecial;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const fm = (v: number) => (isFinite(v) ? (+v.toPrecision(3)).toString() : '');

/* sheet geometry */
const L = 80, T = 30, PW = 520, PH = 360;

function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }

function model(data: any) {
  const tukey = data.whisker !== 'minmax';
  const groups = (data.groups || []).filter((g: any) => g && g.id).map((g: any, i: number) => {
    const vals = B().parse(g.text);
    return { id: g.id, name: g.name || '', color: g.color || col(i), vals, s: vals.length ? B().summary(vals, tukey) : null };
  }).filter((g: any) => g.s);
  const res = data.test === 'none' ? null : groups.length >= 2 ? B().test(groups.map((g: any) => g.vals), data.test === 'rank' ? 'rank' : 'param') : null;
  return { groups, res };
}

function BoxSheet({ data }: { data: any }) {
  const { groups, res } = model(data);
  if (!groups.length) return <EmptyHint text="Add a group and paste its values (numbers separated by spaces, commas or new lines)." />;
  const out: any[] = []; let n = 0; const k = () => 'x' + n++;
  const ng = groups.length, slot = PW / ng, bw = Math.min(96, slot * 0.5), cx = (i: number) => L + slot * (i + 0.5);
  let lo = Math.min(...groups.map((g: any) => g.s.min)), hi = Math.max(...groups.map((g: any) => g.s.max));
  if (data.zero && lo > 0) lo = 0;
  const pad = (hi - lo) * 0.06 || 1; if (!(data.zero && lo === 0)) lo -= pad; hi += pad + (res && ng === 2 && data.bracket !== false ? (hi - lo) * 0.12 : 0);
  const st = niceStep(hi - lo, 7), y0 = Math.floor(lo / st) * st, y1 = Math.ceil(hi / st) * st;
  const Y = (v: number) => T + PH - (v - y0) / (y1 - y0) * PH;
  for (let v = y0; v <= y1 + 1e-9; v += st) {
    const r = +v.toPrecision(10);
    if (data.grid) out.push(<line key={k()} className="km-grid" x1={L} y1={Y(r)} x2={L + PW} y2={Y(r)} />);
    out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>);
  }
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  out.push(<text key={k()} className="km-title" x={22} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 22 ' + (T + PH / 2) + ')'}>{data.ylabel || 'Value'}</text>);
  groups.forEach((g: any, i: number) => {
    const s = g.s, x = cx(i), half = bw / 2, cap = bw * 0.3;
    out.push(<line key={k()} className="bx-whisk" x1={x} y1={Y(s.q3)} x2={x} y2={Y(s.hi)} />, <line key={k()} className="bx-whisk" x1={x} y1={Y(s.q1)} x2={x} y2={Y(s.lo)} />);
    out.push(<line key={k()} className="bx-whisk" x1={x - cap} y1={Y(s.hi)} x2={x + cap} y2={Y(s.hi)} />, <line key={k()} className="bx-whisk" x1={x - cap} y1={Y(s.lo)} x2={x + cap} y2={Y(s.lo)} />);
    out.push(<rect key={k()} className="bx-box" x={x - half} y={Y(s.q3)} width={bw} height={Math.max(1, Y(s.q1) - Y(s.q3))} style={{ fill: g.color, fillOpacity: num(data.fillStrength, 0.45) }} />);
    out.push(<line key={k()} className="bx-med" x1={x - half} y1={Y(s.median)} x2={x + half} y2={Y(s.median)} />);
    if (data.points) g.vals.forEach((v: number, j: number) => { const jit = (((j * 37 + i * 11) % 19) / 19 - 0.5) * bw * 0.7; out.push(<circle key={k()} className="bx-pt" cx={x + jit} cy={Y(v)} r={3.2} style={{ fill: g.color }} />); });
    else s.outliers.forEach((v: number) => out.push(<circle key={k()} className="bx-out" cx={x} cy={Y(v)} r={3.4} />));
    if (data.mean) out.push(<polygon key={k()} className="bx-mean" points={`${x},${Y(s.mean) - 5} ${x + 5},${Y(s.mean)} ${x},${Y(s.mean) + 5} ${x - 5},${Y(s.mean)}`} />);
    out.push(<text key={k()} className="km-name" x={x} y={T + PH + 19} textAnchor="middle">{g.name}</text>);
    if (data.showN !== false) out.push(<text key={k()} className="km-note" x={x} y={T + PH + 34} textAnchor="middle">n = {s.n}</text>);
  });
  if (res && data.pvalue !== false) {
    const txt = res.name + ', ' + (SP().fmtP(res.p));
    if (ng === 2 && data.bracket !== false) {
      const top = Math.max(groups[0].s.max, groups[1].s.max), by = Y(top + (y1 - y0) * 0.05);
      out.push(<path key={k()} className="bx-brk" d={`M${cx(0)} ${by + 6}V${by}H${cx(1)}V${by + 6}`} />);
      out.push(<text key={k()} className="km-note" x={(cx(0) + cx(1)) / 2} y={by - 6} textAnchor="middle">{SP().fmtP(res.p)}</text>);
    } else out.push(<text key={k()} className="km-note" x={L + 8} y={T + 16}>{txt}</text>);
  }
  return <g className="bx">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const groups = data.groups || [], { groups: gm, res } = model(data);
  const upd = (id: string, patch: any, kk: string) => set({ groups: groups.map((g: any) => (g.id === id ? { ...g, ...patch } : g)) }, kk);
  return (
    <>
      <S.Panel kicker="Axis" help="The value axis starts just below the data. Tick Start at 0 for counts, masses and concentrations.">
        <TextIn id="bx-yl" label="Value title" value={data.ylabel} placeholder="Value" onChange={v => set({ ylabel: v }, 'bx-yl')} />
        <Toggle on={!!data.zero} label="Start the axis at 0" onChange={v => set({ zero: v })} />
      </S.Panel>
      <Rows id="bx-g" kicker="Groups" help="One box per group. Paste its values below." rows={groups}
        cols={[{ key: 'name', label: 'Name', w: '1.6fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ id: uid('g', groups.map((g: any) => g.id)), name: 'Group ' + (groups.length + 1), color: col(groups.length), text: '' })}
        addLabel="+ Add group" onChange={(r, kk) => set({ groups: r.map((x, i) => ({ ...x, id: x.id || uid('g', groups.map((g: any) => g.id)), color: x.color || col(i) })) }, kk)} />
      {groups.map((g: any) => <S.Panel key={g.id} kicker={'Values: ' + (g.name || 'group')} help="Numbers separated by spaces, commas or new lines. Paste a spreadsheet column straight in.">
        <Spec id={'bx-t-' + g.id} label="Values" rows={4} value={g.text || ''} onChange={v => upd(g.id, { text: v }, 'bx-t-' + g.id)} />
      </S.Panel>)}
      <S.Panel kicker="Statistics" help="Two groups: Welch t-test or Mann-Whitney U. Three or more: one-way ANOVA or Kruskal-Wallis. These give one overall p value and do not adjust for several comparisons.">
        <Seg value={data.test || 'param'} options={[['param', 'Means (t, ANOVA)'], ['rank', 'Ranks (U, K-W)'], ['none', 'None']]} onChange={v => set({ test: v })} />
        <Toggle on={data.pvalue !== false} label="Show the p value" onChange={v => set({ pvalue: v })} />
        <Toggle on={data.bracket !== false} label="Bracket between two groups" onChange={v => set({ bracket: v })} />
      </S.Panel>
      <S.Panel kicker="Look">
        <Seg value={data.whisker === 'minmax' ? 'minmax' : 'tukey'} options={[['tukey', 'Whiskers 1.5 IQR'], ['minmax', 'Min to max']]} onChange={v => set({ whisker: v })} />
        <Toggle on={!!data.points} label="Show every data point" onChange={v => set({ points: v })} />
        <Toggle on={!!data.mean} label="Mean (diamond)" onChange={v => set({ mean: v })} />
        <Toggle on={data.showN !== false} label="Sample size under each box" onChange={v => set({ showN: v })} />
        <Toggle on={!!data.grid} label="Grid lines" onChange={v => set({ grid: v })} />
        <Range id="bx-op" label="Box fill strength" value={num(data.fillStrength, 0.45)} min={0.1} max={1} step={0.05} onChange={v => set({ fillStrength: v }, 'bx-op')} />
      </S.Panel>
      {gm.length ? <S.Panel kicker="Results" help="Box: first quartile, median and third quartile (R type 7). Whiskers reach the furthest value within 1.5 IQR of the box.">
        <ul className="tr-results">
          {gm.map((g: any) => <li key={g.id}><b>{g.name}</b>: n = {g.s.n}, median {fm(g.s.median)} (IQR {fm(g.s.q1)} to {fm(g.s.q3)}), mean {fm(g.s.mean)}{isFinite(g.s.sd) ? ' ± ' + fm(g.s.sd) : ''}{g.s.outliers.length ? ', ' + g.s.outliers.length + ' outlier' + (g.s.outliers.length > 1 ? 's' : '') : ''}</li>)}
          {res ? <li>{res.name}: {res.text}, {SP().fmtP(res.p)}</li> : null}
        </ul>
      </S.Panel> : null}
    </>
  );
}

function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()); }
const sample = (n: number, seed: number, mu: number, sd: number, dp = 1, extra: number[] = []) => { const z = rng(seed), f = Math.pow(10, dp); return [...Array.from({ length: n }, () => String(Math.round((mu + sd * z()) * f) / f)), ...extra.map(String)].join(' '); };
const grp = (name: string, text: string, i: number) => ({ id: 'g' + i, name, color: col(i), text });

export const boxplot: EditorDef = {
  id: 'box-plot', num: '35', name: 'Box plot', field: 'Methods',
  blurb: 'Distribution by group: median, quartiles, whiskers and outliers, with every data point, the mean and a group test.',
  hint: 'Paste each group\'s values. Quartiles, outliers and the test are worked out for you.',
  templates: [
    { name: 'Two diets, LDL cholesterol', desc: 'Two groups with a t-test and bracket', title: 'LDL cholesterol after two diets',
      caption: 'LDL cholesterol (mmol/L) after 8 weeks on a control diet or a plant-rich diet, 20 adults per group (simulated). Box: quartiles and median. Diamond: mean. Welch t-test. Sample data for practice.',
      data: { ylabel: 'LDL cholesterol (mmol/L)', test: 'param', mean: true, points: true, groups: [grp('Control', sample(20, 3, 3.5, 0.55, 2), 0), grp('Plant-rich', sample(20, 9, 3.0, 0.5, 2), 1)] } },
    { name: 'Fish length at four sites', desc: 'Four groups, an outlier, Kruskal-Wallis', title: 'Fish length at four reef sites',
      caption: 'Total length (cm) of a reef fish at four sites, 25 fish per site (simulated). Open circles are outliers beyond 1.5 IQR. Kruskal-Wallis test. Sample data for practice.',
      data: { ylabel: 'Total length (cm)', test: 'rank', zero: true, groups: [grp('Site 1', sample(25, 4, 18, 3), 0), grp('Site 2', sample(25, 8, 21, 3.5, 1, [33]), 1), grp('Site 3', sample(25, 12, 16, 2.5), 2), grp('Site 4', sample(25, 16, 20, 4), 3)] } },
    { name: 'Three doses, enzyme activity', desc: 'Three groups with points and ANOVA', title: 'Enzyme activity by dose',
      caption: 'Liver enzyme activity (U/L) by dose, 15 animals per group (simulated). Dots are individual animals. One-way ANOVA. Sample data for practice.',
      data: { ylabel: 'Enzyme activity (U/L)', test: 'param', points: true, mean: true, groups: [grp('Vehicle', sample(15, 2, 40, 8, 0), 0), grp('Low dose', sample(15, 6, 52, 9, 0), 1), grp('High dose', sample(15, 10, 68, 11, 0), 2)] } },
  ],
  blank: { ylabel: 'Value', test: 'param', groups: [grp('Group A', '4.1 5.2 5.8 6.0 6.4 7.1 8.3', 0), grp('Group B', '5.5 6.8 7.2 7.9 8.4 9.0 11.5', 1)] },
  stats: d => { const m = model(d); return m.groups.length ? [[m.groups.length, 'groups'], [m.groups.reduce((s: number, g: any) => s + g.s.n, 0), 'values']] : [[0, 'groups']]; },
  Controls,
  Render: ({ data }) => <BoxSheet data={data} />,
};
