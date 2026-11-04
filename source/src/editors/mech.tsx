import { useState } from 'react';
import { S } from '../sheet';
import { num, Range, Rows, Seg, Select, startDrag, Swatches, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';
import { labelParts, layout, Molecule, place, slotAngle } from '../lib/molecule';

/* 20 · Curly-arrow reaction mechanism. Version 1: steps of species drawn from SMILES, electron marks on atoms,
   curly arrows whose ends snap to lone pairs, bonds or atoms, dashed partial bonds and a transition-state bracket.
   It is not a free-hand chemical editor. */

const PH = 270, CY = 150, GAP = 140;
const SW = Array.from({ length: 16 }, (_, i) => 'var(--swatch-' + (i + 1) + ')');
const MARKS: [string, string][] = [['lp', 'Lone pair'], ['radical', 'Radical'], ['plus', 'Charge +'], ['minus', 'Charge −'], ['dplus', 'δ+'], ['dminus', 'δ−']];

function norm(d: any) {
  return { scale: 40, showC: true, nums: false, colour: false, ...d,
    panels: Array.isArray(d.panels) ? d.panels : [], species: Array.isArray(d.species) ? d.species : [], marks: Array.isArray(d.marks) ? d.marks : [],
    arrows: Array.isArray(d.arrows) ? d.arrows : [], partials: Array.isArray(d.partials) ? d.partials : [] };
}

/* ---------- geometry ---------- */
function panelBoxes(d: any) {
  let x = 30;
  return d.panels.map((p: any) => { const w = num(p.width, 300), b = { id: p.id, x, w, cx: x + w / 2 }; x += w + GAP; return b; });
}
function spPlace(d: any, sp: any, boxes: any[]) {
  const b = boxes.find(x => x.id === sp.panel) || boxes[0] || { cx: 180 };
  return { x: b.cx + num(sp.x, 0), y: CY + num(sp.y, 0), scale: num(d.scale, 40), rot: num(sp.rot, 0), flip: !!sp.flip };
}
const showCOf = (d: any, sp: any) => (sp.showC != null ? !!sp.showC : !!d.showC);
function ctx(d: any) {
  const boxes = panelBoxes(d), cache: any = {};
  const get = (spId: string) => {
    if (cache[spId]) return cache[spId];
    const sp = d.species.find((s: any) => s.id === spId); if (!sp) return null;
    const mol = layout(sp.smiles), at = spPlace(d, sp, boxes);
    if (mol.error) return (cache[spId] = { sp, mol, at, pt: () => [at.x, at.y], err: true });
    const pl = place(mol, at);
    return (cache[spId] = { sp, mol, at, pt: pl.pt, labelled: (i: number) => !!labelParts(mol, mol.atoms[i], showCOf(d, sp), pl.pt) });
  };
  return { boxes, get };
}
function markPos(d: any, c: any, m: any) {
  const s = c.get(m.sp); if (!s || s.err || !s.mol.atoms[m.atom]) return null;
  const same = d.marks.filter((x: any) => x.sp === m.sp && x.atom === m.atom);
  const slot = m.slot != null && m.slot !== '' ? num(m.slot, 0) : same.indexOf(m);
  const ang = slotAngle(s.mol, m.atom, s.pt, showCOf(d, s.sp), slot);
  const [x, y] = s.pt(m.atom), r = s.labelled(m.atom) ? 15 : 9;
  return { x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r, ang };
}
function refPoint(d: any, c: any, ref: any, head: boolean) {
  if (!ref) return null;
  if (ref.kind === 'lp') { const m = d.marks.find((x: any) => x.id === ref.mark); const p = m && markPos(d, c, m); return p ? { x: p.x + Math.cos(p.ang) * 3, y: p.y + Math.sin(p.ang) * 3, cut: 0 } : null; }
  const s = c.get(ref.sp); if (!s || s.err) return null;
  if (ref.kind === 'bond') {
    const [a, b] = ref.bond || []; if (!s.mol.atoms[a] || !s.mol.atoms[b]) return null;
    const p = s.pt(a), q = s.pt(b); return { x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2, cut: head ? 4 : 0 };
  }
  if (!s.mol.atoms[ref.atom]) return null;
  const p = s.pt(ref.atom); return { x: p[0], y: p[1], cut: s.labelled(ref.atom) ? 14 : 7 };
}
/* a cubic Bézier bowed to one side; bend is the bow height as a share of the arrow's length */
function curly(d: any, c: any, a: any) {
  const P = refPoint(d, c, a.from, false), Q = refPoint(d, c, a.to, true); if (!P || !Q) return null;
  const vx = Q.x - P.x, vy = Q.y - P.y, L = Math.hypot(vx, vy) || 1, nx = -vy / L, ny = vx / L, h = num(a.bend, 0.45) * Math.max(L, 56);
  const C1 = { x: P.x + vx * 0.2 + nx * h, y: P.y + vy * 0.2 + ny * h }, C2 = { x: P.x + vx * 0.8 + nx * h, y: P.y + vy * 0.8 + ny * h };
  /* pull the head back along its tangent so it stops short of a written atom label */
  let tx = Q.x - C2.x, ty = Q.y - C2.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  const H = { x: Q.x - tx * Q.cut, y: Q.y - ty * Q.cut };
  const mid = { x: 0.125 * P.x + 0.375 * C1.x + 0.375 * C2.x + 0.125 * H.x, y: 0.125 * P.y + 0.375 * C1.y + 0.375 * C2.y + 0.125 * H.y };
  return { P, C1, C2, H, tx, ty, nx, ny, L, mid };
}

/* ---------- drawing ---------- */
function Marks({ d, c }: any) {
  const out: any[] = [];
  d.marks.forEach((m: any) => {
    const p = markPos(d, c, m); if (!p) return;
    const px = -Math.sin(p.ang), py = Math.cos(p.ang);
    if (m.kind === 'lp') out.push(<g key={m.id} className="mech-lp"><circle cx={p.x + px * 3.4} cy={p.y + py * 3.4} r={1.9} /><circle cx={p.x - px * 3.4} cy={p.y - py * 3.4} r={1.9} /></g>);
    else if (m.kind === 'radical') out.push(<circle key={m.id} className="mech-lp" cx={p.x} cy={p.y} r={2.3} />);
    else {
      const t = m.kind === 'plus' ? '+' : m.kind === 'minus' ? '−' : m.kind === 'dplus' ? 'δ+' : 'δ−';
      const q = { x: p.x + Math.cos(p.ang) * 3, y: p.y + Math.sin(p.ang) * 3 };
      out.push(<g key={m.id}>{m.kind === 'plus' || m.kind === 'minus' ? <circle className="mech-qring" cx={q.x} cy={q.y} r={6.4} /> : null}
        <text className={m.kind.startsWith('d') ? 'mech-delta' : 'mech-q'} x={q.x} y={q.y + 4.3} textAnchor="middle">{t}</text></g>);
    }
  });
  return <g>{out}</g>;
}
function Curly({ d, c, a }: any) {
  const g = curly(d, c, a); if (!g) return null;
  const col = a.color || 'var(--swatch-11)', hs = 9;
  const end = { x: g.H.x - g.tx * hs * 0.6, y: g.H.y - g.ty * hs * 0.6 };
  const path = `M${g.P.x},${g.P.y} C${g.C1.x},${g.C1.y} ${g.C2.x},${g.C2.y} ${end.x},${end.y}`;
  const ox = -g.ty, oy = g.tx, sgn = num(a.bend, 0.45) >= 0 ? 1 : -1;
  /* full head for an electron pair; a fishhook (one barb, on the outside of the curve) for one electron */
  const head = a.half
    ? `M${g.H.x},${g.H.y} L${g.H.x - g.tx * hs + ox * hs * 0.55 * sgn},${g.H.y - g.ty * hs + oy * hs * 0.55 * sgn} L${g.H.x - g.tx * hs * 0.6},${g.H.y - g.ty * hs * 0.6} z`
    : `M${g.H.x},${g.H.y} L${g.H.x - g.tx * hs + ox * hs * 0.5},${g.H.y - g.ty * hs + oy * hs * 0.5} L${g.H.x - g.tx * hs * 0.7},${g.H.y - g.ty * hs * 0.7} L${g.H.x - g.tx * hs - ox * hs * 0.5},${g.H.y - g.ty * hs - oy * hs * 0.5} z`;
  return <g className="mech-curly"><path d={path} style={{ stroke: col }} /><path className="mech-head" d={head} style={{ fill: col }} /></g>;
}
function Partials({ d, c }: any) {
  return <g>{d.partials.map((p: any) => {
    const A = c.get(p.a && p.a.sp), B = c.get(p.b && p.b.sp); if (!A || !B || A.err || B.err) return null;
    const a = A.pt(p.a.atom), b = B.pt(p.b.atom); if (!a || !b) return null;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ca = A.labelled(p.a.atom) ? 12 : 3, cb = B.labelled(p.b.atom) ? 12 : 3;
    return <line key={p.id} className="mech-partial" x1={a[0] + dx / L * ca} y1={a[1] + dy / L * ca} x2={b[0] - dx / L * cb} y2={b[1] - dy / L * cb} />;
  })}</g>;
}
function panelExtent(d: any, c: any, p: any) {
  const pts: number[][] = [];
  d.species.filter((s: any) => s.panel === p.id).forEach((s: any) => { const g = c.get(s.id); if (!g || g.err) return; g.mol.atoms.forEach((_: any, i: number) => pts.push(g.pt(i))); });
  if (!pts.length) return null;
  return { x0: Math.min(...pts.map(q => q[0])) - 26, x1: Math.max(...pts.map(q => q[0])) + 26, y0: Math.min(...pts.map(q => q[1])) - 26, y1: Math.max(...pts.map(q => q[1])) + 26 };
}

function Render({ data }: any) {
  const d = norm(data), c = ctx(d), out: any[] = [];
  d.panels.forEach((p: any, k: number) => {
    const b = c.boxes[k];
    if (p.ts) {
      const e = panelExtent(d, c, p);
      if (e) out.push(<g key={'ts' + p.id} className="mech-ts">
        <path d={`M${e.x0 + 8},${e.y0} H${e.x0} V${e.y1} H${e.x0 + 8}`} /><path d={`M${e.x1 - 8},${e.y0} H${e.x1} V${e.y1} H${e.x1 - 8}`} />
        <text className="mech-dagger" x={e.x1 + 5} y={e.y0 + 10}>‡</text></g>);
    }
    if (k < d.panels.length - 1) {
      const x0 = b.x + b.w + 14, x1 = c.boxes[k + 1].x - 14;
      out.push(<g key={'rx' + p.id} className="mech-step">
        <line x1={x0} y1={CY} x2={x1 - 10} y2={CY} /><path d={`M${x1},${CY} l-12,-5 l3,5 l-3,5 z`} />
        {p.reagent ? <S.ChemText className="mech-reagent" x={(x0 + x1) / 2} y={CY - 10} textAnchor="middle">{p.reagent}</S.ChemText> : null}
        {p.condition ? <S.ChemText className="mech-cond" x={(x0 + x1) / 2} y={CY + 22} textAnchor="middle">{p.condition}</S.ChemText> : null}
      </g>);
    }
    if (p.caption) out.push(<S.ChemText key={'cap' + p.id} className="mech-cap" x={b.cx} y={CY + PH / 2 - 6} textAnchor="middle">{p.caption}</S.ChemText>);
  });
  out.push(<Partials key="partials" d={d} c={c} />);
  d.species.forEach((s: any) => { const g = c.get(s.id); if (g) out.push(<Molecule key={'sp' + s.id} mol={g.mol} at={g.at} showC={showCOf(d, s)} numbers={d.nums} className={d.colour ? 'mol-colour' : ''} />); });
  out.push(<Marks key="marks" d={d} c={c} />);
  d.arrows.forEach((a: any) => out.push(<Curly key={'cu' + a.id} d={d} c={c} a={a} />));
  return <g className="mech">{out}</g>;
}

/* ---------- editing on the sheet ---------- */
function anchorsIn(d: any, c: any, panel: string, head: boolean) {
  const out: any[] = [];
  d.species.filter((s: any) => s.panel === panel).forEach((s: any) => {
    const g = c.get(s.id); if (!g || g.err) return;
    g.mol.atoms.forEach((_: any, i: number) => { const p = g.pt(i); out.push({ ref: { kind: 'atom', sp: s.id, atom: i }, x: p[0], y: p[1] }); });
    g.mol.bonds.forEach((b: any) => { const p = g.pt(b.a), q = g.pt(b.b); out.push({ ref: { kind: 'bond', sp: s.id, bond: [b.a, b.b] }, x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2 }); });
    if (!head) d.marks.filter((m: any) => m.sp === s.id && m.kind === 'lp').forEach((m: any) => { const p = markPos(d, c, m); if (p) out.push({ ref: { kind: 'lp', mark: m.id, sp: s.id }, x: p.x, y: p.y, w: 0.6 }); });
  });
  return out;
}
const panelOfRef = (d: any, ref: any) => { const sid = ref && (ref.sp || (d.marks.find((m: any) => m.id === ref.mark) || {}).sp); return (d.species.find((s: any) => s.id === sid) || {}).panel; };

function Overlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const d = norm(data), c = ctx(d), out: any[] = [];
  const upArr = (a: any, p: any, key: string) => set({ arrows: d.arrows.map((x: any) => x === a ? { ...x, ...p } : x) }, key);
  d.species.forEach((s: any) => {
    const g = c.get(s.id); if (!g) return;
    let bb = [g.at.x - 40, g.at.y - 20, 80, 40];
    if (!g.err && g.mol.atoms.length) { const P = g.mol.atoms.map((_: any, i: number) => g.pt(i)), xs = P.map((p: any) => p[0]), ys = P.map((p: any) => p[1]); bb = [Math.min(...xs) - 16, Math.min(...ys) - 16, Math.max(...xs) - Math.min(...xs) + 32, Math.max(...ys) - Math.min(...ys) + 32]; }
    const on = sel && sel.kind === 'species' && sel.id === s.id, x0 = num(s.x, 0), y0 = num(s.y, 0);
    out.push(<rect key={'s' + s.id} className={'mk-hit' + (on ? ' mk-on' : '')} x={bb[0]} y={bb[1]} width={bb[2]} height={bb[3]}
      onPointerDown={ev => { setSel({ kind: 'species', id: s.id }); startDrag(ev, toSvg, (dx, dy) => set({ species: d.species.map((x: any) => x === s ? { ...x, x: Math.round(x0 + dx), y: Math.round(y0 + dy) } : x) }, 'sp-' + s.id)); }} />);
  });
  d.partials.forEach((p: any) => {
    const A = c.get(p.a && p.a.sp), B = c.get(p.b && p.b.sp); if (!A || !B || A.err || B.err) return;
    const a = A.pt(p.a.atom), b = B.pt(p.b.atom), on = sel && sel.kind === 'partial' && sel.id === p.id;
    out.push(<line key={'p' + p.id} className={'mk-hit-line' + (on ? ' mk-on' : '')} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} onPointerDown={ev => { ev.stopPropagation(); setSel({ kind: 'partial', id: p.id }); }} />);
  });
  d.marks.forEach((m: any) => {
    const p = markPos(d, c, m); if (!p) return;
    const on = sel && sel.kind === 'mark' && sel.id === m.id;
    out.push(<circle key={'m' + m.id} className={'mk-hit' + (on ? ' mk-on' : '')} cx={p.x} cy={p.y} r={6} onPointerDown={ev => { ev.stopPropagation(); setSel({ kind: 'mark', id: m.id }); }} />);
  });
  d.arrows.forEach((a: any) => {
    const g = curly(d, c, a); if (!g) return;
    const on = sel && sel.kind === 'arrow' && sel.id === a.id;
    out.push(<path key={'a' + a.id} className={'mk-hit-line' + (on ? ' mk-on' : '')} d={`M${g.P.x},${g.P.y} C${g.C1.x},${g.C1.y} ${g.C2.x},${g.C2.y} ${g.H.x},${g.H.y}`} onPointerDown={ev => { ev.stopPropagation(); setSel({ kind: 'arrow', id: a.id }); }} />);
    if (!on) return;
    /* bend: drag the middle handle sideways */
    out.push(<circle key={'bend' + a.id} className="mk-hit mk-handle" cx={g.mid.x} cy={g.mid.y} r={6}
      onPointerDown={ev => startDrag(ev, toSvg, (_dx, _dy, at) => {
        const mx = (g.P.x + g.H.x) / 2, my = (g.P.y + g.H.y) / 2, off = (at[0] - mx) * g.nx + (at[1] - my) * g.ny;
        upArr(a, { bend: Math.max(-1.4, Math.min(1.4, Math.round(off / 0.75 / Math.max(g.L, 56) * 100) / 100)) }, 'bend-' + a.id);
      })} />);
    /* ends: drag them and they snap to the nearest lone pair, bond or atom in the same step */
    (['from', 'to'] as const).forEach(end => {
      const p = end === 'from' ? g.P : g.H, panel = panelOfRef(d, a[end]);
      out.push(<rect key={end + a.id} className="mk-hit mk-handle" x={p.x - 5} y={p.y - 5} width={10} height={10}
        onPointerDown={ev => startDrag(ev, toSvg, (_dx, _dy, at) => {
          const cand = anchorsIn(d, c, panel, end === 'to'); if (!cand.length) return;
          let best = cand[0], bd = Infinity;
          cand.forEach(q => { const dd = Math.hypot(q.x - at[0], q.y - at[1]) * (q.w || 1); if (dd < bd) { bd = dd; best = q; } });
          if (JSON.stringify(best.ref) !== JSON.stringify(a[end])) upArr(a, { [end]: best.ref }, end + '-' + a.id);
        })} />);
    });
  });
  return <>{out}</>;
}

/* ---------- panels ---------- */
const describe = (d: any, ref: any) => {
  if (!ref) return '–';
  if (ref.kind === 'lp') { const m = d.marks.find((x: any) => x.id === ref.mark); return m ? 'lone pair on atom ' + m.atom + ' of ' + spName(d, m.sp) : 'lone pair'; }
  if (ref.kind === 'bond') return 'bond ' + (ref.bond || []).join('–') + ' of ' + spName(d, ref.sp);
  return 'atom ' + ref.atom + ' of ' + spName(d, ref.sp);
};
const spName = (d: any, id: string) => { const s = d.species.find((x: any) => x.id === id); return s ? s.smiles : '?'; };

function Controls({ data, set, sel, setSel }: EditProps) {
  const d = norm(data);
  const S2 = (p: any, key?: string) => set({ ...d, ...p }, key);
  const find = (list: any[], kind: string) => (sel && sel.kind === kind ? list.find((x: any) => x.id === sel.id) : null);
  const sp = find(d.species, 'species'), ar = find(d.arrows, 'arrow'), mk = find(d.marks, 'mark'), pa = find(d.partials, 'partial');
  const up = (listKey: string, item: any, p: any, key?: string) => S2({ [listKey]: d[listKey].map((x: any) => x === item ? { ...x, ...p } : x) }, key);
  const panelOpts: [string, string][] = d.panels.map((p: any, k: number) => [p.id, 'Step ' + (k + 1)]);
  const addMark = (s: any, atom: number, kind: string) => { const id = uid('M', d.marks.map((x: any) => x.id)); S2({ marks: [...d.marks, { id, sp: s.id, atom, kind }] }); setSel({ kind: 'mark', id }); };
  const addArrow = (s: any) => {
    const lp = d.marks.find((m: any) => m.sp === s.id && m.kind === 'lp'), mol = layout(s.smiles);
    const from = lp ? { kind: 'lp', mark: lp.id, sp: s.id } : mol.bonds[0] ? { kind: 'bond', sp: s.id, bond: [mol.bonds[0].a, mol.bonds[0].b] } : { kind: 'atom', sp: s.id, atom: 0 };
    const other = d.species.find((x: any) => x.panel === s.panel && x !== s);
    const to = other ? { kind: 'atom', sp: other.id, atom: 0 } : { kind: 'atom', sp: s.id, atom: Math.min(1, Math.max(0, mol.atoms.length - 1)) };
    const id = uid('A', d.arrows.map((x: any) => x.id)); S2({ arrows: [...d.arrows, { id, from, to, bend: 0.45 }] }); setSel({ kind: 'arrow', id });
  };
  return <>
    {sp ? <SpeciesPanel d={d} sp={sp} up={(p: any, k?: string) => up('species', sp, p, k)} panelOpts={panelOpts} addMark={addMark} addArrow={addArrow}
      addPartial={(a: number, other: string, b: number) => { const id = uid('P', d.partials.map((x: any) => x.id)); S2({ partials: [...d.partials, { id, a: { sp: sp.id, atom: a }, b: { sp: other, atom: b } }] }); setSel({ kind: 'partial', id }); }}
      remove={() => { S2({ species: d.species.filter((x: any) => x !== sp), marks: d.marks.filter((m: any) => m.sp !== sp.id), arrows: d.arrows.filter((a: any) => (a.from || {}).sp !== sp.id && (a.to || {}).sp !== sp.id), partials: d.partials.filter((p: any) => p.a.sp !== sp.id && p.b.sp !== sp.id) }); setSel(null); }} /> : null}
    {ar ? <S.Panel kicker="Selected curly arrow" help="Drag the square ends on the sheet: each snaps to the nearest lone pair, bond or atom in its step. Drag the round handle to bend it.">
      <p className="sd-help">From {describe(d, ar.from)} to {describe(d, ar.to)}.</p>
      <Seg value={ar.half ? 'half' : 'full'} options={[['full', 'Two electrons (full head)'], ['half', 'One electron (fishhook)']]} onChange={v => up('arrows', ar, { half: v === 'half' })} />
      <Range id="mech-bend" label="Bend" value={num(ar.bend, 0.45)} min={-1.4} max={1.4} step={0.05} onChange={v => up('arrows', ar, { bend: v }, 'bend-' + ar.id)} />
      <Swatches label="Colour" value={ar.color} colors={SW} none="Red (default)" onChange={v => up('arrows', ar, { color: v })} />
      <div className="sd-row-btns">
        <S.ToolButton compact onClick={() => up('arrows', ar, { bend: -num(ar.bend, 0.45) })}>Bow to the other side</S.ToolButton>
        <S.ToolButton compact onClick={() => { S2({ arrows: d.arrows.filter((x: any) => x !== ar) }); setSel(null); }}>Delete arrow</S.ToolButton>
      </div>
    </S.Panel> : null}
    {mk ? <S.Panel kicker="Selected mark" help="Position steps through the free directions around the atom, starting with the roomiest.">
      <Select id="mech-mk" label="Mark" value={mk.kind} options={MARKS} onChange={v => up('marks', mk, { kind: v })} />
      <Range id="mech-slot" label="Position around the atom" value={mk.slot != null && mk.slot !== '' ? num(mk.slot, 0) : d.marks.filter((x: any) => x.sp === mk.sp && x.atom === mk.atom).indexOf(mk)} min={0} max={7} onChange={v => up('marks', mk, { slot: v }, 'slot-' + mk.id)} />
      <S.ToolButton compact onClick={() => { S2({ marks: d.marks.filter((x: any) => x !== mk), arrows: d.arrows.filter((a: any) => !(a.from && a.from.mark === mk.id)) }); setSel(null); }}>Delete mark</S.ToolButton>
    </S.Panel> : null}
    {pa ? <S.Panel kicker="Selected partial bond"><S.ToolButton compact onClick={() => { S2({ partials: d.partials.filter((x: any) => x !== pa) }); setSel(null); }}>Delete partial bond</S.ToolButton></S.Panel> : null}
    <Rows id="mech-p" kicker="Steps" help="Each step is a box of species. The reagent prints above the arrow after the step, the condition below it." rows={d.panels}
      cols={[{ key: 'reagent', label: 'Reagent', w: '1.3fr' }, { key: 'condition', label: 'Condition', w: '1.3fr' }, { key: 'ts', label: 'TS', type: 'check', placeholder: '‡' }, { key: 'width', label: 'Width', type: 'num', w: '0.7fr', placeholder: '300' }]}
      blank={() => ({ id: uid('P', d.panels.map((x: any) => x.id)), reagent: '', condition: '' })} addLabel={d.panels.length < 4 ? '+ Add step' : 'Four steps at most'}
      onChange={(rows, key) => { const keep = rows.slice(0, 4), ids = new Set(keep.map((x: any) => x.id)); S2({ panels: keep, species: d.species.filter((s: any) => ids.has(s.panel)) }, key); }} />
    <Rows id="mech-s" kicker="Species" help="One SMILES per species. Click a species on the sheet to add lone pairs, charges or arrows to it." rows={d.species}
      cols={[{ key: 'panel', label: 'Step', type: 'select', options: panelOpts, w: '0.9fr' }, { key: 'smiles', label: 'SMILES', w: '2.2fr' }]}
      blank={() => ({ id: uid('S', d.species.map((x: any) => x.id)), panel: d.panels[0] && d.panels[0].id, smiles: 'O', x: 0, y: 0 })} addLabel="+ Add species"
      onChange={(rows, key) => S2({ species: rows }, key)} />
    <S.Panel kicker="Drawing">
      <Range id="mech-scale" label="Bond length" value={num(d.scale, 40)} min={26} max={60} step={2} onChange={v => S2({ scale: v }, 'scale')} />
      <Toggle on={d.showC} label="Write carbon atoms (H₃C, CH₂)" onChange={v => S2({ showC: v })} />
      <Toggle on={d.nums} label="Show atom numbers" onChange={v => S2({ nums: v })} />
      <Toggle on={d.colour} label="Colour heteroatoms" onChange={v => S2({ colour: v })} />
    </S.Panel>
  </>;
}

function SpeciesPanel({ d, sp, up, panelOpts, addMark, addArrow, addPartial, remove }: any) {
  const mol = layout(sp.smiles);
  const atomOpts: [string, string][] = mol.atoms.map((a, i) => [String(i), i + ' · ' + (a.el === '*' ? 'R' : a.el)]);
  const others = d.species.filter((x: any) => x.panel === sp.panel && x !== sp);
  const [atomPick, setAtomPick] = useState('0'), [kindPick, setKindPick] = useState('lp');
  return <S.Panel kicker="Selected species" help="Drag it on the sheet. Turn on atom numbers to see which atom is which.">
    <TextIn id="mech-smiles" label="SMILES" value={sp.smiles} onChange={v => up({ smiles: v }, 'smi-' + sp.id)} />
    {mol.error ? <p className="sd-help" style={{ color: 'var(--edge-feedback-neg)' }}>{mol.error}</p> : null}
    <Select id="mech-sp-panel" label="Step" value={sp.panel} options={panelOpts} onChange={v => up({ panel: v })} />
    <Range id="mech-rot" label="Rotate (°)" value={num(sp.rot, 0)} min={-180} max={180} step={15} onChange={v => up({ rot: v }, 'rot-' + sp.id)} />
    <div className="sd-row-btns">
      <S.ToolButton compact onClick={() => up({ flip: !sp.flip })}>Mirror</S.ToolButton>
      <S.ToolButton compact onClick={() => up({ showC: !(sp.showC != null ? sp.showC : d.showC) })}>{(sp.showC != null ? sp.showC : d.showC) ? 'Hide carbons' : 'Write carbons'}</S.ToolButton>
    </div>
    {atomOpts.length ? <>
      <div className="mk-pair">
        <Select id="mech-add-atom" label="Atom" value={atomPick} options={atomOpts} onChange={setAtomPick} />
        <Select id="mech-add-kind" label="Mark" value={kindPick} options={MARKS} onChange={setKindPick} />
      </div>
      <div className="sd-row-btns">
        <S.ToolButton compact onClick={() => addMark(sp, parseInt(atomPick || '0', 10), kindPick || 'lp')}>Add mark</S.ToolButton>
        <S.ToolButton compact onClick={() => addArrow(sp)}>Add curly arrow</S.ToolButton>
      </div>
      {others.length ? <S.ToolButton compact onClick={() => addPartial(parseInt(atomPick || '0', 10), others[0].id, 0)}>Dashed partial bond to the next species</S.ToolButton> : null}
    </> : null}
    <S.ToolButton compact onClick={remove}>Delete species</S.ToolButton>
  </S.Panel>;
}

/* ---------- presets ---------- */
const P = (id: string, p: any = {}) => ({ id, reagent: '', condition: '', ...p });
const SP = (id: string, panel: string, smiles: string, x: number, y: number, p: any = {}) => ({ id, panel, smiles, x, y, ...p });
const LP = (id: string, sp: string, atom: number, kind = 'lp', p: any = {}) => ({ id, sp, atom, kind, ...p });
const AR = (id: string, from: any, to: any, bend = 0.45, p: any = {}) => ({ id, from, to, bend, ...p });
const lp = (mark: string, sp: string) => ({ kind: 'lp', mark, sp });
const atom = (sp: string, a: number) => ({ kind: 'atom', sp, atom: a });
const bond = (sp: string, a: number, b: number) => ({ kind: 'bond', sp, bond: [a, b] });

const SN2 = norm({
  panels: [P('P1', { reagent: '', condition: '' }), P('P2', { ts: true }), P('P3')],
  species: [SP('S1', 'P1', '[H][O-]', -100, 0, { flip: true, rot: -30 }), SP('S2', 'P1', 'CBr', 40, 0, { flip: true, rot: 30 }),
    SP('S3', 'P2', '[OH]', -100, 0), SP('S4', 'P2', '[CH3]', 0, 0), SP('S5', 'P2', '[Br]', 95, 0),
    SP('S6', 'P3', 'CO', -45, 0, { flip: true, rot: 30 }), SP('S7', 'P3', '[Br-]', 85, 0)],
  marks: [LP('M1', 'S1', 1), LP('M2', 'S1', 1), LP('M3', 'S1', 1), LP('M4', 'S2', 1), LP('M5', 'S2', 1), LP('M6', 'S2', 1),
    LP('M7', 'S3', 0, 'dminus'), LP('M8', 'S5', 0, 'dminus'), LP('M9', 'S7', 0), LP('M10', 'S7', 0), LP('M11', 'S7', 0), LP('M12', 'S7', 0)],
  arrows: [AR('A1', lp('M1', 'S1'), atom('S2', 0), -0.5), AR('A2', bond('S2', 0, 1), atom('S2', 1), -0.6)],
  partials: [{ id: 'PB1', a: { sp: 'S3', atom: 0 }, b: { sp: 'S4', atom: 0 } }, { id: 'PB2', a: { sp: 'S4', atom: 0 }, b: { sp: 'S5', atom: 0 } }],
});

export const mechanism: EditorDef = {
  id: 'mechanism', num: '20', name: 'Curly-arrow mechanism', field: 'Pharmacology',
  blurb: 'Reaction mechanisms in steps: species from SMILES, lone pairs and charges, curly arrows that snap to lone pairs, bonds and atoms.',
  hint: 'Click an arrow, then drag its square ends to snap them or its round handle to bend it. Click a species to add marks.',
  normalize: norm,
  templates: [
    { name: 'SN2', desc: 'Hydroxide and bromomethane, one step', title: 'SN2 substitution of bromomethane by hydroxide',
      caption: 'Hydroxide attacks carbon from the side opposite bromine. The C–O bond forms as the C–Br bond breaks, through a single five-coordinate transition state.', data: SN2 },
    { name: 'SN1', desc: 'Carbocation, then water attacks', title: 'SN1 hydrolysis of 2-bromo-2-methylpropane',
      caption: 'Slow loss of bromide gives a tertiary carbocation. Water then attacks the planar cation, and loss of a proton gives the alcohol.',
      data: norm({
        panels: [P('P1', { reagent: 'slow', condition: '−Br^{−}' }), P('P2', { reagent: 'fast', condition: '−H^{+}' }), P('P3')],
        species: [SP('S1', 'P1', 'CC(C)(C)Br', 0, 0), SP('S2', 'P2', 'C[C+](C)C', -40, 0), SP('S3', 'P2', 'O', 90, -10), SP('S4', 'P3', 'CC(C)(C)O', 0, 0)],
        marks: [LP('M1', 'S1', 4), LP('M2', 'S1', 4), LP('M3', 'S1', 4), LP('M4', 'S3', 0), LP('M5', 'S3', 0), LP('M6', 'S4', 4), LP('M7', 'S4', 4)],
        arrows: [AR('A1', bond('S1', 1, 4), atom('S1', 4), 0.5), AR('A2', lp('M4', 'S3'), atom('S2', 1), 0.35)], partials: [] }) },
    { name: 'E1', desc: 'Carbocation loses a β-hydrogen', title: 'E1 elimination from a tertiary carbocation',
      caption: 'After the leaving group goes, water removes a hydrogen from the carbon next to the cation and the C–H electrons form the C=C π bond.',
      data: norm({
        panels: [P('P1', { reagent: 'slow', condition: '−Br^{−}' }), P('P2', { reagent: 'fast' }), P('P3')],
        species: [SP('S1', 'P1', 'CC(C)(C)Br', 0, 0), SP('S2', 'P2', '[H][CH2][C+](C)C', -20, 0), SP('S3', 'P2', 'O', 95, -55), SP('S4', 'P3', 'C=C(C)C', -30, 0), SP('S5', 'P3', '[OH3+]', 90, 0)],
        marks: [LP('M1', 'S1', 4), LP('M2', 'S1', 4), LP('M3', 'S1', 4), LP('M4', 'S3', 0), LP('M5', 'S3', 0), LP('M6', 'S5', 0)],
        arrows: [AR('A1', bond('S1', 1, 4), atom('S1', 4), 0.5), AR('A2', lp('M4', 'S3'), atom('S2', 0), 0.35), AR('A3', bond('S2', 0, 1), bond('S2', 1, 2), 0.6)], partials: [] }) },
    { name: 'E2', desc: 'Base, β-hydrogen and leaving group together', title: 'E2 elimination of bromoethane by hydroxide',
      caption: 'Three arrows in one step: hydroxide takes the β-hydrogen, the C–H electrons form the π bond, and bromide leaves.',
      data: norm({
        panels: [P('P1'), P('P2')],
        species: [SP('S1', 'P1', '[H][O-]', -110, -55, { flip: true, rot: -30 }), SP('S2', 'P1', '[H]CCBr', 10, 15, { flip: true }), SP('S3', 'P2', 'C=C', -60, 0), SP('S4', 'P2', 'O', 30, 0), SP('S5', 'P2', '[Br-]', 100, 0)],
        marks: [LP('M1', 'S1', 1), LP('M2', 'S1', 1), LP('M3', 'S1', 1), LP('M4', 'S2', 3), LP('M5', 'S2', 3), LP('M6', 'S2', 3), LP('M7', 'S4', 0), LP('M8', 'S4', 0)],
        arrows: [AR('A1', lp('M1', 'S1'), atom('S2', 0), 0.4), AR('A2', bond('S2', 0, 1), bond('S2', 1, 2), 0.6), AR('A3', bond('S2', 2, 3), atom('S2', 3), 0.5)], partials: [] }) },
    { name: 'Acyl substitution', desc: 'Ester hydrolysis by hydroxide', title: 'Nucleophilic acyl substitution: hydrolysis of methyl acetate',
      caption: 'Hydroxide adds to the carbonyl carbon to give a tetrahedral intermediate. The C=O bond reforms and methoxide leaves.',
      data: norm({
        panels: [P('P1'), P('P2', { condition: 'tetrahedral intermediate' }), P('P3')],
        species: [SP('S1', 'P1', '[H][O-]', -120, -20, { flip: true, rot: -30 }), SP('S2', 'P1', 'CC(=O)OC', 30, 0), SP('S3', 'P2', 'CC([O-])(O)OC', 0, 0), SP('S4', 'P3', 'CC(=O)O', -40, 0), SP('S5', 'P3', '[O-]C', 90, 0)],
        marks: [LP('M1', 'S1', 1), LP('M2', 'S1', 1), LP('M3', 'S1', 1), LP('M4', 'S3', 2), LP('M5', 'S3', 2), LP('M6', 'S3', 2)],
        arrows: [AR('A1', lp('M1', 'S1'), atom('S2', 1), 0.4), AR('A2', bond('S2', 1, 2), atom('S2', 2), 0.5), AR('A3', lp('M4', 'S3'), bond('S3', 1, 2), 0.5), AR('A4', bond('S3', 1, 4), atom('S3', 4), 0.5)], partials: [] }) },
  ],
  stats: data => { const d = norm(data); return [[d.panels.length, 'steps'], [d.arrows.length, 'arrows']]; },
  Controls, Overlay, Render,
  remove: (data, sel) => {
    const d = norm(data);
    if (sel.kind === 'arrow') return { ...d, arrows: d.arrows.filter((x: any) => x.id !== sel.id) };
    if (sel.kind === 'mark') return { ...d, marks: d.marks.filter((x: any) => x.id !== sel.id), arrows: d.arrows.filter((a: any) => !(a.from && a.from.mark === sel.id)) };
    if (sel.kind === 'partial') return { ...d, partials: d.partials.filter((x: any) => x.id !== sel.id) };
    return null;
  },
  nudge: (data, sel, dx, dy) => { const d = norm(data); return sel.kind === 'species' ? { ...d, species: d.species.map((x: any) => x.id === sel.id ? { ...x, x: num(x.x, 0) + dx, y: num(x.y, 0) + dy } : x) } : null; },
  blank: norm({ panels: [P('P1'), P('P2')], species: [SP('S1', 'P1', 'CBr', 0, 0), SP('S2', 'P2', 'CO', 0, 0)], marks: [], arrows: [], partials: [] }),
};
