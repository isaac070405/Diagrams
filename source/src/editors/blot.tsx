import { S } from '../sheet';
import { num, Rows, Seg, Spec, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

/* ===================== 24 Gels and blots ===================== */
/* One figure for an SDS-PAGE gel or a Western (protein), Eastern (modified protein), Southern (DNA) or Northern (RNA) blot.
   Lane 1 is the ladder, lane 2 the control, the rest are treatments. Samples run from the wells at the top (cathode, −) towards the bottom (anode, +).
   A band's height on the gel comes from its size on a log scale: big molecules stay near the wells. */

const LANE_W = 76, GAP = 10, GEL_H = 440, PAD_T = 44, PAD_B = 34, BAND_W = 62;
const UNITS: [string, string][] = [['kDa', 'kDa'], ['Da', 'Da'], ['kb', 'kb'], ['bp', 'bp']];

/* gel and band colours: a pale gel with a dark band, or a dark gel with a bright one */
const STYLES: Record<string, { name: string; bg: string; band: string; edge: string; well: string }> = {
  coomassie: { name: 'Coomassie', bg: '#e6edfb', band: '#1b3f9c', edge: '#31449a', well: 'rgba(30,60,160,.14)' },
  membrane: { name: 'Membrane', bg: '#f8f8f6', band: '#454545', edge: '#8c8c8c', well: 'rgba(0,0,0,.07)' },
  film: { name: 'Film', bg: '#efefef', band: '#111111', edge: '#4a4a4a', well: 'rgba(0,0,0,.09)' },
  silver: { name: 'Silver stain', bg: '#f3e8d4', band: '#4a2f12', edge: '#7a5a30', well: 'rgba(90,60,20,.14)' },
  sypro: { name: 'Fluorescent', bg: '#150508', band: '#ff2d42', edge: '#555555', well: 'rgba(255,255,255,.1)' },
};
const TYPES: Record<string, { name: string; style: string; unit: string; ladder: string; wells: boolean }> = {
  gel: { name: 'SDS-PAGE gel', style: 'coomassie', unit: 'kDa', ladder: 'p250', wells: true },
  western: { name: 'Western blot', style: 'membrane', unit: 'kDa', ladder: 'p250', wells: false },
  eastern: { name: 'Eastern blot', style: 'film', unit: 'kDa', ladder: 'p250', wells: false },
  southern: { name: 'Southern blot', style: 'film', unit: 'kb', ladder: 'dna1k', wells: false },
  northern: { name: 'Northern blot', style: 'film', unit: 'kb', ladder: 'rna', wells: false },
};
const LADDERS: Record<string, { name: string; unit: string; sizes: string }> = {
  p250: { name: 'Protein 10 to 250 kDa', unit: 'kDa', sizes: '250, 150, 100, 75, 50, 37, 25, 20, 15, 10' },
  p170: { name: 'Protein 10 to 170 kDa', unit: 'kDa', sizes: '170, 130, 95, 72, 55, 43, 34, 26, 17, 10' },
  plow: { name: 'Peptide 2.5 to 17.2 kDa', unit: 'kDa', sizes: '17.2, 14.6, 10.8, 8.2, 6.4, 2.5' },
  dna1k: { name: 'DNA 0.5 to 10 kb', unit: 'kb', sizes: '10, 8, 6, 5, 4, 3, 2, 1.5, 1, 0.5' },
  dna100: { name: 'DNA 100 bp to 1.5 kb', unit: 'bp', sizes: '1500, 1000, 750, 500, 250, 100' },
  rna: { name: 'RNA 0.5 to 9 kb', unit: 'kb', sizes: '9, 6, 4, 3, 2, 1.5, 1, 0.5' },
};

const sizesOf = (t: string) => String(t || '').split(/[,;\s]+/).map(x => parseFloat(x)).filter(x => isFinite(x) && x > 0);
function bandsOf(t: string): [number, number][] {
  return String(t || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean).map(x => { const [s, i] = x.split(':'); return [parseFloat(s), i == null || i.trim() === '' ? 1 : parseFloat(i)] as [number, number]; }).filter(b => isFinite(b[0]) && b[0] > 0 && isFinite(b[1]));
}
function laneNames(d: any) {
  let k = 0;
  return (d.lanes || []).map((l: any) => l.label || (l.kind === 'ladder' ? 'Ladder' : l.kind === 'control' ? 'Control' : 'Treatment ' + (++k)));
}
/* the size to height map is shared by every lane and by the labels, so bands of equal size line up */
function geom(d: any) {
  const lanes: any[] = d.lanes || [], ladder = sizesOf(LADDERS[d.ladder] && !d.ladderText ? LADDERS[d.ladder].sizes : d.ladderText);
  const all = [...ladder]; lanes.forEach(l => { if (l.kind !== 'ladder') bandsOf(l.bands).forEach(b => all.push(b[0])); });
  const hi = all.length ? Math.max(...all) : 100, lo = all.length ? Math.min(...all) : 10;
  const span = Math.log(hi / lo) || 1, top = PAD_T, h = GEL_H - PAD_T - PAD_B;
  const y = (s: number) => top + (Math.log(hi / s) / span) * h * (hi === lo ? 0.5 : 1) + (hi === lo ? h / 4 : 0);
  const W = GAP + lanes.length * (LANE_W + GAP);
  return { lanes, ladder, y, W, laneX: (i: number) => GAP + i * (LANE_W + GAP) };
}
const fmtS = (s: number) => String(Math.round(s * 100) / 100);

function Pole(p: { x: number; y: number; sign: string; label: string }) {
  return (
    <g className="bl-pole">
      <circle cx={p.x} cy={p.y} r={9} />
      <text x={p.x} y={p.y + 4.5} textAnchor="middle" className="bl-sign">{p.sign}</text>
      <text x={p.x + 16} y={p.y + 4.5} className="bl-polename">{p.label}</text>
    </g>
  );
}

function Blot({ data }: { data: any }) {
  const g = geom(data), st = STYLES[data.style] || STYLES.coomassie, names = laneNames(data), unit = data.unit || 'kDa';
  const out: any[] = [];
  out.push(<defs key="d"><filter id="bl-blur" x="-8%" y="-60%" width="116%" height="220%"><feGaussianBlur stdDeviation="1" /></filter></defs>);
  out.push(<rect key="gel" x={0} y={0} width={g.W} height={GEL_H} rx={5} fill={st.bg} stroke={st.edge} strokeWidth={1.4} />);
  const backAt = out.length;
  g.lanes.forEach((l: any, i: number) => {
    const x = g.laneX(i), mid = x + LANE_W / 2;
    if (data.wells) out.push(<rect key={'w' + i} x={x + 6} y={8} width={LANE_W - 12} height={16} fill={st.well} stroke={st.edge} strokeWidth={0.8} />);
    const bands: [number, number][] = l.kind === 'ladder' ? g.ladder.map((s: number) => [s, 1] as [number, number]) : bandsOf(l.bands);
    bands.forEach(([s, v], k) => {
      const h = 3 + Math.min(2, Math.max(0.1, v)) * 3.6, w = BAND_W * (l.kind === 'ladder' ? 1 : 0.94 + Math.min(0.06, v * 0.03));
      out.push(<rect key={'b' + i + '-' + k} x={mid - w / 2} y={g.y(s) - h / 2} width={w} height={h} rx={h / 2} fill={st.band} opacity={Math.min(1, 0.28 + 0.72 * v)} filter="url(#bl-blur)" />);
    });
    out.push(<text key={'n' + i} className="bl-lane" x={mid} y={-(data.laneNo !== false ? 28 : 14)} textAnchor="middle">{names[i]}</text>);
    if (data.laneNo !== false) out.push(<text key={'i' + i} className="bl-idx" x={mid} y={-12} textAnchor="middle">{'L' + (i + 1)}</text>);
  });
  /* ladder sizes on the left, nudged apart so numbers never overlap */
  if (data.scale !== false) {
    const rows = g.ladder.map((s: number) => ({ s, y: g.y(s) })).sort((a: any, b: any) => a.y - b.y);
    let last = -99;
    rows.forEach((r: any) => { r.ty = Math.max(r.y, last + 14); last = r.ty; });
    rows.forEach((r: any, k: number) => {
      out.push(<line key={'tk' + k} className="bl-tick" x1={-18} y1={r.y} x2={-3} y2={r.y} />);
      out.push(<text key={'sz' + k} className="bl-size" x={-24} y={r.ty + 4.5} textAnchor="end">{fmtS(r.s) + (data.unitStyle === 'each' ? ' ' + unit : '')}</text>);
    });
    if (data.unitStyle !== 'each') out.push(<text key="unit" className="bl-unit" x={-24} y={-12} textAnchor="end">{unit}</text>);
  }
  /* annotations: text | lane | size, drawn on the right with a leader and arrow head */
  const notes = String(data.notes || '').split('\n').map(l => l.split('|').map(s => s.trim())).filter(c => c[0] && g.lanes[num(c[1], 0) - 1] && isFinite(parseFloat(c[2])))
    .map(c => ({ text: c[0], lane: num(c[1], 1) - 1, y: g.y(parseFloat(c[2])) })).sort((a, b) => a.y - b.y);
  const back: any[] = [];
  let prev = -99;
  notes.forEach((n: any, k: number) => {
    const ty = Math.max(n.y, prev + 20); prev = ty;
    const bx = g.laneX(n.lane) + LANE_W / 2 + BAND_W / 2 + 5, lx = g.W + 52, pts = [[lx - 6, ty], [g.W + 24, ty], [g.W + 24, n.y], [bx + 10, n.y]];
    back.push(<polyline key={'a' + k} className="bl-lead" points={pts.map(p => p.join(',')).join(' ')} />);
    back.push(<polygon key={'h' + k} className="bl-head" points={`${bx},${n.y} ${bx + 9},${n.y - 4} ${bx + 9},${n.y + 4}`} />);
    out.push(<text key={'at' + k} className="bl-note" x={lx} y={ty + 4.5}>{n.text}</text>);
  });
  out.splice(backAt, 0, ...back);
  if (data.poles !== false) {
    const cxm = g.W / 2, top = -(data.laneNo !== false ? 58 : 44);
    out.push(<Pole key="cat" x={cxm - 44} y={top} sign="−" label="Cathode" />);
    out.push(<Pole key="ano" x={cxm - 36} y={GEL_H + 26} sign="+" label="Anode" />);
  }
  return <g className="bl">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const lanes: any[] = data.lanes || [];
  const applyType = (k: string) => { const t = TYPES[k]; set({ type: k, style: t.style, unit: t.unit, ladder: t.ladder, ladderText: '', wells: t.wells }); };
  return (
    <>
      <S.Panel kicker="Type" help="Choosing a type also sets the colours, unit, ladder and whether wells show. Change any of them afterwards.">
        <Seg wrap value={data.type} options={Object.keys(TYPES).map(k => [k, TYPES[k].name] as [string, string])} onChange={applyType} />
        <Seg wrap value={data.style} options={Object.keys(STYLES).map(k => [k, STYLES[k].name] as [string, string])} onChange={v => set({ style: v })} />
        <Seg value={data.unit} options={UNITS} onChange={v => set({ unit: v })} />
      </S.Panel>
      <Rows id="bl-lanes" kicker="Lanes" help="At least two lanes. Left to right: ladder, control, then one lane per treatment. Bands are size:strength pairs, such as 50:1.2, 37:0.6. Strength is 0.1 to 2. Leave a name empty to number the lane automatically."
        rows={lanes} cols={[{ key: 'label', label: 'Name', w: '1fr', placeholder: 'auto' }, { key: 'kind', label: 'Lane', type: 'select', options: [['ladder', 'Ladder'], ['control', 'Control'], ['sample', 'Treatment']], w: '1fr' }, { key: 'bands', label: 'Bands', w: '1.6fr' }]}
        onChange={rs => { if (rs.length >= 2) set({ lanes: rs }); }}
        blank={() => ({ id: uid('l', lanes.map(x => x.id)), label: '', kind: 'sample', bands: '50:1' })} addLabel="+ Add lane" />
      <S.Panel kicker="Ladder" help="Sizes in the ladder lane, largest first. The ladder lane ignores its Bands cell.">
        <Seg wrap value={data.ladderText ? '' : data.ladder} options={Object.keys(LADDERS).map(k => [k, LADDERS[k].name] as [string, string])} onChange={v => set({ ladder: v, ladderText: '', unit: LADDERS[v].unit })} />
        <Spec id="bl-ladder" label="Or type sizes" value={data.ladderText || ''} rows={2} placeholder={LADDERS[data.ladder] ? LADDERS[data.ladder].sizes : '250, 150, 100'} onChange={v => set({ ladderText: v }, 'bl-ladder')} />
        <Toggle on={data.scale !== false} label="Sizes on the left" onChange={v => set({ scale: v })} />
        <Seg value={data.unitStyle === 'each' ? 'each' : 'header'} options={[['header', 'Unit once on top'], ['each', 'Unit on every size']]} onChange={v => set({ unitStyle: v })} />
      </S.Panel>
      <S.Panel kicker="Gel">
        <Toggle on={data.wells} label="Show wells" onChange={v => set({ wells: v })} />
        <Toggle on={data.poles !== false} label="Cathode (−) at the top, anode (+) at the bottom" onChange={v => set({ poles: v })} />
        <Toggle on={data.laneNo !== false} label="Lane numbers (L1, L2…)" onChange={v => set({ laneNo: v })} />
      </S.Panel>
      <S.Panel kicker="Annotations" help="One per line: text | lane number | size. An arrow points from the text to that band.">
        <Spec id="bl-notes" label="Labels with arrows" value={data.notes || ''} rows={4} placeholder="Target protein | 3 | 50" onChange={v => set({ notes: v }, 'bl-notes')} />
      </S.Panel>
    </>
  );
}

const L = (id: string, label: string, kind: string, bands: string) => ({ id, label, kind, bands });
const T = (n: number, a: string[]) => a.map((b, i) => L('l' + (i + 3), '', 'sample', b)).slice(0, n);
const mk = (type: string, lanesBands: string[], notes: string, over: any = {}) => {
  const t = TYPES[type];
  return { type, style: t.style, unit: t.unit, ladder: t.ladder, ladderText: '', wells: t.wells, poles: true, laneNo: true, scale: true, unitStyle: 'header',
    lanes: [L('l1', '', 'ladder', ''), L('l2', '', 'control', lanesBands[0]), ...T(lanesBands.length - 1, lanesBands.slice(1))], notes, ...over };
};

export const blot: EditorDef = {
  id: 'gel-blot', num: '24', name: 'Gels and blots', field: 'Methods',
  blurb: 'SDS-PAGE gels and Western, Eastern, Southern and Northern blots: ladder, control and treatment lanes, sizes, poles and arrows.',
  hint: 'Edit the lanes and their bands in the sidebar. Band height comes from size on a log scale, so ladder labels and bands always line up.',
  blank: mk('gel', ['50:1', '50:1'], ''),
  templates: [
    { name: 'SDS-PAGE gel', desc: 'Coomassie gel with wells, ladder, control and three treatments', title: 'SDS-PAGE of cell lysates',
      data: mk('gel', ['150:0.5, 100:0.7, 75:0.6, 50:0.8, 37:1, 25:0.7, 15:0.5', '150:0.6, 100:0.6, 75:0.6, 50:1.5, 37:0.9, 25:0.7, 15:0.5', '150:0.6, 100:0.7, 75:0.6, 50:1.1, 37:1, 25:0.7, 15:0.4', '150:0.6, 100:0.6, 75:0.5, 50:0.6, 37:1, 25:0.8, 15:0.5'], 'Target protein | 3 | 50') },
    { name: 'Western blot', desc: 'Protein blot with a target band and a loading control', title: 'Western blot: target protein after treatment',
      data: mk('western', ['50:0.4, 42:1', '50:0.8, 42:1', '50:1.3, 42:1', '50:1.7, 42:1'], 'Target protein (50 kDa) | 5 | 50\nβ-actin (42 kDa) | 5 | 42') },
    { name: 'Eastern blot', desc: 'Blot for a post-translationally modified protein', title: 'Eastern blot: phosphorylated protein',
      data: mk('eastern', ['70:0.3', '70:0.9, 52:0.3', '70:1.4, 52:0.6', '70:1.8, 52:0.9'], 'Modified protein (70 kDa) | 5 | 70') },
    { name: 'Southern blot', desc: 'DNA blot with a probe-hybridising fragment', title: 'Southern blot: restriction fragments',
      data: mk('southern', ['3:0.8', '3:0.8, 1.2:1.2', '3:0.7, 1.2:1.8', '3:0.7'], 'Fragment that binds the probe (1.2 kb) | 4 | 1.2') },
    { name: 'Northern blot', desc: 'RNA blot with 28S and 18S rRNA', title: 'Northern blot: mRNA expression',
      data: mk('northern', ['4.7:0.6, 2.4:0.3, 1.9:0.5', '4.7:0.6, 2.4:1, 1.9:0.5', '4.7:0.6, 2.4:1.6, 1.9:0.5', '4.7:0.6, 2.4:0.1, 1.9:0.5'], 'Target mRNA (2.4 kb) | 4 | 2.4\n28S rRNA | 4 | 4.7\n18S rRNA | 4 | 1.9') },
  ],
  stats: d => [[(d.lanes || []).length, 'lanes'], [geom(d).ladder.length, 'ladder bands']],
  Controls,
  Render: ({ data }) => <Blot data={data} />,
};
