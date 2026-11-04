import { useEffect } from 'react';
import { S } from '../sheet';
import { cells, EmptyHint, lines, num, Range, RowsText, Seg, Spec, startDrag, Swatches, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';
import { SAMPLE } from './boneSample';
import { AdjFilter, AdjPanel, adjOf, isNeutral } from './scaleadj';
import { apply, fovFor, inv, layout, letterOf, mul, panelGeo, SHEET_W, sameM, type M } from './scalegeo';
import { CropOverlay, CropPanel, GridPanel, GridSvg, PanelsPanel } from './scalepanels';
import { useImageData } from './scalecurve';
import { fmt, GfxList, GfxOverlay, GfxSelected, GfxTools, gfxClick, lastRuler, migrate, moveShape, Shapes } from './scalegfx';

/* ===================== 10 Histological image ===================== */
/* The sheet holds panels. Each panel is a micrograph with its own calibration, crop, scale bar and graphics.
   Panel components receive a "view": the panel's fields plus the shared tool state and the panel width (pw). */
const D = SHEET_W;
const resolveImg = (img: any) => img === 'sample:artery' ? SAMPLE : img;
function sb(d: any) {
  const pw = num(d.pw, SHEET_W), g = panelGeo(d, pw, !!d.cropping);
  return { H: g.ph, ppu: g.ppu, len: num(d.bar, 50) * g.ppu, pw, g };
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
  return { x: left ? m + 10 : g.pw - m - 10 - len, y: top ? m + 8 : g.H - m - bh + 8, len, th, fs, bh, g };
}

function PanelRender({ data, id }: { data: any; id: number }) {
  const b = barBox(data), g = b.g, img = resolveImg(data.img), pw = g.pw, ph = g.H;
  const color = data.barColor || 'var(--ink)', above = data.labelPos === 'above';
  const ty = above ? b.y - 6 : b.y + b.th + b.fs + 2;
  const a = adjOf(data), adj = isNeutral(a) ? null : a, clip = 'sb-clip-' + id, fid = 'sb-adj-' + id;
  const size = num(data.letterSize, 26);
  const pix = useImageData(img), prof = { inv: inv(g.g.m), img: pix, iw: g.g.iw, ih: g.g.ih };
  return (
    <g>
      <rect className="mk-panel-bg" x={0} y={0} width={pw} height={ph} style={{ fill: 'var(--paper)' }} />
      <g data-clip="1" clipPath={'url(#' + clip + ')'}>
        <defs><clipPath id={clip}><rect x={0} y={0} width={pw} height={ph} /></clipPath>{adj ? <AdjFilter id={fid} a={adj} w={pw} h={ph} /> : null}</defs>
        <g filter={adj ? 'url(#' + fid + ')' : undefined}>
          <g transform={'matrix(' + g.g.m.map(v => +v.toFixed(6)).join(' ') + ')'}>
            {img ? <image href={img} x={0} y={0} width={g.g.iw} height={g.g.ih} preserveAspectRatio="none" />
              : <g transform={'scale(' + g.g.iw / D + ')'}><ExampleImage H={D * g.g.ih / g.g.iw} /></g>}
          </g>
        </g>
        <GridSvg d={data} ppu={g.ppu} pw={pw} ph={ph} />
      </g>
      <Shapes shapes={data.shapes || []} ppu={g.ppu} unit={data.unit} prof={prof} />
      {data.barHidden ? null : <>
        {data.plate ? <rect x={b.x - 10} y={(above ? b.y - b.fs - 12 : b.y - 8)} width={b.len + 20} height={b.bh} className="mk-plate" style={{ fill: data.plateColor || undefined }} /> : null}
        <rect x={b.x} y={b.y} width={b.len} height={b.th} style={{ fill: color }} />
        <text className="mk-bar-label" x={b.x + b.len / 2} y={ty} style={{ fill: color, fontSize: b.fs + 'px', fontWeight: data.barBold ? 700 : 400 }}>{fmt(num(data.bar, 50)) + ' ' + data.unit}</text>
      </>}
      {data.letter ? <text className="mk-panel-letter" x={10} y={10 + size * 0.8} style={{ fill: 'var(--ink)', fontSize: size + 'px', fontWeight: 700, stroke: 'var(--paper)', strokeWidth: size * 0.16, paintOrder: 'stroke' }}>{data.letter}</text> : null}
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

function ScaleControls(p: EditProps & { top: EditProps }) {
  const { data, set, sel, top } = p;
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
      <PanelsPanel {...top} />
      <S.Panel kicker="Image" help="Large photos are reduced to 1600 px on the longest side. This replaces the image of the selected panel.">
        <label className="sd-tbtn mk-upload">Upload micrograph<input type="file" accept="image/png,image/jpeg,image/webp" hidden
          onChange={(e: any) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) readImage(f, (img, w, h) => set({ img, imgW: w, imgH: h, shapes: [], draft: [], adj: undefined, crop: undefined, q: 0, ang: 0, flipX: false, flipY: false, bx: undefined, by: undefined }), () => set({})); }} /></label>
        {data.img !== 'sample:artery' ? <S.ToolButton onClick={() => set({ img: 'sample:artery', imgW: 1182, imgH: 665, fov: 1800, unit: 'µm', shapes: [], draft: [], adj: undefined, crop: undefined, q: 0, ang: 0, flipX: false, flipY: false, bx: undefined, by: undefined })}>Use the artery example</S.ToolButton> : null}
      </S.Panel>
      <CropPanel {...p} />
      <AdjPanel {...p} />
      <GridPanel {...p} />
      <S.Panel kicker="Calibration" help="The width of the whole image in real units, from your microscope's field of view or a stage micrometer. A crop or turn keeps it valid.">
        <div className="mk-pair">
          <S.Field id="sb-fov" label="Image width" value={data.fov} onChange={(e: any) => set({ fov: e.target.value }, 'fov')} />
          <S.Field id="sb-unit" label="Unit" value={data.unit} placeholder="e.g. µm" onChange={(e: any) => set({ unit: e.target.value }, 'unit')} />
        </div>
        {ruler ? <S.Field id="sb-known" label={(picked && ruler === picked ? 'Selected ' + ruler.type : 'Last caliper or line') + ' is really…'} placeholder={'e.g. 7.5 (' + data.unit + ')'} value=""
          onChange={(e: any) => { const v = parseFloat(e.target.value); if (v > 0) { const px = Math.hypot(ruler.p[2] - ruler.p[0], ruler.p[3] - ruler.p[1]); set({ fov: fovFor(data, g.pw, px, v) }, 'cal'); } }}
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

/* ---------- panels: routing between the sheet's data and one panel's view ---------- */
const TOP = new Set(['tool', 'draft', 'keep', 'active', 'cols', 'gap', 'letters', 'letterSize', 'cropping', 'panels']);
const PANEL0 = { shapes: [] as any[] };
const TOP0 = { active: 0, cols: 1, gap: 12, letters: '', letterSize: 26, tool: 'select', keep: false, draft: [] as any[], cropping: false };

function viewOf(d: any, i: number, L: ReturnType<typeof layout>) {
  return { ...d.panels[i], tool: d.tool, draft: i === L.active ? d.draft : [], keep: d.keep, cropping: !!d.cropping && i === L.active, pw: L.pw, letter: d.panels.length > 1 || d.letters ? letterOf(i, d.letters) : '', letterSize: d.letterSize };
}

/* a patch from a panel component, or a change to the sheet itself, becomes a change to the sheet's data.
   When the picture or the panel size changes, graphics are carried with the image, so they stay on the same cells. */
function route(d: any, patch: any, i: number = d.active) {
  const top: any = {}, pp: any = {};
  for (const k of Object.keys(patch)) (TOP.has(k) ? top : pp)[k] = patch[k];
  let panels: any[] = top.panels || d.panels;
  if (Object.keys(pp).length) { const k = top.panels ? Math.min(top.active ?? i, panels.length - 1) : i; panels = panels.map((q, j) => j === k ? { ...q, ...pp } : q); }
  const oL = layout(d), nL = layout({ ...d, ...top, panels });
  const old = new Map<string, { q: any; g: any }>(d.panels.map((q: any, j: number) => [q.pid, { q, g: oL.boxes[j].g }]));
  const view = (q: any) => JSON.stringify([q.q || 0, q.ang || 0, !!q.flipX, !!q.flipY, q.crop || null]);
  const pts = (A: M, a: number[]) => { const o: number[] = []; for (let k = 0; k < a.length; k += 2) { const [x, y] = apply(A, a[k], a[k + 1]); o.push(Math.round(x), Math.round(y)); } return o; };
  let moved = false;
  panels = panels.map((q, j) => {
    const was = old.get(q.pid), ng = nL.boxes[j].g; if (!was || sameM(was.g.m, ng.m)) return q;
    moved = true;
    const A = mul(ng.m, inv(was.g.m)), o = { ...q, shapes: (q.shapes || []).map((sh: any) => ({ ...sh, p: pts(A, sh.p) })) };
    if (view(was.q) === view(q)) { if (q.bx != null) { o.bx = Math.round(q.bx * nL.pw / oL.pw); o.by = Math.round(q.by * ng.ph / was.g.ph); } }
    else { o.bx = undefined; o.by = undefined; }
    return o;
  });
  return { ...top, panels, ...(moved ? { draft: [] } : {}) };
}

/* a click on the sheet with a tool: the panel under the pointer gets it, unless a graphic is half drawn */
function sheetClick(d: any, pt: [number, number]) {
  const tool = d.tool || 'select';
  if (tool === 'select' || d.cropping) return null;
  const L = layout(d);
  let i = L.active;
  if (!(d.draft || []).length) {
    i = L.boxes.findIndex(b => pt[0] >= b.x && pt[0] <= b.x + b.w && pt[1] >= b.y && pt[1] <= b.y + b.h);
    if (i < 0) return null;
  }
  const b = L.boxes[i], lp: [number, number] = [pt[0] - b.x, pt[1] - b.y], v = viewOf(d, i, L);
  const patch = tool === 'bar'
    ? { bx: Math.round(lp[0] - sb(v).len / 2), by: Math.round(lp[1]), barHidden: false, barLocked: false, tool: d.keep ? 'bar' : 'select', draft: [] }
    : gfxClick(v, lp);
  return patch ? { ...route(d, patch, i), active: i } : null;
}

function MultiOverlay(p: EditProps & { toSvg: (x: number, y: number) => [number, number] }) {
  const { data, set, toSvg, setSel } = p;
  const L = layout(data), i = L.active, b = L.boxes[i], view = viewOf(data, i, L);
  const pset = (patch: any, key?: string) => set(route(data, patch, i), key);
  const local = (x: number, y: number): [number, number] => { const q = toSvg(x, y); return [q[0] - b.x, q[1] - b.y]; };
  const picking = (data.tool || 'select') === 'select' && !data.cropping;
  return (
    <>
      {L.boxes.length > 1 ? L.boxes.map((bx, j) => j === i
        ? <rect key={j} className="mk-panel-on" x={bx.x} y={bx.y} width={bx.w} height={bx.h} />
        : picking ? <rect key={j} className="mk-panel-pick" x={bx.x} y={bx.y} width={bx.w} height={bx.h}
          onPointerDown={e => { e.stopPropagation(); set({ active: j }); setSel(null); }} /> : null) : null}
      <g transform={'translate(' + b.x + ',' + b.y + ')'}>
        {data.cropping ? <CropOverlay {...p} data={view} set={pset} toSvg={local} /> : <ScaleOverlay {...p} data={view} set={pset} toSvg={local} />}
      </g>
    </>
  );
}

function MultiControls(p: EditProps) {
  const { data, set, setSel } = p;
  const L = layout(data), i = L.active, view = viewOf(data, i, L);
  const pset = (patch: any, key?: string) => set(route(data, patch, i), key);
  const top = { ...p, set: (patch: any, key?: string) => set(route(data, patch), key) };
  useEffect(() => { setSel(null); }, [i]);
  return <ScaleControls {...p} data={view} set={pset} top={top} />;
}

function MultiRender({ data }: { data: any }) {
  const L = layout(data);
  return <g>{L.boxes.map((b, i) => <g key={data.panels[i].pid} transform={'translate(' + b.x + ',' + b.y + ')'}><PanelRender data={viewOf(data, i, L)} id={i} /></g>)}</g>;
}

/* the old single-image sheets and the new panel sheets both load as panel sheets */
function toPanels(d: any) {
  const base = d.img && typeof d.img === 'string' && d.img === SAMPLE ? { ...d, img: 'sample:artery' } : d;
  let o: any;
  if (Array.isArray(base.panels)) o = { ...TOP0, ...base, panels: base.panels.map((q: any) => migrate(q)) };
  else {
    const { tool, draft, keep, ...panel } = migrate(base);
    void tool; void draft;
    o = { ...TOP0, panels: [panel], keep: !!keep };
  }
  const taken: string[] = [];
  o.panels = o.panels.map((q: any, j: number) => { const { tool, draft, ...r } = q; void tool; void draft; let pid = r.pid; while (!pid || taken.includes(pid)) pid = 'p' + (j + 1 + taken.length + 100); taken.push(pid); return { ...PANEL0, ...r, pid }; });
  return { ...o, tool: 'select', draft: [], cropping: false, active: Math.max(0, Math.min(o.panels.length - 1, num(o.active, 0))) };
}
const sheetOf = (panels: any[], extra: any = {}) => toPanels({ ...TOP0, panels, ...extra });

/* the artery example, annotated the way ZEN figures are: leader labels and calipers (points are sheet units on the 800 px wide image) */
const L = (id: string, text: string, p: number[]) => ({ id, type: 'label', p, text, size: 15, width: 1.6, head: true, halo: true });
const C = (id: string, p: number[]) => ({ id, type: 'caliper', p, width: 2, showValue: true, halo: true });
const ARTERY_GFX = [
  C('g1', [352, 240, 410, 240]), C('g2', [324, 200, 356, 200]),
  L('g3', 'tunica adventitia', [286, 190, 226, 160]), L('g4', 'tunica media', [322, 262, 226, 300]), L('g5', 'lumen', [380, 290, 226, 372]),
];
const ARTERY = { img: 'sample:artery', imgW: 1182, imgH: 665, fov: 1800, unit: 'µm', bar: 200, corner: 'bl', plate: true };
const EXTRA = (shapes: any[] = []) => ({ shapes });

export const scalebar: EditorDef = {
  id: 'scale-bar', num: '10', name: 'Histological image', field: 'Cells and measurement',
  blurb: 'Annotate your own micrographs: calibrated scale bars, a ZEN-style graphics toolbar, contours and profiles, multi-panel figures, crop and rotate, stain adjustment and a calibrated grid.',
  hint: 'Pick a tool in Graphics, then click the image. Add panels for a multi-panel figure, then click a panel on the sheet to edit it.',
  normalize: toPanels,
  templates: [
    { name: 'Muscular artery', desc: 'Cross-section with labelled wall layers and a lumen caliper', title: 'Muscular artery in cross-section',
      caption: 'Smooth muscle of the tunica media surrounds the lumen; collagen of the tunica adventitia lies outside it.',
      data: sheetOf([{ ...ARTERY, ...EXTRA(ARTERY_GFX) }]) },
    { name: 'Overview and detail', desc: 'Two panels: whole vessel, then a cropped close-up', title: 'Muscular artery: overview and detail',
      caption: 'A, whole cross-section; the box marks the region enlarged in B. Both bars are calibrated to the same micrograph.',
      data: sheetOf([
        { ...ARTERY, bar: 500, ...EXTRA([{ id: 'g1', type: 'rect', p: [118, 33, 276, 188], width: 1.6, color: 'var(--paper)' }]) },
        { ...ARTERY, bar: 100, crop: { l: 0.3, r: 0.3, t: 0.15, b: 0.15 }, corner: 'br', ...EXTRA() },
      ], { cols: 2, letters: 'A', active: 1 }) },
    { name: 'Light microscope', desc: 'Drawn example field, 100 µm bar', title: 'Onion epidermis, 40× objective', data: sheetOf([{ img: null, imgW: 1200, imgH: 800, fov: 450, unit: 'µm', bar: 100, corner: 'br', plate: true }]) },
    { name: 'Electron micrograph', desc: '2 µm field, 500 nm bar', title: 'Mitochondrion, TEM', data: sheetOf([{ img: null, imgW: 1200, imgH: 900, fov: 2000, unit: 'nm', bar: 500, corner: 'bl', plate: true }]) }
  ],
  Controls: MultiControls,
  Overlay: MultiOverlay,
  sheetClick,
  blank: sheetOf([{ img: null, imgW: 1200, imgH: 800, fov: 500, unit: 'µm', bar: 100, corner: 'br', plate: true }]),
  nudge: (d, sel, dx, dy) => {
    const L = layout(d), i = L.active, v = viewOf(d, i, L);
    if (sel.kind === 'bar') { if (v.barLocked) return null; const b = barBox(v); return route(d, { bx: b.x + dx, by: b.y + dy }); }
    if (sel.kind === 'shape') { const s = (v.shapes || []).find((q: any) => q.id === sel.id); return s && !s.locked ? route(d, { shapes: v.shapes.map((q: any) => q === s ? moveShape(s, dx, dy) : q) }) : null; }
    return null;
  },
  findText: (d, text) => { const v = viewOf(d, layout(d).active, layout(d)); return text.endsWith(' ' + v.unit) && text.startsWith(fmt(num(v.bar, 50))) ? { kind: 'bar', id: 'bar' } : null; },
  remove: (d, sel) => {
    const v = viewOf(d, layout(d).active, layout(d));
    if (sel.kind === 'bar') return v.barLocked ? null : route(d, { barHidden: true });
    if (sel.kind === 'shape') { const s = (v.shapes || []).find((q: any) => q.id === sel.id); return s && !s.locked ? route(d, { shapes: v.shapes.filter((q: any) => q !== s) }) : null; }
    return null;
  },
  duplicate: (d, sel) => {
    if (sel.kind !== 'shape') return null;
    const v = viewOf(d, layout(d).active, layout(d)), shapes = v.shapes || [], s = shapes.find((q: any) => q.id === sel.id); if (!s) return null;
    let n = shapes.length + 1; while (shapes.some((q: any) => q.id === 'g' + n)) n++;
    const c = { ...moveShape(s, 16, 16), id: 'g' + n, name: undefined, locked: false };
    return { patch: route(d, { shapes: [...shapes, c] }), sel: { kind: 'shape', id: c.id } };
  },
  Render: ({ data }) => <MultiRender data={data} />,
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

