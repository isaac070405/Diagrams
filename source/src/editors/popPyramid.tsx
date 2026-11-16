import { S } from '../sheet';
import { EmptyHint, Seg, Spec, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const P = () => (window as any).SDPyramid;
const fm = (v: number, d = 3) => (isFinite(v) ? (+v.toPrecision(d)).toString() : 'n/a');

/* sheet geometry: a centre column of age labels, males to its left and females to its right */
const CX = 330, GAP = 30, HW = 240, T = 44, RH_MAX = 24, PH_MAX = 380;

function model(data: any) {
  const rows = P().parse(data.text), rows2 = data.text2 ? P().parse(data.text2) : [];
  return { rows, rows2, sum: P().summary(rows), sum2: rows2.length ? P().summary(rows2) : null };
}

function PyramidSheet({ data }: { data: any }) {
  const { rows, rows2, sum, sum2 } = model(data);
  if (rows.length < 2) return <EmptyHint text={'Paste rows of age group, males, females, youngest first, for example "0-4, 5200, 4980".'} />;
  const out: any[] = []; let n = 0; const k = () => 'y' + n++;
  const pct = data.mode !== 'count', mCol = data.colM || 'var(--swatch-3)', fCol = data.colF || 'var(--swatch-12)';
  const val = (v: number, total: number) => (pct ? (total ? v / total * 100 : 0) : v);
  const vals = rows.flatMap((r: any) => [val(r.male, sum.total), val(r.female, sum.total)]), vals2 = rows2.flatMap((r: any) => [val(r.male, sum2.total), val(r.female, sum2.total)]);
  const vmax = Math.max(...vals, ...vals2, 1e-9), nr = rows.length, rh = Math.min(RH_MAX, PH_MAX / nr), PH = rh * nr;
  const step = (() => { const raw = vmax / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; })(), top = Math.ceil(vmax * 1.04 / step) * step;
  const W = (v: number) => v / top * HW, yOf = (i: number) => T + PH - (i + 1) * rh;
  /* axis and gridlines on both sides */
  for (let v = 0; v <= top + 1e-9; v += step) {
    const r = +v.toPrecision(10), dx = W(r);
    if (data.grid !== false) out.push(<line key={k()} className="km-grid" x1={CX - GAP - dx} y1={T} x2={CX - GAP - dx} y2={T + PH} />, <line key={k()} className="km-grid" x1={CX + GAP + dx} y1={T} x2={CX + GAP + dx} y2={T + PH} />);
    out.push(<text key={k()} className="py-tick" x={CX - GAP - dx} y={T + PH + 16} textAnchor="middle">{r}</text>, <text key={k()} className="py-tick" x={CX + GAP + dx} y={T + PH + 16} textAnchor="middle">{r}</text>);
  }
  /* bars, with the age label in the middle */
  rows.forEach((r: any, i: number) => {
    const y = yOf(i), m = val(r.male, sum.total), f = val(r.female, sum.total), bh = rh * 0.86;
    out.push(<rect key={k()} className="py-bar" x={CX - GAP - W(m)} y={y + (rh - bh) / 2} width={W(m)} height={bh} style={{ fill: mCol }} />, <rect key={k()} className="py-bar" x={CX + GAP} y={y + (rh - bh) / 2} width={W(f)} height={bh} style={{ fill: fCol }} />);
    out.push(<text key={k()} className="py-age" x={CX} y={y + rh / 2 + 4} textAnchor="middle">{r.label}</text>);
    if (data.values && rh >= 13) out.push(<text key={k()} className="py-val" x={CX - GAP - W(m) - 4} y={y + rh / 2 + 3.5} textAnchor="end">{fm(m, 3)}</text>, <text key={k()} className="py-val" x={CX + GAP + W(f) + 4} y={y + rh / 2 + 3.5}>{fm(f, 3)}</text>);
  });
  /* a second population as an outline, matched to the age groups by label */
  if (rows2.length) {
    const idx: any = {}; rows.forEach((r: any, i: number) => { idx[String(r.label).trim().toLowerCase()] = i; });
    const side = (key: string, sign: number) => { let d = ''; rows2.forEach((r: any) => { const i = idx[String(r.label).trim().toLowerCase()]; if (i === undefined) return; const y = yOf(i), x = CX + sign * (GAP + W(val(r[key], sum2.total))); d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + (y + rh).toFixed(1) + 'L' + x.toFixed(1) + ' ' + y.toFixed(1); }); return d; };
    out.push(<path key={k()} className="py-cmp" d={side('male', -1)} />, <path key={k()} className="py-cmp" d={side('female', 1)} />);
  }
  out.push(<text key={k()} className="py-head" x={CX - GAP - HW / 2} y={T - 22} textAnchor="middle" style={{ fill: mCol }}>{data.nameM || 'Males'}</text>, <text key={k()} className="py-head" x={CX + GAP + HW / 2} y={T - 22} textAnchor="middle" style={{ fill: fCol }}>{data.nameF || 'Females'}</text>);
  out.push(<text key={k()} className="km-title" x={CX} y={T + PH + 40} textAnchor="middle">{data.xlabel || (pct ? 'Percent of the population' : 'Number of people' + (data.unit ? ' (' + data.unit + ')' : ''))}</text>);
  out.push(<text key={k()} className="km-name" x={CX} y={T - 6} textAnchor="middle">Age</text>);
  if (rows2.length && data.legend !== false) out.push(<path key={k()} className="py-cmp" d={`M${CX - 70} ${T + PH + 60}H${CX - 48}`} />, <text key={k()} className="km-note" x={CX - 42} y={T + PH + 64}>{data.name2 || 'Comparison'}</text>);
  return <g className="py">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const { rows, sum, sum2 } = model(data);
  return (
    <>
      <Spec id="py-text" label="Age group, males, females" rows={10} value={data.text || ''} help="One age group per row, youngest first: the label, the number of males, the number of females. Labels such as 0-4, 15-19 or 85+ are used to work out the median age and dependency ratios. Commas, tabs or semicolons. Paste three spreadsheet columns straight in."
        onChange={v => set({ text: v }, 'py-text')} placeholder={'0-4, 5200, 4980\n5-9, 5100, 4900'} />
      <S.Panel kicker="Bars" help="Percent of the population uses the total of both sexes, so bars on both sides share one scale and the whole pyramid sums to 100%.">
        <Seg value={data.mode === 'count' ? 'count' : 'pct'} options={[['pct', 'Percent'], ['count', 'Number']]} onChange={v => set({ mode: v })} />
        <div className="mk-pair"><TextIn id="py-nm" label="Left side" value={data.nameM} placeholder="Males" onChange={v => set({ nameM: v }, 'py-nm')} /><TextIn id="py-nf" label="Right side" value={data.nameF} placeholder="Females" onChange={v => set({ nameF: v }, 'py-nf')} /></div>
        <TextIn id="py-xl" label="Axis title" value={data.xlabel} placeholder="Percent of the population" onChange={v => set({ xlabel: v }, 'py-xl')} />
        <Toggle on={!!data.values} label="Values at the bar ends" onChange={v => set({ values: v })} />
        <Toggle on={data.grid !== false} label="Grid lines" onChange={v => set({ grid: v })} />
      </S.Panel>
      <Spec id="py-text2" label="Second population (optional outline)" rows={5} value={data.text2 || ''} help="Another table with the same age labels, drawn as an outline over the bars, for example the same place in another year."
        onChange={v => set({ text2: v }, 'py-text2')} placeholder={'0-4, 4800, 4600'} />
      {data.text2 ? <S.Panel kicker="Comparison"><TextIn id="py-n2" label="Name of the outline" value={data.name2} placeholder="Comparison" onChange={v => set({ name2: v }, 'py-n2')} /></S.Panel> : null}
      {rows.length >= 2 ? <S.Panel kicker="Results" help="Sex ratio is males per 100 females. Median age is interpolated within the age group that holds the middle person. Dependency ratios are the under 15s, the 65 and overs, and both together, per 100 people aged 15 to 64. They need age groups that start at 15 and 65.">
        <ul className="tr-results">
          <li>Total {fm(sum.total, 6)} ({fm(sum.pctMale, 4)}% {(data.nameM || 'male').toLowerCase()}); sex ratio {fm(sum.sexRatio, 4)} per 100</li>
          <li>Median age {isFinite(sum.median) ? fm(sum.median, 3) + ' years' : 'needs age groups such as 0-4, 5-9 and 85+'}</li>
          {isFinite(sum.total_dep) ? <li>Dependency ratio {fm(sum.total_dep, 3)} (young {fm(sum.young, 3)}, old {fm(sum.old, 3)}) per 100 aged 15 to 64</li> : <li>Dependency ratios need age groups that start at 15 and 65.</li>}
          {sum2 ? <li><b>{data.name2 || 'Comparison'}</b>: total {fm(sum2.total, 6)}, median age {isFinite(sum2.median) ? fm(sum2.median, 3) : 'n/a'}{isFinite(sum2.total_dep) ? ', dependency ratio ' + fm(sum2.total_dep, 3) : ''}</li> : null}
        </ul>
      </S.Panel> : null}
    </>
  );
}

const GROUPS = ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80-84', '85+'];
const table = (shape: number[], total: number, mShare: number[]) => { const s = shape.reduce((a, b) => a + b, 0); return GROUPS.map((g, i) => { const n = total * shape[i] / s; return g + ', ' + Math.round(n * mShare[i]) + ', ' + Math.round(n * (1 - mShare[i])); }).join('\n'); };
const young = [14, 12.8, 11.6, 10.4, 9.2, 8, 6.9, 5.9, 5, 4.2, 3.4, 2.7, 2.1, 1.5, 1, 0.6, 0.3, 0.1];
const mid = [6.5, 6.7, 6.9, 7.2, 7.4, 7.2, 7, 6.8, 6.9, 7.1, 7.2, 6.8, 6, 5, 4, 2.8, 1.8, 1.2];
const old = [4.6, 4.8, 5, 5.3, 5.6, 5.9, 6.1, 6.3, 6.4, 6.6, 6.9, 7, 6.8, 6.2, 5.4, 4.3, 3.1, 3.5];
const ms = (a: number) => GROUPS.map((_, i) => Math.max(0.3, a - 0.0025 * i * i / 4 - (i > 12 ? 0.012 * (i - 12) : 0)));

export const popPyramid: EditorDef = {
  id: 'population-pyramid', num: '49', name: 'Population pyramid', field: 'Evidence and clinical',
  blurb: 'Age and sex structure as back-to-back bars, with the median age, sex ratio and dependency ratios, and an optional second year as an outline.',
  hint: 'Paste age group, males, females on each row. Percent bars, median age and dependency ratios are worked out for you.',
  templates: [
    { name: 'Young, growing population', desc: 'Wide base, tapering to the top', title: 'Age and sex structure of a young population',
      caption: 'Example population of 1 million by age group and sex (percent of the population). The wide base means many children. Illustrative values, not a real country.',
      data: { text: table(young, 1000000, ms(0.505)), mode: 'pct', nameM: 'Males', nameF: 'Females' } },
    { name: 'Ageing population', desc: 'A narrow base and a heavy top', title: 'Age and sex structure of an ageing population',
      caption: 'Example population of 1 million by age group and sex (percent of the population). More women than men survive into old age. Illustrative values, not a real country.',
      data: { text: table(old, 1000000, ms(0.49).map((v, i) => (i > 12 ? v - 0.012 * (i - 12) * 2 : v))), mode: 'pct', nameM: 'Men', nameF: 'Women', values: false } },
    { name: 'Two years compared', desc: 'Bars for now, an outline for 30 years ago', title: 'Population structure then and now',
      caption: 'Example population by age group and sex now (bars) and 30 years earlier (outline), each as a percent of its own total. The population has aged. Illustrative values.',
      data: { text: table(mid, 1000000, ms(0.495)), text2: table(young.map((v, i) => v * 0.55 + mid[i] * 0.45), 800000, ms(0.505)), name2: '30 years earlier', mode: 'pct' } },
  ],
  blank: { text: '0-14, 2600, 2500\n15-24, 2300, 2250\n25-44, 3500, 3600\n45-64, 3000, 3200\n65+, 1500, 1900', mode: 'pct' },
  stats: d => { const m = model(d); return m.rows.length >= 2 ? [[m.rows.length, 'age groups'], [Math.round(m.sum.total), 'people'], [isFinite(m.sum.median) ? +m.sum.median.toPrecision(3) : 0, 'median age']] : [[m.rows.length, 'age groups']]; },
  Controls,
  Render: ({ data }) => <PyramidSheet data={data} />,
};
