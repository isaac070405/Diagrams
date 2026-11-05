import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const K = () => (window as any).SDKite;

/* sheet geometry: species names in the left margin, the transect line spans PW */
const L = 150, PW = 520;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const key = (id: string) => 'c_' + id;
const short = (n: any) => String(n || '').split(' ').map((w, i) => w.slice(0, i ? 3 : 5)).join(' ');

function model(data: any) {
  const sp = (data.species || []).filter((s: any) => s && s.id);
  const qs = (data.quads || []).map((q: any) => ({ x: parseFloat(q.x), counts: sp.map((s: any) => { const c = parseFloat(q[key(s.id)]); return isFinite(c) && c > 0 ? c : 0; }) })).filter((q: any) => isFinite(q.x)).sort((a: any, b: any) => a.x - b.x);
  return { sp, qs };
}
const tickStep = (span: number) => { const raw = span / 7, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; };

function TransectSheet({ data }: { data: any }) {
  const { sp, qs } = model(data), k = K();
  if (!sp.length || !qs.length) return <EmptyHint text="Add a species and at least one quadrat." />;
  const out: any[] = []; let n = 0; const key2 = () => 't' + n++;
  const xmin = qs[0].x, xmax = qs[qs.length - 1].x, st = tickStep(Math.max(1e-9, xmax - xmin) || 1);
  const x0 = Math.floor(xmin / st) * st, x1 = Math.max(Math.ceil(xmax / st) * st, x0 + st);
  const X = (x: number) => L + (x - x0) / (x1 - x0) * PW;
  const qSize = num(data.quadrat, 0.5), belt = num(data.belt, 1), unit = data.unit || 'individuals';
  const maxAll = Math.max(1, ...qs.flatMap((q: any) => q.counts));
  const u = Math.min(14, 96 / maxAll);                       /* sheet units per individual, shared by every kite */
  const side = Math.max(24, Math.min(54, qSize / (x1 - x0) * PW));
  let y = 10;
  /* the belt and its quadrats */
  if (data.strip !== false) {
    const bh = side + 16;
    out.push(<rect key={key2()} className="tr-belt" x={L} y={y} width={PW} height={bh} />);
    out.push(<text key={key2()} className="tr-note" x={L - side / 2 - 10} y={y + bh / 2 + 4} textAnchor="end">Belt {+belt.toFixed(2)} m wide</text>);
    qs.forEach((q: any, qi: number) => {
      const cx = X(q.x), bx = cx - side / 2, by = y + 8;
      out.push(<rect key={key2()} className="tr-quad" x={bx} y={by} width={side} height={side} />);
      if (data.dots !== false) sp.forEach((s: any, si: number) => {
        const c = Math.min(Math.round(q.counts[si]), 14);
        k.dots(c, qi * 31 + si * 7 + 1).forEach((d: number[], di: number) => out.push(<circle key={key2()} className="tr-dot" cx={bx + 3 + d[0] * (side - 6)} cy={by + 3 + d[1] * (side - 6)} r={Math.max(1.6, side / 16)} style={{ fill: s.color || col(si) }} />));
      });
    });
    y += bh + 14;
  }
  /* the kites */
  const top = y, bands: { cy: number; h: number }[] = [];
  sp.forEach((s: any, si: number) => {
    const mx = Math.max(...qs.map((q: any) => q.counts[si])), h = Math.max(36, mx * u + 26), cy = y + h / 2;
    bands.push({ cy, h });
    y += h;
  });
  if (data.guides !== false) qs.forEach((q: any) => out.push(<line key={key2()} className="tr-guide" x1={X(q.x)} y1={top - 6} x2={X(q.x)} y2={y} />));
  sp.forEach((s: any, si: number) => {
    const { cy } = bands[si], counts = qs.map((q: any) => q.counts[si]), xs = qs.map((q: any) => q.x), fill = s.color || col(si);
    out.push(<line key={key2()} className="tr-base" x1={L} y1={cy} x2={L + PW} y2={cy} />);
    const poly = k.polygon(xs, counts);
    if (k.total(counts) > 0) out.push(<polygon key={key2()} className="tr-kite" points={poly.map((p: number[]) => X(p[0]).toFixed(1) + ',' + (cy + p[1] * u).toFixed(1)).join(' ')} style={{ fill, fillOpacity: num(data.fillStrength, 0.6) }} />);
    out.push(<rect key={key2()} x={L - 124} y={cy - 5} width={9} height={9} style={{ fill }} className="tr-key" />);
    out.push(<text key={key2()} className="tr-name" x={L - 110} y={cy + 4}>{s.name}</text>);
    const mx = Math.max(...counts);
    if (data.numbers !== false && u >= 8 && mx > 0 && mx <= 20) {
      const qi = counts.indexOf(mx), cx = X(xs[qi]);
      for (let j = 1; j <= Math.round(mx); j++) out.push(<text key={key2()} className="tr-unit" x={cx} y={cy - mx * u / 2 + (j - 0.5) * u + 3.5} textAnchor="middle">{j}</text>);
    }
  });
  /* scale bar for one shared unit */
  const sb = k.scaleBar(maxAll);
  out.push(<g key={key2()} className="tr-scale"><line x1={L + PW + 22} y1={top + 18} x2={L + PW + 22} y2={top + 18 + sb * u} /><line x1={L + PW + 18} y1={top + 18} x2={L + PW + 26} y2={top + 18} /><line x1={L + PW + 18} y1={top + 18 + sb * u} x2={L + PW + 26} y2={top + 18 + sb * u} /><text x={L + PW + 32} y={top + 18 + sb * u / 2 + 4}>{sb} {unit === 'individuals' ? '' : unit}{unit === 'individuals' ? 'ind.' : ''}</text></g>);
  /* distance axis */
  out.push(<line key={key2()} className="tr-axis" x1={L} y1={y + 4} x2={L + PW} y2={y + 4} />);
  for (let v = x0; v <= x1 + 1e-9; v += st) out.push(<g key={key2()} className="tr-tick"><line x1={X(v)} y1={y + 4} x2={X(v)} y2={y + 10} /><text x={X(v)} y={y + 24} textAnchor="middle">{+v.toPrecision(10)}</text></g>);
  out.push(<text key={key2()} className="tr-title" x={L + PW / 2} y={y + 46} textAnchor="middle">{data.xlabel || 'Distance along the transect (m)'}</text>);
  const yl = data.ylabel || 'Number of ' + unit;
  out.push(<text key={key2()} className="tr-title" x={8} y={(top + y) / 2} textAnchor="middle" transform={'rotate(-90 8 ' + ((top + y) / 2) + ')'}>{yl}</text>);
  return <g className="tr">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const sp = data.species || [], quads = data.quads || [], { qs } = model(data), k = K();
  const totals = sp.map((_: any, i: number) => qs.reduce((s: number, q: any) => s + q.counts[i], 0));
  const area = Math.pow(num(data.quadrat, 0.5), 2), nQ = Math.max(1, qs.length);
  const f2 = (v: number) => (Math.round(v * 100) / 100).toString();
  return (
    <>
      <S.Panel kicker="Sampling" help="A belt transect samples a strip of set width. Quadrats are placed along its centre line at fixed distances.">
        <div className="mk-pair">
          <TextIn id="tr-belt" label="Belt width (m)" value={data.belt} placeholder="1" onChange={v => set({ belt: v }, 'tr-belt')} />
          <TextIn id="tr-quad" label="Quadrat side (m)" value={data.quadrat} placeholder="0.5" onChange={v => set({ quadrat: v }, 'tr-quad')} />
        </div>
        <TextIn id="tr-unit" label="Count unit" value={data.unit} placeholder="individuals" onChange={v => set({ unit: v }, 'tr-unit')} />
        <TextIn id="tr-xl" label="Distance title" value={data.xlabel} placeholder="Distance along the transect (m)" onChange={v => set({ xlabel: v }, 'tr-xl')} />
        <TextIn id="tr-yl" label="Count title" value={data.ylabel} placeholder="Number of individuals" onChange={v => set({ ylabel: v }, 'tr-yl')} />
      </S.Panel>
      <Rows id="tr-sp" kicker="Species" help="Each species gets its own kite. Colour fills the kite and its dots." rows={sp}
        cols={[{ key: 'name', label: 'Name', w: '1.6fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ id: uid('sp', sp.map((s: any) => s.id)), name: 'Species ' + (sp.length + 1), color: col(sp.length) })}
        addLabel="+ Add species" onChange={(rows, kk) => set({ species: rows.map((r, i) => ({ ...r, id: r.id || uid('sp', sp.map((s: any) => s.id)), color: r.color || col(i) })) }, kk)} />
      <Rows id="tr-q" kicker="Quadrats" help="One row per quadrat: its distance along the transect, then the count of each species." rows={quads}
        cols={[{ key: 'x', label: 'm', type: 'num', w: '0.6fr' }, ...sp.map((s: any) => ({ key: key(s.id), label: short(s.name), type: 'num' as const, w: '0.6fr' }))]}
        blank={() => ({ x: quads.length ? String(num(quads[quads.length - 1].x, 0) + (quads.length > 1 ? num(quads[quads.length - 1].x, 0) - num(quads[quads.length - 2].x, 0) : 5)) : '0' })}
        addLabel="+ Add quadrat" onChange={(rows, kk) => set({ quads: rows }, kk)} />
      <S.Panel kicker="Look">
        <Toggle on={data.strip !== false} label="Draw the belt and quadrats" onChange={v => set({ strip: v })} />
        <Toggle on={data.dots !== false} label="Dots for each individual (up to 14 per species)" onChange={v => set({ dots: v })} />
        <Toggle on={data.guides !== false} label="Guide lines through the quadrat positions" onChange={v => set({ guides: v })} />
        <Toggle on={data.numbers !== false} label="Number the units inside the tallest kite" onChange={v => set({ numbers: v })} />
        <Range id="tr-op" label="Kite fill strength" value={num(data.fillStrength, 0.6)} min={0.2} max={1} step={0.05} onChange={v => set({ fillStrength: v }, 'tr-op')} />
      </S.Panel>
      {sp.length ? <S.Panel kicker="Results" help="Computed from the table. Density is the mean count per square metre of quadrat.">
        <ul className="tr-results">
          {sp.map((s: any, i: number) => <li key={s.id}><b>{s.name}</b>: total {totals[i]}, mean density {f2(totals[i] / nQ / area)} per m²</li>)}
          <li>Shannon index H′ = {f2(k.shannon(totals))}</li>
          <li>Simpson index of diversity 1 − D = {f2(k.simpson(totals))}</li>
          <li>Pielou evenness J = {f2(k.evenness(totals))}</li>
        </ul>
      </S.Panel> : null}
    </>
  );
}

const sp3 = [{ id: 'a', name: 'Species A', color: col(0) }, { id: 'b', name: 'Species B', color: col(1) }, { id: 'c', name: 'Species C', color: col(2) }];
const q3 = [[0, 2, 0, 0], [5, 2, 0, 0], [10, 0, 0, 0], [15, 0, 8, 0], [20, 0, 4, 0], [25, 0, 0, 4], [30, 0, 0, 3], [35, 0, 0, 8]]
  .map(([x, a, b, c]) => ({ x: String(x), c_a: String(a), c_b: String(b), c_c: String(c) }));
const shore = [['Barnacles', 'Chthamalus'], ['Limpets', 'Cellana'], ['Rock oysters', 'Saccostrea'], ['Tubeworms', 'Galeolaria'], ['Coralline algae', 'Corallina']];
const shoreCounts = [
  [11, 9, 6, 2, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 3, 5, 6, 4, 2, 1, 0, 0, 0],
  [0, 0, 0, 2, 5, 9, 11, 7, 3, 0, 0],
  [0, 0, 0, 0, 0, 3, 8, 12, 9, 4, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 6, 10, 13],
];
const shoreSp = shore.map(([name], i) => ({ id: 's' + i, name, color: col(i) }));
const shoreQ = Array.from({ length: 11 }, (_, j) => { const q: any = { x: String(j * 2) }; shoreCounts.forEach((r, i) => { q['c_s' + i] = String(r[j]); }); return q; });

export const transect: EditorDef = {
  id: 'belt-transect', num: '26', name: 'Belt transect and kite diagram', field: 'Ecology',
  blurb: 'Quadrat counts along a belt transect drawn as one kite per species, with the sampling layout and diversity indices.',
  hint: 'Edit the species and the quadrat table. Each kite is as wide as the count at that distance.',
  templates: [
    { name: 'Species A, B and C', desc: 'The three-species worked example', title: 'Kite diagram of three species along a transect',
      caption: 'Number of individuals of each species in quadrats at 5 m intervals along a belt transect. The width of a kite at a quadrat equals the count.',
      data: { belt: '1', quadrat: '1', unit: 'individuals', species: sp3, quads: q3 } },
    { name: 'Rocky shore zonation', desc: 'Example data from high to low tide', title: 'Zonation on a rocky shore',
      caption: 'Example counts per 0.5 m quadrat along a belt transect from the high-tide mark (0 m) down the shore. Sample values for practice.',
      data: { belt: '1', quadrat: '0.5', unit: 'individuals', xlabel: 'Distance down the shore from the high-tide mark (m)', species: shoreSp, quads: shoreQ } },
  ],
  blank: { belt: '1', quadrat: '1', unit: 'individuals', species: [{ id: 'a', name: 'Species A', color: col(0) }], quads: [{ x: '0', c_a: '1' }, { x: '5', c_a: '4' }, { x: '10', c_a: '2' }] },
  stats: d => { const { sp, qs } = model(d), tot = sp.map((_: any, i: number) => qs.reduce((s: number, q: any) => s + q.counts[i], 0)); return [[sp.length, 'species'], [qs.length, 'quadrats'], [+K().shannon(tot).toFixed(2), 'Shannon H′']]; },
  Controls,
  Render: ({ data }) => <TransectSheet data={data} />,
};
