import { S } from '../sheet';
import { cells, EmptyHint, lines, num, Range, Rows, Seg, Select, startDrag, Swatches, TextIn, TextView, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const ROLES = ['exposure', 'outcome', 'confounder', 'mediator', 'moderator'];
const ROLE_OPTS: [string, string][] = [['', 'No role'], ...ROLES.map(r => [r, r[0].toUpperCase() + r.slice(1)] as [string, string])];
const TYPES: [string, string][] = [['process', 'Association'], ['uncertain', 'Uncertain'], ['label', 'Label'], ['inhibit', 'Inhibits'], ['moderate', 'Moderates'],
  ['secrete', 'Secretes (organ → hormone)'], ['mutual', 'Reciprocal (two-way)'], ['mutualU', 'Reciprocal, uncertain (two-way, dotted)']];
/* types SystemWheel cannot draw: the extra layer draws them */
const LAYER_TYPES = new Set(['secrete', 'mutual', 'mutualU']);
const ARROWS: [string, string][] = [['<?>', 'mutualU'], ['<->', 'mutual'], ['=>', 'secrete'], ['-|', 'inhibit'], ['?>', 'uncertain'], ['~>', 'moderate'], ['--', 'label'], ['->', 'process']];
const SYM: any = { mutualU: '<?>', mutual: '<->', secrete: '=>', inhibit: '-|', uncertain: '?>', moderate: '~>', label: '--', process: '->' };
const pal = (p: string) => Array.from({ length: 8 }, (_, i) => 'var(--wheel-' + p + '-' + (i + 1) + ')');
const CX = 430, CY = 300;

/* ---------- old text format → structure ---------- */
function fromText(d: any) {
  const p = d.palette || 'sat';
  const factors = lines(d.factors).map((l, i) => {
    const [code, name, role, group, values] = cells(l);
    const c = (code || 'F' + (i + 1)).toUpperCase();
    return { id: c, code: c, name: name || c, role: ROLES.includes((role || '').toLowerCase()) ? role.toLowerCase() : '', color: 'var(--wheel-' + p + '-' + Math.min(8, Math.max(1, parseInt(group) || 1)) + ')', values: values || '' };
  });
  const links = lines(d.links).map(l => {
    const [rel, ...rest] = l.split(':'); const label = rest.join(':').trim();
    const ar = ARROWS.find(([a]) => rel.includes(a)); if (!ar) return null;
    const [a, b] = rel.split(ar[0]).map(s => s.trim().toUpperCase());
    const pm = label.match(/\bp\s*(=|<)\s*([0-9.]+)/i);
    return { from: a, to: b, type: ar[1], name: label.replace(/\bp\s*(=|<)\s*[0-9.]+/i, '').trim(), p: pm ? (pm[1] === '<' ? '< ' : '') + pm[2] : '' };
  }).filter(Boolean);
  const key = lines(d.key).map(l => { const [g, lab] = l.split('='); return { color: 'var(--wheel-' + p + '-' + Math.min(8, Math.max(1, parseInt(g) || 1)) + ')', label: (lab || '').trim() }; }).filter(k => k.label);
  return { factors, links, key };
}
function normalize(d: any) {
  if (Array.isArray(d.factors)) return d;
  return { R: 205, hubR: 92, fontSize: 12.5, titleSize: 21, ...d, ...fromText(d) };
}
function toText(d: any) {
  const f = d.factors.map((n: any) => [n.code, n.name, n.role || '', ((n.color || '').match(/-(\d+)\)$/) || [, ''])[1], n.values || ''].join(' | ').replace(/( \| )+$/, ''));
  const l = d.links.map((e: any) => e.from + ' ' + SYM[e.type || 'process'] + ' ' + e.to + (e.name || e.p ? ' : ' + [e.name, e.p ? 'p' + (String(e.p).startsWith('<') ? '' : '=') + String(e.p).replace(/\s/g, '') : ''].filter(Boolean).join(' ') : ''));
  return f.join('\n') + '\n\n' + l.join('\n');
}
function values(s: string) { return String(s || '').split(',').map(v => v.trim()).filter(Boolean).map(v => { const [a, b] = v.split('='); return { v: (a || '').trim(), label: (b || a || '').trim() }; }); }

function model(d: any) {
  const nodes = d.factors.map((n: any) => ({ ...n, id: n.id, code: n.code || n.id, role: n.role || undefined, values: n.values ? values(n.values) : undefined }));
  const ids = new Set(nodes.map((n: any) => n.id));
  const edges = d.links.filter((e: any) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  return { nodes, edges };
}
/* the same geometry SystemWheel draws, so hit areas sit on the marks */
/* inner circle settings live on each system: the main system keeps them on the document, extra systems on their own entry */
const sidOf = (d: any, f: any) => f && f.sys && (d.systems || []).some((x: any) => x.id === f.sys) ? f.sys : '';
export function icOf(d: any, sid: string) {
  const src = (sid && (d.systems || []).find((x: any) => x.id === sid)) || d;
  return { outerShape: src.outerShape === 'box' ? 'box' : 'dot', innerShape: src.innerShape === 'dot' ? 'dot' : 'box', on: !!src.innerOn, organ: !!src.innerOn && src.mode === 'organ', mode: src.mode, innerName: src.innerName, outerName: src.outerName, innerR: src.innerR };
}
const sysIds = (d: any) => ['', ...(d.systems || []).map((x: any) => x.id)];
const anyInner = (d: any) => sysIds(d).some((s: string) => icOf(d, s).on);
const isInner = (d: any, f: any) => f.ring === 'inner' && icOf(d, sidOf(d, f)).on;
export const innerR = (d: any) => Math.min(num(d.innerR, Math.round(num(d.R, 205) * 0.6)), num(d.R, 205) - 50);
const boxW = (txt: string) => Math.max(56, String(txt || '').length * 6.9 + 18);
/* look settings per system: an extra system uses its own value, else the main system's */
const SV_KEYS = ['hubR', 'fontSize', 'titleSize', 'labels', 'innerLabels', 'numbers', 'guideRing'];
function sv(d: any, sid: string, k: string, def?: any) {
  const s = sid && (d.systems || []).find((x: any) => x.id === sid);
  const v = s && s[k] != null && s[k] !== '' ? s[k] : d[k];
  return v == null || v === '' ? def : v;
}
const labelOf = (mode: string, f: any) => mode === 'Code' ? (f.code || f.name) : mode === 'Both' ? [f.code, f.name].filter(Boolean).join(' · ') : (f.name || f.code);
const boxText = (d: any, f: any, inn: boolean, sid = '') => labelOf(inn ? sv(d, sid, 'innerLabels', 'Description') : sv(d, sid, 'labels', 'Description'), f);
const innerRFor = (d: any, R: number, sid = '') => sid ? Math.min(num(icOf(d, sid).innerR, Math.round(R * 0.6)), R - 50) : Math.min(Math.round(innerR(d) * R / num(d.R, 205)), R - 50);
const SYS_TINT = [1, 4, 6, 3, 7, 2, 5, 8];
/* every system is one wheel: the main one (title = centre title) plus any extra ones placed beside it */
export function systemsOf(d: any) {
  const extra = Array.isArray(d.systems) ? d.systems : [];
  const list = [{ id: '', name: d.center, label: d.sysLabel, R: num(d.R, 205), color: d.sysColor, x: d.cx, y: d.cy }, ...extra.map((s: any) => ({ ...s, R: num(s.R, num(d.R, 205)) }))];
  const maxR = Math.max(...list.map((s: any) => s.R)), step = 2 * maxR + 230, ar = d.arrange || 'row';
  const x0 = num(d.cx, CX), y0 = num(d.cy, CY);
  return list.map((s: any, k: number) => {
    const dx = ar === 'column' ? 0 : ar === 'grid' ? (k % 2) * step : k * step, dy = ar === 'column' ? k * step : ar === 'grid' ? Math.floor(k / 2) * step : 0;
    return { ...s, k, x: s.x != null && s.x !== '' ? num(s.x, x0 + dx) : x0 + dx, y: s.y != null && s.y !== '' ? num(s.y, y0 + dy) : y0 + dy, color: s.color || 'var(--wheel-' + (d.palette || 'sat') + '-' + SYS_TINT[k % 8] + ')' };
  });
}
const multi = (d: any) => Array.isArray(d.systems) && d.systems.length > 0;
const sysOf = (sys: any[], f: any) => sys.find(s => s.id === (f.sys || '')) || sys[0];
const hubBase = (d: any, R: number, sid = '') => { const s = sid && (d.systems || []).find((x: any) => x.id === sid); return s && s.hubR != null && s.hubR !== '' ? num(s.hubR, 92) : num(d.hubR, 92) * R / num(d.R, 205); };
const hubFor = (d: any, R: number, sid = '') => icOf(d, sid).on ? Math.max(26, Math.min(hubBase(d, R, sid), Math.round(innerRFor(d, R, sid) * 0.4))) : Math.round(hubBase(d, R, sid));
function geom(d: any) {
  const R = num(d.R, 205), RI = innerR(d), sys = systemsOf(d);
  const groups: any = {};
  d.factors.forEach((f: any) => { const s = sysOf(sys, f), k = s.id + '|' + (isInner(d, f) ? 1 : 0); (groups[k] = groups[k] || { s, inn: isInner(d, f), list: [] }).list.push(f); });
  const pos: any = {};
  Object.values(groups).forEach(({ s, inn, list }: any) => list.forEach((f: any, i: number) => {
    const rad = inn ? innerRFor(d, s.R, s.id) : s.R;
    const a = f.angle != null ? f.angle : -Math.PI / 2 + i * 2 * Math.PI / list.length;
    const ic = icOf(d, s.id), box = (inn ? ic.innerShape : ic.outerShape) === 'box', txt = boxText(d, f, inn, s.id);
    pos[f.id] = { a, x: s.x + Math.cos(a) * rad, y: s.y + Math.sin(a) * rad, r: f.radius || 15, inner: inn, box, txt, w: box ? boxW(txt) : 0, h: box ? 24 : 0, sys: s.id, cx: s.x, cy: s.y };
  }));
  const curve = (e: any) => {
    const pa = pos[e.from], pb = pos[e.to]; if (!pa || !pb) return null;
    const cross = pa.sys !== pb.sys, rx = cross ? (pa.cx + pb.cx) / 2 : pa.cx, ry = cross ? (pa.cy + pb.cy) / 2 + 1 : pa.cy;
    const dx = pb.x - pa.x, dy = pb.y - pa.y, dist = Math.hypot(dx, dy) || 1, px = -dy / dist, py = dx / dist;
    const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }, amt = cross ? Math.max(18, Math.min(dist * 0.12, 70)) : Math.max(14, Math.min(dist * 0.16, 56));
    const bend = e.bend != null ? e.bend * dist : amt * ((px * (mid.x - rx) + py * (mid.y - ry)) >= 0 ? 1 : -1);
    return { pa, pb, mid, px, py, dist, cross, c: { x: mid.x + px * bend, y: mid.y + py * bend } };
  };
  return { R, RI, pos, curve, sys };
}

const lid = (e: any) => e.from + '>' + e.to;
function orient(d: any, e: any) {
  if (e.type !== 'secrete') return e;
  const A = d.factors.find((f: any) => f.id === e.from), B = d.factors.find((f: any) => f.id === e.to);
  return A && B && !isInner(d, A) && isInner(d, B) ? { ...e, from: e.to, to: e.from } : e;
}
/* organ–hormone mode: each link is a kind of interaction with a fixed line style */
const KINDS: [string, string][] = [['secretes', 'Secretes'], ['stimulates', 'Acts on / stimulates'], ['inhibits', 'Inhibits (feedback)']];
const KIND_STYLE: any = { secretes: { type: 'process', color: 'var(--wheel-edge)' }, stimulates: { type: 'process', color: 'var(--accent-700)' }, inhibits: { type: 'inhibit', color: 'var(--edge-feedback-neg)' } };
const organMode = (d: any) => sysIds(d).some((s: string) => icOf(d, s).organ);
const organSet = (d: any) => icOf(d, sysIds(d).find((s: string) => icOf(d, s).organ) || '');
const factorOf = (d: any, id: string) => d.factors.find((f: any) => f.id === id);
const organLink = (d: any, e: any) => icOf(d, sidOf(d, factorOf(d, e.from))).organ || icOf(d, sidOf(d, factorOf(d, e.to))).organ;
function styled(d: any, e: any, cross?: boolean) {
  if (organLink(d, e) && KIND_STYLE[e.kind || 'stimulates']) return { ...e, ...KIND_STYLE[e.kind || 'stimulates'], color: e.color || KIND_STYLE[e.kind || 'stimulates'].color };
  return cross ? { ...e, color: e.color || 'var(--accent-700)', width: e.width || 2.4 } : e;
}
function kindFor(d: any, a: string, b: string) {
  const A = d.factors.find((f: any) => f.id === a), B = d.factors.find((f: any) => f.id === b);
  return A && B && isInner(d, A) && !isInner(d, B) ? 'secretes' : 'stimulates';
}

/* the inner circle, and every link that touches it: drawn on top of the outer wheel */
const LETTER = (s: any) => 'System ' + String.fromCharCode(65 + s.k);
export function haloText(d: any, s: any) {
  if (s.label) return s.label;
  const m = d.haloText || 'letter';
  return m === 'none' ? '' : m === 'name' ? (s.name || LETTER(s)) : m === 'both' ? String.fromCharCode(65 + s.k) + ' · ' + (s.name || 'System') : LETTER(s);
}
/* a heading that already names the system leaves the centre of the wheel empty */
const headingNames = (d: any, s: any) => multi(d) && d.halo !== false && !!(s.label || ((d.haloText === 'name' || d.haloText === 'both') && s.name));
const hubTitle = (d: any, s: any) => headingNames(d, s) && !d.hubRepeat ? '\u00a0' : s.name;
function Halos({ d }: { d: any }) {
  if (!multi(d) || d.halo === false) return null;
  return <g className="wh-halos">{systemsOf(d).map((s: any) => <g key={'h' + s.k}>
    <circle className="wh-halo" cx={s.x} cy={s.y} r={s.R + 64} style={{ fill: s.color, stroke: s.color }} />
    <text className="wh-halo-label" x={s.x} y={s.y - s.R - 76} textAnchor="middle" style={{ fill: s.color }}>{haloText(d, s)}</text>
  </g>)}</g>;
}
function InnerLayer({ d, under }: { d: any; under?: boolean }) {
  const g = geom(d), out: any[] = [];
  let k = 0; const K = () => 'i' + k++;
  if (!under) g.sys.forEach((s: any) => { if (sv(d, s.id, 'guideRing', true) !== false && icOf(d, s.id).on) out.push(<circle key={K()} className="wh-iring" cx={s.x} cy={s.y} r={innerRFor(d, s.R, s.id)} />); });
  const clip = (p: any, ux: number, uy: number) => p.box ? Math.min(p.w / 2 / (Math.abs(ux) || 1e-6), p.h / 2 / (Math.abs(uy) || 1e-6)) + 3 : p.r + 3;
  d.links.forEach((e0: any) => {
    const q0 = g.curve(e0); if (!q0 || e0.from === e0.to) return;
    const plain = !q0.pa.inner && !q0.pb.inner && !q0.pa.box && !q0.pb.box && !q0.cross;
    if (plain && !LAYER_TYPES.has(e0.type)) return;
    if (!!under !== plain) return;
    const e = styled(d, e0, q0.cross), q = q0;
    let ux = q.c.x - q.pa.x, uy = q.c.y - q.pa.y, ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    let vx = q.pb.x - q.c.x, vy = q.pb.y - q.c.y, vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
    const s = { x: q.pa.x + ux * clip(q.pa, ux, uy), y: q.pa.y + uy * clip(q.pa, ux, uy) };
    const en = { x: q.pb.x - vx * clip(q.pb, vx, vy), y: q.pb.y - vy * clip(q.pb, vx, vy) };
    const t0 = e.type || 'process', two = t0 === 'mutual' || t0 === 'mutualU';
    const w = e.width || 2, color = e.color || 'var(--wheel-edge)', type = t0 === 'secrete' || t0 === 'mutual' ? 'process' : t0 === 'mutualU' ? 'uncertain' : t0, ang = Math.atan2(vy, vx) * 180 / Math.PI, hs = 7.5 + w;
    let endPt = en;
    const s0 = { ...s };
    if (two) { s.x += ux * hs * 0.74; s.y += uy * hs * 0.74; }
    if (type === 'process' || type === 'uncertain') endPt = { x: en.x - vx * hs * 0.74, y: en.y - vy * hs * 0.74 };
    if (type === 'moderate') endPt = { x: en.x - vx * (5 + w * 0.6) * 2, y: en.y - vy * (5 + w * 0.6) * 2 };
    out.push(<path key={K()} className={'sd-wh-edge sd-wh-' + type + (q.cross ? ' wh-cross' : '')} d={'M' + s.x + ',' + s.y + ' Q' + q.c.x + ',' + q.c.y + ' ' + endPt.x + ',' + endPt.y} style={{ stroke: color, strokeWidth: w }} />);
    const tr = 'translate(' + en.x + ',' + en.y + ') rotate(' + ang + ')';
    if (two) out.push(<path key={K()} transform={'translate(' + s0.x + ',' + s0.y + ') rotate(' + (Math.atan2(-uy, -ux) * 180 / Math.PI) + ')'} d={'M0,0 L' + (-hs) + ',' + hs * 0.5 + ' L' + (-hs * 0.74) + ',0 L' + (-hs) + ',' + (-hs * 0.5) + ' z'} style={{ fill: color }} />);
    if (t0 === 'secrete') out.push(<circle key={K()} className="wh-src" cx={s0.x} cy={s0.y} r={3 + w * 0.5} style={{ fill: color }} />);
    if (type === 'process' || type === 'uncertain') out.push(<path key={K()} transform={tr} d={'M0,0 L' + (-hs) + ',' + hs * 0.5 + ' L' + (-hs * 0.74) + ',0 L' + (-hs) + ',' + (-hs * 0.5) + ' z'} style={{ fill: color }} />);
    else if (type === 'label') out.push(<circle key={K()} cx={en.x} cy={en.y} r={3.2 + w * 0.4} style={{ fill: color }} />);
    else if (type === 'inhibit') out.push(<line key={K()} transform={tr} x1={0} y1={-(7 + w)} x2={0} y2={7 + w} style={{ stroke: color, strokeWidth: w }} />);
    else if (type === 'moderate') { const z = 5 + w * 0.6; out.push(<path key={K()} transform={tr} d={'M0,0 L' + (-z) + ',' + (-z * 0.75) + ' L' + (-2 * z) + ',0 L' + (-z) + ',' + (z * 0.75) + ' z'} style={{ fill: color }} />); }
    const text = [e.name || '', S.sigMark(e)].filter(Boolean).join(' ');
    if (text) { const m = { x: 0.25 * s.x + 0.5 * q.c.x + 0.25 * en.x, y: 0.25 * s.y + 0.5 * q.c.y + 0.25 * en.y }; out.push(<text key={K()} className="sd-wh-elabel" x={m.x} y={m.y}>{text}</text>); }
  });
  if (under) return <g className="sd-wheel wh-under">{out}</g>;
  d.factors.filter((f: any) => g.pos[f.id] && g.pos[f.id].inner && !g.pos[f.id].box).forEach((f: any) => {
    const p = g.pos[f.id], col = f.color || 'var(--neutral-600)';
    out.push(<g key={K()} className="wh-idot">
      <circle cx={p.x} cy={p.y} r={p.r * 0.8} style={{ fill: col }} />
      <text x={p.x} y={p.y + p.r * 0.8 + 13} textAnchor="middle" style={{ fontSize: Math.min(12, num(sv(d, p.sys, 'fontSize'), 12.5)) + 'px' }}>{labelOf(sv(d, p.sys, 'innerLabels', 'Description'), f)}</text>
    </g>);
  });
  d.factors.filter((f: any) => g.pos[f.id] && g.pos[f.id].box).forEach((f: any) => {
    const p = g.pos[f.id], col = f.color || 'var(--neutral-600)';
    out.push(<g key={K()} className="wh-organ">
      <rect x={p.x - p.w / 2} y={p.y - p.h / 2} width={p.w} height={p.h} rx={4} style={{ stroke: col }} />
      <rect className="wh-organ-tint" x={p.x - p.w / 2} y={p.y - p.h / 2} width={p.w} height={p.h} rx={4} style={{ fill: col }} />
      <text x={p.x} y={p.y + 4} textAnchor="middle" style={{ fontSize: Math.min(12.5, num(sv(d, p.sys, 'fontSize'), 12.5)) + 'px' }}>{p.txt}</text>
    </g>);
  });
  const crossUsed = multi(d) && d.links.some((e: any) => { const q = g.curve(e); return q && q.cross; });
  if (organMode(d) || crossUsed) {
    const y = Math.max(...g.sys.map((s: any) => s.y + s.R)) + (multi(d) && d.halo !== false ? 110 : 70);
    const items: [string, string][] = organMode(d) ? [['secretes', 'Secretes'], ['stimulates', 'Acts on target'], ['inhibits', 'Negative feedback']] : [['within', 'Link within a system'], ['between', 'Link between systems']];
    const LS: any = { ...KIND_STYLE, within: { type: 'process', color: 'var(--wheel-edge)' }, between: { type: 'process', color: 'var(--accent-700)' } };
    let x = Math.min(...g.sys.map((s: any) => s.x - s.R)) + 10;
    items.forEach(([kd, lab]) => {
      const st = LS[kd];
      out.push(<line key={K()} className="sd-wh-edge" x1={x} y1={y} x2={x + 30} y2={y} style={{ stroke: st.color, strokeWidth: 2 }} />);
      if (st.type === 'inhibit') out.push(<line key={K()} x1={x + 32} y1={y - 8} x2={x + 32} y2={y + 8} style={{ stroke: st.color, strokeWidth: 2 }} />);
      else out.push(<path key={K()} d={'M' + (x + 36) + ',' + y + ' l-9.5,4.75 l2.5,-4.75 l-2.5,-4.75 z'} style={{ fill: st.color }} />);
      out.push(<text key={K()} className="wh-key" x={x + 44} y={y + 4}>{lab}</text>);
      x += 64 + lab.length * 6.6;
    });
    const shp = (shape: string, x0: number) => shape === 'box' ? <rect className="wh-organ-key" x={x0} y={y - 9} width={26} height={18} rx={3} /> : <circle cx={x0 + 13} cy={y} r={8} style={{ fill: 'var(--neutral-500)' }} />;
    if (organMode(d)) out.push(<g key={K()}>{shp(organSet(d).innerShape, x)}<text className="wh-key" x={x + 34} y={y + 4}>{organSet(d).innerName || 'Organs'}</text></g>);
    x += 50 + String(organSet(d).innerName || 'Organs').length * 6.6;
    if (organMode(d)) out.push(<g key={K()}>{shp(organSet(d).outerShape, x - 4)}<text className="wh-key" x={x + 28} y={y + 4}>{organSet(d).outerName || 'Hormones'}</text></g>);
  }
  return <g className="sd-wheel wh-inner">{out}</g>;
}

function Overlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const d = normalize(data), g = geom(d);
  return (
    <>
      {multi(d) && d.halo !== false ? g.sys.map((s: any) => {
        const txt = haloText(d, s); if (!txt) return null;
        const w = txt.length * 9 + 24, on = sel && sel.kind === 'system' && sel.id === s.id;
        return <rect key={'sl' + s.k} className={'mk-hit' + (on ? ' mk-on' : '')} x={s.x - w / 2} y={s.y - s.R - 92} width={w} height={22} rx={4} onPointerDown={() => setSel({ kind: 'system', id: s.id })} />;
      }) : null}
      {multi(d) ? g.sys.map((s: any) => {
        const on = sel && sel.kind === 'system' && sel.id === s.id;
        return <circle key={'s' + s.k} className={'mk-hit' + (on ? ' mk-on' : '')} cx={s.x} cy={s.y} r={hubFor(d, s.R, s.id)}
          onPointerDown={ev => {
            setSel({ kind: 'system', id: s.id });
            const fixed = g.sys.map((x: any) => ({ id: x.id, x: x.x, y: x.y }));
            startDrag(ev, toSvg, (_dx, _dy, at) => {
              const nx = Math.round(at[0] / 5) * 5, ny = Math.round(at[1] / 5) * 5;
              const at2 = (id: string): any => id === s.id ? { x: nx, y: ny } : fixed.find(f => f.id === id) || {};
              set({ cx: at2('').x, cy: at2('').y, systems: d.systems.map((x: any) => ({ ...x, x: at2(x.id).x, y: at2(x.id).y })) }, 'sys-' + s.id);
            });
          }} />;
      }) : null}
      {d.links.map((e: any, i: number) => {
        const q = g.curve(e); if (!q) return null;
        const on = sel && sel.kind === 'link' && sel.id === lid(e);
        return <path key={'e' + i} className={'mk-hit-line' + (on ? ' mk-on' : '')} d={'M' + q.pa.x + ',' + q.pa.y + ' Q' + q.c.x + ',' + q.c.y + ' ' + q.pb.x + ',' + q.pb.y}
          onPointerDown={ev => {
            setSel({ kind: 'link', id: lid(e) });
            startDrag(ev, toSvg, (_dx, _dy, at) => {
              const off = (at[0] - q.mid.x) * q.px + (at[1] - q.mid.y) * q.py;
              const bend = Math.max(-0.9, Math.min(0.9, Math.round(2 * off / q.dist * 100) / 100));
              set({ links: d.links.map((x: any) => x === e ? { ...x, bend } : x) }, 'bend-' + lid(e));
            });
          }} />;
      })}
      {d.factors.map((f: any) => {
        const q = g.pos[f.id], on = sel && sel.kind === 'factor' && sel.id === f.id;
        const down = (ev: any) => {
          setSel({ kind: 'factor', id: f.id });
          startDrag(ev, toSvg, (_dx, _dy, at) => {
            const a = Math.round(Math.atan2(at[1] - q.cy, at[0] - q.cx) * 1000) / 1000;
            set({ ...(data === d ? {} : d), factors: d.factors.map((x: any) => x.id === f.id ? { ...x, angle: a } : x) }, 'drag-' + f.id);
          });
        };
        if (q.box) return <rect key={f.id} className={'mk-hit' + (on ? ' mk-on' : '')} x={q.x - q.w / 2 - 4} y={q.y - q.h / 2 - 4} width={q.w + 8} height={q.h + 8} onPointerDown={down} />;
        return <circle key={f.id} className={'mk-hit' + (on ? ' mk-on' : '')} cx={q.x} cy={q.y} r={q.r + 7}
          onPointerDown={ev => {
            setSel({ kind: 'factor', id: f.id });
            startDrag(ev, toSvg, (_dx, _dy, at) => {
              const a = Math.round(Math.atan2(at[1] - q.cy, at[0] - q.cx) * 1000) / 1000;
              set({ factors: d.factors.map((x: any) => x.id === f.id ? { ...x, angle: a } : x) }, 'drag-' + f.id);
            });
          }} />;
      })}
    </>
  );
}

function Controls({ data, set, sel, setSel }: EditProps) {
  const d = normalize(data);
  const colors = pal(d.palette || 'sat');
  const S2 = (patch: any, key?: string) => set({ ...(data === d ? {} : d), ...patch }, key);
  const f = sel && sel.kind === 'factor' ? d.factors.find((x: any) => x.id === sel.id) : null;
  const e = sel && sel.kind === 'link' ? d.links.find((x: any) => lid(x) === sel.id) : null;
  const upF = (patch: any, key?: string) => S2({ factors: d.factors.map((x: any) => x === f ? { ...x, ...patch } : x) }, key);
  const upE = (patch: any, key?: string) => { const ne = orient(d, { ...e, ...patch }); S2({ links: d.links.map((x: any) => x === e ? ne : x) }, key); if (ne.from !== e.from) setSel({ kind: 'link', id: lid(ne) }); };
  const names: [string, string][] = d.factors.map((x: any) => [x.id, x.code + ' · ' + x.name]);
  const sysList = systemsOf(d), sysOpts: [string, string][] = sysList.map((s: any) => [s.id, String.fromCharCode(65 + s.k) + ' · ' + (s.name || 'System')]);
  const sy = sel && sel.kind === 'system' ? sysList.find((s: any) => s.id === sel.id) : null;
  const fSel = sel && sel.kind === 'factor' ? d.factors.find((x: any) => x.id === sel.id) : null;
  const tid = sy ? sy.id : fSel ? sidOf(d, fSel) : '', tic = icOf(d, tid), tsys = sysList.find((s: any) => s.id === tid) || sysList[0];
  /* editing the main system must not drag along extra systems that still inherit: they keep the old value */
  const upIC = (patch: any, key?: string) => {
    if (tid !== '') return S2({ systems: d.systems.map((x: any) => x.id === tid ? { ...x, ...patch } : x) }, key);
    if (!multi(d)) return S2(patch, key);
    const keep = (x: any) => { const o: any = {}; Object.keys(patch).forEach(k => { if (SV_KEYS.includes(k) && (x[k] == null || x[k] === '') && d[k] != null) o[k] = d[k]; if (k === 'hubR' && (x.hubR == null || x.hubR === '')) o.hubR = Math.round(hubBase(d, num(x.R, num(d.R, 205)), x.id)); }); return o; };
    S2({ ...patch, systems: d.systems.map((x: any) => ({ ...x, ...keep(x) })) }, key);
  };
  const upS = (patch: any, key?: string) => sy && (sy.id === '' ? S2({ sysLabel: 'label' in patch ? patch.label : d.sysLabel, center: patch.name != null ? patch.name : d.center, sysColor: 'color' in patch ? patch.color : d.sysColor, R: patch.R != null ? patch.R : d.R }, key)
    : S2({ systems: d.systems.map((x: any) => x.id === sy.id ? { ...x, ...patch } : x) }, key));
  const addSystem = () => {
    const ids = (d.systems || []).map((x: any) => x.id), id = uid('S', ids), n = (d.systems || []).length + 2;
    const fa = uid('F', d.factors.map((x: any) => x.id)), fb = uid('F', [...d.factors.map((x: any) => x.id), fa]);
    const look: any = {}; SV_KEYS.forEach(k => { if (d[k] != null) look[k] = d[k]; });
    S2({ systems: [...(d.systems || []), { id, name: 'System ' + String.fromCharCode(64 + n), ...look }],
      factors: [...d.factors, { id: fa, code: fa, name: 'New factor', role: '', color: colors[(n * 2) % 8], values: '', sys: id }, { id: fb, code: fb, name: 'New factor', role: '', color: colors[(n * 2) % 8], values: '', sys: id }] });
    setSel({ kind: 'system', id });
  };
  const addFactor = () => {
    const id = uid('F', d.factors.map((x: any) => x.id));
    S2({ factors: [...d.factors, { id, code: id, name: 'New factor', role: '', color: colors[0], values: '' }] }); setSel({ kind: 'factor', id });
  };
  const setPalette = (p: string) => {
    const re = /var\(--wheel-(sat|muted|warm)-(\d)\)/;
    const sw = (c: string) => c && re.test(c) ? c.replace(re, 'var(--wheel-' + p + '-$2)') : c;
    S2({ palette: p, factors: d.factors.map((x: any) => ({ ...x, color: sw(x.color) })), key: d.key.map((k: any) => ({ ...k, color: sw(k.color) })) });
  };
  return (
    <>
      {f ? (
        <S.Panel kicker="Selected factor" help="Drag it around the circle on the sheet. Delete removes it and its links.">
          <div className="mk-pair">
            <TextIn id="wh-code" label="Code" value={f.code} onChange={v => upF({ code: v.toUpperCase() }, 'code-' + f.id)} />
            <Select id="wh-role" label="Role" value={f.role || ''} options={ROLE_OPTS} onChange={v => upF({ role: v })} />
          </div>
          <TextIn id="wh-name" label="Name" value={f.name} onChange={v => upF({ name: v }, 'name-' + f.id)} />
          {multi(d) ? <Select id="wh-fsys" label="System" value={f.sys || ''} options={sysOpts} onChange={v => upF({ sys: v || undefined, angle: undefined })} /> : null}
          {icOf(d, sidOf(d, f)).on ? <Seg value={f.ring === 'inner' ? 'inner' : 'outer'} options={[['outer', icOf(d, sidOf(d, f)).outerName || 'Outer circle'], ['inner', icOf(d, sidOf(d, f)).innerName || 'Inner circle']]} onChange={v => upF({ ring: v === 'inner' ? 'inner' : undefined, angle: undefined })} /> : null}
          <Swatches label="Colour" value={f.color} colors={[...colors, ...Array.from({ length: 16 }, (_, i) => 'var(--swatch-' + (i + 1) + ')')]} none="Palette default" onChange={v => upF({ color: v })} />
          <Range id="wh-rad" label="Dot size" value={num(f.radius, 15)} min={8} max={30} onChange={v => upF({ radius: v }, 'rad-' + f.id)} />
          <TextIn id="wh-vals" label="Values (for the codebook)" value={f.values} placeholder="e.g. 0=Never, 1=Former, 2=Current" onChange={v => upF({ values: v }, 'vals-' + f.id)} />
          <Select id="wh-linkto" label="Draw a link to" value="" options={[['', 'Choose a factor…'], ...names.filter(([i]) => i !== f.id)]}
            onChange={v => { if (v) S2({ links: [...d.links, { from: f.id, to: v, type: 'process', kind: kindFor(d, f.id, v), name: '', p: '' }] }); }} />
          <div className="sd-row-btns">
            <S.ToolButton compact onClick={() => upF({ angle: undefined })}>Even spacing</S.ToolButton>
            <S.ToolButton compact onClick={() => { S2({ factors: d.factors.filter((x: any) => x !== f), links: d.links.filter((x: any) => x.from !== f.id && x.to !== f.id) }); setSel(null); }}>Delete factor</S.ToolButton>
          </div>
        </S.Panel>
      ) : null}
      {sy ? (
        <S.Panel kicker={'Selected system · ' + String.fromCharCode(65 + sy.k)} help="Drag the centre of a wheel to move the whole system. Links between systems are drawn in steel blue by default.">
          <TextIn id="wh-sname" label="System name (centre title)" value={sy.name} onChange={v => upS({ name: v }, 'sname-' + sy.id)} />
          <TextIn id="wh-slabel" label="Heading above the wheel" value={sy.label} placeholder={haloText(d, { ...sy, label: '' }) || 'e.g. Eating & Appetite'} onChange={v => upS({ label: v || undefined }, 'slabel-' + sy.id)} />
          <Swatches label="Shade" value={sy.id === '' ? d.sysColor : (d.systems.find((x: any) => x.id === sy.id) || {}).color} colors={[...colors, ...Array.from({ length: 16 }, (_, i) => 'var(--swatch-' + (i + 1) + ')')]} none="Automatic" onChange={v => upS({ color: v })} />
          <Range id="wh-sR" label="Circle size" value={sy.R} min={120} max={320} step={5} onChange={v => upS({ R: v }, 'sR-' + sy.id)} />
          <div className="sd-row-btns">
            <S.ToolButton compact onClick={() => { const id = uid('F', d.factors.map((x: any) => x.id)); S2({ factors: [...d.factors, { id, code: id, name: 'New factor', role: '', color: colors[0], values: '', sys: sy.id || undefined }] }); setSel({ kind: 'factor', id }); }}>Add a factor here</S.ToolButton>
            {sy.id ? <S.ToolButton compact onClick={() => {
              const gone = new Set(d.factors.filter((x: any) => x.sys === sy.id).map((x: any) => x.id));
              S2({ systems: d.systems.filter((x: any) => x.id !== sy.id), factors: d.factors.filter((x: any) => !gone.has(x.id)), links: d.links.filter((x: any) => !gone.has(x.from) && !gone.has(x.to)) }); setSel(null);
            }}>Delete system</S.ToolButton> : null}
          </div>
        </S.Panel>
      ) : null}
      {e ? (
        <S.Panel kicker="Selected link" help="Drag the line on the sheet to bend it. Stars come from the p value: *** below 0.005, ** up to 0.01, * up to 0.05, n.s. above.">
          {organLink(d, e) ? <Select id="wh-kind" label="Interaction" value={e.kind || 'stimulates'} options={KINDS} onChange={v => upE({ kind: v, color: undefined })} />
            : <Select id="wh-type" label="Type" value={e.type || 'process'} options={TYPES} onChange={v => upE({ type: v })} />}
          <div className="mk-pair">
            <TextIn id="wh-lname" label="Label" value={e.name} placeholder="e.g. raises" onChange={v => upE({ name: v }, 'ln')} />
            <TextIn id="wh-lp" label="p value" value={e.p} placeholder="e.g. 0.02" onChange={v => upE({ p: v }, 'lp')} />
          </div>
          <Swatches label="Colour" value={e.color} colors={[...colors, 'var(--edge-feedback-neg)', 'var(--accent-700)']} none="Grey" onChange={v => upE({ color: v })} />
          <Range id="wh-lw" label="Line width" value={num(e.width, 2)} min={1} max={6} step={0.5} onChange={v => upE({ width: v }, 'lw')} />
          <div className="sd-row-btns">
            <S.ToolButton compact onClick={() => upE({ from: e.to, to: e.from })}>Flip direction</S.ToolButton>
            <S.ToolButton compact onClick={() => upE({ bend: undefined })}>Auto bend</S.ToolButton>
          </div>
          <S.ToolButton onClick={() => { S2({ links: d.links.filter((x: any) => x !== e) }); setSel(null); }}>Delete link</S.ToolButton>
        </S.Panel>
      ) : null}
      <S.Panel kicker="Systems" help="Add more wheels beside the first one. Links inside a wheel show interactions within a system; links from one wheel to another show interactions between systems. Drag a wheel's centre to move it.">
        {multi(d) ? <>
          <Rows id="wh-sys" rows={d.systems} cols={[{ key: 'name', label: 'Extra system', w: '1.6fr' }, { key: 'label', label: 'Heading', w: '1.4fr', placeholder: 'Default' }, { key: 'R', label: 'Size', type: 'num', w: '0.7fr', placeholder: String(num(d.R, 205)) }, { key: 'color', label: 'Shade', type: 'color', colors }]}
            blank={() => { const look: any = {}; SV_KEYS.forEach(k => { if (d[k] != null) look[k] = d[k]; }); return { id: uid('S', d.systems.map((x: any) => x.id)), name: 'System ' + String.fromCharCode(66 + d.systems.length), ...look }; }} addLabel="+ Add system"
            onChange={(rows, key) => { const ids = new Set(rows.map((x: any) => x.id)); S2({ systems: rows, factors: d.factors.map((x: any) => x.sys && !ids.has(x.sys) ? { ...x, sys: undefined, angle: undefined } : x) }, key); }} />
          <Seg value={d.arrange || 'row'} options={[['row', 'Side by side'], ['column', 'Stacked'], ['grid', 'Grid']]}
            onChange={v => S2({ arrange: v, cx: undefined, cy: undefined, systems: d.systems.map((x: any) => ({ ...x, x: undefined, y: undefined })) })} />
          <Toggle on={d.halo !== false} label="Shade each system with a heading" onChange={v => S2({ halo: v })} />
          {d.halo !== false ? <>
            <Seg value={d.haloText || 'letter'} options={[['letter', 'System A'], ['name', 'Name'], ['both', 'A · Name'], ['none', 'None']]} onChange={v => S2({ haloText: v })} />
            <Toggle on={!!d.hubRepeat} label="Keep the centre circle and name when the heading names the system" onChange={v => S2({ hubRepeat: v })} />
            <p className="sd-help">Headings default to the choice above. Type your own heading for one system (e.g. Eating & Appetite) under Selected system, or click a heading on the sheet.</p>
          </> : null}
        </> : <S.ToolButton onClick={addSystem}>+ Add a second system beside this one</S.ToolButton>}
      </S.Panel>
      <S.Panel kicker="Circles" help="Choose points or labelled boxes for each circle. A second set of factors on a smaller circle, linked to the outer one. Organ–hormone mode names the rings and gives each link a kind: secretes, acts on, or inhibits.">
        {multi(d) ? <Select id="wh-icsys" label="Settings for" value={tid} options={sysOpts} onChange={v => setSel({ kind: 'system', id: v })} /> : null}
        <Toggle on={tic.on} label={multi(d) ? 'Inner circle in ' + (tsys.name || 'this system') : 'Inner circle'} onChange={v => upIC({ innerOn: v })} />
        <div className="mk-pair">
          <Select id="wh-oshape" label={(tic.on ? tic.outerName || 'Outer circle' : 'Circle') + ' shown as'} value={tic.outerShape} options={[['dot', 'Points'], ['box', 'Labelled boxes']]} onChange={v => upIC({ outerShape: v })} />
          {tic.on ? <Select id="wh-ishape" label={(tic.innerName || 'Inner circle') + ' shown as'} value={tic.innerShape} options={[['box', 'Labelled boxes'], ['dot', 'Points']]} onChange={v => upIC({ innerShape: v })} /> : null}
        </div>
        {tic.on ? <>
          <Seg value={tic.mode === 'organ' ? 'organ' : 'general'} options={[['general', 'General'], ['organ', 'Organ–hormone']]}
            onChange={v => upIC(v === 'organ' ? { mode: v, innerName: tic.innerName && tic.innerName !== 'Inner circle' ? tic.innerName : 'Organs', outerName: tic.outerName && tic.outerName !== 'Outer circle' ? tic.outerName : 'Hormones' } : { mode: v })} />
          <div className="mk-pair">
            <TextIn id="wh-iname" label="Inner set" value={tic.innerName} placeholder="e.g. Organs" onChange={v => upIC({ innerName: v }, 'iname-' + tid)} />
            <TextIn id="wh-oname" label="Outer set" value={tic.outerName} placeholder="e.g. Hormones" onChange={v => upIC({ outerName: v }, 'oname-' + tid)} />
          </div>
          <Range id="wh-iR" label="Inner circle size" value={innerRFor(d, tsys.R, tid)} min={70} max={Math.max(80, tsys.R - 50)} step={5}
            onChange={v => upIC({ innerR: tid ? v : Math.round(v * num(d.R, 205) / tsys.R) }, 'iR-' + tid)} />
        </> : null}
      </S.Panel>
      <Rows id="wh-f" kicker={anyInner(d) ? 'Factors on both circles' : 'Factors'} help="Click a factor on the sheet to edit it, or edit the rows here." rows={d.factors}
        cols={[...(anyInner(d)
          ? [{ key: 'code', label: 'Code', w: '0.8fr' }, { key: 'name', label: 'Name', w: '1.6fr' }, { key: 'ring', label: 'Circle', type: 'select', options: multi(d) ? [['', 'Outer'], ['inner', 'Inner']] : [['', (d.outerName || 'Outer').slice(0, 9)], ['inner', (d.innerName || 'Inner').slice(0, 9)]], w: '1fr' }, { key: 'color', label: 'Colour', type: 'color', colors }]
          : [{ key: 'code', label: 'Code', w: '0.9fr' }, { key: 'name', label: 'Name', w: '1.8fr' }, { key: 'role', label: 'Role', type: 'select', options: ROLE_OPTS, w: '1.2fr' }, { key: 'color', label: 'Colour', type: 'color', colors }] as any[]).slice(0, multi(d) ? -1 : undefined),
          ...(multi(d) ? [{ key: 'sys', label: 'System', type: 'select', options: sysList.map((s: any) => [s.id, String.fromCharCode(65 + s.k)]), w: '0.6fr' }, { key: 'color', label: 'Colour', type: 'color', colors }] : [])] as any}
        blank={() => { const id = uid('F', d.factors.map((x: any) => x.id)); return { id, code: id, name: 'New factor', role: '', color: colors[0], values: '' }; }}
        addLabel="+ Add factor" onChange={(rows, key) => S2({ factors: rows }, key)} />
      <Rows id="wh-l" kicker="Links" rows={d.links}
        cols={organMode(d)
          ? [{ key: 'from', label: 'From', type: 'select', options: names }, { key: 'kind', label: 'Interaction', type: 'select', options: [['secretes', 'Secretes'], ['stimulates', 'Acts on'], ['inhibits', 'Inhibits']] }, { key: 'to', label: 'To', type: 'select', options: names }]
          : [{ key: 'from', label: 'From', type: 'select', options: names }, { key: 'type', label: 'Type', type: 'select', options: TYPES }, { key: 'to', label: 'To', type: 'select', options: names }, { key: 'name', label: 'Label' }]}
        blank={() => ({ from: d.factors[0] && d.factors[0].id, to: d.factors[1] && d.factors[1].id, type: 'process', kind: d.factors[0] && d.factors[1] ? kindFor(d, d.factors[0].id, d.factors[1].id) : 'stimulates', name: '', p: '' })}
        addLabel="+ Add link" onChange={(rows, key) => S2({ links: rows.map((r: any) => orient(d, r)) }, key)} />
      <Rows id="wh-k" kicker="Colour key" rows={d.key} cols={[{ key: 'color', label: 'Colour', type: 'color', colors }, { key: 'label', label: 'Meaning' }]}
        blank={() => ({ color: colors[0], label: 'New group' })} addLabel="+ Add colour" onChange={(rows, key) => S2({ key: rows }, key)} />
      <S.Panel kicker={multi(d) ? 'Wheel · ' + (tsys.name || 'System ' + String.fromCharCode(65 + tsys.k)) : 'Wheel'} help={multi(d) ? 'Sizes, labels, numbers and the guide ring apply to the system chosen under "Settings for". Colours and the codebook apply to the whole sheet.' : undefined}>
        {multi(d) ? <Select id="wh-wsys" label="Settings for" value={tid} options={sysOpts} onChange={v => setSel({ kind: 'system', id: v })} /> : null}
        <S.Field id="wh-center" label="Centre title" value={tid ? tsys.name : d.center} placeholder="e.g. Drivers of fatty liver" onChange={(ev: any) => tid ? upIC({ name: ev.target.value }, 'center-' + tid) : S2({ center: ev.target.value }, 'center')} />
        <Range id="wh-R" label="Circle size" value={tsys.R} min={120} max={320} step={5} onChange={v => tid ? upIC({ R: v }, 'R-' + tid) : S2({ R: v }, 'R')} />
        <Range id="wh-hub" label="Centre size" value={Math.round(hubBase(d, tsys.R, tid))} min={30} max={160} step={2} onChange={v => upIC({ hubR: v }, 'hub-' + tid)} />
        <Range id="wh-fs" label="Label size" value={num(sv(d, tid, 'fontSize'), 12.5)} min={9} max={20} step={0.5} onChange={v => upIC({ fontSize: v }, 'fs-' + tid)} />
        <Range id="wh-ts" label="Centre text size" value={num(sv(d, tid, 'titleSize'), 21)} min={12} max={34} onChange={v => upIC({ titleSize: v }, 'ts-' + tid)} />
        <Select id="wh-labels" label={tic.on ? (tic.outerName || 'Outer circle') + ' labels' : 'Labels'} value={sv(d, tid, 'labels', 'Description')} options={[['Description', 'Names'], ['Code', 'Codes'], ['Both', 'Both']]} onChange={v => upIC({ labels: v })} />
        {tic.on ? <Select id="wh-ilabels" label={(tic.innerName || 'Inner circle') + ' labels'} value={sv(d, tid, 'innerLabels', 'Description')} options={[['Description', 'Names'], ['Code', 'Codes'], ['Both', 'Both']]} onChange={v => upIC({ innerLabels: v })} /> : null}
        <Toggle on={!!sv(d, tid, 'numbers')} label="Number the factors" onChange={v => upIC({ numbers: v })} />
        <Toggle on={sv(d, tid, 'guideRing', true) !== false} label="Guide ring" onChange={v => upIC({ guideRing: v })} />
        {multi(d) ? <S.ToolButton compact onClick={() => {
          const look: any = {}; SV_KEYS.forEach(k => { const v = sv(d, tid, k); if (v != null) look[k] = v; });
          const pos = (x: any) => ({ outerShape: icOf(d, tid).outerShape, innerShape: icOf(d, tid).innerShape });
          S2({ ...look, ...pos(null), systems: d.systems.map((x: any) => ({ ...x, ...look, ...pos(x) })) });
        }}>Copy this look to every system</S.ToolButton> : null}
        <p className="sd-help">Whole sheet</p>
        <Seg value={d.palette} options={[['sat', 'Saturated'], ['muted', 'Muted'], ['warm', 'Warm']]} onChange={setPalette} />
        <Toggle on={d.codebook} label="Codebook under the sheet" onChange={v => S2({ codebook: v })} />
        <S.ToolButton onClick={() => S2({ factors: d.factors.map((x: any) => ({ ...x, angle: undefined })), links: d.links.map((x: any) => ({ ...x, bend: undefined })) })}>Space evenly and reset bends</S.ToolButton>
      </S.Panel>
      <TextView id="wh-text" title="Edit as text" text={toText(d)} rows={12}
        help="Factor: CODE | Name | role | colour 1–8 | values. Link: A -> B, A ?> B, A -- B, A -| B, A ~> B, A => B (secretes), A <-> B, A <?> B (reciprocal), then : label p=0.02. A blank line separates factors from links."
        onChange={t => {
          const [fa, ...li] = t.split(/\n\s*\n/);
          const parsed = fromText({ factors: fa, links: li.join('\n'), key: '', palette: d.palette });
          const old: any = {}; d.factors.forEach((x: any) => { old[x.id] = x; });
          const keep = (x: any) => old[x.id] ? { angle: old[x.id].angle, radius: old[x.id].radius, ring: old[x.id].ring, sys: old[x.id].sys } : {};
          S2({ factors: parsed.factors.map((x: any) => ({ ...x, ...keep(x) })), links: parsed.links }, 'text');
        }} />
    </>
  );
}

const TPL = (x: any) => normalize(x);

export const wheel: EditorDef = {
  id: 'system-thinking', num: '01', name: 'System Thinking Circle', field: 'Methods',
  blurb: 'Factors around a circle, relationships across it, study roles as rings: drag factors, bend links, recolour.',
  hint: 'Click a factor or link to edit it. Drag factors around the circle; drag a link to bend it.',
  normalize,
  templates: [
    {
      name: 'Liver biomarkers', desc: 'Smoking, alcohol and obesity on GGT and ALT', title: 'Liver biomarkers in smokers and alcohol users with obesity',
      data: TPL({
        center: 'Liver biomarkers in smokers and alcohol users with obesity', palette: 'sat', labels: 'Description', numbers: true, guideRing: true, codebook: true,
        factors: 'SMKSTAT | Smoking status | exposure | 1 | 0=Never, 1=Former, 2=Current\nALCWK | Alcohol intake, units per week | exposure | 1 | 1=None, 2=1–14, 3=15+\nBMICAT | Obesity / BMI category | | 6 | 1=Normal, 2=Overweight, 3=Obese\nOXSTR | Oxidative stress | mediator | 4\nINFLAM | Chronic inflammation | mediator | 4\nHOMAIR | Insulin resistance (HOMA-IR) | | 6\nHEPFAT | Hepatic fat build-up | | 6\nPAQ7D | Physical activity, days per week | confounder | 1\nALTAST | ALT / AST elevation | outcome | 2\nGGT | GGT elevation | outcome | 2\nFIB4 | Fibrosis risk (FIB-4) | | 4',
        links: 'SMKSTAT -> OXSTR : raises p=0.003\nALCWK -> OXSTR : raises\nBMICAT -> HOMAIR : drives p=0.02\nHOMAIR -> HEPFAT : promotes\nHEPFAT -> ALTAST : raises\nALCWK -> GGT : raises p<0.001\nOXSTR -> INFLAM : fuels\nINFLAM -> FIB4 : increases\nINFLAM ?> HOMAIR : worsens?\nPAQ7D -| HEPFAT\nGGT -- FIB4 : associated with p=0.21',
        key: '1 = Behavioural factor\n2 = Biomarker\n4 = Pathological process\n6 = Metabolic driver'
      })
    },
    {
      name: 'Organs and hormones', desc: 'Endocrine axes: organs inside, hormones outside', title: 'Organs and hormones of three endocrine axes and glucose control',
      caption: 'Organs sit on the inner circle and hormones on the outer circle. Grey arrows: the organ secretes the hormone. Steel arrows: the hormone acts on its target organ. Red bars: negative feedback.',
      data: (() => {
        const A = (f: number) => Math.round((-Math.PI / 2 + f * 2 * Math.PI) * 1000) / 1000;
        const org = (id: string, name: string, f: number, c: number) => ({ id, code: id, name, ring: 'inner', angle: A(f), color: 'var(--wheel-sat-' + c + ')', role: '', values: '' });
        const hor = (id: string, name: string, f: number, c: number) => ({ id, code: id, name, angle: A(f), color: 'var(--wheel-sat-' + c + ')', role: '', values: '' });
        const L = (from: string, to: string, kind: string) => ({ from, to, kind, type: kind === 'inhibits' ? 'inhibit' : 'process', name: '', p: '' });
        return {
          center: 'Endocrine control', palette: 'sat', labels: 'Code', numbers: false, guideRing: true, codebook: true, R: 240, innerR: 148, fontSize: 12.5, titleSize: 15,
          innerOn: true, mode: 'organ', innerName: 'Organs', outerName: 'Hormones',
          factors: [
            org('HYP', 'Hypothalamus', 0, 7), org('PIT', 'Pituitary', 0.143, 5), org('THY', 'Thyroid', 0.286, 2), org('ADR', 'Adrenal cortex', 0.429, 2),
            org('LIV', 'Liver', 0.571, 2), org('PAN', 'Pancreas', 0.714, 1), org('ADI', 'Adipose tissue', 0.857, 3),
            hor('CRH', 'Corticotropin-releasing hormone', 0.93, 7), hor('TRH', 'Thyrotropin-releasing hormone', 0.02, 7), hor('ACTH', 'Adrenocorticotropic hormone', 0.10, 5),
            hor('TSH', 'Thyroid-stimulating hormone', 0.18, 5), hor('GH', 'Growth hormone', 0.26, 5), hor('T3/T4', 'Thyroid hormones', 0.34, 2), hor('CORT', 'Cortisol', 0.44, 2),
            hor('IGF-1', 'Insulin-like growth factor 1', 0.54, 2), hor('GCG', 'Glucagon', 0.64, 1), hor('INS', 'Insulin', 0.73, 1), hor('LEP', 'Leptin', 0.83, 3)
          ],
          links: [
            L('HYP', 'CRH', 'secretes'), L('HYP', 'TRH', 'secretes'), L('CRH', 'PIT', 'stimulates'), L('TRH', 'PIT', 'stimulates'),
            L('PIT', 'ACTH', 'secretes'), L('PIT', 'TSH', 'secretes'), L('PIT', 'GH', 'secretes'),
            L('ACTH', 'ADR', 'stimulates'), L('TSH', 'THY', 'stimulates'), L('GH', 'LIV', 'stimulates'),
            L('THY', 'T3/T4', 'secretes'), L('ADR', 'CORT', 'secretes'), L('LIV', 'IGF-1', 'secretes'),
            L('PAN', 'INS', 'secretes'), L('PAN', 'GCG', 'secretes'), L('INS', 'LIV', 'stimulates'), L('INS', 'ADI', 'stimulates'), L('GCG', 'LIV', 'stimulates'),
            L('ADI', 'LEP', 'secretes'), L('LEP', 'HYP', 'stimulates'),
            L('CORT', 'HYP', 'inhibits'), L('CORT', 'PIT', 'inhibits'), L('T3/T4', 'PIT', 'inhibits'), L('IGF-1', 'PIT', 'inhibits')
          ],
          key: [{ color: 'var(--wheel-sat-7)', label: 'Hypothalamic' }, { color: 'var(--wheel-sat-5)', label: 'Pituitary' }, { color: 'var(--wheel-sat-2)', label: 'Peripheral gland and liver' }, { color: 'var(--wheel-sat-1)', label: 'Pancreatic' }, { color: 'var(--wheel-sat-3)', label: 'Adipose tissue' }]
        };
      })()
    },
    {
      name: 'Gut, liver and brain', desc: 'Three systems side by side with links between them', title: 'Interactions within and between the gut, liver and brain',
      caption: 'Each wheel is one organ system. Grey arrows link factors within a system; steel arrows link factors between systems.',
      data: (() => {
        const F = (id: string, name: string, c: number, sys?: string, role = '') => ({ id, code: id, name, role, color: 'var(--wheel-sat-' + c + ')', values: '', sys });
        const L = (from: string, to: string, type: string, name = '', p = '') => ({ from, to, type, name, p });
        return {
          center: 'Gut', palette: 'sat', labels: 'Description', numbers: true, guideRing: true, codebook: true, R: 160, hubR: 62, fontSize: 12, titleSize: 19, arrange: 'row', halo: true,
          systems: [{ id: 'LIVER', name: 'Liver' }, { id: 'BRAIN', name: 'Brain' }],
          factors: [
            F('FIB', 'Dietary fibre', 1, undefined, 'exposure'), F('MICRO', 'Microbial diversity', 1), F('SCFA', 'Short-chain fatty acids', 1, undefined, 'mediator'), F('PERM', 'Gut permeability', 1), F('LPS', 'Endotoxin (LPS)', 1), F('GLP1', 'GLP-1 secretion', 1),
            F('KUP', 'Kupffer cell activation', 4, 'LIVER'), F('INFL', 'Hepatic inflammation', 4, 'LIVER'), F('FAT', 'Hepatic fat', 4, 'LIVER'), F('IR', 'Hepatic insulin resistance', 4, 'LIVER', 'outcome'), F('BA', 'Bile acids', 4, 'LIVER'),
            F('VAG', 'Vagal afferent signalling', 6, 'BRAIN'), F('HYP', 'Hypothalamic satiety', 6, 'BRAIN'), F('APP', 'Appetite', 6, 'BRAIN', 'outcome'), F('MOOD', 'Low mood', 6, 'BRAIN')
          ],
          links: [
            L('FIB', 'MICRO', 'process', 'raises'), L('MICRO', 'SCFA', 'process', 'produces'), L('SCFA', 'PERM', 'inhibit'), L('PERM', 'LPS', 'process', 'leaks'), L('SCFA', 'GLP1', 'process'),
            L('KUP', 'INFL', 'process'), L('INFL', 'IR', 'process', 'drives'), L('FAT', 'IR', 'process', '', '0.003'),
            L('VAG', 'HYP', 'process'), L('HYP', 'APP', 'inhibit'),
            L('LPS', 'KUP', 'process', 'portal vein'), L('BA', 'MICRO', 'moderate', 'shapes'), L('GLP1', 'HYP', 'process', 'satiety'), L('SCFA', 'VAG', 'process'), L('INFL', 'MOOD', 'uncertain', 'cytokines'), L('APP', 'FAT', 'process', 'intake')
          ],
          key: [{ color: 'var(--wheel-sat-1)', label: 'Gut' }, { color: 'var(--wheel-sat-4)', label: 'Liver' }, { color: 'var(--wheel-sat-6)', label: 'Brain' }]
        };
      })()
    },
    {
      name: 'Fructose and obesity', desc: 'UPF intake to insulin and leptin resistance', title: 'Fructose intake and obesity',
      data: TPL({
        center: 'Fructose intake and obesity', palette: 'muted', labels: 'Description', numbers: true, guideRing: true, codebook: true,
        factors: 'UPF | Ultra-processed food intake | exposure | 1\nFRUC | Fructose intake | | 1\nURIC | Uric acid | mediator | 3\nTG | Hepatic triglyceride | mediator | 3\nVLDL | VLDL secretion | | 3\nINFL | Inflammation | mediator | 5\nIR | Insulin resistance | | 5\nLR | Leptin resistance | | 5\nPA | Physical activity | confounder | 2\nOB | Obesity | outcome | 7',
        links: 'UPF -> FRUC : raises\nFRUC -> URIC : converts\nFRUC -> TG : lipogenesis\nTG -> VLDL : exported as\nURIC -> INFL : promotes\nINFL -> IR : drives\nIR -> LR : worsens\nLR -> OB : overeating\nVLDL -> OB : stores\nPA -| IR',
        key: '1 = Diet\n3 = Hepatic metabolism\n5 = Signalling\n2 = Behaviour\n7 = Outcome'
      })
    }
  ],
  stats: d => { const n = normalize(d); if (multi(n)) return [[n.systems.length + 1, 'systems'], [n.factors.length, 'factors'], [n.links.length, 'links']]; return n.innerOn ? [[n.factors.filter((f: any) => f.ring !== 'inner').length, (n.outerName || 'outer').toLowerCase()], [n.factors.filter((f: any) => f.ring === 'inner').length, (n.innerName || 'inner').toLowerCase()], [n.links.length, 'links']] : [[n.factors.length, 'factors'], [n.links.length, 'links']]; },
  Controls,
  Overlay,
  findText: (data, text) => {
    const d = normalize(data), t = text.toLowerCase().trim();
    const f = d.factors.find((x: any) => String(x.name).toLowerCase() === t || String(x.code).toLowerCase() === t || (t.length > 5 && String(x.name).toLowerCase().includes(t)));
    if (f) return { kind: 'factor', id: f.id };
    const s = multi(d) && systemsOf(d).find((x: any) => String(x.name || '').toLowerCase() === t);
    if (s) return { kind: 'system', id: s.id };
    const e = d.links.find((x: any) => x.name && t.startsWith(String(x.name).toLowerCase()));
    return e ? { kind: 'link', id: lid(e) } : null;
  },
  blank: normalize({ center: 'Untitled system', palette: 'sat', labels: 'Description', numbers: true, guideRing: true, codebook: true, factors: 'EXP | Exposure | exposure | 1\nOUT | Outcome | outcome | 2', links: 'EXP -> OUT : affects', key: '' }),
  connect: { kind: 'factor', label: 'factor', make: (data, a, b) => { const d = normalize(data); const kind = kindFor(d, a, b); return { ...d, links: [...d.links, { from: a, to: b, type: kind === 'inhibits' ? 'inhibit' : 'process', kind, name: '', p: '' }] }; } },
  nudge: (data, sel, dx, dy) => {
    if (sel.kind === 'system') {
      const d = normalize(data), sys = systemsOf(d);
      const at = (s: any) => s.id === sel.id ? { x: s.x + dx, y: s.y + dy } : { x: s.x, y: s.y };
      return { ...d, cx: at(sys[0]).x, cy: at(sys[0]).y, systems: (d.systems || []).map((x: any) => ({ ...x, ...at(sys.find((s: any) => s.id === x.id)) })) };
    }
    if (sel.kind !== 'factor') return null;
    const d = normalize(data), g = geom(d), q = g.pos[sel.id]; if (!q) return null;
    const a = Math.atan2(q.y + dy - q.cy, q.x + dx - q.cx);
    return { ...d, factors: d.factors.map((f: any) => f.id === sel.id ? { ...f, angle: Math.round(a * 1000) / 1000 } : f) };
  },
  duplicate: (data, sel) => {
    if (sel.kind !== 'factor') return null;
    const d = normalize(data), f = d.factors.find((x: any) => x.id === sel.id); if (!f) return null;
    const id = uid('F', d.factors.map((x: any) => x.id));
    return { patch: { ...d, factors: [...d.factors, { ...f, id, code: id, name: f.name + ' (copy)', angle: undefined }] }, sel: { kind: 'factor', id } };
  },
  remove: (data, sel) => {
    const d = normalize(data);
    if (sel.kind === 'factor') return { ...d, factors: d.factors.filter((x: any) => x.id !== sel.id), links: d.links.filter((x: any) => x.from !== sel.id && x.to !== sel.id) };
    if (sel.kind === 'link') return { ...d, links: d.links.filter((x: any) => lid(x) !== sel.id) };
    if (sel.kind === 'system' && sel.id) {
      const gone = new Set(d.factors.filter((x: any) => x.sys === sel.id).map((x: any) => x.id));
      return { ...d, systems: d.systems.filter((x: any) => x.id !== sel.id), factors: d.factors.filter((x: any) => !gone.has(x.id)), links: d.links.filter((x: any) => !gone.has(x.from) && !gone.has(x.to)) };
    }
    return null;
  },
  Render: ({ data }) => {
    const d = normalize(data), m = model(d);
    if (!m.nodes.length) return <EmptyHint text="Add a factor in the sidebar to start the wheel." />;
    const g = geom(d);
    const wheels = g.sys.map((s: any) => {
      const ids = new Set(d.factors.filter((f: any) => !isInner(d, f) && !g.pos[f.id].box && g.pos[f.id].sys === s.id).map((f: any) => f.id));
      const nodes = m.nodes.filter((n: any) => ids.has(n.id)).map((n: any) => ({ ...n, angle: g.pos[n.id].a }));
      const edges = m.edges.filter((e: any) => ids.has(e.from) && ids.has(e.to) && !LAYER_TYPES.has(e.type)).map((e: any) => styled(d, e));
      const hub = hubFor(d, s.R, s.id), tsz = num(sv(d, s.id, 'titleSize'), 21), ts = icOf(d, s.id).on || multi(d) ? Math.min(tsz, Math.max(11, hub * 0.3)) : tsz;
      const bare = hubTitle(d, s) === '\u00a0';
      return <g key={'w' + s.k} className={bare ? 'wh-nohub' : undefined}><S.SystemWheel cx={s.x} cy={s.y} r={s.R} hubR={hub} fontSize={num(sv(d, s.id, 'fontSize'), 12.5)} titleSize={ts} title={hubTitle(d, s)}
        nodes={nodes} edges={edges} numbers={sv(d, s.id, 'numbers')} guideRing={sv(d, s.id, 'guideRing')} labels={sv(d, s.id, 'labels')} /></g>;
    });
    return <>
      <Halos d={d} />
      {d.links.some((e: any) => LAYER_TYPES.has(e.type)) ? <InnerLayer d={d} under /> : null}
      {wheels}
      {anyInner(d) || multi(d) || d.links.some((e: any) => LAYER_TYPES.has(e.type)) ? <InnerLayer d={d} /> : null}
    </>;
  },
  Below: ({ data }) => {
    const d = normalize(data), m = model(d);
    if (!d.codebook || !m.nodes.length) return null;
    if (multi(d)) {
      const g = geom(d), groups: any[] = [];
      g.sys.forEach((s: any) => [false, true].forEach(inn => {
        const ns = m.nodes.filter((n: any) => g.pos[n.id] && g.pos[n.id].sys === s.id && g.pos[n.id].inner === inn);
        if (ns.length) groups.push({ ns, title: String.fromCharCode(65 + s.k) + ' · ' + (s.name || 'System') + (icOf(d, s.id).on ? ' · ' + (inn ? icOf(d, s.id).innerName || 'Inner circle' : icOf(d, s.id).outerName || 'Outer circle') : '') });
      }));
      return <div className="wh-codebooks">{groups.map((gr, i) => <S.Codebook key={i} nodes={gr.ns} title={gr.title} legend={i === groups.length - 1 ? d.key : undefined} note={i === groups.length - 1 ? (organMode(d) ? false : undefined) : false} />)}</div>;
    }
    if (!d.innerOn) return <S.Codebook nodes={m.nodes} legend={d.key} />;
    const inner = new Set(d.factors.filter((f: any) => isInner(d, f)).map((f: any) => f.id));
    const o = m.nodes.filter((n: any) => !inner.has(n.id)), i = m.nodes.filter((n: any) => inner.has(n.id));
    const note = organMode(d) ? false : undefined;
    return <div className="wh-codebooks">
      {o.length ? <S.Codebook nodes={o} title={d.outerName || 'Outer circle'} legend={i.length ? undefined : d.key} note={note} /> : null}
      {i.length ? <S.Codebook nodes={i} title={d.innerName || 'Inner circle'} legend={d.key} note={note} /> : null}
    </div>;
  },
};
