import { S } from '../sheet';
import { num, Range, Rows, Seg, Spec, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

/* ===================== 24 Gels and blots ===================== */
/* One figure for an SDS-PAGE gel or a Western (protein), Eastern (modified protein), Southern (DNA) or Northern (RNA) blot.
   Lane 1 is the ladder, lane 2 the control, the rest are treatments. Samples run from the wells at the top (cathode, −) towards the bottom (anode, +).
   A band's height on the gel comes from its size on a log scale: big molecules stay near the wells. */

const WELL_D = 18, LANE_W = 76, GAP = 10, GEL_H = 440, PAD_T = 56, PAD_B = 34, BAND_W = 62;
const UNITS: [string, string][] = [['kDa', 'kDa'], ['Da', 'Da'], ['kb', 'kb'], ['bp', 'bp']];

/* gel and band colours: a pale gel with a dark band, or a dark gel with a bright one */
const STYLES: Record<string, { name: string; bg: string; band: string; edge: string; well: string }> = {
  coomassie: { name: 'Coomassie Blue', bg: '#e6edfb', band: '#1b3f9c', edge: '#31449a', well: 'rgba(30,60,160,.14)' },
  membrane: { name: 'Membrane', bg: '#f8f8f6', band: '#454545', edge: '#8c8c8c', well: 'rgba(0,0,0,.07)' },
  film: { name: 'Film', bg: '#efefef', band: '#111111', edge: '#4a4a4a', well: 'rgba(0,0,0,.09)' },
  silver: { name: 'Silver Stain', bg: '#f3e8d4', band: '#4a2f12', edge: '#7a5a30', well: 'rgba(90,60,20,.14)' },
  sypro: { name: 'SYPRO Ruby', bg: '#150508', band: '#ff2d42', edge: '#555555', well: 'rgba(255,255,255,.1)' },
};
const TYPES: Record<string, { name: string; style: string; unit: string; ladder: string; shape: string }> = {
  gel: { name: 'SDS-PAGE gel', style: 'coomassie', unit: 'kDa', ladder: 'p250', shape: 'wells' },
  western: { name: 'Western blot', style: 'membrane', unit: 'kDa', ladder: 'p250', shape: 'rect' },
  eastern: { name: 'Eastern blot', style: 'film', unit: 'kDa', ladder: 'p250', shape: 'rect' },
  southern: { name: 'Southern blot', style: 'film', unit: 'kb', ladder: 'dna1k', shape: 'rect' },
  northern: { name: 'Northern blot', style: 'film', unit: 'kb', ladder: 'rna', shape: 'rect' },
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
const shapeOf = (d: any) => d.shape === 'wells' || d.shape === 'rect' ? d.shape : d.wells ? 'wells' : 'rect';
/* outline of the gel: a rounded rectangle, or a rectangle with an open well cut into the top edge above each lane */
function outline(g: any, shape: string) {
  const W = g.W, H = GEL_H, r = 5;
  let top = `M0,${r} Q0,0 ${r},0`;
  if (shape === 'wells') g.lanes.forEach((_: any, i: number) => { const a = g.laneX(i) + 6, b = g.laneX(i) + LANE_W - 6; top += ` H${a} V${WELL_D} H${b} V0`; });
  return `${top} H${W - r} Q${W},0 ${W},${r} V${H - r} Q${W},${H} ${W - r},${H} H${r} Q0,${H} 0,${H - r} Z`;
}

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
  /* a colour row matches a lane (blank = every lane) and a size (blank = every band); later rows win */
  const colourFor = (lane: number, size: number) => {
    let c: string | undefined;
    (data.colours || []).forEach((r: any) => {
      const ln = r.lane === '' || r.lane == null ? 0 : num(r.lane, -1), sz = r.size === '' || r.size == null ? 0 : num(r.size, -1);
      if ((!ln || ln === lane + 1) && (!sz || Math.abs(Math.log(size / sz)) < 0.03) && r.color) c = r.color;
    });
    return c;
  };
  const shape = shapeOf(data), path = outline(g, shape), glow = data.style === 'sypro';
  out.push(<defs key="d"><filter id="bl-blur" x="-8%" y="-60%" width="116%" height="220%"><feGaussianBlur stdDeviation="1" /></filter>
    <filter id="bl-glow" x="-20%" y="-150%" width="140%" height="400%"><feGaussianBlur stdDeviation="4" /></filter>
    <clipPath id="bl-clip"><path d={path} /></clipPath></defs>);
  out.push(<path key="gel" d={path} fill={st.bg} stroke={st.edge} strokeWidth={1.4} strokeLinejoin="round" />);
  const layers = !!data.layers, stackH = Math.max(26, Math.min(PAD_T - 6, num(data.stackH, 40)));
  if (layers) {
    out.push(<rect key="stack" x={0} y={0} width={g.W} height={stackH} fill={st.well} clipPath="url(#bl-clip)" />);
    out.push(<line key="divide" x1={0} y1={stackH} x2={g.W} y2={stackH} stroke={st.edge} strokeWidth={1.3} />);
  }
  const backAt = out.length;
  g.lanes.forEach((l: any, i: number) => {
    const x = g.laneX(i), mid = x + LANE_W / 2;
    const bands: [number, number][] = l.kind === 'ladder' ? g.ladder.map((s: number) => [s, 1] as [number, number]) : bandsOf(l.bands);
    bands.forEach(([s, v], k) => {
      const h = 3 + Math.min(2, Math.max(0.1, v)) * 3.6, w = BAND_W * (l.kind === 'ladder' ? 1 : 0.94 + Math.min(0.06, v * 0.03));
      const fill = colourFor(i, s) || st.band, op = Math.min(1, 0.28 + 0.72 * v);
      if (glow) out.push(<rect key={'g' + i + '-' + k} x={mid - w / 2 - 2} y={g.y(s) - h / 2 - 1} width={w + 4} height={h + 2} rx={h / 2} fill={fill} opacity={op * 0.55} filter="url(#bl-glow)" />);
      out.push(<rect key={'b' + i + '-' + k} x={mid - w / 2} y={g.y(s) - h / 2} width={w} height={h} rx={h / 2} fill={fill} opacity={op} filter="url(#bl-blur)" />);
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
    .map(c => ({ text: c[0], lane: num(c[1], 1) - 1, size: parseFloat(c[2]), y: g.y(parseFloat(c[2])) })).sort((a, b) => a.y - b.y);
  const back: any[] = [];
  const ro = layers ? 124 : 0;
  let prev = -99;
  notes.forEach((n: any, k: number) => {
    const ty = Math.max(n.y, prev + 20); prev = ty;
    const bx = g.laneX(n.lane) + LANE_W / 2 + BAND_W / 2 + 5, lx = g.W + 52 + ro, pts = [[lx - 6, ty], [g.W + 24 + ro, ty], [g.W + 24 + ro, n.y], [bx + 10, n.y]];
    const nc = colourFor(n.lane, n.size), stroke = nc && data.noteColour !== false ? { stroke: nc } : undefined, fillc = nc && data.noteColour !== false ? { fill: nc } : undefined;
    /* on a dark gel the arrow gets a light halo so it stays visible where it crosses the gel */
    if (glow) back.push(<polyline key={'ah' + k} className="bl-lead" points={pts.map(p => p.join(',')).join(' ')} style={{ stroke: 'var(--paper)', strokeWidth: 3.6 }} />);
    back.push(<polyline key={'a' + k} className="bl-lead" points={pts.map(p => p.join(',')).join(' ')} style={stroke} />);
    back.push(<polygon key={'h' + k} className="bl-head" points={`${bx},${n.y} ${bx + 9},${n.y - 4} ${bx + 9},${n.y + 4}`} style={glow ? { ...fillc, stroke: 'var(--paper)', strokeWidth: 1.6, paintOrder: 'stroke' } : fillc} />);
    out.push(<text key={'at' + k} className="bl-note" x={lx} y={ty + 4.5} style={fillc}>{n.text}</text>);
  });
  out.splice(backAt, 0, ...back);
  if (layers) {
    /* the stacking gel label sits level with the stacking gel, the resolving gel bracket spans the rest of the gel */
    const free = (y0: number) => { let y = y0; for (let k = 0; k < 12 && notes.some((n: any) => Math.abs(n.y - y) < 13); k++) y += k % 2 ? -(k + 1) * 11 : (k + 1) * 11; return y; };
    const ys = stackH / 2, ym = free((stackH + GEL_H) / 2), x0 = g.W;
    out.push(<line key="sl" className="bl-tick" x1={x0 + 4} y1={ys} x2={x0 + 30} y2={ys} />);
    out.push(<text key="st" className="bl-note" x={x0 + 38} y={ys + 4.5}>Stacking gel</text>);
    out.push(<path key="rb" className="bl-lead" d={`M${x0 + 8},${stackH + 3} H${x0 + 20} V${GEL_H - 4} H${x0 + 8}`} />);
    out.push(<line key="rl" className="bl-tick" x1={x0 + 20} y1={ym} x2={x0 + 30} y2={ym} />);
    out.push(<text key="rt" className="bl-note" x={x0 + 38} y={ym + 4.5}>Resolving gel</text>);
  }
  if (data.poles !== false) {
    const cxm = g.W / 2, top = -(data.laneNo !== false ? 58 : 44);
    out.push(<Pole key="cat" x={cxm - 44} y={top} sign="−" label="Cathode" />);
    out.push(<Pole key="ano" x={cxm - 36} y={GEL_H + 26} sign="+" label="Anode" />);
  }
  return <g className="bl">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const lanes: any[] = data.lanes || [];
  const applyType = (k: string) => { const t = TYPES[k]; set({ type: k, style: t.style, unit: t.unit, ladder: t.ladder, ladderText: '', shape: t.shape, wells: undefined, layers: k === 'gel' }); };
  return (
    <>
      <S.Panel kicker="Type" help="Choosing a type also sets the stain, unit, ladder and shape. Change any of them afterwards.">
        <Seg wrap value={data.type} options={Object.keys(TYPES).map(k => [k, TYPES[k].name] as [string, string])} onChange={applyType} />
        <Seg value={data.unit} options={UNITS} onChange={v => set({ unit: v })} />
      </S.Panel>
      <S.Panel kicker="Stain" help="Gels are stained with Coomassie Blue, Silver Stain or SYPRO Ruby. Membrane and Film are for blots. SYPRO Ruby is a dark gel with glowing red bands.">
        <Seg wrap value={data.style} options={Object.keys(STYLES).map(k => [k, STYLES[k].name] as [string, string])} onChange={v => set({ style: v })} />
      </S.Panel>
      <Rows id="bl-colours" kicker="Band colours" help="Colour one band, one protein or one fragment. Lane and size pick the band, such as lane 3, size 50. Leave lane empty for every lane, or size empty for every band in the lane. Later rows win. Arrows and labels take the band's colour."
        rows={data.colours || []} cols={[{ key: 'lane', label: 'Lane', type: 'num', w: '0.6fr', placeholder: 'all' }, { key: 'size', label: 'Size', type: 'num', w: '0.7fr', placeholder: 'all' }, { key: 'color', label: 'Colour', type: 'color' }]}
        onChange={rs => set({ colours: rs })} blank={() => ({ id: uid('c', (data.colours || []).map((x: any) => x.id)), lane: '', size: '', color: 'var(--swatch-11)' })} addLabel="+ Colour a band" />
      {(data.colours || []).length ? <S.Panel><Toggle on={data.noteColour !== false} label="Colour arrows and labels to match" onChange={v => set({ noteColour: v })} /></S.Panel> : null}
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
        <Seg value={shapeOf(data)} options={[['rect', 'Rectangle'], ['wells', 'With loading wells on top']]} onChange={v => set({ shape: v, wells: undefined })} />
        <Toggle on={!!data.layers} label="Stacking gel and resolving gel" onChange={v => set({ layers: v })} />
        {data.layers ? <Range id="bl-stack" label="Stacking gel height" value={num(data.stackH, 40)} min={26} max={PAD_T - 6} onChange={v => set({ stackH: v }, 'bl-stack')} /> : null}
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
  return { type, style: t.style, unit: t.unit, ladder: t.ladder, ladderText: '', shape: t.shape, layers: type === 'gel', stackH: 40, poles: true, laneNo: true, scale: true, unitStyle: 'header',
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
    { name: 'Silver-stained gel', desc: 'Silver Stain: brown bands on a cream gel, the most sensitive of the three', title: 'Silver-stained SDS-PAGE',
      data: mk('gel', ['150:0.5, 100:0.7, 75:0.6, 50:0.8, 37:1, 25:0.7, 15:0.5', '150:0.6, 100:0.6, 75:0.6, 50:1.5, 37:0.9, 25:0.7, 15:0.5', '150:0.6, 100:0.7, 75:0.6, 50:1.1, 37:1, 25:0.7, 15:0.4', '150:0.6, 100:0.6, 75:0.5, 50:0.6, 37:1, 25:0.8, 15:0.5'], 'Target protein | 3 | 50', { style: 'silver' }) },
    { name: 'SYPRO Ruby gel', desc: 'Fluorescent stain: glowing red bands on a dark gel', title: 'SYPRO Ruby-stained SDS-PAGE',
      data: mk('gel', ['150:0.5, 100:0.7, 75:0.6, 50:0.8, 37:1, 25:0.7, 15:0.5', '150:0.6, 100:0.6, 75:0.6, 50:1.5, 37:0.9, 25:0.7, 15:0.5', '150:0.6, 100:0.7, 75:0.6, 50:1.1, 37:1, 25:0.7, 15:0.4', '150:0.6, 100:0.6, 75:0.5, 50:0.6, 37:1, 25:0.8, 15:0.5'], 'Target protein | 3 | 50', { style: 'sypro' }) },
    { name: 'Prestained ladder blot', desc: 'Western blot with a coloured ladder and a highlighted target', title: 'Western blot with a prestained ladder',
      data: mk('western', ['50:0.4, 42:1', '50:0.8, 42:1', '50:1.3, 42:1', '50:1.7, 42:1'], 'Target protein | 5 | 50', { colours: [
        { id: 'c1', lane: 1, size: 250, color: 'var(--swatch-13)' }, { id: 'c2', lane: 1, size: 150, color: 'var(--swatch-14)' }, { id: 'c3', lane: 1, size: 100, color: 'var(--swatch-2)' }, { id: 'c4', lane: 1, size: 75, color: 'var(--swatch-11)' },
        { id: 'c5', lane: 1, size: 50, color: 'var(--swatch-7)' }, { id: 'c6', lane: 1, size: 37, color: 'var(--swatch-9)' }, { id: 'c7', lane: 1, size: 25, color: 'var(--swatch-5)' }, { id: 'c8', lane: 1, size: 20, color: 'var(--swatch-3)' },
        { id: 'c9', lane: 1, size: 15, color: 'var(--swatch-2)' }, { id: 'c10', lane: 1, size: 10, color: 'var(--swatch-6)' }, { id: 'c11', lane: '', size: 50, color: 'var(--swatch-11)' }] }) },
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
