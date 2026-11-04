/* Molecule layout and drawing for templates 19 (SAR) and 20 (mechanism).
   SmilesDrawer (bundled from npm) only supplies the 2D layout: atom positions, bond orders and rings.
   The drawing itself is done here in React SVG with the design tokens, so it follows the paper and
   night themes, exports cleanly, and every highlight or arrow can be pinned to an atom index. */
import SmilesDrawer from 'smiles-drawer';
import { S } from '../sheet';

export interface Atom { i: number; el: string; x: number; y: number; charge: number; hcount: number | null; cls: number | null; arom: boolean; nb: number[] }
export interface Bond { a: number; b: number; order: number; arom: boolean; ring: number | null }
export interface Mol { atoms: Atom[]; bonds: Bond[]; rings: { members: number[]; cx: number; cy: number }[]; error?: string }
export interface Place { x: number; y: number; scale?: number; rot?: number; flip?: boolean }

const BOND = 30; // SmilesDrawer's bond length in its own units
const VALENCE: any = { B: 3, C: 4, N: 3, O: 2, P: 3, S: 2, F: 1, Cl: 1, Br: 1, I: 1, Si: 4, Se: 2 };
const cache = new Map<string, Mol>();

/* Kekulé structure for aromatic rings: a perfect matching on the aromatic atoms that need a double bond */
function kekulize(atoms: Atom[], bonds: Bond[]) {
  const needs = (a: Atom) => a.arom && (a.el === 'C' || (a.el === 'N' && !(a.hcount && a.hcount > 0) && a.charge === 0) || (a.el === 'N' && a.charge === 1));
  const ab = bonds.filter(b => b.arom);
  const mate: any = {};
  const order = atoms.filter(needs).map(a => a.i);
  const adj = (i: number) => ab.filter(b => b.a === i || b.b === i).map(b => (b.a === i ? b.b : b.a)).filter(j => needs(atoms[j]));
  let steps = 0;
  const solve = (k: number): boolean => {
    if (++steps > 20000) return false;
    while (k < order.length && mate[order[k]] != null) k++;
    if (k >= order.length) return true;
    const i = order[k];
    for (const j of adj(i)) if (mate[j] == null) { mate[i] = j; mate[j] = i; if (solve(k + 1)) return true; mate[i] = mate[j] = null; }
    return false;
  };
  const ok = solve(0);
  ab.forEach(b => { b.order = ok && mate[b.a] === b.b ? 2 : 1; });
}

export function layout(smiles: string): Mol {
  const key = String(smiles || '').trim();
  if (cache.has(key)) return cache.get(key)!;
  let mol: Mol = { atoms: [], bonds: [], rings: [], error: key ? undefined : 'Type a SMILES string.' };
  if (key) {
    try {
      const d = new (SmilesDrawer as any).SvgDrawer({ width: 500, height: 400, compactDrawing: false });
      (SmilesDrawer as any).parse(key, (tree: any) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        d.draw(tree, svg, 'light', false);
        const g = d.preprocessor.graph;
        const atoms: Atom[] = g.vertices.map((v: any) => {
          const br = v.value.bracket || {};
          return { i: v.id, el: v.value.element, x: v.position.x, y: v.position.y, charge: br.charge || 0, hcount: v.value.bracket ? (br.hcount || 0) : null, cls: v.value.class != null ? v.value.class : null, arom: !!v.value.isPartOfAromaticRing, nb: [] };
        });
        const bonds: Bond[] = g.edges.filter((e: any) => e.bondType !== '.').map((e: any) => ({ a: e.sourceId, b: e.targetId, order: e.bondType === '=' ? 2 : e.bondType === '#' ? 3 : 1, arom: !!e.isPartOfAromaticRing, ring: null }));
        bonds.forEach(b => { atoms[b.a].nb.push(b.b); atoms[b.b].nb.push(b.a); });
        const rings = (d.preprocessor.rings || []).map((r: any) => {
          const m = r.members as number[];
          return { members: m, cx: m.reduce((s, i) => s + atoms[i].x, 0) / m.length, cy: m.reduce((s, i) => s + atoms[i].y, 0) / m.length };
        });
        bonds.forEach(b => { const r = rings.findIndex((r: any) => r.members.includes(b.a) && r.members.includes(b.b)); b.ring = r >= 0 ? r : null; });
        kekulize(atoms, bonds);
        mol = { atoms, bonds, rings };
      }, (e: any) => { mol = { atoms: [], bonds: [], rings: [], error: 'Could not read this SMILES: ' + String(e && e.message || e).slice(0, 80) }; });
    } catch (e: any) { mol = { atoms: [], bonds: [], rings: [], error: 'Could not read this SMILES: ' + String(e && e.message || e).slice(0, 80) }; }
  }
  cache.set(key, mol);
  return mol;
}

/* centre the molecule on (0, 0), then scale, rotate, mirror and move it */
export function place(mol: Mol, p: Place) {
  const xs = mol.atoms.map(a => a.x), ys = mol.atoms.map(a => a.y);
  const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0, cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
  const s = (p.scale || 44) / BOND, r = (p.rot || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
  const f = (x: number, y: number): [number, number] => { let u = (x - cx) * s, v = (y - cy) * s; if (p.flip) u = -u; return [p.x + u * c - v * sn, p.y + u * sn + v * c]; };
  return { pt: (i: number) => f(mol.atoms[i].x, mol.atoms[i].y), ringC: (k: number) => f(mol.rings[k].cx, mol.rings[k].cy), scale: s };
}

export function hydrogens(mol: Mol, a: Atom) {
  if (a.hcount != null) return a.hcount;
  if (a.el === '*' || VALENCE[a.el] == null) return 0;
  let v = VALENCE[a.el];
  if (a.charge && ['N', 'P', 'O', 'S'].includes(a.el)) v += a.charge;
  if (a.charge && a.el === 'C') v -= 1;
  const used = mol.bonds.filter(b => b.a === a.i || b.b === a.i).reduce((s, b) => s + b.order, 0);
  return Math.max(0, v - used);
}
const chargeText = (q: number) => (q ? '^{' + (Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '−') + '}' : '');
/* the written label of an atom, split so the element symbol sits exactly on the atom:
   el (centred on the atom), h (hydrogens, on the side away from the neighbours) and charge */
export interface Label { el: string; h: string; side: 'left' | 'right'; charge: string }
export function labelParts(mol: Mol, a: Atom, showC: boolean, pts?: (i: number) => [number, number]): Label | null {
  if (a.el === '*') return { el: 'R' + (a.cls != null ? '_{' + a.cls + '}' : ''), h: '', side: 'right', charge: '' };
  if (a.el === 'C' && !showC && !a.charge && a.nb.length > 0) return null;
  const n = hydrogens(mol, a), h = n ? 'H' + (n > 1 ? '_{' + n + '}' : '') : '';
  let side: 'left' | 'right' = 'right';
  if (h && pts && a.nb.length) { const p = pts(a.i), mx = a.nb.reduce((s, j) => s + pts(j)[0], 0) / a.nb.length; if (mx > p[0] + 1) side = 'left'; }
  return { el: a.el, h, side, charge: chargeText(a.charge) };
}
export function label(mol: Mol, a: Atom, showC: boolean, pts?: (i: number) => [number, number]) {
  const L = labelParts(mol, a, showC, pts); if (!L) return '';
  return (L.side === 'left' ? L.h + L.el : L.el + L.h) + L.charge;
}
const glyphW = (s: string) => s.replace(/[_^]\{([^}]*)\}/g, (_m, x) => x.slice(0, 0) + '¸'.repeat(x.length)).split('').reduce((w, c) => w + (c === '¸' ? 6.3 : /[a-z]/.test(c) ? 8.3 : 10.6), 0);
/* directions around an atom that are taken: bonds, plus the side its written hydrogens sit on */
export function takenAngles(mol: Mol, i: number, pt: (i: number) => [number, number], showC: boolean) {
  const p = pt(i), out = mol.atoms[i].nb.map(j => { const q = pt(j); return Math.atan2(q[1] - p[1], q[0] - p[0]); });
  const L = labelParts(mol, mol.atoms[i], showC, pt);
  if (L && L.h) out.push(L.side === 'left' ? Math.PI : 0);
  if (L && L.charge) out.push(-Math.PI / 4);
  return out;
}
/* the k-th best free direction: candidates every 45°, ranked by distance from anything taken */
export function slotAngle(mol: Mol, i: number, pt: (i: number) => [number, number], showC: boolean, k: number) {
  /* greedy: each new slot takes the candidate farthest from the bonds, the hydrogens and the slots already used */
  const taken = takenAngles(mol, i, pt, showC), used: number[] = [];
  const gap = (a: number, t: number) => Math.abs(((a - t) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  const cand = Array.from({ length: 8 }, (_, j) => -Math.PI / 2 + j * Math.PI / 4);
  let pick = cand[0];
  for (let s = 0; s <= ((k % 8) + 8) % 8; s++) {
    const all = [...taken, ...used];
    let best = -1;
    cand.forEach(a => { if (used.includes(a)) return; const dd = all.length ? Math.min(...all.map(t => gap(a, t))) : Math.PI; if (dd > best + 1e-9) { best = dd; pick = a; } });
    used.push(pick);
  }
  return pick;
}
/* direction with the most free room around an atom, as an angle in radians */
export function freeAngle(mol: Mol, i: number, pt: (i: number) => [number, number], k = 0) {
  const p = pt(i), angs = mol.atoms[i].nb.map(j => { const q = pt(j); return Math.atan2(q[1] - p[1], q[0] - p[0]); }).sort((a, b) => a - b);
  if (!angs.length) return -Math.PI / 2 + k * Math.PI / 2;
  if (angs.length === 1) return angs[0] + Math.PI + (k ? (k % 2 ? 1 : -1) * Math.PI / 2.4 * Math.ceil(k / 2) : 0);
  const gaps = angs.map((a, j) => { const b = j + 1 < angs.length ? angs[j + 1] : angs[0] + 2 * Math.PI; return { mid: (a + b) / 2, size: b - a }; }).sort((x, y) => y.size - x.size);
  return gaps[k % gaps.length].mid;
}

export function Molecule(p: { mol: Mol; at: Place; showC?: boolean; numbers?: boolean; className?: string }) {
  const { mol } = p;
  if (mol.error) return <text className="mol-error" x={p.at.x} y={p.at.y}>{mol.error}</text>;
  const pl = place(mol, p.at), pt = pl.pt;
  const parts = mol.atoms.map(a => labelParts(mol, a, !!p.showC, pt));
  const labels = parts.map(L => (L ? L.el : ''));
  const out: any[] = [];
  mol.bonds.forEach((b, k) => {
    let [x1, y1] = pt(b.a), [x2, y2] = pt(b.b);
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const cut = (s: string) => (s ? 10.5 : 0);
    const ca = cut(labels[b.a]), cb = cut(labels[b.b]);
    x1 += ux * ca; y1 += uy * ca; x2 -= ux * cb; y2 -= uy * cb;
    const nx = -uy, ny = ux, line = (o: number, s0 = 0, s1 = 0, dash?: string) =>
      out.push(<line key={'b' + k + ':' + o + ':' + s0} className="mol-bond" x1={x1 + nx * o + ux * s0} y1={y1 + ny * o + uy * s0} x2={x2 + nx * o - ux * s1} y2={y2 + ny * o - uy * s1} style={dash ? { strokeDasharray: dash } : undefined} />);
    if (b.order === 1) line(0);
    else if (b.order === 3) { line(0); line(4); line(-4); }
    else if (b.ring != null) {
      /* ring double bond: second line inside the ring, a little shorter */
      const [rx, ry] = pl.ringC(b.ring), side = (rx - (x1 + x2) / 2) * nx + (ry - (y1 + y2) / 2) * ny > 0 ? 1 : -1;
      line(0); line(5.5 * side, ca ? 0 : 6, cb ? 0 : 6);
    } else { line(2.6); line(-2.6); }
  });
  mol.atoms.forEach((a, i) => {
    const [x, y] = pt(i);
    const L = parts[i];
    if (L) {
      const cls = 'mol-atom mol-' + a.el.toLowerCase(), half = glyphW(L.el) / 2;
      out.push(<S.ChemText key={'l' + i} className={cls} x={x} y={y + 5.5} textAnchor="middle">{L.el}</S.ChemText>);
      if (L.h) out.push(<S.ChemText key={'h' + i} className={cls} x={L.side === 'left' ? x - half - 0.5 : x + half + 0.5} y={y + 5.5} textAnchor={L.side === 'left' ? 'end' : 'start'}>{L.h}</S.ChemText>);
      if (L.charge) {
        const cx = x + half + (L.side === 'right' && L.h ? glyphW(L.h) + 1 : 1);
        out.push(<S.ChemText key={'q' + i} className="mol-charge" x={cx} y={y + 5.5} textAnchor="start">{L.charge}</S.ChemText>);
      }
    }
    if (p.numbers) out.push(<text key={'n' + i} className="mol-num" x={x + 7} y={y - 7}>{i}</text>);
  });
  return <g className={'mol ' + (p.className || '')}>{out}</g>;
}

/* every point an arrow can snap to: atoms, bond midpoints and lone-pair positions */
export function anchors(mol: Mol, at: Place) {
  if (mol.error) return [];
  const pl = place(mol, at), out: any[] = [];
  mol.atoms.forEach((a, i) => { const [x, y] = pl.pt(i); out.push({ kind: 'atom', atom: i, x, y }); });
  mol.bonds.forEach(b => { const [x1, y1] = pl.pt(b.a), [x2, y2] = pl.pt(b.b); out.push({ kind: 'bond', bond: [b.a, b.b], x: (x1 + x2) / 2, y: (y1 + y2) / 2 }); });
  return out;
}
