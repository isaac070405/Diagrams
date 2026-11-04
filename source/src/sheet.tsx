import { useEffect, useLayoutEffect, useRef, useState } from 'react';
export const S: any = (window as any).SciDiagram;
/* While something is dragged the sheet keeps its frame, so pointer maths stay stable. */
export const dragState = { on: false, listeners: new Set<() => void>() };

const M = 24;

function wrap(text: string, width: number, px: number): string[] {
  const max = Math.max(20, Math.floor(width / (px * 0.52)));
  const out: string[] = [];
  for (const para of String(text || '').split(/\n/)) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if ((line + ' ' + w).trim().length > max) { if (line) out.push(line); line = w; }
      else line = (line + ' ' + w).trim();
    }
    if (line) out.push(line);
  }
  return out;
}

/* ---------- notes: text, arrows, boxes and ellipses any diagram can carry ---------- */
export function Notes(p: { notes: any[] }) {
  return (
    <g className="mk-notes">
      {(p.notes || []).map(n => {
        const st: any = { stroke: n.color || 'var(--ink)', strokeWidth: n.width || 1.5, strokeDasharray: n.dash === 'dashed' ? '6 4' : n.dash === 'dotted' ? '1.5 3' : undefined };
        if (n.kind === 'text') return <text key={n.id} className="mk-note-text" x={n.x} y={n.y} style={{ fill: n.color || 'var(--ink)', fontSize: (n.size || 14) + 'px', fontWeight: n.bold ? 700 : 400, fontStyle: n.italic ? 'italic' : undefined }}>
          {String(n.text || '').split('\n').map((l: string, i: number) => <tspan key={i} x={n.x} dy={i ? (n.size || 14) * 1.25 : 0}>{l}</tspan>)}
        </text>;
        if (n.kind === 'arrow') {
          const a = Math.atan2(n.y2 - n.y, n.x2 - n.x), hs = 8 + (n.width || 1.5) * 1.5;
          return <g key={n.id}>
            <line x1={n.x} y1={n.y} x2={n.x2 - Math.cos(a) * hs * 0.7} y2={n.y2 - Math.sin(a) * hs * 0.7} style={st} />
            {n.head !== false ? <path d={'M0,0 L' + (-hs) + ',' + hs * 0.45 + ' L' + (-hs) + ',' + (-hs * 0.45) + 'z'} transform={'translate(' + n.x2 + ',' + n.y2 + ') rotate(' + a * 180 / Math.PI + ')'} style={{ fill: n.color || 'var(--ink)' }} /> : null}
          </g>;
        }
        const fill = n.fill || 'none';
        if (n.kind === 'ellipse') return <ellipse key={n.id} cx={n.x + n.w / 2} cy={n.y + n.h / 2} rx={n.w / 2} ry={n.h / 2} style={{ ...st, fill, fillOpacity: n.fill ? 0.35 : undefined }} />;
        return <rect key={n.id} x={n.x} y={n.y} width={n.w} height={n.h} rx={n.round ? 8 : 0} style={{ ...st, fill, fillOpacity: n.fill ? 0.35 : undefined }} />;
      })}
    </g>
  );
}

type XY = [number, number];
/* One sheet: a white paper figure fitted to its content with 24px margins.
   The title and caption are drawn inside the SVG so they leave with every export. */
export function Sheet(p: {
  font: string; title?: string; caption?: string; number?: string; children: any; label?: string; zoom?: number;
  svgRef?: (el: SVGSVGElement | null) => void;
  overlay?: (toSvg: (x: number, y: number) => XY, box: { x: number; y: number; w: number; h: number }) => any;
  onSvgClick?: (pt: XY) => void;
  notes?: any[]; nudges?: Record<string, XY>;
  onNudge?: (key: string, d: XY) => void; onTextClick?: (text: string) => void; onBackground?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [box, setBox] = useState({ x: 0, y: 0, w: 400, h: 200 });
  const spins = useRef(0);
  const [, refit] = useState(0);
  useEffect(() => { const f = () => refit(n => n + 1); dragState.listeners.add(f); return () => { dragState.listeners.delete(f); }; }, []);

  /* text labels keyed by their words and which copy they are */
  function textKeys(): [SVGTextElement, string][] {
    const g = gRef.current; if (!g) return [];
    const seen: any = {};
    return Array.from(g.querySelectorAll('text')).filter(t => !t.closest('.mk-notes')).map(t => {
      const s = (t.textContent || '').trim(); seen[s] = (seen[s] || 0) + 1;
      return [t as SVGTextElement, s + '#' + (seen[s] - 1)];
    });
  }

  useLayoutEffect(() => {
    const nz = p.nudges || {};
    for (const [t, k] of textKeys()) { const d = nz[k]; t.style.translate = d ? d[0] + 'px ' + d[1] + 'px' : ''; }
    const g = gRef.current; if (!g || dragState.on) return;
    let b: DOMRect;
    /* content a clip-path cuts off (a cropped micrograph) must not widen the sheet: measure without it */
    const cut = Array.from(g.querySelectorAll('[data-clip]')) as SVGElement[];
    cut.forEach(e => { e.style.display = 'none'; });
    try { b = g.getBBox(); } catch (e) { return; } finally { cut.forEach(e => { e.style.display = ''; }); }
    const nb = { x: Math.floor(b.x), y: Math.floor(b.y), w: Math.ceil(b.width) || 200, h: Math.ceil(b.height) || 100 };
    const moved = Math.abs(nb.x - box.x) > 1 || Math.abs(nb.y - box.y) > 1 || Math.abs(nb.w - box.w) > 1 || Math.abs(nb.h - box.h) > 1;
    if (!moved) { spins.current = 0; return; }
    if (spins.current++ < 6) setBox(nb);
  });

  const titlePx = 22, capPx = 13;
  const tH = p.title ? titlePx + 18 : 0;
  const capW = Math.max(box.w, 360);
  const capLines = p.caption ? wrap((p.number ? 'Figure ' + p.number + '. ' : '') + p.caption, capW, capPx) : [];
  const cH = capLines.length ? capLines.length * 19 + 14 : 0;
  const titleW = p.title ? p.title.length * titlePx * 0.56 : 0;
  const vx = box.x - M, vy = box.y - M - tH;
  const vw = Math.max(box.w, titleW, capLines.length ? capW : 0) + 2 * M;
  const vh = box.h + 2 * M + tH + cH;

  useLayoutEffect(() => {
    const svg = wrapRef.current && wrapRef.current.querySelector('svg');
    if (!svg) return;
    svg.setAttribute('viewBox', [vx, vy, vw, vh].map(n => Math.round(n * 10) / 10).join(' '));
    svg.setAttribute('width', String(Math.round(vw)));
    svg.setAttribute('height', String(Math.round(vh)));
    if (p.zoom) { (svg as any).style.width = Math.round(vw * p.zoom) + 'px'; (svg as any).style.height = Math.round(vh * p.zoom) + 'px'; }
    else { (svg as any).style.width = ''; (svg as any).style.height = ''; }
    p.svgRef && p.svgRef(svg as SVGSVGElement);
  });

  function toSvg(cx: number, cy: number): XY {
    const svg = wrapRef.current && wrapRef.current.querySelector('svg');
    const m = svg && (svg as any).getScreenCTM(); if (!m) return [cx, cy];
    const pt = (svg as any).createSVGPoint(); pt.x = cx; pt.y = cy;
    const q = pt.matrixTransform(m.inverse());
    return [q.x, q.y];
  }
  function down(e: any) {
    const t = e.target as Element;
    if (t.closest('.mk-overlay') || t.closest('.mk-notes')) return;
    const txt = t.closest('text');
    if (txt && gRef.current && gRef.current.contains(txt) && (p.onNudge || p.onTextClick)) {
      const hit = textKeys().find(([el]) => el === txt);
      if (!hit) return;
      const key = hit[1], base = (p.nudges || {})[key] || [0, 0];
      const s = toSvg(e.clientX, e.clientY);
      e.preventDefault();
      dragState.on = true;
      let moved = false;
      const mv = (ev: PointerEvent) => {
        const q = toSvg(ev.clientX, ev.clientY);
        if (!moved && Math.hypot(q[0] - s[0], q[1] - s[1]) < 3) return;
        moved = true;
        if (p.onNudge) p.onNudge(key, [Math.round(base[0] + q[0] - s[0]), Math.round(base[1] + q[1] - s[1])]);
      };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        dragState.on = false; dragState.listeners.forEach(f => f());
        if (!moved && p.onTextClick) p.onTextClick(hit[1].replace(/#\d+$/, ''));
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      return;
    }
    if (p.onBackground) p.onBackground();
  }
  function click(e: any) {
    if (!p.onSvgClick) return;
    if ((e.target as Element).closest('.mk-overlay')) return;
    p.onSvgClick(toSvg(e.clientX, e.clientY));
  }

  return (
    <div className="mk-sheet" ref={wrapRef} data-zoom={p.zoom ? '1' : undefined} onPointerDown={down} onClick={click} data-clickable={p.onSvgClick ? '1' : undefined} data-labels={p.onNudge ? '1' : undefined}>
      <S.Canvas font={p.font} width={vw} height={vh} title={p.label || p.title || 'Diagram'}>
        {p.title ? <text className="mk-title" x={box.x} y={box.y - 22}>{p.title}</text> : null}
        <g ref={gRef}>{p.children}{p.notes && p.notes.length ? <Notes notes={p.notes} /> : null}</g>
        {capLines.map((l, i) => (
          <text key={i} className="mk-caption" x={box.x} y={box.y + box.h + M + 4 + i * 19}>
            {i === 0 && p.number ? <tspan fontWeight={700}>{'Figure ' + p.number + '.'}</tspan> : null}
            {i === 0 && p.number ? l.slice(('Figure ' + p.number + '.').length) : l}
          </text>
        ))}
        {p.overlay ? <g className="mk-overlay" data-export="skip">{p.overlay(toSvg, box)}</g> : null}
      </S.Canvas>
    </div>
  );
}
