import { S } from '../sheet';
import { EmptyHint, num, Rows, Seg, Select, startDrag, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';
import { store } from '../lib/platform';
import { pkcurve } from './pharm';

/* 16 · PK/PD compartment model. Boxes are compartments, arrows carry rate constants.
   A pair of arrows between the same two boxes (k12 and k21) sits side by side. */

const KINDS: [string, string][] = [['dose', 'Dose'], ['comp', 'Compartment'], ['effect', 'Effect site'], ['elim', 'Elimination'], ['note', 'Note']];
const SIZE: any = { dose: [120, 52], comp: [168, 78], effect: [150, 70], elim: [120, 40], note: [190, 50] };
const sizeOf = (n: any) => [num(n.w, SIZE[n.kind || 'comp'][0]), SIZE[n.kind || 'comp'][1]];

function norm(d: any) { return { showValues: true, units: 'h^{-1}', ...d, nodes: Array.isArray(d.nodes) ? d.nodes : [], arrows: Array.isArray(d.arrows) ? d.arrows : [] }; }

/* where the line from a box centre towards (tx, ty) leaves the box */
function edge(n: any, tx: number, ty: number) {
  const [w, h] = sizeOf(n), dx = tx - n.x, dy = ty - n.y;
  const s = Math.min(w / 2 / (Math.abs(dx) || 1e-6), h / 2 / (Math.abs(dy) || 1e-6));
  return [n.x + dx * s, n.y + dy * s];
}
function geom(d: any, a: any) {
  const A = d.nodes.find((n: any) => n.id === a.from), B = d.nodes.find((n: any) => n.id === a.to);
  if (!A || !B || A === B) return null;
  const pair = d.arrows.some((x: any) => x !== a && x.from === a.to && x.to === a.from);
  const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, off = pair ? 9 : 0;
  /* both arrows of a pair shift to their own right-hand side, so they never overlap */
  const ax = A.x + nx * off, ay = A.y + ny * off, bx = B.x + nx * off, by = B.y + ny * off;
  const [x1, y1] = edge({ ...A, x: ax, y: ay }, bx, by), [x2, y2] = edge({ ...B, x: bx, y: by }, ax, ay);
  return { x1, y1, x2, y2, nx, ny, pair, L };
}
const labelOf = (d: any, a: any) => (a.label || '') + (d.showValues && a.value !== '' && a.value != null ? ' = ' + a.value + (d.units ? ' ' + d.units : '') : '');

function Render({ data }: any) {
  const d = norm(data);
  if (!d.nodes.length) return <EmptyHint text="Add a compartment in the sidebar." />;
  const out: any[] = [];
  d.arrows.forEach((a: any, i: number) => {
    const g = geom(d, a); if (!g) return;
    const ux = (g.x2 - g.x1), uy = (g.y2 - g.y1), L = Math.hypot(ux, uy) || 1, ex = ux / L, ey = uy / L, hs = 9;
    out.push(<line key={'a' + i} className="pk-arrow" x1={g.x1} y1={g.y1} x2={g.x2 - ex * hs * 0.8} y2={g.y2 - ey * hs * 0.8} />);
    out.push(<path key={'h' + i} className="pk-head" d={`M${g.x2},${g.y2} l${-ex * hs + ey * hs * 0.5},${-ey * hs - ex * hs * 0.5} l${ex * hs * 0.25 - ey * hs * 0.5},${ey * hs * 0.25 + ex * hs * 0.5} l${-ex * hs * 0.25 - ey * hs * 0.5},${-ey * hs * 0.25 + ex * hs * 0.5} z`} />);
    const t = labelOf(d, a); if (!t) return;
    const side = g.pair ? 1 : (num(a.side, 1) >= 0 ? 1 : -1), mx = (g.x1 + g.x2) / 2 + g.nx * 15 * side, my = (g.y1 + g.y2) / 2 + g.ny * 15 * side;
    const anchor = Math.abs(g.nx) < 0.3 ? 'middle' : (g.nx * side > 0 ? 'start' : 'end');
    out.push(<S.ChemText key={'t' + i} className="pk-rate" x={mx} y={my + 5} textAnchor={anchor}>{t}</S.ChemText>);
  });
  d.nodes.forEach((n: any) => {
    const [w, h] = sizeOf(n), k = n.kind || 'comp', x = n.x - w / 2, y = n.y - h / 2;
    const two = n.sub || (d.showValues && n.value);
    const sub = [n.sub, d.showValues && n.value ? n.value + (n.unit ? ' ' + n.unit : '') : ''].filter(Boolean).join(' = ');
    out.push(<g key={'n' + n.id} className={'pk-node pk-' + k}>
      {k === 'elim' || k === 'note' ? null : <rect x={x} y={y} width={w} height={h} rx={k === 'effect' ? h / 2 : k === 'dose' ? 3 : 6} />}
      <S.ChemText className="pk-name" x={n.x} y={two && k !== 'elim' ? n.y - 4 : n.y + 5} textAnchor="middle">{n.label}</S.ChemText>
      {two && k !== 'elim' ? <S.ChemText className="pk-sub" x={n.x} y={n.y + 16} textAnchor="middle">{sub}</S.ChemText> : null}
    </g>);
  });
  return <g className="pk-model">{out}</g>;
}

function Overlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const d = norm(data);
  const out: any[] = [];
  d.arrows.forEach((a: any) => {
    const g = geom(d, a); if (!g) return;
    const on = sel && sel.kind === 'arrow' && sel.id === a.id;
    out.push(<line key={'a' + a.id} className={'mk-hit-line' + (on ? ' mk-on' : '')} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} onPointerDown={ev => { ev.stopPropagation(); setSel({ kind: 'arrow', id: a.id }); }} />);
  });
  d.nodes.forEach((n: any) => {
    const [w, h] = sizeOf(n), on = sel && sel.kind === 'node' && sel.id === n.id;
    out.push(<rect key={'n' + n.id} className={'mk-hit' + (on ? ' mk-on' : '')} x={n.x - w / 2 - 3} y={n.y - h / 2 - 3} width={w + 6} height={h + 6} rx={6}
      onPointerDown={ev => {
        setSel({ kind: 'node', id: n.id });
        const x0 = n.x, y0 = n.y;
        startDrag(ev, toSvg, (dx, dy) => set({ nodes: d.nodes.map((m: any) => m.id === n.id ? { ...m, x: Math.round((x0 + dx) / 5) * 5, y: Math.round((y0 + dy) / 5) * 5 } : m) }, 'drag-' + n.id));
      }} />);
  });
  return <>{out}</>;
}

/* read the model back as a regimen for template 17 */
function toRegimen(d: any) {
  const by = (kind: string) => d.nodes.filter((n: any) => n.kind === kind);
  const dose = by('dose')[0]; if (!dose) return { error: 'Add a Dose box first.' };
  const first = d.arrows.find((a: any) => a.from === dose.id); if (!first) return { error: 'Draw an arrow from the Dose box.' };
  let central = d.nodes.find((n: any) => n.id === first.to), ka: any = null;
  /* an oral model has a gut box between the dose and the central compartment */
  const out1 = d.arrows.filter((a: any) => central && a.from === central.id);
  const elimOf = (c: any) => d.arrows.find((a: any) => a.from === c.id && (d.nodes.find((n: any) => n.id === a.to) || {}).kind === 'elim');
  if (central && !elimOf(central) && out1.length === 1) { ka = out1[0].value; central = d.nodes.find((n: any) => n.id === out1[0].to); }
  if (!central) return { error: 'The dose arrow does not reach a compartment.' };
  const el = elimOf(central); if (!el) return { error: 'Draw an elimination arrow out of the central compartment.' };
  const peri = d.arrows.find((a: any) => a.from === central.id && (d.nodes.find((n: any) => n.id === a.to) || {}).kind === 'comp');
  const back = peri && d.arrows.find((a: any) => a.from === peri.to && a.to === central.id);
  const r: any = { id: 'R1', label: central.label + ' model', dose: dose.value || '500', V: central.value || '40', ke: el.value || '0.12', F: '1', tau: '8', n: '6', tinf: '1' };
  r.thalf = String(Number((Math.log(2) / num(r.ke, 0.12)).toPrecision(3)));
  if (ka != null) { r.route = 'oral'; r.ka = ka || '1.2'; }
  else if (peri && back) { r.route = 'iv2'; r.k12 = peri.value || '0.5'; r.k21 = back.value || '0.3'; }
  else r.route = 'iv';
  return { r };
}

function Controls({ data, set, sel, setSel }: EditProps) {
  const d = norm(data);
  const S2 = (p: any, key?: string) => set({ ...d, ...p }, key);
  const n = sel && sel.kind === 'node' ? d.nodes.find((x: any) => x.id === sel.id) : null;
  const a = sel && sel.kind === 'arrow' ? d.arrows.find((x: any) => x.id === sel.id) : null;
  const upN = (p: any, key?: string) => S2({ nodes: d.nodes.map((x: any) => x === n ? { ...x, ...p } : x) }, key);
  const upA = (p: any, key?: string) => S2({ arrows: d.arrows.map((x: any) => x === a ? { ...x, ...p } : x) }, key);
  const opts: [string, string][] = d.nodes.map((x: any) => [x.id, x.label || x.id]);
  const link = toRegimen(d);
  const open = () => {
    if (!link.r) return;
    const t = pkcurve.templates[link.r.route === 'oral' ? 0 : 2];
    const doc = { v: 1, editor: pkcurve.id, title: 'Concentration–time curve from the compartment model', caption: '', number: '1', font: 'arial', notes: [], nudges: {},
      data: { ...JSON.parse(JSON.stringify(t.data)), mode: 'single', regimens: [link.r], show: { cmax: true, tmax: link.r.route === 'oral', window: false, readout: true } } };
    store.set('sd-maker:doc:' + pkcurve.id, doc);
    location.hash = pkcurve.id;
  };
  return <>
    {n ? <S.Panel kicker="Selected box" help="Drag boxes on the sheet. Use Connect in the toolbar to draw a new arrow.">
      <TextIn id="pm-label" label="Name" value={n.label} onChange={v => upN({ label: v }, 'lab-' + n.id)} />
      <Select id="pm-kind" label="Kind" value={n.kind || 'comp'} options={KINDS} onChange={v => upN({ kind: v })} />
      {n.kind === 'comp' || n.kind === 'effect' || n.kind === 'dose' || !n.kind ? <TextIn id="pm-sub" label="Symbol (e.g. V_{1}, C_{e})" value={n.sub} onChange={v => upN({ sub: v }, 'sub-' + n.id)} /> : null}
      {n.kind === 'comp' || n.kind === 'dose' || !n.kind ? <div className="mk-pair">
        <TextIn id="pm-val" label={n.kind === 'dose' ? 'Dose' : 'Volume'} value={n.value} onChange={v => upN({ value: v }, 'val-' + n.id)} />
        <TextIn id="pm-unit" label="Unit" value={n.unit} placeholder={n.kind === 'dose' ? 'mg' : 'L'} onChange={v => upN({ unit: v }, 'unit-' + n.id)} />
      </div> : null}
      <div className="sd-row-btns">
        <S.ToolButton compact onClick={() => upN({ w: num(n.w, sizeOf(n)[0]) + 20 })}>Wider</S.ToolButton>
        <S.ToolButton compact onClick={() => upN({ w: Math.max(70, num(n.w, sizeOf(n)[0]) - 20) })}>Narrower</S.ToolButton>
        <S.ToolButton compact onClick={() => { S2({ nodes: d.nodes.filter((x: any) => x !== n), arrows: d.arrows.filter((x: any) => x.from !== n.id && x.to !== n.id) }); setSel(null); }}>Delete box</S.ToolButton>
      </div>
    </S.Panel> : null}
    {a ? <S.Panel kicker="Selected arrow" help="The value prints after the symbol, e.g. k_{a} = 1.2 h⁻¹. A pair of arrows between the same two boxes sits side by side.">
      <div className="mk-pair">
        <TextIn id="pm-al" label="Rate constant (e.g. k_{12})" value={a.label} onChange={v => upA({ label: v }, 'al-' + a.id)} />
        <TextIn id="pm-av" label="Value" value={a.value} placeholder="e.g. 0.5" onChange={v => upA({ value: v }, 'av-' + a.id)} />
      </div>
      <div className="sd-row-btns">
        <S.ToolButton compact onClick={() => upA({ from: a.to, to: a.from })}>Flip direction</S.ToolButton>
        <S.ToolButton compact onClick={() => upA({ side: -num(a.side, 1) })}>Label to other side</S.ToolButton>
        <S.ToolButton compact onClick={() => { S2({ arrows: d.arrows.filter((x: any) => x !== a) }); setSel(null); }}>Delete arrow</S.ToolButton>
      </div>
    </S.Panel> : null}
    <Rows id="pm-n" kicker="Boxes" rows={d.nodes} cols={[{ key: 'label', label: 'Name', w: '1.6fr' }, { key: 'kind', label: 'Kind', type: 'select', options: KINDS, w: '1.2fr' }, { key: 'sub', label: 'Symbol', w: '0.8fr' }]}
      blank={() => ({ id: uid('N', d.nodes.map((x: any) => x.id)), kind: 'comp', label: 'Compartment', sub: '', value: '', x: 300, y: 300 })} addLabel="+ Add box"
      onChange={(rows, key) => { const ids = new Set(rows.map((x: any) => x.id)); S2({ nodes: rows, arrows: d.arrows.filter((x: any) => ids.has(x.from) && ids.has(x.to)) }, key); }} />
    <Rows id="pm-a" kicker="Arrows" rows={d.arrows} cols={[{ key: 'from', label: 'From', type: 'select', options: opts }, { key: 'to', label: 'To', type: 'select', options: opts }, { key: 'label', label: 'Symbol', w: '0.9fr' }, { key: 'value', label: 'Value', type: 'num', w: '0.7fr' }]}
      blank={() => ({ id: uid('A', d.arrows.map((x: any) => x.id)), from: d.nodes[0] && d.nodes[0].id, to: d.nodes[1] && d.nodes[1].id, label: 'k', value: '' })} addLabel="+ Add arrow"
      onChange={(rows, key) => S2({ arrows: rows }, key)} />
    <S.Panel kicker="Model">
      <Toggle on={d.showValues} label="Print values (dose, volumes, rate constants)" onChange={v => S2({ showValues: v })} />
      <TextIn id="pm-units" label="Rate constant unit" value={d.units} onChange={v => S2({ units: v }, 'units')} />
      <S.ToolButton onClick={open}>Draw this model's concentration curve (17)</S.ToolButton>
      <p className="sd-help">{link.r ? 'Opens diagram 17 with dose ' + link.r.dose + ' mg, V ' + link.r.V + ' L, ke ' + link.r.ke + (link.r.route === 'oral' ? ', ka ' + link.r.ka : link.r.route === 'iv2' ? ', k12 ' + link.r.k12 + ', k21 ' + link.r.k21 : '') + ' (' + (link.r.route === 'oral' ? 'oral' : link.r.route === 'iv2' ? 'two-compartment IV' : 'IV bolus') + '). It replaces the curve saved there.' : link.error}</p>
    </S.Panel>
  </>;
}

const N = (id: string, kind: string, label: string, x: number, y: number, p: any = {}) => ({ id, kind, label, x, y, sub: '', value: '', ...p });
const A = (id: string, from: string, to: string, label: string, value = '') => ({ id, from, to, label, value });

export const pkpd: EditorDef = {
  id: 'pk-compartment', num: '16', name: 'PK/PD compartment model', field: 'Pharmacology',
  blurb: 'Compartment diagrams with rate constants on the arrows: one and two compartments, oral absorption, and an effect site.',
  hint: 'Drag boxes. Click an arrow to set its rate constant. Connect draws a new arrow.',
  normalize: norm,
  templates: [
    { name: 'One compartment, IV bolus', desc: 'Dose, central compartment, elimination', title: 'One-compartment model, IV bolus',
      caption: 'The whole dose enters the central compartment (volume V) at once and leaves by first-order elimination with rate constant k_e.',
      data: norm({ nodes: [N('D', 'dose', 'IV bolus', 80, 150, { value: '500', unit: 'mg' }), N('C', 'comp', 'Central', 320, 150, { sub: 'V', value: '40', unit: 'L' }), N('E', 'elim', 'Elimination', 560, 150)],
        arrows: [A('A1', 'D', 'C', 'Dose'), A('A2', 'C', 'E', 'k_{e}', '0.12')] }) },
    { name: 'One compartment, oral', desc: 'Gut absorption with ka', title: 'One-compartment model with first-order oral absorption',
      caption: 'The dose is absorbed from the gut into the central compartment with rate constant k_a and eliminated with k_e.',
      data: norm({ nodes: [N('D', 'dose', 'Oral dose', 80, 150, { value: '500', unit: 'mg' }), N('G', 'comp', 'Gut', 280, 150, { sub: 'F' }), N('C', 'comp', 'Central', 500, 150, { sub: 'V', value: '40', unit: 'L' }), N('E', 'elim', 'Elimination', 720, 150)],
        arrows: [A('A1', 'D', 'G', ''), A('A2', 'G', 'C', 'k_{a}', '1.2'), A('A3', 'C', 'E', 'k_{e}', '0.12')] }) },
    { name: 'Two compartments, IV', desc: 'Central and peripheral with k12 and k21', title: 'Two-compartment model, IV bolus',
      caption: 'Drug distributes between the central (V₁) and peripheral (V₂) compartments with k₁₂ and k₂₁ and is eliminated from the central compartment with k₁₀.',
      data: norm({ nodes: [N('D', 'dose', 'IV bolus', 80, 150, { value: '500', unit: 'mg' }), N('C', 'comp', 'Central', 320, 150, { sub: 'V_{1}', value: '20', unit: 'L' }), N('P', 'comp', 'Peripheral', 320, 340, { sub: 'V_{2}' }), N('E', 'elim', 'Elimination', 560, 150)],
        arrows: [A('A1', 'D', 'C', 'Dose'), A('A2', 'C', 'P', 'k_{12}', '0.6'), A('A3', 'P', 'C', 'k_{21}', '0.3'), A('A4', 'C', 'E', 'k_{10}', '0.15')] }) },
    { name: 'Effect compartment', desc: 'PK/PD link through an effect site', title: 'PK/PD model with an effect compartment',
      caption: 'A small effect compartment links plasma concentration to the effect. Its equilibration rate constant kₑ₀ sets the delay between peak concentration and peak effect.',
      data: norm({ nodes: [N('D', 'dose', 'IV bolus', 80, 150, { value: '500', unit: 'mg' }), N('C', 'comp', 'Central', 320, 150, { sub: 'V_{1}', value: '40', unit: 'L' }), N('E', 'elim', 'Elimination', 320, 330),
          N('F', 'effect', 'Effect site', 580, 150, { sub: 'C_{e}' }), N('X', 'elim', 'Removed', 580, 330), N('R', 'note', 'E = E_{max}·C_{e} / (EC_{50} + C_{e})', 820, 150)],
        arrows: [A('A1', 'D', 'C', 'Dose'), A('A2', 'C', 'E', 'k_{10}', '0.12'), A('A3', 'C', 'F', 'k_{1e}'), A('A4', 'F', 'X', 'k_{e0}', '0.5'), A('A5', 'F', 'R', '')] }) },
  ],
  stats: data => { const d = norm(data); return [[d.nodes.length, 'boxes'], [d.arrows.length, 'arrows']]; },
  Controls, Overlay, Render,
  findText: (data, text) => { const d = norm(data), t = text.toLowerCase(); const n = d.nodes.find((x: any) => String(x.label).toLowerCase() === t); return n ? { kind: 'node', id: n.id } : null; },
  remove: (data, sel) => {
    const d = norm(data);
    if (sel.kind === 'node') return { ...d, nodes: d.nodes.filter((x: any) => x.id !== sel.id), arrows: d.arrows.filter((x: any) => x.from !== sel.id && x.to !== sel.id) };
    if (sel.kind === 'arrow') return { ...d, arrows: d.arrows.filter((x: any) => x.id !== sel.id) };
    return null;
  },
  nudge: (data, sel, dx, dy) => { const d = norm(data); return sel.kind === 'node' ? { ...d, nodes: d.nodes.map((x: any) => x.id === sel.id ? { ...x, x: x.x + dx, y: x.y + dy } : x) } : null; },
  duplicate: (data, sel) => {
    const d = norm(data), n = sel.kind === 'node' && d.nodes.find((x: any) => x.id === sel.id); if (!n) return null;
    const id = uid('N', d.nodes.map((x: any) => x.id));
    return { patch: { ...d, nodes: [...d.nodes, { ...n, id, x: n.x + 30, y: n.y + 30 }] }, sel: { kind: 'node', id } };
  },
  connect: { kind: 'node', label: 'box', plural: 'boxes', make: (data, from, to) => { const d = norm(data); return { ...d, arrows: [...d.arrows, { id: uid('A', d.arrows.map((x: any) => x.id)), from, to, label: 'k', value: '' }] }; } },
  blank: norm({ nodes: [N('D', 'dose', 'Dose', 80, 150), N('C', 'comp', 'Central', 320, 150, { sub: 'V' }), N('E', 'elim', 'Elimination', 560, 150)], arrows: [A('A1', 'D', 'C', ''), A('A2', 'C', 'E', 'k_{e}')] }),
};
