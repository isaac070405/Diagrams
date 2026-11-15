import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const R_ = () => (window as any).SDRadar;

/* sheet geometry: centre of the web and its outer radius */
const CX = 320, CY = 240, R = 170;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const key = (id: string) => 'v_' + id;
const short = (n: any) => String(n || '').slice(0, 6);
const f1 = (v: number) => (+v.toPrecision(3)).toString();

function model(data: any) {
  const axes = (data.axes || []).filter((a: any) => a && a.id);
  const lo = num(data.min, 0), hi = num(data.max, 100);
  const sc = axes.map((a: any) => ({ id: a.id, name: a.name || '', min: lo, max: num(a.max, hi) }));
  const series = (data.series || []).filter((s: any) => s && s.id).map((s: any, i: number) => ({
    id: s.id, name: s.name || '', color: s.color || col(i),
    vals: axes.map((a: any) => parseFloat(s[key(a.id)])),
    fr: axes.map((a: any, j: number) => R_().frac(s[key(a.id)], sc[j].min, sc[j].max)),
  }));
  return { axes, sc, series };
}

/* anchor and nudge for a label at axis angle a */
function place(i: number, n: number, x: number, y: number) {
  const a = R_().angle(i, n), s = Math.sin(a), c = Math.cos(a);
  const anchor = Math.abs(s) < 0.2 ? 'middle' : s > 0 ? 'start' : 'end';
  return { x: x + s * 12, y: y - c * 10 + (c > 0.2 ? 0 : c < -0.2 ? 12 : 4), anchor };
}

function RadarSheet({ data }: { data: any }) {
  const { axes, sc, series } = model(data), r = R_();
  if (axes.length < 3 || !series.length) return <EmptyHint text="Add at least three axes and one series." />;
  const n = axes.length, rings = Math.max(1, Math.min(10, Math.round(num(data.rings, 5))));
  const out: any[] = []; let k = 0; const key2 = () => 'r' + k++;
  const P = (i: number, f: number) => r.point(i, n, f, CX, CY, R);
  const poly = (fs: number[]) => fs.map((f, i) => P(i, f).map(v => v.toFixed(1)).join(',')).join(' ');
  /* rings */
  for (let q = 1; q <= rings; q++) {
    if (data.round) out.push(<circle key={key2()} className="rd-ring" cx={CX} cy={CY} r={R * q / rings} />);
    else out.push(<polygon key={key2()} className="rd-ring" points={poly(axes.map(() => q / rings))} />);
  }
  /* spokes and axis names */
  axes.forEach((a: any, i: number) => {
    const e = P(i, 1), l = place(i, n, e[0], e[1]);
    out.push(<line key={key2()} className="rd-spoke" x1={CX} y1={CY} x2={e[0]} y2={e[1]} />);
    out.push(<text key={key2()} className="rd-axis" x={l.x} y={l.y} textAnchor={l.anchor as any}>{a.name}</text>);
  });
  /* ring values along the first axis, using its own scale */
  if (data.scale !== false) for (let q = 1; q <= rings; q++) {
    const p = P(0, q / rings);
    out.push(<text key={key2()} className="rd-tick" x={p[0] + 4} y={p[1] + 3}>{f1(r.ringValue(q, rings, sc[0].min, sc[0].max))}</text>);
  }
  /* series */
  series.forEach((s: any) => {
    out.push(<polygon key={key2()} className="rd-poly" points={poly(s.fr)} style={{ stroke: s.color, fill: data.fill === false ? 'none' : s.color, fillOpacity: num(data.fillStrength, 0.25) }} />);
    if (data.dots !== false) s.fr.forEach((f: number, i: number) => { const p = P(i, f); out.push(<circle key={key2()} className="rd-dot" cx={p[0]} cy={p[1]} r={3.4} style={{ fill: s.color }} />); });
    if (data.values) s.fr.forEach((f: number, i: number) => { if (isFinite(s.vals[i])) { const p = P(i, f), l = place(i, n, p[0], p[1]); out.push(<text key={key2()} className="rd-val" x={l.x} y={l.y} textAnchor={l.anchor as any}>{f1(s.vals[i])}</text>); } });
  });
  /* legend */
  if (data.legend !== false) {
    const y = CY + R + 52; let x = CX - series.reduce((w: number, s: any) => w + 28 + s.name.length * 7 + 18, 0) / 2;
    series.forEach((s: any) => {
      out.push(<rect key={key2()} className="rd-key" x={x} y={y - 9} width={11} height={11} style={{ fill: s.color }} />);
      out.push(<text key={key2()} className="rd-name" x={x + 17} y={y}>{s.name}</text>);
      x += 28 + s.name.length * 7 + 18;
    });
  }
  return <g className="rd">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const axes = data.axes || [], series = data.series || [], { series: sm } = model(data), r = R_();
  return (
    <>
      <S.Panel kicker="Scale" help="Every axis runs from the minimum to its own maximum. Leave an axis maximum blank to use the shared one.">
        <div className="mk-pair">
          <TextIn id="rd-min" label="Minimum" value={data.min} placeholder="0" onChange={v => set({ min: v }, 'rd-min')} />
          <TextIn id="rd-max" label="Maximum" value={data.max} placeholder="100" onChange={v => set({ max: v }, 'rd-max')} />
        </div>
        <Range id="rd-rings" label="Rings" value={num(data.rings, 5)} min={1} max={10} onChange={v => set({ rings: v }, 'rd-rings')} />
      </S.Panel>
      <Rows id="rd-ax" kicker="Axes" help="Axes run clockwise from the top. Use at least three." rows={axes}
        cols={[{ key: 'name', label: 'Name', w: '1.6fr' }, { key: 'max', label: 'Max', type: 'num', w: '0.6fr' }]}
        blank={() => ({ id: uid('a', axes.map((a: any) => a.id)), name: 'Axis ' + (axes.length + 1), max: '' })}
        addLabel="+ Add axis" onChange={(rows, kk) => set({ axes: rows.map(x => ({ ...x, id: x.id || uid('a', axes.map((a: any) => a.id)) })) }, kk)} />
      <Rows id="rd-sr" kicker="Series" help="One row per polygon: its name and colour, then a value on each axis." rows={series}
        cols={[{ key: 'name', label: 'Name', w: '1.4fr' }, { key: 'color', label: 'Colour', type: 'color' }, ...axes.map((a: any) => ({ key: key(a.id), label: short(a.name), type: 'num' as const, w: '0.6fr' }))]}
        blank={() => ({ id: uid('s', series.map((s: any) => s.id)), name: 'Series ' + (series.length + 1), color: col(series.length) })}
        addLabel="+ Add series" onChange={(rows, kk) => set({ series: rows.map((x, i) => ({ ...x, id: x.id || uid('s', series.map((s: any) => s.id)), color: x.color || col(i) })) }, kk)} />
      <S.Panel kicker="Look">
        <Toggle on={!!data.round} label="Circular rings" onChange={v => set({ round: v })} />
        <Toggle on={data.fill !== false} label="Fill the polygons" onChange={v => set({ fill: v })} />
        <Toggle on={data.dots !== false} label="Dots on the axes" onChange={v => set({ dots: v })} />
        <Toggle on={!!data.values} label="Value next to each dot" onChange={v => set({ values: v })} />
        <Toggle on={data.scale !== false} label="Ring values along the first axis" onChange={v => set({ scale: v })} />
        <Toggle on={data.legend !== false} label="Legend" onChange={v => set({ legend: v })} />
        <Range id="rd-op" label="Fill strength" value={num(data.fillStrength, 0.25)} min={0.05} max={0.8} step={0.05} onChange={v => set({ fillStrength: v }, 'rd-op')} />
      </S.Panel>
      {axes.length >= 3 && sm.length ? <S.Panel kicker="Results" help="Polygon area as a share of the full web (every axis at its maximum). Area depends on axis order, so compare shapes with care.">
        <ul className="tr-results">
          {sm.map((s: any) => <li key={s.id}><b>{s.name}</b>: {f1(r.areaShare(s.fr) * 100)}% of the full web</li>)}
        </ul>
      </S.Panel> : null}
    </>
  );
}

const mkAxes = (names: string[], max = '') => names.map((name, i) => ({ id: 'a' + i, name, max }));
const mkSeries = (rows: [string, number[]][], axes: { id: string }[]) => rows.map(([name, v], i) => {
  const s: any = { id: 's' + i, name, color: col(i) }; axes.forEach((a, j) => { s[key(a.id)] = String(v[j]); }); return s;
});

const nutAxes = mkAxes(['Protein', 'Fibre', 'Iron', 'Calcium', 'Vitamin C', 'Folate']);
const nutSeries = mkSeries([['Diet A', [95, 60, 70, 85, 110, 55]], ['Diet B', [80, 100, 90, 55, 70, 95]]], nutAxes);
const reefAxes = mkAxes(['Coral cover', 'Fish biomass', 'Water clarity', 'Algal control', 'Recruitment']);
const reefSeries = mkSeries([['Site 1', [80, 70, 90, 75, 60]], ['Site 2', [45, 55, 60, 35, 40]], ['Site 3', [65, 30, 50, 55, 80]]], reefAxes);
const traitAxes = mkAxes(['Length (cm)', 'Mass (g)', 'Age (y)', 'Fecundity (k eggs)', 'Depth (m)']).map((x, i) => ({ ...x, max: ['100', '200', '10', '60', '50'][i] }));
const traitSeries = mkSeries([['Species A', [60, 120, 7, 30, 20]], ['Species B', [30, 40, 4, 55, 45]]], traitAxes);

export const radar: EditorDef = {
  id: 'radar-chart', num: '28', name: 'Radar chart', field: 'Methods',
  blurb: 'Several variables on spokes from one centre, one polygon per group: nutrient adequacy, reef health scores or species traits.',
  hint: 'Edit the axes and the series. Each value is drawn along its own spoke.',
  templates: [
    { name: 'Nutrient adequacy', desc: 'Two diets against six nutrients', title: 'Nutrient adequacy of two diets',
      caption: 'Example intake as a percent of the recommended intake for six nutrients. A value of 100 meets the recommendation. Sample values for practice.',
      data: { min: '0', max: '120', rings: 6, axes: nutAxes, series: nutSeries } },
    { name: 'Reef health scores', desc: 'Three sites on five indicators', title: 'Reef health indicators at three sites',
      caption: 'Example scores from 0 (poor) to 100 (excellent) for five reef indicators at three sites. Sample values for practice.',
      data: { min: '0', max: '100', rings: 5, axes: reefAxes, series: reefSeries } },
    { name: 'Species traits', desc: 'Different units on separate scales', title: 'Traits of two fish species',
      caption: 'Example traits scaled to a maximum on each axis, so different units share one web. Sample values for practice.',
      data: { min: '0', max: '100', rings: 5, axes: traitAxes, series: traitSeries } },
  ],
  blank: { min: '0', max: '10', rings: 5, axes: mkAxes(['A', 'B', 'C', 'D', 'E']), series: mkSeries([['Series 1', [8, 6, 9, 4, 7]]], mkAxes(['A', 'B', 'C', 'D', 'E'])) },
  stats: d => { const m = model(d); return [[m.axes.length, 'axes'], [m.series.length, 'series']]; },
  Controls,
  Render: ({ data }) => <RadarSheet data={data} />,
};
