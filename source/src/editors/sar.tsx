import { S } from '../sheet';
import { num, Range, Rows, Seg, startDrag, Swatches, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';
import { layout, Molecule, place } from '../lib/molecule';

/* 19 · Structure–activity relationship scheme: a molecule drawn from SMILES, coloured highlights pinned
   to atom numbers, and callout boxes joined to them by leader lines. Highlights move with the molecule. */

const SW = Array.from({ length: 16 }, (_, i) => 'var(--swatch-' + (i + 1) + ')');
const SHAPES: [string, string][] = [['atom', 'Atom'], ['bond', 'Bond or chain'], ['region', 'Region']];
const LEADERS: [string, string][] = [['straight', 'Straight'], ['elbow', 'Elbow'], ['dashed', 'Dashed']];

function norm(d: any) { return { smiles: '', rot: 0, flip: false, scale: 44, mx: 400, my: 250, nums: false, colour: false, imgW: 300, ...d, annots: Array.isArray(d.annots) ? d.annots : [] }; }
const atomList = (s: any) => String(s == null ? '' : s).split(/[\s,;]+/).map(v => parseInt(v, 10)).filter(v => isFinite(v));

/* points a highlight covers, on the sheet: atoms of the molecule, or a free point over an uploaded image */
function hlPoints(d: any, a: any, mol: any) {
  if (d.image || mol.error) return [[num(a.px, d.mx), num(a.py, d.my)]];
  const pl = place(mol, { x: d.mx, y: d.my, scale: d.scale, rot: d.rot, flip: d.flip });
  return atomList(a.atoms).filter(i => i >= 0 && i < mol.atoms.length).map(i => pl.pt(i));
}
function hull(pts: number[][]) {
  if (pts.length < 3) return pts;
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: number[][] = [], up: number[][] = [];
  p.forEach(q => { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
  [...p].reverse().forEach(q => { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const centre = (pts: number[][]) => pts.length ? [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length] : [0, 0];
const pad = (a: any) => (a.shape === 'atom' ? 17 : a.shape === 'bond' ? 12 : 19);

function Highlight({ a, pts }: { a: any; pts: number[][] }) {
  if (!pts.length) return null;
  const col = a.color || SW[0];
  if (a.shape === 'atom') return <g className="sar-hl">{pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={17} style={{ fill: col }} />)}</g>;
  if (a.shape === 'bond' || pts.length < 3) return <polyline className="sar-hl sar-hl-line" points={pts.map(p => p.join(',')).join(' ')} style={{ stroke: col }} />;
  return <polygon className="sar-hl sar-hl-blob" points={hull(pts).map(p => p.join(',')).join(' ')} style={{ fill: col, stroke: col }} />;
}
/* width grows to fit the longest line; ChemText markup (_{ } ^{ }) does not count towards it */
const plain = (s: string) => String(s || '').replace(/[_^]\{([^}]*)\}/g, '$1');
function boxSize(a: any) {
  const lines = String(a.text || '').split('\n').filter(l => l.trim());
  const est = Math.max(plain(a.title).length * 7.7, ...lines.map(l => (plain(l).length + 2) * 6.7)) + 30;
  return [Math.max(num(a.bw, 160), Math.ceil(est)), 30 + lines.length * 17 + (lines.length ? 8 : 0)];
}
function Callout({ a, pts }: { a: any; pts: number[][] }) {
  const col = a.color || SW[0], [w, h] = boxSize(a), bx = num(a.bx, 40), by = num(a.by, 40);
  const lines = String(a.text || '').split('\n').filter(l => l.trim());
  let leader = null;
  if (pts.length) {
    const [cx, cy] = centre(pts), r = pad(a) + 2;
    const sx = cx < bx ? bx : cx > bx + w ? bx + w : cx, sy = cy < by ? by : cy > by + h ? by + h : cy;
    const fromSide = sx === bx || sx === bx + w;
    const ex = (x0: number, y0: number) => { const dx = cx - x0, dy = cy - y0, L = Math.hypot(dx, dy) || 1; return [cx - dx / L * r, cy - dy / L * r]; };
    if (a.leader === 'elbow') {
      /* leave the box from its side, run level, then turn towards the highlight */
      const ox = fromSide ? sx : cx < bx + w / 2 ? bx : bx + w, oy = fromSide ? sy : by + h / 2;
      const [tx, ty] = ex(cx, oy);
      leader = <path className="sar-leader" d={`M${ox},${oy}H${cx}V${cy + (oy < cy ? -r : r)}`} style={{ stroke: col }} data-t={tx + ty} />;
    } else { const [tx, ty] = ex(sx, sy); leader = <line className="sar-leader" x1={sx} y1={sy} x2={tx} y2={ty} style={{ stroke: col, strokeDasharray: a.leader === 'dashed' ? '5 4' : undefined }} />; }
  }
  return <g className="sar-callout">
    {leader}
    <rect x={bx} y={by} width={w} height={h} rx={4} style={{ stroke: col }} />
    <rect x={bx} y={by} width={5} height={h} rx={2} style={{ fill: col, stroke: 'none' }} />
    <S.ChemText className="sar-title" x={bx + 14} y={by + 20}>{a.title || 'Note'}</S.ChemText>
    {lines.map((l, i) => <S.ChemText key={i} className="sar-line" x={bx + 14} y={by + 40 + i * 17}>{'• ' + l.replace(/^[•\-–]\s*/, '')}</S.ChemText>)}
  </g>;
}

function Render({ data }: any) {
  const d = norm(data), mol = layout(d.smiles);
  return <g className="sar">
    {d.annots.map((a: any) => <Highlight key={'h' + a.id} a={a} pts={hlPoints(d, a, mol)} />)}
    {d.image ? <image href={d.image} x={d.mx - num(d.imgW, 300) / 2} y={d.my - num(d.imgW, 300) * 0.4} width={num(d.imgW, 300)} preserveAspectRatio="xMidYMid meet" />
      : <Molecule mol={mol} at={{ x: d.mx, y: d.my, scale: d.scale, rot: d.rot, flip: d.flip }} numbers={d.nums} className={d.colour ? 'mol-colour' : ''} />}
    {d.annots.map((a: any) => <Callout key={'c' + a.id} a={a} pts={hlPoints(d, a, mol)} />)}
  </g>;
}

function Overlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const d = norm(data), mol = layout(d.smiles), out: any[] = [];
  const upA = (a: any, p: any, key?: string) => set({ annots: d.annots.map((x: any) => x === a ? { ...x, ...p } : x) }, key);
  const cur = sel && sel.kind === 'annot' ? d.annots.find((x: any) => x.id === sel.id) : null;
  /* the molecule: drag anywhere on it to move it, and the highlights follow */
  let bb = [d.mx - 120, d.my - 90, 240, 180];
  if (!d.image && !mol.error && mol.atoms.length) {
    const pl = place(mol, { x: d.mx, y: d.my, scale: d.scale, rot: d.rot, flip: d.flip }), P = mol.atoms.map((_, i) => pl.pt(i));
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    bb = [Math.min(...xs) - 18, Math.min(...ys) - 18, Math.max(...xs) - Math.min(...xs) + 36, Math.max(...ys) - Math.min(...ys) + 36];
  }
  out.push(<rect key="mol" className={'mk-hit' + (sel && sel.kind === 'mol' ? ' mk-on' : '')} x={bb[0]} y={bb[1]} width={bb[2]} height={bb[3]}
    onPointerDown={ev => { setSel({ kind: 'mol', id: 'mol' }); const x0 = d.mx, y0 = d.my; startDrag(ev, toSvg, (dx, dy) => set({ mx: Math.round(x0 + dx), my: Math.round(y0 + dy) }, 'mol')); }} />);
  d.annots.forEach((a: any) => {
    const pts = hlPoints(d, a, mol); if (!pts.length) return;
    const [cx, cy] = centre(pts), on = cur === a;
    out.push(<circle key={'h' + a.id} className={'mk-hit' + (on ? ' mk-on' : '')} cx={cx} cy={cy} r={14}
      onPointerDown={ev => {
        setSel({ kind: 'annot', id: a.id });
        if (d.image || mol.error) { const x0 = num(a.px, d.mx), y0 = num(a.py, d.my); startDrag(ev, toSvg, (dx, dy) => upA(a, { px: Math.round(x0 + dx), py: Math.round(y0 + dy) }, 'pt-' + a.id)); }
        else ev.stopPropagation();
      }} />);
  });
  /* with a highlight selected, clicking an atom adds it to that highlight or takes it out */
  if (cur && !d.image && !mol.error) {
    const pl = place(mol, { x: d.mx, y: d.my, scale: d.scale, rot: d.rot, flip: d.flip });
    mol.atoms.forEach((_, i) => {
      const [x, y] = pl.pt(i), inIt = atomList(cur.atoms).includes(i);
      out.push(<circle key={'at' + i} className={'mk-hit mk-handle' + (inIt ? ' mk-on' : '')} cx={x} cy={y} r={7}
        onPointerDown={ev => { ev.stopPropagation(); const L = atomList(cur.atoms); upA(cur, { atoms: (inIt ? L.filter(j => j !== i) : [...L, i]).join(', ') }); }} />);
    });
  }
  d.annots.forEach((a: any) => {
    const [w, h] = boxSize(a), on = cur === a, x0 = num(a.bx, 40), y0 = num(a.by, 40);
    out.push(<rect key={'b' + a.id} className={'mk-hit' + (on ? ' mk-on' : '')} x={x0} y={y0} width={w} height={h} rx={4}
      onPointerDown={ev => { setSel({ kind: 'annot', id: a.id }); startDrag(ev, toSvg, (dx, dy) => upA(a, { bx: Math.round((x0 + dx) / 5) * 5, by: Math.round((y0 + dy) / 5) * 5 }, 'box-' + a.id)); }} />);
  });
  return <>{out}</>;
}

function Controls({ data, set, sel, setSel }: EditProps) {
  const d = norm(data), mol = layout(d.smiles);
  const S2 = (p: any, key?: string) => set({ ...d, ...p }, key);
  const a = sel && sel.kind === 'annot' ? d.annots.find((x: any) => x.id === sel.id) : null;
  const upA = (p: any, key?: string) => a && S2({ annots: d.annots.map((x: any) => x === a ? { ...x, ...p } : x) }, key);
  const upload = (f: File | undefined) => { if (!f) return; const r = new FileReader(); r.onload = () => S2({ image: String(r.result) }); r.readAsDataURL(f); };
  return <>
    {a ? <S.Panel kicker="Selected highlight" help={d.image ? 'Drag the highlight dot over the image to place it.' : 'Click atoms on the sheet to add them to this highlight or take them out. Turn on atom numbers to see the indices.'}>
      <TextIn id="sar-title" label="Callout title" value={a.title} placeholder="e.g. R_{1}: –OCH_{3} / –CH_{3}" onChange={v => upA({ title: v }, 'tt-' + a.id)} />
      <label className="sd-field"><span>Bullet lines, one per line</span>
        <textarea id="sar-text" className="sd-input" rows={4} value={a.text || ''} onChange={e => upA({ text: e.target.value }, 'tx-' + a.id)} /></label>
      <Seg value={a.shape || 'region'} options={SHAPES} onChange={v => upA({ shape: v })} />
      {!d.image ? <TextIn id="sar-atoms" label="Atom numbers" value={a.atoms} placeholder="e.g. 10, 11, 12" onChange={v => upA({ atoms: v }, 'at-' + a.id)} /> : null}
      <Seg value={a.leader || 'straight'} options={LEADERS} onChange={v => upA({ leader: v })} />
      <Swatches label="Colour (highlight and callout)" value={a.color} colors={SW} onChange={v => upA({ color: v })} />
      <Range id="sar-bw" label="Minimum callout width" value={num(a.bw, 160)} min={120} max={420} step={10} onChange={v => upA({ bw: v }, 'bw-' + a.id)} />
      <S.ToolButton compact onClick={() => { S2({ annots: d.annots.filter((x: any) => x !== a) }); setSel(null); }}>Delete highlight</S.ToolButton>
    </S.Panel> : null}
    <S.Panel kicker="Structure" help="Type a SMILES string. Dummy atoms [*:1], [*:2] draw as R₁, R₂. Drag the molecule on the sheet; the highlights move with it.">
      <TextIn id="sar-smiles" label="SMILES" value={d.smiles} placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O" onChange={v => S2({ smiles: v }, 'smiles')} />
      {mol.error && !d.image ? <p className="sd-help" style={{ color: 'var(--edge-feedback-neg)' }}>{mol.error}</p> : null}
      <Range id="sar-rot" label="Rotate (°)" value={num(d.rot, 0)} min={-180} max={180} step={15} onChange={v => S2({ rot: v }, 'rot')} />
      <Range id="sar-scale" label="Bond length" value={num(d.scale, 44)} min={24} max={80} step={2} onChange={v => S2({ scale: v }, 'scale')} />
      <Toggle on={d.flip} label="Mirror left to right" onChange={v => S2({ flip: v })} />
      <Toggle on={d.nums} label="Show atom numbers (for picking highlights)" onChange={v => S2({ nums: v })} />
      <Toggle on={d.colour} label="Colour heteroatoms" onChange={v => S2({ colour: v })} />
      <label className="sd-field"><span>Or use an image of the structure (PNG, JPEG or SVG)</span>
        <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={e => upload(e.target.files ? e.target.files[0] : undefined)} /></label>
      {d.image ? <>
        <Range id="sar-imgw" label="Image width" value={num(d.imgW, 300)} min={120} max={600} step={10} onChange={v => S2({ imgW: v }, 'imgw')} />
        <S.ToolButton compact onClick={() => S2({ image: undefined })}>Remove image, use SMILES</S.ToolButton>
      </> : null}
    </S.Panel>
    <Rows id="sar-a" kicker="Highlights and callouts" rows={d.annots}
      cols={[{ key: 'title', label: 'Title', w: '2fr' }, { key: 'shape', label: 'Shape', type: 'select', options: SHAPES, w: '1.1fr' }, { key: 'color', label: 'Colour', type: 'color', colors: SW }]}
      blank={() => ({ id: uid('H', d.annots.map((x: any) => x.id)), shape: 'region', atoms: '', color: SW[(d.annots.length * 5 + 2) % 16], title: 'New feature', text: 'What changing it does', bx: 40, by: 40 + d.annots.length * 90, leader: 'straight' })}
      addLabel="+ Add highlight" onChange={(rows, key) => S2({ annots: rows }, key)} />
  </>;
}

const H = (id: string, shape: string, atoms: string, c: number, title: string, text: string, bx: number, by: number, p: any = {}) => ({ id, shape, atoms, color: SW[c - 1], title, text, bx, by, leader: 'straight', ...p });

export const sar: EditorDef = {
  id: 'sar-scheme', num: '19', name: 'SAR scheme', field: 'Pharmacology',
  blurb: 'Structure–activity relationships: a molecule from SMILES with coloured highlights and callouts that follow it when it moves.',
  hint: 'Click a highlight, then click atoms to change what it covers. Drag the molecule or the callouts.',
  normalize: norm,
  templates: [
    { name: 'Aspirin', desc: 'Acetyl ester, carboxylic acid, ortho ring', title: 'Structure–activity relationships of aspirin',
      caption: 'Aspirin acetylates a serine in the COX active site. The acetyl ester, the free carboxylic acid and their ortho relationship are all needed for activity.',
      data: norm({ smiles: 'CC(=O)Oc1ccccc1C(=O)O', mx: 400, my: 250, rot: 0, annots: [
        H('H1', 'region', '0, 1, 2, 3', 11, 'Acetyl ester', 'Transfers its acetyl group to Ser530 of COX\nMakes the inhibition irreversible', 560, 60),
        H('H2', 'region', '10, 11, 12', 2, 'Carboxylic acid', 'Ionised at physiological pH\nBinds Arg120 in the COX channel', 560, 330),
        H('H3', 'region', '4, 5, 6, 7, 8, 9', 6, 'Benzene ring, ortho pattern', 'Holds the ester and acid next to each other\nMeta and para isomers lose activity', 30, 60)] }) },
    { name: 'R-group scaffold', desc: 'R₁ and R₂ positions with options', title: 'Substituent effects on a para-acylaminophenol scaffold',
      caption: 'Each callout lists the groups tried at that position and the effect seen. Values are illustrative.',
      data: norm({ smiles: '[*:1]Oc1ccc(NC(=O)[*:2])cc1', mx: 420, my: 240, annots: [
        H('H1', 'atom', '0', 13, 'R_{1}: –H / –CH_{3} / –C_{2}H_{5}', '–H keeps analgesic activity\nLarger alkyl groups lower potency', 40, 60),
        H('H2', 'atom', '9', 3, 'R_{2}: –CH_{3} / –CF_{3}', '–CH_{3} gives the best balance\n–CF_{3} raises lipophilicity', 590, 300),
        H('H3', 'bond', '6, 7, 8', 8, 'Amide link', 'Needed for activity\nHydrolysis releases the free amine', 590, 60, { leader: 'dashed' })] }) },
    { name: 'Penicillin G', desc: 'β-lactam, thiazolidine, acyl side chain', title: 'Structure–activity relationships of penicillin G',
      caption: 'The strained β-lactam ring acylates the transpeptidase that builds the bacterial cell wall.',
      data: norm({ smiles: 'CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O', mx: 430, my: 260, annots: [
        H('H1', 'region', '4, 5, 16, 17, 18', 11, 'β-Lactam ring', 'Ring strain makes the amide reactive\nOpening it kills activity', 620, 70),
        H('H2', 'region', '20, 21, 22', 2, 'Carboxylic acid', 'Binds a lysine in the enzyme\nEsters act as prodrugs', 30, 60),
        H('H3', 'region', '9, 10, 11, 12, 13, 14, 15', 6, 'Acyl side chain', 'Sets the spectrum and acid stability\nChanging it gave ampicillin and amoxicillin', 640, 360),
        H('H4', 'region', '1, 3, 19', 15, 'Thiazolidine ring', 'Fused to the β-lactam\nIncreases ring strain', 30, 380, { leader: 'elbow' })] }) },
  ],
  stats: data => { const d = norm(data); const m = layout(d.smiles); return [[m.atoms.length, 'atoms'], [d.annots.length, 'highlights']]; },
  Controls, Overlay, Render,
  findText: (data, text) => { const d = norm(data), t = text.toLowerCase(); const a = d.annots.find((x: any) => String(x.title).toLowerCase().includes(t)); return a ? { kind: 'annot', id: a.id } : null; },
  remove: (data, sel) => { const d = norm(data); return sel.kind === 'annot' ? { ...d, annots: d.annots.filter((x: any) => x.id !== sel.id) } : null; },
  nudge: (data, sel, dx, dy) => {
    const d = norm(data);
    if (sel.kind === 'mol') return { ...d, mx: d.mx + dx, my: d.my + dy };
    if (sel.kind === 'annot') return { ...d, annots: d.annots.map((x: any) => x.id === sel.id ? { ...x, bx: num(x.bx, 40) + dx, by: num(x.by, 40) + dy } : x) };
    return null;
  },
  duplicate: (data, sel) => {
    const d = norm(data), a = sel.kind === 'annot' && d.annots.find((x: any) => x.id === sel.id); if (!a) return null;
    const id = uid('H', d.annots.map((x: any) => x.id));
    return { patch: { ...d, annots: [...d.annots, { ...a, id, bx: num(a.bx, 40) + 30, by: num(a.by, 40) + 30 }] }, sel: { kind: 'annot', id } };
  },
  blank: norm({ smiles: 'c1ccccc1O', annots: [] }),
};
