import { S } from '../sheet';
import { cells, EmptyHint, lines, num, Range, RowsText, Seg, Spec, startDrag, Swatches, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';
import { SAMPLE } from './boneSample';
import { fmt, GfxList, GfxOverlay, GfxSelected, GfxTools, gfxClick, lastRuler, migrate, moveShape, Shapes } from './scalegfx';

/* ===================== 10 Scale bar ===================== */
const D = 800;
const resolveImg = (img: any) => img === 'sample:artery' ? SAMPLE : img;
function sb(d: any) {
  const w = num(d.imgW, 1200), h = num(d.imgH, 800), H = D * h / w;
  const ppu = D / Math.max(1e-9, num(d.fov, 200));
  return { H, ppu, len: num(d.bar, 50) * ppu };
}
const BAR_INKS = ['var(--ink)', 'var(--paper)', 'var(--accent-700)', 'var(--edge-feedback-neg)', 'var(--swatch-6)', 'var(--swatch-11)'];

function ExampleImage(p: { H: number }) {
  const cells: any[] = [];
  let s = 7;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 46; i++) {
    const x = r() * D, y = r() * p.H, rr = 26 + r() * 22;
    cells.push(<g key={i}><ellipse cx={x} cy={y} rx={rr} ry={rr * (0.75 + r() * 0.3)} className="mk-ex-cell" /><circle cx={x + rr * 0.15} cy={y - rr * 0.1} r={rr * 0.3} className="mk-ex-nuc" /></g>);
  }
  return <g><rect width={D} height={p.H} className="mk-ex-bg" />{cells}<text x={12} y={22} className="mk-ex-note">Example image: upload your own micrograph</text></g>;
}

function readImage(file: File, done: (img: string, w: number, h: number) => void, fail: () => void) {
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
      done(c.toDataURL('image/jpeg', 0.9), c.width, c.height);
    };
    im.onerror = fail; im.src = String(fr.result);
  };
  fr.onerror = fail; fr.readAsDataURL(file);
}

/* where the bar sits: a dragged position, or a corner */
function barBox(d: any) {
  const g = sb(d), len = g.len, th = num(d.thick, 4), fs = num(d.barFont, 13), m = 22;
  const bh = th + fs + 14;
  if (d.bx != null && d.by != null) return { x: d.bx, y: d.by, len, th, fs, bh, g };
  const left = d.corner === 'bl' || d.corner === 'tl', top = d.corner === 'tl' || d.corner === 'tr';
  return { x: left ? m + 10 : D - m - 10 - len, y: top ? m + 8 : g.H - m - bh + 8, len, th, fs, bh, g };
}

function ScaleRender({ data }: { data: any }) {
  const b = barBox(data), g = b.g, img = resolveImg(data.img);
  const color = data.barColor || 'var(--ink)', above = data.labelPos === 'above';
  const ty = above ? b.y - 6 : b.y + b.th + b.fs + 2;
  return (
    <g>
      {img ? <image href={img} x={0} y={0} width={D} height={g.H} preserveAspectRatio="none" /> : <ExampleImage H={g.H} />}
      <Shapes shapes={data.shapes || []} ppu={g.ppu} unit={data.unit} />
      {data.barHidden ? null : <>
        {data.plate ? <rect x={b.x - 10} y={(above ? b.y - b.fs - 12 : b.y - 8)} width={b.len + 20} height={b.bh} className="mk-plate" style={{ fill: data.plateColor || undefined }} /> : null}
        <rect x={b.x} y={b.y} width={b.len} height={b.th} style={{ fill: color }} />
        <text className="mk-bar-label" x={b.x + b.len / 2} y={ty} style={{ fill: color, fontSize: b.fs + 'px', fontWeight: data.barBold ? 700 : 400 }}>{fmt(num(data.bar, 50)) + ' ' + data.unit}</text>
      </>}
    </g>
  );
}

function ScaleOverlay(p: EditProps & { toSvg: any }) {
  const { data, set, sel, setSel, toSvg } = p;
  const b = barBox(data), above = data.labelPos === 'above';
  const on = sel && sel.kind === 'bar';
  const live = !data.barHidden && !data.barLocked && (data.tool || 'select') === 'select';
  return (
    <>
      <GfxOverlay {...p} />
      {live ? <rect className={'mk-hit' + (on ? ' mk-on' : '')} x={b.x - 12} y={(above ? b.y - b.fs - 14 : b.y - 10)} width={b.len + 24} height={b.bh + 4}
        onPointerDown={e => { setSel({ kind: 'bar', id: 'bar' }); const x0 = b.x, y0 = b.y; startDrag(e, toSvg, (dx, dy) => set({ bx: Math.round(x0 + dx), by: Math.round(y0 + dy) }, 'bar-drag')); }} /> : null}
    </>
  );
}

function ScaleControls(p: EditProps) {
  const { data, set, sel } = p;
  const g = sb(data);
  const shapes: any[] = data.shapes || [];
  const picked = sel && sel.kind === 'shape' ? shapes.find(q => q.id === sel.id) : null;
  const ruler = picked && (picked.type === 'caliper' || picked.type === 'line') ? picked : lastRuler(shapes);
  return (
    <>
      <GfxTools {...p} />
      {sel && sel.kind === 'bar' ? (
        <S.Panel kicker="Selected scale bar" help={data.barLocked ? 'Locked: unlock it in the Graphics list to move it.' : 'Drag the bar anywhere on the image.'}>
          <S.Field id="sb-bar2" label={'Length (' + data.unit + ')'} value={data.bar} onChange={(e: any) => set({ bar: e.target.value }, 'bar')} />
          <Swatches label="Bar and text colour" value={data.barColor} colors={BAR_INKS} none="Ink" onChange={v => set({ barColor: v })} />
          <Range id="sb-th" label="Bar thickness" value={num(data.thick, 4)} min={1} max={14} onChange={v => set({ thick: v }, 'th')} />
          <Range id="sb-fs" label="Text size" value={num(data.barFont, 13)} min={9} max={32} onChange={v => set({ barFont: v }, 'bf')} />
          <Seg value={data.labelPos || 'below'} options={[['below', 'Text below'], ['above', 'Text above']]} onChange={v => set({ labelPos: v })} />
          <Toggle on={data.barBold} label="Bold text" onChange={v => set({ barBold: v })} />
          <Toggle on={data.plate} label="Plate behind the bar" onChange={v => set({ plate: v })} />
          {data.plate ? <Swatches label="Plate colour" value={data.plateColor} colors={['var(--paper)', 'var(--ink)', 'var(--neutral-200)', 'var(--accent-100)']} none="White" onChange={v => set({ plateColor: v })} /> : null}
        </S.Panel>
      ) : null}
      <GfxSelected {...p} />
      <GfxList {...p} />
      <S.Panel kicker="Image" help="Large photos are reduced to 1600 px on the longest side.">
        <label className="sd-tbtn mk-upload">Upload micrograph<input type="file" accept="image/png,image/jpeg,image/webp" hidden
          onChange={(e: any) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) readImage(f, (img, w, h) => set({ img, imgW: w, imgH: h, shapes: [], draft: [], bx: undefined, by: undefined }), () => set({})); }} /></label>
        {data.img !== 'sample:artery' ? <S.ToolButton onClick={() => set({ img: 'sample:artery', imgW: 1182, imgH: 665, fov: 1800, unit: 'µm', shapes: [], draft: [], bx: undefined, by: undefined })}>Use the artery example</S.ToolButton> : null}
      </S.Panel>
      <S.Panel kicker="Calibration" help="The width of the whole image in real units, from your microscope's field of view or a stage micrometer.">
        <div className="mk-pair">
          <S.Field id="sb-fov" label="Image width" value={data.fov} onChange={(e: any) => set({ fov: e.target.value }, 'fov')} />
          <S.Field id="sb-unit" label="Unit" value={data.unit} placeholder="e.g. µm" onChange={(e: any) => set({ unit: e.target.value }, 'unit')} />
        </div>
        {ruler ? <S.Field id="sb-known" label={(picked && ruler === picked ? 'Selected ' + ruler.type : 'Last caliper or line') + ' is really…'} placeholder={'e.g. 7.5 (' + data.unit + ')'} value=""
          onChange={(e: any) => { const v = parseFloat(e.target.value); if (v > 0) { const px = Math.hypot(ruler.p[2] - ruler.p[0], ruler.p[3] - ruler.p[1]); set({ fov: Math.round(D / (px / v) * 100) / 100 }, 'cal'); } }}
          help="Type the true length of a known object you measured to recalibrate." /> : null}
      </S.Panel>
      <S.Panel kicker="Bar" help="Click the bar on the sheet for colour, thickness and text. The Scale bar tool places it with one click.">
        <S.Field id="sb-bar" label={'Bar length (' + data.unit + ')'} value={data.bar} onChange={(e: any) => set({ bar: e.target.value }, 'bar')} help={'Draws ' + Math.round(g.len) + ' px wide on the sheet.'} />
        <Seg value={data.bx != null ? '' : data.corner} options={[['bl', 'Bottom left'], ['br', 'Bottom right']]} onChange={v => set({ corner: v, bx: undefined, by: undefined, barHidden: false })} />
        <Seg value={data.bx != null ? '' : data.corner} options={[['tl', 'Top left'], ['tr', 'Top right']]} onChange={v => set({ corner: v, bx: undefined, by: undefined, barHidden: false })} />
      </S.Panel>
    </>
  );
}

/* the artery example, annotated the way ZEN figures are: leader labels and calipers (points are sheet units on the 800 px wide image) */
const L = (id: string, text: string, p: number[]) => ({ id, type: 'label', p, text, size: 15, width: 1.6, head: true, halo: true });
const C = (id: string, p: number[]) => ({ id, type: 'caliper', p, width: 2, showValue: true, halo: true });
const ARTERY_GFX = [
  C('g1', [352, 240, 410, 240]), C('g2', [324, 200, 356, 200]),
  L('g3', 'tunica adventitia', [286, 190, 226, 160]), L('g4', 'tunica media', [322, 262, 226, 300]), L('g5', 'lumen', [380, 290, 226, 372]),
];
const GFX0 = { shapes: [] as any[], tool: 'select', keep: false, draft: [] as any[] };

export const scalebar: EditorDef = {
  id: 'scale-bar', num: '10', name: 'Scale bar', field: 'Cells and measurement',
  blurb: 'Calibrated scale bars on your own micrographs, with a ZEN-style graphics toolbar: text, lines, arrows, shapes, calipers and leader labels.',
  hint: 'Pick a tool in Graphics, then click the image. Use Select to move graphics; the Graphics list shows, locks, names and reorders them.',
  normalize: d => migrate(d.img && typeof d.img === 'string' && d.img === SAMPLE ? { ...d, img: 'sample:artery' } : d),
  templates: [
    { name: 'Muscular artery', desc: 'Cross-section with labelled wall layers and a lumen caliper', title: 'Muscular artery in cross-section',
      caption: 'Smooth muscle of the tunica media surrounds the lumen; collagen of the tunica adventitia lies outside it.',
      data: { img: 'sample:artery', imgW: 1182, imgH: 665, fov: 1800, unit: 'µm', bar: 200, corner: 'bl', plate: true, ...GFX0, shapes: ARTERY_GFX } },
    { name: 'Light microscope', desc: 'Drawn example field, 100 µm bar', title: 'Onion epidermis, 40× objective', data: { img: null, imgW: 1200, imgH: 800, fov: 450, unit: 'µm', bar: 100, corner: 'br', plate: true, ...GFX0 } },
    { name: 'Electron micrograph', desc: '2 µm field, 500 nm bar', title: 'Mitochondrion, TEM', data: { img: null, imgW: 1200, imgH: 900, fov: 2000, unit: 'nm', bar: 500, corner: 'bl', plate: true, ...GFX0 } }
  ],
  Controls: ScaleControls,
  Overlay: ScaleOverlay,
  sheetClick: (d, pt) => {
    if ((d.tool || 'select') === 'bar') return { bx: Math.round(pt[0] - sb(d).len / 2), by: Math.round(pt[1]), barHidden: false, barLocked: false, tool: d.keep ? 'bar' : 'select', draft: [] };
    return gfxClick(d, pt);
  },
  blank: { img: null, imgW: 1200, imgH: 800, fov: 500, unit: 'µm', bar: 100, corner: 'br', plate: true, ...GFX0 },
  nudge: (d, sel, dx, dy) => {
    if (sel.kind === 'bar') { if (d.barLocked) return null; const b = barBox(d); return { bx: b.x + dx, by: b.y + dy }; }
    if (sel.kind === 'shape') { const s = (d.shapes || []).find((q: any) => q.id === sel.id); return s && !s.locked ? { shapes: d.shapes.map((q: any) => q === s ? moveShape(s, dx, dy) : q) } : null; }
    return null;
  },
  findText: (d, text) => text.endsWith(' ' + d.unit) && text.startsWith(fmt(num(d.bar, 50))) ? { kind: 'bar', id: 'bar' } : null,
  remove: (d, sel) => {
    if (sel.kind === 'bar') return d.barLocked ? null : { barHidden: true };
    if (sel.kind === 'shape') { const s = (d.shapes || []).find((q: any) => q.id === sel.id); return s && !s.locked ? { shapes: d.shapes.filter((q: any) => q !== s) } : null; }
    return null;
  },
  duplicate: (d, sel) => {
    if (sel.kind !== 'shape') return null;
    const shapes = d.shapes || [], s = shapes.find((q: any) => q.id === sel.id); if (!s) return null;
    let n = shapes.length + 1; while (shapes.some((q: any) => q.id === 'g' + n)) n++;
    const c = { ...moveShape(s, 16, 16), id: 'g' + n, name: undefined, locked: false };
    return { patch: { shapes: [...shapes, c] }, sel: { kind: 'shape', id: c.id } };
  },
  Render: ({ data }) => <ScaleRender data={data} />,
};

/* ===================== 11 Gradient bar ===================== */

/* ---------- gradient bar: items as draggable markers ---------- */
function gbItems(d: any) {
  /* index = the item line's position among item lines, so edits write back to the right line */
  return lines(d.items).map((l, i) => { const [label, v, mk] = cells(l); return { i, label, value: num(v, NaN), marker: mk === 'arrow' ? 'arrow' : 'pin' }; }).filter(x => isFinite(x.value));
}
function gbWrite(d: any, i: number, patch: any) {
  const ls = lines(d.items);
  return { items: ls.map((l, j) => { if (j !== i) return l; const [label, v, mk] = cells(l); const r = { label, value: v, marker: mk === 'arrow' ? 'arrow' : '', ...patch }; return [r.label, r.value, r.marker === 'arrow' ? 'arrow' : ''].filter(x => x !== '' && x != null).join(' | '); }).join('\n') };
}
function gbGeom(d: any) {
  const L = num(d.length, 600), T = num(d.thickness, 24), H = (d.orient || 'h') === 'h', flip = !!d.flip, from = num(d.from, 0), to = num(d.to, 10);
  const pu = (v: number) => (v - from) / ((to - from) || 1) * L;
  const pt = (u: number, v: number): [number, number] => { const uu = flip ? L - u : u; return H ? [uu, v] : [v, L - uu]; };
  const valAt = (x: number, y: number) => { let u = H ? x : L - y; if (flip) u = L - u; return from + Math.max(0, Math.min(1, u / L)) * (to - from); };
  return { L, T, H, pu, pt, valAt, from, to };
}
const round3 = (v: number, span: number) => { const s = Math.pow(10, Math.floor(Math.log10(Math.abs(span) || 1)) - 2); return Math.round(v / s) * s; };
function GbOverlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const g = gbGeom(data);
  return <>{gbItems(data).map(it => {
    const q = g.pt(g.pu(it.value), -(g.T / 2 + 10)), on = sel && sel.kind === 'item' && sel.id === String(it.i);
    const w = g.H ? 16 : 34, hh = g.H ? 34 : 16;
    return <rect key={it.i} className={'mk-hit' + (on ? ' mk-on' : '')} x={q[0] - w / 2} y={q[1] - hh / 2} width={w} height={hh} style={{ cursor: g.H ? 'ew-resize' : 'ns-resize' }}
      onPointerDown={e => {
        setSel({ kind: 'item', id: String(it.i) });
        startDrag(e, toSvg, (_dx, _dy, at) => set(gbWrite(data, it.i, { value: +round3(g.valAt(at[0], at[1]), g.to - g.from).toPrecision(6) }), 'gb-drag-' + it.i));
      }} />;
  })}</>;
}
function GbSelected({ data, set, sel, setSel }: EditProps) {
  if (!sel || sel.kind !== 'item') return null;
  const i = +sel.id, l = lines(data.items)[i]; if (l == null) return null;
  const [label, v, mk] = cells(l);
  return (
    <S.Panel kicker="Selected item" help="Drag its marker along the bar to change the value.">
      <S.Field id="gb-sl2" label="Label" value={label} onChange={(e: any) => set(gbWrite(data, i, { label: e.target.value }), 'gb-l' + i)} />
      <S.Field id="gb-sv2" label="Value" value={v} onChange={(e: any) => set(gbWrite(data, i, { value: e.target.value }), 'gb-v' + i)} />
      <Seg value={mk === 'arrow' ? 'arrow' : 'pin'} options={[['pin', 'Pin'], ['arrow', 'Arrow']]} onChange={m => set(gbWrite(data, i, { marker: m }))} />
      <S.ToolButton onClick={() => { set({ items: lines(data.items).filter((_, j) => j !== i).join('\n') }); setSel(null); }}>Delete item</S.ToolButton>
    </S.Panel>
  );
}

export const gradient: EditorDef = {
  hint: 'Click an item marker on the bar to edit it; drag it along the bar to change its value.',
  blank: { palette: 'viridis', orient: 'h', flip: false, bands: 0, dividers: false, outline: true, length: 600, thickness: 24, fontSize: 12, startLabel: 'Low', endLabel: 'High', scaleName: '', from: 0, to: 100, step: 10, minor: 0, format: 'number', named: '', items: '', zones: '', arrows: '' },
  Overlay: GbOverlay,
  findText: (d, text) => { const it = gbItems(d).find(x => x.label === text.trim()); return it ? { kind: 'item', id: String(it.i) } : null; },
  remove: (d, sel) => sel.kind === 'item' ? { items: lines(d.items).filter((_, j) => j !== +sel.id).join('\n') } : null,
  duplicate: (d, sel) => { const ls = lines(d.items), l = ls[+sel.id]; if (l == null) return null; return { patch: { items: [...ls, l].join('\n') }, sel: { kind: 'item', id: String(ls.length) } }; },
  nudge: (d, sel, dx, dy) => { const it = gbItems(d).find(x => x.i === +sel.id); if (!it) return null; const g = gbGeom(d), step = (g.to - g.from) / g.L * (g.H ? dx : -dy) * (d.flip ? -1 : 1); return step ? gbWrite(d, it.i, { value: +round3(it.value + step, g.to - g.from).toPrecision(6) }) : null; },
  id: 'gradient-bar', num: '11', name: 'Gradient bar', field: 'Cells and measurement',
  blurb: 'Colour scales for pH, temperature, Likert items or any continuous range, with zones, arrows and items.',
  templates: [
    { name: 'pH scale 0 to 14', desc: 'Indicator gradient with 14 everyday substances', title: 'pH of common substances at 25 °C',
      data: { palette: 'ph', orient: 'h', flip: false, bands: 0, dividers: false, outline: true, length: 700, thickness: 26, fontSize: 12, startLabel: 'Acidic', endLabel: 'Basic',
        scaleName: 'pH', from: 0, to: 14, step: 1, minor: 0, format: 'number', named: '',
        items: 'Gastric acid | 1.5\nLemon juice | 2.2\nVinegar | 2.9\nOrange juice | 3.5\nBlack coffee | 5\nMilk | 6.6\nPure water | 7\nBlood | 7.4\nSea water | 8.1\nBaking soda | 8.3\nSoap | 10\nAmmonia | 11.6\nBleach | 12.6\nLye | 13.5',
        zones: '', arrows: 'more acidic | 7 | 0 | bold\nmore basic | 7 | 14 | bold' } },
    { name: 'Water temperature', desc: 'Ice, liquid water and steam in °C', title: 'States of water at sea level',
      data: { palette: 'temp', orient: 'h', flip: false, bands: 0, dividers: false, outline: true, length: 600, thickness: 22, fontSize: 12, startLabel: '', endLabel: '',
        scaleName: '°C', from: -20, to: 110, step: 20, minor: 1, format: 'number', named: '',
        items: 'Body temperature | 37\nPasteurisation | 72', zones: 'Ice | -20 | 0\nLiquid water | 0 | 100\nSteam | 100 | 110', arrows: '' } },
    { name: 'Likert item', desc: 'Five bands with a class average', title: 'I feel confident drawing pathway diagrams',
      data: { palette: 'diverge', orient: 'h', flip: false, bands: 5, dividers: true, outline: true, length: 600, thickness: 22, fontSize: 12, startLabel: '', endLabel: '',
        scaleName: '', from: 0.5, to: 5.5, step: 1, minor: 0, format: 'named', named: 'Strongly disagree\nDisagree\nNeutral\nAgree\nStrongly agree',
        items: 'Class average | 3.6 | arrow', zones: '', arrows: '' } },
    { name: 'Ocean depth zones', desc: 'Vertical bar, sunlit to hadal', title: 'Ocean zones by depth',
      data: { palette: 'steel', orient: 'v', flip: true, bands: 0, dividers: false, outline: true, length: 520, thickness: 26, fontSize: 12, startLabel: 'Surface', endLabel: 'Trench floor',
        scaleName: 'Depth (m)', from: 0, to: 11000, step: 2000, minor: 0, format: 'number', named: '',
        items: 'Sperm whale dive | 2250\nTitanic wreck | 3800', zones: 'Sunlight | 0 | 200\nTwilight | 200 | 1000\nMidnight | 1000 | 4000\nAbyssal | 4000 | 6000\nHadal | 6000 | 11000', arrows: '' } }
  ],
  Controls: (ep) => { const { data, set } = ep; return (
    <>
      <GbSelected {...ep} />
      <S.Panel kicker="Bar">
        <Seg wrap value={data.palette} options={[['viridis', 'Viridis'], ['steel', 'Steel'], ['grey', 'Grey'], ['diverge', 'Diverging'], ['temp', 'Temperature'], ['ph', 'pH'], ['rg', 'Red–green'], ['spectrum', 'Spectrum']]} onChange={v => set({ palette: v })} />
        <p className="sd-help">Prefer viridis or steel unless the colours are the science (pH indicator, visible spectrum).</p>
        <Seg value={data.orient} options={[['h', 'Horizontal'], ['v', 'Vertical']]} onChange={v => set({ orient: v })} />
        <Toggle on={data.flip} label="Flip direction" onChange={v => set({ flip: v })} />
        <Range id="gb-bands" label="Bands (0 = smooth)" value={num(data.bands, 0)} min={0} max={14} onChange={v => set({ bands: v }, 'bands')} />
        <Toggle on={data.dividers} label="Lines between bands" onChange={v => set({ dividers: v })} />
        <Range id="gb-len" label="Length" value={num(data.length, 600)} min={240} max={900} step={10} onChange={v => set({ length: v }, 'len')} />
        <Range id="gb-th" label="Thickness" value={num(data.thickness, 24)} min={6} max={90} onChange={v => set({ thickness: v }, 'th')} />
        <Range id="gb-fs" label="Text size" value={num(data.fontSize, 12)} min={9} max={28} onChange={v => set({ fontSize: v }, 'fs')} />
      </S.Panel>
      <S.Panel kicker="End labels">
        <div className="mk-pair">
          <S.Field id="gb-sl" label="At the start" value={data.startLabel} placeholder="e.g. Acidic" onChange={(e: any) => set({ startLabel: e.target.value }, 'sl')} />
          <S.Field id="gb-el" label="At the end" value={data.endLabel} placeholder="e.g. Basic" onChange={(e: any) => set({ endLabel: e.target.value }, 'el')} />
        </div>
      </S.Panel>
      <S.Panel kicker="Scale">
        <S.Field id="gb-sn" label="Scale name" value={data.scaleName} placeholder="e.g. pH" onChange={(e: any) => set({ scaleName: e.target.value }, 'sn')} />
        <div className="mk-pair">
          <S.Field id="gb-from" label="From" value={data.from} onChange={(e: any) => set({ from: e.target.value }, 'from')} />
          <S.Field id="gb-to" label="To" value={data.to} onChange={(e: any) => set({ to: e.target.value }, 'to')} />
        </div>
        <div className="mk-pair">
          <S.Field id="gb-step" label="Step" value={data.step} onChange={(e: any) => set({ step: e.target.value }, 'step')} />
          <S.Field id="gb-minor" label="Minor ticks" value={data.minor} onChange={(e: any) => set({ minor: e.target.value }, 'minor')} />
        </div>
        <Seg value={data.format} options={[['number', '1, 2, 3'], ['power', '10ⁿ'], ['named', 'Named']]} onChange={v => set({ format: v })} />
        {data.format === 'named' ? <Spec id="gb-named" label="Names, one per tick" value={data.named} rows={5} onChange={v => set({ named: v }, 'named')} /> : null}
      </S.Panel>
      <RowsText id="gb-items" kicker="Items on the bar" help="Click a label on the sheet to find its row." text={data.items}
        parse={l => { const [label, value, marker] = cells(l); return { label, value, marker: marker === 'arrow' ? 'arrow' : 'pin' }; }}
        format={r => [r.label, r.value, r.marker === 'arrow' ? 'arrow' : ''].filter(x => x !== '').join(' | ')}
        cols={[{ key: 'label', label: 'Label', w: '1.6fr' }, { key: 'value', label: 'Value', type: 'num', w: '0.7fr' }, { key: 'marker', label: 'Mark', type: 'select', options: [['pin', 'Pin'], ['arrow', 'Arrow']], w: '0.8fr' }]}
        blank={() => ({ label: 'New item', value: (num(data.from, 0) + num(data.to, 10)) / 2, marker: 'pin' })} addLabel="+ Add item" onText={(v, k) => set({ items: v }, k)} />
      <RowsText id="gb-zones" kicker="Zones" text={data.zones}
        parse={l => { const [label, from, to] = cells(l); return { label, from, to }; }} format={r => [r.label, r.from, r.to].join(' | ')}
        cols={[{ key: 'label', label: 'Zone', w: '1.4fr' }, { key: 'from', label: 'From', type: 'num', w: '0.7fr' }, { key: 'to', label: 'To', type: 'num', w: '0.7fr' }]}
        blank={() => ({ label: 'Zone', from: data.from, to: data.to })} addLabel="+ Add zone" onText={(v, k) => set({ zones: v }, k)} />
      <RowsText id="gb-arrows" kicker="Range arrows" text={data.arrows}
        parse={l => { const [label, from, to, st] = cells(l); return { label, from, to, style: st === 'bold' ? 'bold' : 'thin' }; }}
        format={r => [r.label, r.from, r.to, r.style === 'bold' ? 'bold' : ''].filter(x => x !== '').join(' | ')}
        cols={[{ key: 'label', label: 'Label', w: '1.2fr' }, { key: 'from', label: 'From', type: 'num', w: '0.6fr' }, { key: 'to', label: 'To', type: 'num', w: '0.6fr' }, { key: 'style', label: 'Line', type: 'select', options: [['thin', 'Thin'], ['bold', 'Bold']], w: '0.8fr' }]}
        blank={() => ({ label: 'more', from: data.from, to: data.to, style: 'thin' })} addLabel="+ Add arrow" onText={(v, k) => set({ arrows: v }, k)} />
    </>
  ); },
  Render: ({ data }) => {
    const from = num(data.from, 0), to = num(data.to, 10), step = Math.abs(num(data.step, 1)) || 1;
    if (from === to) return <EmptyHint text="The scale needs different From and To values." />;
    const sc: any = { name: data.scaleName, from, to, step, minor: num(data.minor, 0) || undefined, format: data.format };
    if (data.format === 'named') { sc.labels = String(data.named || ''); sc.titlePos = data.scaleName ? 'start' : 'none'; }
    const items = lines(data.items).map(l => { const [label, v, mk] = cells(l); return { label, value: num(v, NaN), marker: mk === 'arrow' ? 'arrow' : undefined }; }).filter(i => isFinite(i.value));
    const zones = lines(data.zones).map(l => { const [label, a, b] = cells(l); return { label, from: num(a, NaN), to: num(b, NaN) }; }).filter(z => isFinite(z.from) && isFinite(z.to));
    const arrows = lines(data.arrows).map(l => { const [label, a, b, st] = cells(l); return { label, from: num(a, NaN), to: num(b, NaN), style: st === 'bold' ? 'bold' : 'thin' }; }).filter(z => isFinite(z.from) && isFinite(z.to));
    return <S.GradientBar x={0} y={0} length={num(data.length, 600)} thickness={num(data.thickness, 24)} orient={data.orient} flip={data.flip} palette={data.palette}
      bands={num(data.bands, 0) || undefined} dividers={data.dividers} outline={data.outline} fontSize={num(data.fontSize, 12)}
      startLabel={data.startLabel || undefined} endLabel={data.endLabel || undefined} scales={[sc]} items={items} zones={zones} arrows={arrows} />;
  },
};

