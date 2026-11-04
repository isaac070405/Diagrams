import { useEffect, useRef, useState } from 'react';
import { S } from '../sheet';
import { num, Range, RowX, Seg, startDrag, Swatches, Toggle, uid } from '../ui';
import type { EditProps } from '../shell';
import { fmt, panelGeo, SHEET_W } from './scalegeo';
import { plotRect, ProfileSvg, SplineSvg, splinePath, splineText, type ProfCtx } from './scalecurve';

export { fmt };

/* Graphics for the Scale bar editor, modelled on the Graphics tools of ZEN: a tool strip,
   an object list (show, lock, type, name), z-order, and burn-in on export.
   Every graphic is { id, type, p: number[], ...style }. p holds sheet-unit points:
   text [x,y]; line, arrow, rect, caliper [x1,y1,x2,y2]; circle [centre, point on edge];
   label [tip, text anchor]. */

export type XY = [number, number];
type Shape = any;


export const TOOLS: [string, string][] = [['select', 'Select'], ['text', 'Text'], ['bar', 'Scale bar'], ['line', 'Line'], ['arrow', 'Arrow'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['caliper', 'Caliper'], ['label', 'Label'], ['spline', 'Contour'], ['profile', 'Profile']];
const NEED: Record<string, number> = { text: 1, bar: 1, line: 2, arrow: 2, rect: 2, circle: 2, caliper: 2, label: 2, profile: 2 };
const TYPE_NAME: Record<string, string> = { text: 'Text', line: 'Line', arrow: 'Arrow', rect: 'Rectangle', circle: 'Circle', caliper: 'Caliper', label: 'Label', spline: 'Contour', profile: 'Profile' };
const HELP: Record<string, string> = {
  select: 'Click a graphic to select it, then drag it or its square handles.',
  text: 'Click where the text goes.',
  bar: 'Click where the scale bar goes.',
  line: 'Click the start, then the end.',
  arrow: 'Click the tail, then the tip.',
  rect: 'Click one corner, then the opposite corner.',
  circle: 'Click the centre, then a point on the edge.',
  caliper: 'Click the two ends of the structure. The length prints in calibrated units.',
  label: 'Click the structure, then where its name goes. A leader line joins them.',
  spline: 'Click points around the structure. Click the first point to close it, or double-click to end an open curve. Area and perimeter print in calibrated units.',
  profile: 'Click the start, then the end of a line across the image. A plot of brightness along it appears beside the line.',
};
const INKS = ['var(--ink)', 'var(--paper)', 'var(--accent-700)', 'var(--edge-feedback-neg)', 'var(--swatch-6)', 'var(--swatch-11)'];

const ink = (s: Shape) => s.color || 'var(--ink)';
const dashOf = (d?: string) => d === 'dashed' ? '6 4' : d === 'dotted' ? '1.5 3' : undefined;
const sizeOf = (s: Shape) => num(s.size, s.type === 'caliper' || s.type === 'spline' ? 13 : 14);
const textW = (t: string, size: number) => Math.max(1, ...String(t || '').split('\n').map(l => l.length)) * size * 0.56 + 8;

/* ---------- creating ---------- */
function make(tool: string, draft: XY[], shapes: Shape[]): Shape {
  const id = uid('g', shapes.map(s => s.id));
  const a = draft[0], b = draft[1] || draft[0];
  if (tool === 'text') return { id, type: 'text', p: [a[0], a[1]], text: 'Text', size: 16 };
  if (tool === 'label') return { id, type: 'label', p: [a[0], a[1], b[0], b[1]], text: 'Structure', size: 15, width: 1.8, head: true };
  if (tool === 'arrow') return { id, type: 'arrow', p: [a[0], a[1], b[0], b[1]], width: 2, head: true };
  if (tool === 'caliper') return { id, type: 'caliper', p: [a[0], a[1], b[0], b[1]], width: 2, showValue: true };
  if (tool === 'profile') return { id, type: 'profile', p: [a[0], a[1], b[0], b[1]], width: 2, dx: 12, dy: 12, pw: 190, ph: 84, channel: 'luma', smooth: 3 };
  return { id, type: tool, p: [a[0], a[1], b[0], b[1]], width: 2 };
}

/* a click on the sheet: collect points until the tool has enough, then add the graphic */
export function gfxClick(d: any, pt: XY) {
  const tool = d.tool || 'select', n = NEED[tool];
  if (tool === 'spline') {
    const draft = [...(d.draft || []), [Math.round(pt[0]), Math.round(pt[1])]] as XY[], k = draft.length, q = draft[k - 1];
    if (k >= 4 && Math.hypot(q[0] - draft[0][0], q[1] - draft[0][1]) < 9) return finishSpline({ ...d, draft: draft.slice(0, -1) }, true);
    if (k >= 3 && Math.hypot(q[0] - draft[k - 2][0], q[1] - draft[k - 2][1]) < 4) return finishSpline({ ...d, draft: draft.slice(0, -1) }, false);
    return { draft };
  }
  if (!n || tool === 'bar') return null;
  const draft = [...(d.draft || []), [Math.round(pt[0]), Math.round(pt[1])]] as XY[];
  if (draft.length < n) return { draft };
  const shapes = d.shapes || [];
  return { tool: d.keep ? tool : 'select', draft: [], shapes: [...shapes, make(tool, draft, shapes)] };
}

/* end a contour: closed joins the last point to the first */
export function finishSpline(d: any, closed: boolean) {
  const draft: XY[] = d.draft || [];
  if (draft.length < (closed ? 3 : 2)) return null;
  const shapes = d.shapes || [];
  return { tool: d.keep ? 'spline' : 'select', draft: [], shapes: [...shapes, { id: uid('g', shapes.map((q: any) => q.id)), type: 'spline', p: draft.flat(), closed, tn: 1, width: 2, showDim: true }] };
}

/* old sheets kept measurements as bare lines: they become calipers */
export function migrate(d: any) {
  let o = d;
  if (o.measures || o.pts || o.measuring != null || o.measureColor) {
    const shapes = [...(o.shapes || [])];
    (o.measures || []).forEach((q: number[]) => shapes.push({ id: uid('g', shapes.map(s => s.id)), type: 'caliper', p: q.map(Math.round), width: 2, showValue: true, color: o.measureColor }));
    const { measures, pts, measuring, measureColor, ...rest } = o;
    o = { ...rest, shapes };
  }
  return { ...o, shapes: o.shapes || [], tool: 'select', draft: [] };
}

export function moveShape(s: Shape, dx: number, dy: number): Shape {
  return { ...s, p: s.p.map((v: number, i: number) => Math.round(v + (i % 2 ? dy : dx))) };
}
export function lastRuler(shapes: Shape[]) {
  for (let i = shapes.length - 1; i >= 0; i--) if (shapes[i].type === 'caliper' || shapes[i].type === 'line') return shapes[i];
  return null;
}
const lengthOf = (s: Shape) => Math.hypot(s.p[2] - s.p[0], s.p[3] - s.p[1]);

/* what the graphic measures, in calibrated units */
function dimText(s: Shape, ppu: number, unit: string): string | null {
  if (s.type === 'spline') return splineText(s, ppu, unit);
  if (s.type === 'caliper' || s.type === 'line' || s.type === 'profile') return fmt(lengthOf(s) / ppu) + ' ' + unit;
  if (s.type === 'circle') return 'Ø ' + fmt(2 * lengthOf(s) / ppu) + ' ' + unit;
  if (s.type === 'rect') return fmt(Math.abs(s.p[2] - s.p[0]) / ppu) + ' × ' + fmt(Math.abs(s.p[3] - s.p[1]) / ppu) + ' ' + unit;
  return null;
}
export const shapeName = (shapes: Shape[], i: number) => shapes[i].name ?? TYPE_NAME[shapes[i].type] + ' ' + (shapes.slice(0, i + 1).filter(q => q.type === shapes[i].type).length);

export function reorder(shapes: Shape[], id: string, mode: 'front' | 'forward' | 'backward' | 'back') {
  const i = shapes.findIndex(s => s.id === id); if (i < 0) return shapes;
  const j = mode === 'front' ? shapes.length - 1 : mode === 'back' ? 0 : mode === 'forward' ? Math.min(shapes.length - 1, i + 1) : Math.max(0, i - 1);
  if (i === j) return shapes;
  const a = [...shapes]; const [it] = a.splice(i, 1); a.splice(j, 0, it); return a;
}

/* ---------- drawing ---------- */
function Head(p: { x: number; y: number; a: number; w: number; color: string }) {
  const hs = 8 + p.w * 1.5;
  return <path d={'M0,0 L' + (-hs) + ',' + hs * 0.45 + ' L' + (-hs) + ',' + (-hs * 0.45) + 'z'} transform={'translate(' + p.x + ',' + p.y + ') rotate(' + p.a * 180 / Math.PI + ')'} style={{ fill: p.color }} />;
}
/* the end of a line pulled back so the arrowhead tip lands on the point */
function Shaft(p: { s: Shape; head: boolean; style: any }) {
  const [x1, y1, x2, y2] = p.s.p, a = Math.atan2(y2 - y1, x2 - x1), hs = 8 + num(p.s.width, 2) * 1.5, k = p.head ? hs * 0.7 : 0;
  return <line x1={x1} y1={y1} x2={x2 - Math.cos(a) * k} y2={y2 - Math.sin(a) * k} style={p.style} />;
}
const halo = (size: number) => ({ stroke: 'var(--paper)', strokeWidth: size * 0.22, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const });

export function ShapeSvg({ s, ppu, unit, prof }: { s: Shape; ppu: number; unit: string; prof?: ProfCtx }) {
  const col = ink(s), w = num(s.width, 2), size = sizeOf(s);
  const st: any = { stroke: col, strokeWidth: w, strokeDasharray: dashOf(s.dash), fill: 'none' };
  const tst: any = { fill: col, fontSize: size + 'px', fontWeight: s.bold ? 700 : 400, ...(s.halo ? halo(size) : {}) };
  if (s.type === 'text') return (
    <text className="mk-note-text" x={s.p[0]} y={s.p[1]} style={tst}>
      {String(s.text || '').split('\n').map((l: string, i: number) => <tspan key={i} x={s.p[0]} dy={i ? size * 1.25 : 0}>{l}</tspan>)}
    </text>
  );
  if (s.type === 'spline') return <SplineSvg s={s} ppu={ppu} unit={unit} />;
  if (s.type === 'profile') return <ProfileSvg s={s} ppu={ppu} unit={unit} prof={prof} />;
  if (s.type === 'line') return <line x1={s.p[0]} y1={s.p[1]} x2={s.p[2]} y2={s.p[3]} style={st} />;
  if (s.type === 'arrow') { const head = s.head !== false; return <g><Shaft s={s} head={head} style={st} />{head ? <Head x={s.p[2]} y={s.p[3]} a={Math.atan2(s.p[3] - s.p[1], s.p[2] - s.p[0])} w={w} color={col} /> : null}</g>; }
  if (s.type === 'rect' || s.type === 'circle') {
    const fill = s.fill ? { fill: s.fill, fillOpacity: 0.35 } : {};
    const label = s.showDim ? dimText(s, ppu, unit) : null;
    if (s.type === 'rect') {
      const x = Math.min(s.p[0], s.p[2]), y = Math.min(s.p[1], s.p[3]);
      return <g><rect x={x} y={y} width={Math.abs(s.p[2] - s.p[0])} height={Math.abs(s.p[3] - s.p[1])} style={{ ...st, ...fill }} />
        {label ? <text className="mk-dim" x={x + Math.abs(s.p[2] - s.p[0]) / 2} y={y + Math.abs(s.p[3] - s.p[1]) / 2 + size * 0.35} style={{ ...tst, ...halo(size) }}>{label}</text> : null}</g>;
    }
    return <g><circle cx={s.p[0]} cy={s.p[1]} r={lengthOf(s)} style={{ ...st, ...fill }} />
      {label ? <text className="mk-dim" x={s.p[0]} y={s.p[1] + size * 0.35} style={{ ...tst, ...halo(size) }}>{label}</text> : null}</g>;
  }
  if (s.type === 'caliper') {
    const [x1, y1, x2, y2] = s.p, len = lengthOf(s) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len, c = 5 + w * 1.5;
    let nx = -uy, ny = ux; if (ny > 1e-6 || (Math.abs(ny) <= 1e-6 && nx < 0)) { nx = -nx; ny = -ny; }
    const off = c + size * 0.55, tx = (x1 + x2) / 2 + nx * off, ty = (y1 + y2) / 2 + ny * off + size * 0.35;
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} style={st} />
        <path d={'M' + (x1 + (-uy) * c) + ',' + (y1 + ux * c) + 'L' + (x1 - (-uy) * c) + ',' + (y1 - ux * c) + 'M' + (x2 + (-uy) * c) + ',' + (y2 + ux * c) + 'L' + (x2 - (-uy) * c) + ',' + (y2 - ux * c)} style={st} />
        {s.showValue !== false ? <text className="mk-dim" x={tx} y={ty} style={{ ...tst, ...halo(size), textAnchor: 'middle', fontWeight: 600 }}>{dimText(s, ppu, unit)}</text> : null}
      </g>
    );
  }
  if (s.type === 'label') {
    const [tipx, tipy, lx, ly] = s.p, left = lx <= tipx, head = s.head !== false;
    const sx = lx + (left ? 4 : -4), sy = ly - size * 0.32;
    const a = Math.atan2(tipy - sy, tipx - sx), hs = 8 + w * 1.5, k = head ? hs * 0.7 : 0;
    return (
      <g>
        <line x1={sx} y1={sy} x2={tipx - Math.cos(a) * k} y2={tipy - Math.sin(a) * k} style={st} />
        {head ? <Head x={tipx} y={tipy} a={a} w={w} color={col} /> : null}
        <text className="mk-note-text" x={lx} y={ly} style={{ ...tst, textAnchor: left ? 'end' : 'start' }}>{s.text}</text>
      </g>
    );
  }
  return null;
}

/* graphics sit in a .mk-notes group so the sheet never treats their words as diagram labels */
export function Shapes({ shapes, ppu, unit, prof }: { shapes: Shape[]; ppu: number; unit: string; prof?: ProfCtx }) {
  return <g className="mk-notes">{shapes.filter(s => !s.hidden).map(s => <ShapeSvg key={s.id} s={s} ppu={ppu} unit={unit} prof={prof} />)}</g>;
}

/* ---------- on the sheet: select, move, reshape, and a preview while drawing ---------- */
export function GfxOverlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: (x: number, y: number) => XY }) {
  const tool = data.tool || 'select', draft: XY[] = data.draft || [], shapes: Shape[] = data.shapes || [];
  const ppu = panelGeo(data, num(data.pw, SHEET_W), !!data.cropping).ppu;
  const [cur, setCur] = useState<XY | null>(null);
  const to = useRef(toSvg); to.current = toSvg;
  useEffect(() => {
    if (tool === 'select' || !draft.length) { setCur(null); return; }
    const f = (e: PointerEvent) => setCur(to.current(e.clientX, e.clientY));
    window.addEventListener('pointermove', f);
    return () => window.removeEventListener('pointermove', f);
  }, [tool, draft.length]);

  if (tool !== 'select') {
    const live = draft.length && cur && NEED[tool] === 2 && tool !== 'bar' ? make(tool, [draft[0], cur], [])
      : draft.length && cur && tool === 'spline' ? { id: 'live', type: 'spline', p: [...draft.flat(), Math.round(cur[0]), Math.round(cur[1])], closed: false, tn: 1, width: 2, showDim: false } : null;
    return (
      <g style={{ pointerEvents: 'none' }}>
        {tool === 'spline' && draft.length >= 3 ? <circle cx={draft[0][0]} cy={draft[0][1]} r={9} style={{ fill: 'none', stroke: 'var(--accent)', strokeWidth: 1.4 }} /> : null}
        {draft.map((q, i) => <circle key={i} className="mk-measure-pt" cx={q[0]} cy={q[1]} r={4} />)}
        {live ? <g style={{ opacity: 0.55 }}><ShapeSvg s={live} ppu={ppu} unit={data.unit} /></g> : null}
      </g>
    );
  }

  const up = (id: string, patch: any, key: string) => set({ shapes: shapes.map(s => s.id === id ? { ...s, ...patch } : s) }, key);
  return (
    <>
      {shapes.filter(s => !s.hidden && !s.locked).map(s => {
        const on = !!sel && sel.kind === 'shape' && sel.id === s.id, cls = (on ? ' mk-on' : ''), o = s;
        const pick = () => setSel({ kind: 'shape', id: s.id });
        const dragAll = (e: any) => { pick(); startDrag(e, toSvg, (dx, dy) => up(s.id, { p: moveShape(o, dx, dy).p }, 'g-move-' + s.id)); };
        const handle = (k: number) => <rect key={k} className="mk-handle" x={s.p[k] - 5} y={s.p[k + 1] - 5} width={10} height={10}
          onPointerDown={e => { pick(); startDrag(e, toSvg, (dx, dy) => { const p = [...o.p]; p[k] = Math.round(o.p[k] + dx); p[k + 1] = Math.round(o.p[k + 1] + dy); up(s.id, { p }, 'g-end-' + s.id + k); }); }} />;
        if (s.type === 'text') {
          const size = sizeOf(s), ls = String(s.text || '').split('\n');
          return <rect key={s.id} className={'mk-hit' + cls} x={s.p[0] - 4} y={s.p[1] - size} width={textW(s.text, size)} height={ls.length * size * 1.25 + 4} onPointerDown={dragAll} />;
        }
        if (s.type === 'rect') return (
          <g key={s.id}>
            <rect className={'mk-hit-line' + cls} x={Math.min(s.p[0], s.p[2])} y={Math.min(s.p[1], s.p[3])} width={Math.abs(s.p[2] - s.p[0])} height={Math.abs(s.p[3] - s.p[1])} style={s.fill ? { pointerEvents: 'all' } : undefined} onPointerDown={dragAll} />
            {on ? [handle(0), handle(2)] : null}
          </g>
        );
        if (s.type === 'circle') return (
          <g key={s.id}>
            <circle className={'mk-hit-line' + cls} cx={s.p[0]} cy={s.p[1]} r={lengthOf(s)} style={s.fill ? { pointerEvents: 'all' } : undefined} onPointerDown={dragAll} />
            {on ? handle(2) : null}
          </g>
        );
        if (s.type === 'label') {
          const size = sizeOf(s), w = textW(s.text, size), left = s.p[2] <= s.p[0];
          return (
            <g key={s.id}>
              <line className={'mk-hit-line' + cls} x1={s.p[0]} y1={s.p[1]} x2={s.p[2]} y2={s.p[3]} onPointerDown={dragAll} />
              <rect className={'mk-hit' + cls} x={left ? s.p[2] - w + 4 : s.p[2] - 4} y={s.p[3] - size} width={w} height={size * 1.3}
                onPointerDown={e => { pick(); startDrag(e, toSvg, (dx, dy) => { const p = [...o.p]; p[2] = Math.round(o.p[2] + dx); p[3] = Math.round(o.p[3] + dy); up(s.id, { p }, 'g-text-' + s.id); }); }} />
              {on ? [handle(0), handle(2)] : null}
            </g>
          );
        }
        if (s.type === 'spline') return (
          <g key={s.id}>
            <path className={'mk-hit-line' + cls} d={splinePath(s.p, !!s.closed, num(s.tn, 1))} style={s.closed && s.fill ? { pointerEvents: 'all' } : undefined} onPointerDown={dragAll} />
            {on ? s.p.map((_: number, k: number) => k % 2 === 0 ? handle(k) : null) : null}
          </g>
        );
        if (s.type === 'profile') {
          const R = plotRect(s);
          return (
            <g key={s.id}>
              <line className={'mk-hit-line' + cls} x1={s.p[0]} y1={s.p[1]} x2={s.p[2]} y2={s.p[3]} onPointerDown={dragAll} />
              {s.showPlot !== false ? <rect className={'mk-hit' + cls} x={R.x} y={R.y} width={R.w} height={R.h}
                onPointerDown={e => { pick(); startDrag(e, toSvg, (dx, dy) => up(s.id, { dx: Math.round(num(o.dx, 12) + dx), dy: Math.round(num(o.dy, 12) + dy) }, 'g-plot-' + s.id)); }} /> : null}
              {on ? [handle(0), handle(2)] : null}
              {on && s.showPlot !== false ? <rect className="mk-handle" x={R.x + R.w - 5} y={R.y + R.h - 5} width={10} height={10}
                onPointerDown={e => { pick(); startDrag(e, toSvg, (dx, dy) => up(s.id, { pw: Math.max(90, Math.round(R.w + dx)), ph: Math.max(50, Math.round(R.h + dy)) }, 'g-plotsize-' + s.id)); }} /> : null}
            </g>
          );
        }
        return (
          <g key={s.id}>
            <line className={'mk-hit-line' + cls} x1={s.p[0]} y1={s.p[1]} x2={s.p[2]} y2={s.p[3]} onPointerDown={dragAll} />
            {on ? [handle(0), handle(2)] : null}
          </g>
        );
      })}
    </>
  );
}

/* ---------- sidebar ---------- */
const Eye = (off: boolean) => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{off ? <path d="M4 20L20 4" /> : null}</svg>;
const Lock = (on: boolean) => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" />{on ? <path d="M8 11V7a4 4 0 0 1 8 0v4" /> : <path d="M8 11V7a4 4 0 0 1 7-2.6" />}</svg>;

export function GfxTools(p: EditProps) {
  const { data, set, setSel } = p, tool = data.tool || 'select', shapes: Shape[] = data.shapes || [];
  const ref = useRef(p); ref.current = p;
  /* Esc drops the tool and any half-drawn graphic */
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const q = ref.current.data, el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const drafting = (q.tool || 'select') === 'spline' && (q.draft || []).length > 0;
      if (e.key === 'Escape') { if ((q.tool || 'select') !== 'select' || (q.draft || []).length) ref.current.set({ tool: 'select', draft: [] }); }
      else if (e.key === 'Enter' && drafting) { const r = finishSpline(q, false); if (r) ref.current.set(r); }
      else if (e.key === 'Backspace' && drafting) { e.preventDefault(); ref.current.set({ draft: q.draft.slice(0, -1) }); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
  /* a graphic just drawn is selected, so its text and style are one click away */
  const prev = useRef({ n: shapes.length, tool });
  useEffect(() => {
    if (shapes.length > prev.current.n && prev.current.tool !== 'select') setSel({ kind: 'shape', id: shapes[shapes.length - 1].id });
    prev.current = { n: shapes.length, tool };
  }, [shapes.length, tool]);
  return (
    <S.Panel kicker="Graphics" help={HELP[tool]}>
      <Seg wrap value={tool} options={TOOLS} onChange={v => { set({ tool: v, draft: [] }); setSel(null); }} />
      <Toggle on={!!data.keep} label="Keep tool" onChange={v => set({ keep: v })} />
      {tool === 'spline' && (data.draft || []).length ? (
        <div className="sd-row-btns">
          <S.ToolButton compact disabled={data.draft.length < 3} onClick={() => { const r = finishSpline(data, true); if (r) set(r); }}>Close contour</S.ToolButton>
          <S.ToolButton compact disabled={data.draft.length < 2} onClick={() => { const r = finishSpline(data, false); if (r) set(r); }} title="Enter">Finish open</S.ToolButton>
          <S.ToolButton compact onClick={() => set({ draft: data.draft.slice(0, -1) })} title="Backspace">Undo point</S.ToolButton>
        </div>
      ) : null}
    </S.Panel>
  );
}

interface RowP { on: boolean; type: string; hidden?: boolean; locked?: boolean; name: string; onPick: () => void; onHide: () => void; onLock: () => void; onName?: (v: string) => void; onRemove?: () => void }
function GlRow(p: RowP) {
  return (
    <div className="mk-gl-row" data-on={p.on ? '1' : '0'} data-off={p.hidden ? '1' : '0'}>
      <button type="button" className="mk-gl-ico" aria-pressed={!p.hidden} aria-label={(p.hidden ? 'Show ' : 'Hide ') + p.name} title={p.hidden ? 'Show' : 'Hide'} onClick={p.onHide}>{Eye(!!p.hidden)}</button>
      <button type="button" className="mk-gl-ico" aria-pressed={!!p.locked} aria-label={(p.locked ? 'Unlock ' : 'Lock ') + p.name} title={p.locked ? 'Unlock' : 'Lock'} onClick={p.onLock}>{Lock(!!p.locked)}</button>
      <button type="button" className="mk-gl-type" onClick={p.onPick}>{p.type}</button>
      {p.onName
        ? <input className="sd-input mk-gl-name" aria-label={'Name of ' + p.type} placeholder="Name" value={p.name} onFocus={p.onPick} onChange={e => p.onName!(e.target.value)} />
        : <button type="button" className="mk-gl-name mk-gl-fixed" onClick={p.onPick}>{p.name}</button>}
      {p.onRemove ? <RowX label={p.name} onRemove={p.onRemove} /> : <span />}
    </div>
  );
}

export function GfxList({ data, set, sel, setSel }: EditProps) {
  const shapes: Shape[] = data.shapes || [];
  const on = (kind: string, id: string) => !!sel && sel.kind === kind && sel.id === id;
  const upd = (id: string, patch: any, key?: string) => set({ shapes: shapes.map(s => s.id === id ? { ...s, ...patch } : s) }, key);
  return (
    <S.Panel kicker="Graphics list" help="Eye shows or hides a graphic, padlock stops it moving. Lower rows draw on top.">
      <div className="mk-gl">
        <div className="mk-gl-head"><span>Show</span><span>Lock</span><span>Type</span><span>Name</span><span /></div>
        <GlRow on={on('bar', 'bar')} type="Scale bar" name={'Scale bar, ' + fmt(num(data.bar, 50)) + ' ' + data.unit} hidden={data.barHidden} locked={data.barLocked}
          onPick={() => setSel({ kind: 'bar', id: 'bar' })} onHide={() => set({ barHidden: !data.barHidden })} onLock={() => set({ barLocked: !data.barLocked })} />
        {shapes.map((s, i) => (
          <GlRow key={s.id} on={on('shape', s.id)} type={TYPE_NAME[s.type]} name={shapeName(shapes, i)} hidden={s.hidden} locked={s.locked}
            onPick={() => setSel({ kind: 'shape', id: s.id })} onHide={() => upd(s.id, { hidden: !s.hidden })} onLock={() => upd(s.id, { locked: !s.locked })} onName={v => upd(s.id, { name: v }, 'g-name-' + s.id)}
            onRemove={() => { set({ shapes: shapes.filter(q => q.id !== s.id) }); if (on('shape', s.id)) setSel(null); }} />
        ))}
        {!shapes.length ? <p className="mk-note">No graphics yet. Pick a tool above and click the image.</p> : null}
      </div>
    </S.Panel>
  );
}

export function GfxSelected({ data, set, sel }: EditProps) {
  const shapes: Shape[] = data.shapes || [];
  const i = sel && sel.kind === 'shape' ? shapes.findIndex(s => s.id === sel.id) : -1;
  if (i < 0) return null;
  const s = shapes[i], ppu = panelGeo(data, num(data.pw, SHEET_W), !!data.cropping).ppu;
  const upd = (patch: any, key?: string) => set({ shapes: shapes.map(q => q.id === s.id ? { ...q, ...patch } : q) }, key);
  const isText = s.type === 'text' || s.type === 'label', dim = dimText(s, ppu, data.unit);
  const to = (m: 'front' | 'forward' | 'backward' | 'back') => set({ shapes: reorder(shapes, s.id, m) });
  return (
    <S.Panel kicker={'Selected ' + TYPE_NAME[s.type].toLowerCase()} help={s.locked ? 'Locked: unlock it in the Graphics list to move or delete it.' : 'Drag it on the sheet. Squares move its ends. Delete removes it.'}>
      {dim && s.type !== 'text' ? <p className="mk-note">{dim}</p> : null}
      {isText ? <S.Field id="gs-text" label="Text" multiline={s.type === 'text'} rows={2} value={s.text} onChange={(e: any) => upd({ text: e.target.value }, 'gs-text-' + s.id)} /> : null}
      {isText || s.type === 'caliper' || s.type === 'spline' ? <Range id="gs-size" label="Text size" value={num(s.size, sizeOf(s))} min={8} max={60} onChange={v => upd({ size: v }, 'gs-size-' + s.id)} /> : null}
      {isText ? <Toggle on={!!s.bold} label="Bold" onChange={v => upd({ bold: v })} /> : null}
      {isText ? <Toggle on={!!s.halo} label="White outline on text" onChange={v => upd({ halo: v })} /> : null}
      {s.type !== 'text' ? <Range id="gs-w" label="Line width" value={num(s.width, 2)} min={0.5} max={8} step={0.5} onChange={v => upd({ width: v }, 'gs-w-' + s.id)} /> : null}
      {s.type !== 'text' && s.type !== 'caliper' ? <Seg value={s.dash || ''} options={[['', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']]} onChange={v => upd({ dash: v || undefined })} /> : null}
      <Swatches label={isText ? 'Text and line colour' : 'Colour'} value={s.color} colors={INKS} none="Ink" onChange={v => upd({ color: v })} />
      {s.type === 'spline' && s.closed ? <Swatches label="Fill" value={s.fill} colors={INKS} none="No fill" onChange={v => upd({ fill: v })} /> : null}
      {s.type === 'rect' || s.type === 'circle' ? <Swatches label="Fill" value={s.fill} colors={INKS} none="No fill" onChange={v => upd({ fill: v })} /> : null}
      {s.type === 'arrow' || s.type === 'label' ? <Toggle on={s.head !== false} label="Arrowhead" onChange={v => upd({ head: v })} /> : null}
      {s.type === 'spline' ? <>
        <Toggle on={!!s.closed} label="Closed contour" onChange={v => upd({ closed: v && s.p.length >= 6 })} />
        <Range id="gs-tn" label="Smoothness %" value={Math.round(num(s.tn, 1) * 100)} min={0} max={100} onChange={v => upd({ tn: v / 100 }, 'gs-tn-' + s.id)} />
        <Toggle on={s.showDim !== false} label={s.closed ? 'Show area and perimeter' : 'Show length'} onChange={v => upd({ showDim: v })} />
      </> : null}
      {s.type === 'profile' ? <>
        <Seg value={s.channel || 'luma'} options={[['luma', 'Brightness'], ['r', 'Red'], ['g', 'Green'], ['b', 'Blue']]} onChange={v => upd({ channel: v })} />
        <Range id="gs-sm" label="Smoothing" value={num(s.smooth, 3)} min={0} max={15} onChange={v => upd({ smooth: v }, 'gs-sm-' + s.id)} />
        <Toggle on={s.showPlot !== false} label="Show plot" onChange={v => upd({ showPlot: v })} />
      </> : null}
      {s.type === 'caliper' ? <Toggle on={s.showValue !== false} label="Show length" onChange={v => upd({ showValue: v })} /> : null}
      {s.type === 'rect' || s.type === 'circle' ? <Toggle on={!!s.showDim} label={s.type === 'circle' ? 'Show diameter' : 'Show size'} onChange={v => upd({ showDim: v })} /> : null}
      <div className="sd-row-btns">
        <S.ToolButton compact disabled={i === shapes.length - 1} onClick={() => to('front')} title="Bring to front">Front</S.ToolButton>
        <S.ToolButton compact disabled={i === shapes.length - 1} onClick={() => to('forward')} title="Bring forward">Forward</S.ToolButton>
        <S.ToolButton compact disabled={i === 0} onClick={() => to('backward')} title="Send backward">Backward</S.ToolButton>
        <S.ToolButton compact disabled={i === 0} onClick={() => to('back')} title="Send to back">Back</S.ToolButton>
      </div>
    </S.Panel>
  );
}

