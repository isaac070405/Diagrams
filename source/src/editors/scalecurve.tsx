import { useEffect, useState } from 'react';
import { num } from '../ui';
import { apply, fmt, type M } from './scalegeo';

/* Contour (spline) and intensity profile graphics for the Scale bar editor.
   Contour: a smooth curve through clicked points, with area and perimeter in calibrated units.
   Profile: a line across the micrograph and a small plot of pixel intensity along it. */

type XY = [number, number];
const dashOf = (d?: string) => d === 'dashed' ? '6 4' : d === 'dotted' ? '1.5 3' : undefined;

/* ---------- spline: Catmull-Rom through the points, as cubic Beziers; tension 0 gives straight sides ---------- */
type Seg = [XY, XY, XY, XY];
function segs(p: number[], closed: boolean, tn: number): Seg[] {
  const n = p.length / 2, pt = (i: number): XY => {
    const j = closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
    return [p[j * 2], p[j * 2 + 1]];
  };
  const k = Math.max(0, Math.min(1, tn)) / 6, out: Seg[] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pt(i - 1), b = pt(i), c = pt(i + 1), d = pt(i + 2);
    out.push([b, [b[0] + (c[0] - a[0]) * k, b[1] + (c[1] - a[1]) * k], [c[0] - (d[0] - b[0]) * k, c[1] - (d[1] - b[1]) * k], c]);
  }
  return out;
}
export function splinePath(p: number[], closed: boolean, tn: number) {
  const ss = segs(p, closed, tn); if (!ss.length) return '';
  const f = (v: number) => +v.toFixed(1);
  return 'M' + f(ss[0][0][0]) + ',' + f(ss[0][0][1]) + ss.map(s => 'C' + f(s[1][0]) + ',' + f(s[1][1]) + ' ' + f(s[2][0]) + ',' + f(s[2][1]) + ' ' + f(s[3][0]) + ',' + f(s[3][1])).join('') + (closed ? 'Z' : '');
}
/* area (closed) and length of the drawn curve, in sheet pixels, by sampling every segment */
export function splineMetrics(p: number[], closed: boolean, tn: number) {
  const pts: XY[] = [];
  for (const [a, b, c, d] of segs(p, closed, tn)) for (let i = 0; i < 16; i++) {
    const t = i / 16, u = 1 - t;
    pts.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  const last = closed ? pts[0] : [p[p.length - 2], p[p.length - 1]];
  pts.push([last[0], last[1]]);
  let len = 0, area = 0;
  for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); area += pts[i - 1][0] * pts[i][1] - pts[i][0] * pts[i - 1][1]; }
  const n = p.length / 2; let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { cx += p[i * 2]; cy += p[i * 2 + 1]; }
  return { len, area: closed ? Math.abs(area) / 2 : 0, cx: cx / n, cy: cy / n };
}
export function splineText(s: any, ppu: number, unit: string) {
  const m = splineMetrics(s.p, !!s.closed, num(s.tn, 1));
  return s.closed ? 'A ' + fmt(m.area / (ppu * ppu)) + ' ' + unit + '² · P ' + fmt(m.len / ppu) + ' ' + unit : 'L ' + fmt(m.len / ppu) + ' ' + unit;
}

export function SplineSvg({ s, ppu, unit }: { s: any; ppu: number; unit: string }) {
  const col = s.color || 'var(--ink)', size = num(s.size, 13), closed = !!s.closed, m = splineMetrics(s.p, closed, num(s.tn, 1));
  return (
    <g>
      <path d={splinePath(s.p, closed, num(s.tn, 1))} style={{ stroke: col, strokeWidth: num(s.width, 2), strokeDasharray: dashOf(s.dash), strokeLinejoin: 'round', fill: closed && s.fill ? s.fill : 'none', fillOpacity: closed && s.fill ? 0.35 : undefined }} />
      {s.showDim !== false ? <text className="mk-dim" x={m.cx} y={m.cy + size * 0.35} style={{ fill: col, fontSize: size + 'px', fontWeight: 600, textAnchor: 'middle', stroke: 'var(--paper)', strokeWidth: size * 0.22, paintOrder: 'stroke', strokeLinejoin: 'round' }}>{splineText(s, ppu, unit)}</text> : null}
    </g>
  );
}

/* ---------- profile: pixels of the source image under a line ---------- */
const cache = new Map<string, ImageData | null>();
export function useImageData(src: string | null | undefined): ImageData | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!src || cache.has(src)) return;
    if (cache.size > 6) cache.delete(cache.keys().next().value as string);
    cache.set(src, null);
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(im, 0, 0);
        cache.set(src, x.getImageData(0, 0, c.width, c.height));
      } catch (e) { /* tainted or too large: the plot says so */ }
      tick(n => n + 1);
    };
    im.src = src;
  }, [src]);
  return src ? cache.get(src) || null : null;
}

export interface ProfCtx { inv: M; img: ImageData | null; iw: number; ih: number }

/* one value per source pixel along the line; NaN where the line leaves the picture */
export function profileSamples(ctx: ProfCtx, p: number[], channel: string, smooth: number) {
  const img = ctx.img!, a = apply(ctx.inv, p[0], p[1]), b = apply(ctx.inv, p[2], p[3]);
  const n = Math.max(2, Math.min(600, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]))));
  const kx = img.width / ctx.iw, ky = img.height / ctx.ih, v: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = Math.round((a[0] + (b[0] - a[0]) * i / n) * kx - 0.5), y = Math.round((a[1] + (b[1] - a[1]) * i / n) * ky - 0.5);
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) { v.push(NaN); continue; }
    const o = (y * img.width + x) * 4, r = img.data[o], g = img.data[o + 1], bl = img.data[o + 2];
    v.push(channel === 'r' ? r : channel === 'g' ? g : channel === 'b' ? bl : 0.2126 * r + 0.7152 * g + 0.0722 * bl);
  }
  const k = Math.max(0, Math.round(smooth));
  if (!k) return v;
  return v.map((_, i) => { let t = 0, c = 0; for (let j = Math.max(0, i - k); j <= Math.min(v.length - 1, i + k); j++) if (!isNaN(v[j])) { t += v[j]; c++; } return isNaN(v[i]) || !c ? NaN : t / c; });
}

const CH: Record<string, string> = { luma: 'Brightness', r: 'Red', g: 'Green', b: 'Blue' };
/* the plot sits at an offset from the middle of the line, so it follows the line when graphics are moved */
export function plotRect(s: any) {
  const mx = (s.p[0] + s.p[2]) / 2, my = (s.p[1] + s.p[3]) / 2;
  return { x: mx + num(s.dx, 12), y: my + num(s.dy, 12), w: Math.max(90, num(s.pw, 190)), h: Math.max(50, num(s.ph, 84)) };
}

export function ProfileSvg({ s, ppu, unit, prof }: { s: any; ppu: number; unit: string; prof?: ProfCtx }) {
  const [x1, y1, x2, y2] = s.p, col = s.color || 'var(--ink)', w = num(s.width, 2), ang = Math.atan2(y2 - y1, x2 - x1), hs = 8 + w * 1.5;
  const R = plotRect(s), L = Math.hypot(x2 - x1, y2 - y1) / ppu, size = 10, ml = 30, mr = 8, mt = 16, mb = 18, iw = R.w - ml - mr, ih = R.h - mt - mb;
  const ch = s.channel || 'luma', vals = prof && prof.img ? profileSamples(prof, s.p, ch, num(s.smooth, 3)) : null;
  let path = '', sum = 0, cnt = 0;
  if (vals) vals.forEach((v, i) => { if (isNaN(v)) return; sum += v; cnt++; path += (i > 0 && !isNaN(vals[i - 1]) ? 'L' : 'M') + +(ml + iw * i / (vals.length - 1)).toFixed(1) + ',' + +(mt + ih * (1 - v / 255)).toFixed(1); });
  const t: any = { fill: 'var(--ink)', fontSize: size + 'px' };
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2 - Math.cos(ang) * hs * 0.7} y2={y2 - Math.sin(ang) * hs * 0.7} style={{ stroke: col, strokeWidth: w, strokeDasharray: dashOf(s.dash), fill: 'none' }} />
      <path d={'M0,0 L' + (-hs) + ',' + hs * 0.45 + ' L' + (-hs) + ',' + (-hs * 0.45) + 'z'} transform={'translate(' + x2 + ',' + y2 + ') rotate(' + ang * 180 / Math.PI + ')'} style={{ fill: col }} />
      {s.showPlot !== false && prof ? (
        <g className="mk-profile" transform={'translate(' + R.x + ',' + R.y + ')'}>
          <rect width={R.w} height={R.h} style={{ fill: 'var(--paper)', fillOpacity: 0.94, stroke: col, strokeWidth: 1 }} />
          <path d={'M' + ml + ',' + mt + 'V' + (mt + ih) + 'H' + (ml + iw)} style={{ fill: 'none', stroke: 'var(--ink)', strokeWidth: 1 }} />
          {vals ? <path d={path} style={{ fill: 'none', stroke: ch === 'r' ? 'var(--edge-feedback-neg)' : ch === 'g' ? 'var(--swatch-6)' : ch === 'b' ? 'var(--accent-700)' : 'var(--ink)', strokeWidth: 1.4, strokeLinejoin: 'round' }} /> : null}
          {vals ? null : <text x={R.w / 2} y={R.h / 2 + 3} style={{ ...t, textAnchor: 'middle', fontStyle: 'italic' }}>{prof.img ? 'Outside the picture' : 'Needs a micrograph'}</text>}
          <text x={ml - 4} y={mt + 3} style={{ ...t, textAnchor: 'end' }}>255</text>
          <text x={ml - 4} y={mt + ih + 3} style={{ ...t, textAnchor: 'end' }}>0</text>
          <text x={ml} y={mt + ih + 13} style={{ ...t, textAnchor: 'start' }}>0</text>
          <text x={ml + iw} y={mt + ih + 13} style={{ ...t, textAnchor: 'end' }}>{fmt(L) + ' ' + unit}</text>
          <text x={ml} y={11} style={{ ...t, fontWeight: 600 }}>{CH[ch] || 'Brightness'}</text>
          {cnt ? <text x={ml + iw} y={11} style={{ ...t, textAnchor: 'end' }}>{'mean ' + Math.round(sum / cnt)}</text> : null}
        </g>
      ) : null}
    </g>
  );
}
