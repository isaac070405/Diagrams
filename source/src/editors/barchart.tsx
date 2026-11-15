import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, Seg, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const B = () => (window as any).SDBox;
const SP = () => (window as any).SDSpecial;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const key = (id: string) => 's_' + id;
const short = (n: any) => String(n || '').slice(0, 10);
const fm = (v: number) => (isFinite(v) ? (+v.toPrecision(3)).toString() : '');
const ERR: any = { sd: 'SD', sem: 'SEM', ci: '95% CI' };

/* sheet geometry */
const L = 80, T = 24, PW = 520, PH = 340;
function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }

/* a cell is a list of replicates, or in summary mode "mean, error" */
function cell(text: string, summary: boolean, err: string) {
  const v = B().parse(text);
  if (summary) return v.length >= 1 ? { mean: v[0], err: v.length > 1 ? Math.abs(v[1]) : 0, vals: [] as number[], n: 0 } : null;
  if (!v.length) return null;
  const s = B().summary(v, true), e = B().errorOf(v, err);
  return { mean: s.mean, err: isFinite(e) ? e : 0, vals: v, n: v.length };
}

function model(data: any) {
  const summary = data.mode === 'sum', err = data.error || 'sem';
  const series = (data.series || []).filter((s: any) => s && s.id).map((s: any, i: number) => ({ ...s, color: s.color || col(i) }));
  const cats = (data.cats || []).filter((c: any) => c && c.id).map((c: any) => {
    const cells = series.map((s: any) => cell(c[key(s.id)], summary, err));
    let p = null;
    if (!summary && data.stars !== false && series.length >= 2) {
      const groups = cells.map((x: any) => (x ? x.vals : [])).filter((g: number[]) => g.length >= 2);
      p = groups.length >= 2 ? B().test(groups, data.test === 'rank' ? 'rank' : 'param') : null;
    }
    return { id: c.id, name: c.name || '', cells, test: p };
  });
  return { series, cats, summary, err };
}

function BarSheet({ data }: { data: any }) {
  const { series, cats, summary, err } = model(data);
  if (!series.length || !cats.some((c: any) => c.cells.some((x: any) => x))) return <EmptyHint text="Add a series and a category, then type values in the table." />;
  const out: any[] = []; let n = 0; const k = () => 'b' + n++;
  const ns = series.length, nc = cats.length, slot = PW / nc, bw = Math.min(60, slot * 0.78 / ns), gw = bw * ns;
  const dots = data.style === 'dots', cx = (ci: number, si: number) => L + slot * ci + (slot - gw) / 2 + bw * (si + 0.5);
  let hi = 0, lo = 0;
  cats.forEach((c: any) => c.cells.forEach((x: any) => { if (!x) return; hi = Math.max(hi, x.mean + x.err, ...(data.points && x.vals.length ? x.vals : [])); lo = Math.min(lo, x.mean - x.err, ...(data.points && x.vals.length ? x.vals : [])); }));
  const hasStars = cats.some((c: any) => c.test);
  hi = hi + (hi - lo || 1) * (hasStars ? 0.22 : 0.08);
  const st = niceStep(hi - lo, 7), y0 = Math.floor(lo / st) * st, y1 = Math.ceil(hi / st) * st;
  const Y = (v: number) => T + PH - (v - y0) / (y1 - y0) * PH;
  for (let v = y0; v <= y1 + 1e-9; v += st) { const r = +v.toPrecision(10); if (data.grid) out.push(<line key={k()} className="km-grid" x1={L} y1={Y(r)} x2={L + PW} y2={Y(r)} />); out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>); }
  out.push(<line key={k()} className="bc-axis" x1={L} y1={T} x2={L} y2={T + PH} />, <line key={k()} className="bc-axis" x1={L} y1={Y(0)} x2={L + PW} y2={Y(0)} />);
  out.push(<text key={k()} className="km-title" x={22} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 22 ' + (T + PH / 2) + ')'}>{data.ylabel || 'Value'}</text>);
  if (data.xlabel) out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + 50} textAnchor="middle">{data.xlabel}</text>);
  cats.forEach((c: any, ci: number) => {
    let top = -Infinity;
    c.cells.forEach((x: any, si: number) => {
      if (!x) return;
      const xc = cx(ci, si), s = series[si], cap = Math.min(8, bw * 0.28), yt = Y(x.mean);
      if (dots) out.push(<circle key={k()} className="bc-mean" cx={xc} cy={yt} r={5.5} style={{ fill: s.color }} />);
      else out.push(<rect key={k()} className="bc-bar" x={xc - bw * 0.42} y={Math.min(yt, Y(0))} width={bw * 0.84} height={Math.max(1, Math.abs(Y(0) - yt))} style={{ fill: s.color, fillOpacity: num(data.fillStrength, 0.7) }} />);
      if (x.err > 0 && data.bars !== false) out.push(<path key={k()} className="bc-err" d={`M${xc} ${Y(x.mean - x.err)}V${Y(x.mean + x.err)}M${xc - cap} ${Y(x.mean + x.err)}H${xc + cap}M${xc - cap} ${Y(x.mean - x.err)}H${xc + cap}`} />);
      if (data.points) x.vals.forEach((v: number, j: number) => out.push(<circle key={k()} className="bc-pt" cx={xc + (((j * 29 + si * 7) % 13) / 13 - 0.5) * bw * 0.55} cy={Y(v)} r={2.8} />));
      top = Math.max(top, x.mean + x.err, ...(data.points ? x.vals : []));
    });
    const first = c.cells.findIndex((x: any) => x), last = c.cells.length - 1 - [...c.cells].reverse().findIndex((x: any) => x);
    if (c.test && (c.test.p < 0.05 || data.showNs) && last > first) {
      const by = Y(top) - 10;
      out.push(<path key={k()} className="bx-brk" d={`M${cx(ci, first)} ${by + 5}V${by}H${cx(ci, last)}V${by + 5}`} />);
      out.push(<text key={k()} className={'bc-star' + (c.test.p >= 0.05 ? ' bc-ns' : '')} x={(cx(ci, first) + cx(ci, last)) / 2} y={by - 3} textAnchor="middle">{B().stars(c.test.p)}</text>);
    }
    out.push(<text key={k()} className="km-name" x={L + slot * (ci + 0.5)} y={Y(0) < T + PH - 2 ? T + PH + 19 : Y(0) + 19} textAnchor="middle">{c.name}</text>);
  });
  if (ns > 1 && data.legend !== false) series.forEach((s: any, i: number) => {
    out.push(<rect key={k()} className="bc-key" x={L + PW + 16} y={T + 6 + i * 20} width={12} height={12} style={{ fill: s.color, fillOpacity: num(data.fillStrength, 0.7) }} />, <text key={k()} className="km-name" x={L + PW + 34} y={T + 16 + i * 20}>{s.name}</text>);
  });
  if (data.note !== false && !summary) out.push(<text key={k()} className="km-note" x={L + PW} y={T + PH + 50} textAnchor="end">Mean ± {ERR[err]}</text>);
  if (data.note !== false && summary) out.push(<text key={k()} className="km-note" x={L + PW} y={T + PH + 50} textAnchor="end">Mean ± {ERR[err] || 'error'} as entered</text>);
  return <g className="bc">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const series = data.series || [], cats = data.cats || [], { cats: cm, summary } = model(data);
  return (
    <>
      <S.Panel kicker="Data" help="Replicates: type each cell's values (spaces or commas) and the mean and error are worked out. Summary: type the mean then the error, for example 4.2, 0.6, from a paper or your own table.">
        <Seg value={summary ? 'sum' : 'rep'} options={[['rep', 'Replicates'], ['sum', 'Mean, error']]} onChange={v => set({ mode: v })} />
        <Seg value={data.error || 'sem'} options={[['sem', 'SEM'], ['sd', 'SD'], ['ci', '95% CI']]} onChange={v => set({ error: v })} />
        <TextIn id="bc-yl" label="Value title" value={data.ylabel} placeholder="Value" onChange={v => set({ ylabel: v }, 'bc-yl')} />
        <TextIn id="bc-xl" label="Category title" value={data.xlabel} placeholder="(none)" onChange={v => set({ xlabel: v }, 'bc-xl')} />
      </S.Panel>
      <Rows id="bc-s" kicker="Series" help="One colour per series, drawn side by side within each category." rows={series}
        cols={[{ key: 'name', label: 'Name', w: '1.6fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ id: uid('s', series.map((s: any) => s.id)), name: 'Series ' + (series.length + 1), color: col(series.length) })}
        addLabel="+ Add series" onChange={(r, kk) => set({ series: r.map((x, i) => ({ ...x, id: x.id || uid('s', series.map((s: any) => s.id)), color: x.color || col(i) })) }, kk)} />
      <Rows id="bc-c" kicker="Categories and values" help="One row per category. Each series has its own cell." rows={cats}
        cols={[{ key: 'name', label: 'Category', w: '1fr' }, ...series.map((s: any) => ({ key: key(s.id), label: short(s.name), w: '1.5fr', placeholder: summary ? 'mean, error' : '4.1 5.2 4.8' }))]}
        blank={() => ({ id: uid('c', cats.map((c: any) => c.id)), name: 'Category ' + (cats.length + 1) })}
        addLabel="+ Add category" onChange={(r, kk) => set({ cats: r.map(x => ({ ...x, id: x.id || uid('c', cats.map((c: any) => c.id)) })) }, kk)} />
      <S.Panel kicker="Significance" help="Per category, an overall test across the series (Welch t-test for two, one-way ANOVA for three or more; or the rank versions). Replicate mode only. Stars: * below 0.05, ** below 0.01, *** below 0.001. No adjustment for the number of categories.">
        <Toggle on={data.stars !== false} label="Stars above each category" onChange={v => set({ stars: v })} />
        <Toggle on={!!data.showNs} label="Show ns (not significant)" onChange={v => set({ showNs: v })} />
        <Seg value={data.test === 'rank' ? 'rank' : 'param'} options={[['param', 'Means (t, ANOVA)'], ['rank', 'Ranks (U, K-W)']]} onChange={v => set({ test: v })} />
      </S.Panel>
      <S.Panel kicker="Look">
        <Seg value={data.style === 'dots' ? 'dots' : 'bars'} options={[['bars', 'Bars'], ['dots', 'Dots']]} onChange={v => set({ style: v })} />
        <Toggle on={data.bars !== false} label="Error bars" onChange={v => set({ bars: v })} />
        <Toggle on={!!data.points} label="Show every replicate" onChange={v => set({ points: v })} />
        <Toggle on={data.legend !== false} label="Legend" onChange={v => set({ legend: v })} />
        <Toggle on={data.note !== false} label="Note on the error bars" onChange={v => set({ note: v })} />
        <Toggle on={!!data.grid} label="Grid lines" onChange={v => set({ grid: v })} />
        <Range id="bc-op" label="Bar fill strength" value={num(data.fillStrength, 0.7)} min={0.2} max={1} step={0.05} onChange={v => set({ fillStrength: v }, 'bc-op')} />
      </S.Panel>
      {cm.some((c: any) => c.test) ? <S.Panel kicker="Results" help="Overall p value for each category.">
        <ul className="tr-results">{cm.filter((c: any) => c.test).map((c: any) => <li key={c.id}><b>{c.name}</b>: {c.test.name}, {c.test.text}, {SP().fmtP(c.test.p)} ({B().stars(c.test.p)})</li>)}</ul>
      </S.Panel> : null}
    </>
  );
}

function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()); }
const rep = (n: number, seed: number, mu: number, sd: number, dp = 1) => { const z = rng(seed), f = Math.pow(10, dp); return Array.from({ length: n }, () => String(Math.round((mu + sd * z()) * f) / f)).join(' '); };
const ser = (names: string[]) => names.map((name, i) => ({ id: 's' + i, name, color: col(i) }));
const cat = (name: string, i: number, cells: string[]) => { const c: any = { id: 'c' + i, name }; cells.forEach((t, j) => { c['s_s' + j] = t; }); return c; };

export const barchart: EditorDef = {
  id: 'bar-chart', num: '37', name: 'Bar chart with error bars', field: 'Methods',
  blurb: 'Grouped means with SD, SEM or 95% CI error bars, every replicate, and significance stars from a t-test or ANOVA.',
  hint: 'Type each cell\'s replicates (or mean and error). Means, error bars and tests are worked out for you.',
  templates: [
    { name: 'Body weight over time', desc: 'Two diets, three time points, stars', title: 'Body weight of mice on two diets',
      caption: 'Body weight (g) of mice on a control or high-fat diet, 8 per group (simulated). Bars: mean. Error bars: SEM. Dots: individual mice. Welch t-test per week; * p < 0.05, ** p < 0.01, *** p < 0.001. Sample data for practice.',
      data: { ylabel: 'Body weight (g)', xlabel: 'Week', error: 'sem', points: true, series: ser(['Control', 'High-fat']),
        cats: [cat('0', 0, [rep(8, 1, 22, 1.2), rep(8, 2, 22, 1.3)]), cat('4', 1, [rep(8, 3, 25, 1.4), rep(8, 4, 28, 1.6)]), cat('8', 2, [rep(8, 5, 27, 1.5), rep(8, 6, 33, 2.0)])] } },
    { name: 'Enzyme activity by tissue', desc: 'Three tissues, two treatments, SD', title: 'Enzyme activity by tissue and treatment',
      caption: 'Enzyme activity (U/mg protein) in three tissues, 6 animals per group (simulated). Bars: mean. Error bars: SD. Sample data for practice.',
      data: { ylabel: 'Activity (U/mg protein)', error: 'sd', points: true, series: ser(['Vehicle', 'Treated']),
        cats: [cat('Liver', 0, [rep(6, 7, 14, 2), rep(6, 8, 21, 2.5)]), cat('Muscle', 1, [rep(6, 9, 9, 1.5), rep(6, 10, 10, 1.7)]), cat('Kidney', 2, [rep(6, 11, 11, 1.8), rep(6, 12, 15, 2)])] } },
    { name: 'Summary values from a paper', desc: 'Mean and SD entered directly', title: 'Serum vitamin D by supplement group',
      caption: 'Serum 25(OH)D (nmol/L) at baseline and after 12 weeks. Mean and SD as reported; example values for practice.',
      data: { mode: 'sum', ylabel: 'Serum 25(OH)D (nmol/L)', error: 'sd', series: ser(['Placebo', 'Supplement']),
        cats: [cat('Baseline', 0, ['48.2, 12.1', '47.6, 11.8']), cat('12 weeks', 1, ['49.5, 13.0', '78.4, 14.2'])] } },
  ],
  blank: { ylabel: 'Value', error: 'sem', series: ser(['Group A', 'Group B']), cats: [cat('Condition 1', 0, ['4.1 5.2 4.8 5.0', '6.2 6.8 7.1 6.5']), cat('Condition 2', 1, ['3.9 4.4 4.1 4.6', '4.2 4.0 4.5 4.3'])] },
  stats: d => { const m = model(d); return [[m.series.length, 'series'], [m.cats.length, 'categories']]; },
  Controls,
  Render: ({ data }) => <BarSheet data={data} />,
};
