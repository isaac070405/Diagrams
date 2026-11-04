/* Geometry of the Scale bar editor: where a micrograph sits in its panel after rotating,
   flipping and cropping, how many sheet pixels one real unit takes, and where panels sit
   on the sheet. Calibration (fov) is the real width of the whole source image, so crops and
   rotations never break it. */

export const SHEET_W = 800;
const n = (v: any, d: number) => { const x = parseFloat(v); return isFinite(x) ? x : d; };

/* 2D affine matrices as SVG's matrix(a b c d e f): x' = a x + c y + e, y' = b x + d y + f */
export type M = [number, number, number, number, number, number];
export const mul = (A: M, B: M): M => [
  A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
export const inv = (A: M): M => {
  const det = A[0] * A[3] - A[1] * A[2] || 1e-12;
  return [A[3] / det, -A[1] / det, -A[2] / det, A[0] / det, (A[2] * A[5] - A[3] * A[4]) / det, (A[1] * A[4] - A[0] * A[5]) / det];
};
export const apply = (A: M, x: number, y: number): [number, number] => [A[0] * x + A[2] * y + A[4], A[1] * x + A[3] * y + A[5]];
const T = (x: number, y: number): M => [1, 0, 0, 1, x, y];
const Sc = (x: number, y: number): M => [x, 0, 0, y, 0, 0];
const R = (deg: number): M => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const same = (A: M, B: M) => A.every((v, i) => Math.abs(v - B[i]) < 1e-6);
export const sameM = same;

export interface Crop { l: number; t: number; r: number; b: number }
export function cropOf(p: any): Crop {
  const c = p.crop || {};
  let l = Math.max(0, Math.min(0.9, n(c.l, 0))), r = Math.max(0, Math.min(0.9, n(c.r, 0))), t = Math.max(0, Math.min(0.9, n(c.t, 0))), b = Math.max(0, Math.min(0.9, n(c.b, 0)));
  if (l + r > 0.9) { const k = 0.9 / (l + r); l *= k; r *= k; }
  if (t + b > 0.9) { const k = 0.9 / (t + b); t *= k; b *= k; }
  return { l, t, r, b };
}

export function panelGeo(p: any, pw: number, cropping = false) {
  const iw = Math.max(1, n(p.imgW, 1200)), ih = Math.max(1, n(p.imgH, 800));
  const q = ((Math.round(n(p.q, 0)) % 4) + 4) % 4, odd = q % 2 === 1;
  const OW = odd ? ih : iw, OH = odd ? iw : ih;
  const c = cropping ? { l: 0, t: 0, r: 0, b: 0 } : cropOf(p);
  const cw = 1 - c.l - c.r, ch = 1 - c.t - c.b;
  const s = pw / (cw * OW), ph = ch * OH * s;
  const fov = Math.max(1e-9, n(p.fov, 200)), realOW = odd ? fov * ih / iw : fov;
  const ppu = pw / (cw * realOW);
  const m = mul(Sc(s, s), mul(T(-c.l * OW, -c.t * OH), mul(T(OW / 2, OH / 2), mul(R(q * 90 + n(p.ang, 0)), mul(Sc(p.flipX ? -1 : 1, p.flipY ? -1 : 1), T(-iw / 2, -ih / 2))))));
  return { iw, ih, OW, OH, q, odd, cw, ch, s, ph, ppu, realOW, m, c };
}
/* the image width in real units that puts a ruler of px sheet pixels at v real units */
export function fovFor(p: any, pw: number, px: number, v: number) {
  const g = panelGeo(p, pw), realOW = pw / (g.cw * (px / v));
  return Math.round((g.odd ? realOW * g.iw / g.ih : realOW) * 100) / 100;
}

/* panels on the sheet: rows of equal-width panels, tops aligned, row height = tallest panel */
export function layout(d: any) {
  const panels: any[] = d.panels || [];
  const cols = Math.max(1, Math.min(Math.round(n(d.cols, 1)), panels.length || 1)), gap = Math.max(0, n(d.gap, 12));
  const pw = cols === 1 ? SHEET_W : (SHEET_W - gap * (cols - 1)) / cols;
  const active = Math.max(0, Math.min(panels.length - 1, Math.round(n(d.active, 0))));
  const gs = panels.map((p, i) => panelGeo(p, pw, !!d.cropping && i === active));
  const rows: number[] = [];
  gs.forEach((g, i) => { const r = Math.floor(i / cols); rows[r] = Math.max(rows[r] || 0, g.ph); });
  const boxes = gs.map((g, i) => {
    const r = Math.floor(i / cols), col = i % cols;
    let y = 0; for (let k = 0; k < r; k++) y += rows[k] + gap;
    return { x: col * (pw + gap), y, w: pw, h: g.ph, g };
  });
  return { pw, cols, gap, active, boxes };
}

export function letterOf(i: number, mode: string) {
  if (mode === 'A') return String.fromCharCode(65 + i % 26);
  if (mode === 'a') return String.fromCharCode(97 + i % 26);
  return '';
}

export function niceStep(v: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1e-12, v)))), m = v / pow;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow;
}
