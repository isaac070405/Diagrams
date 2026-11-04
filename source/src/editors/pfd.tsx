import { useState } from 'react';
import { S } from '../sheet';
import { EmptyHint, lines, num, Range, Rows, Seg, Select, startDrag, TextIn, TextView, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const EQUIP: [string, string, string][] = (window as any).SciDiagram.PFD_EQUIP;
const TYPES: [string, string][] = [['process', 'Process'], ['io', 'Input / output'], ['decision', 'Decision'], ['equipment', 'Equipment']];
const HAZ: [string, string][] = [['B', 'Biological'], ['C', 'Chemical'], ['P', 'Physical'], ['A', 'Allergen']];

/* ---------- old text format → structure ---------- */
function fromText(spec: string) {
  const steps: any[] = [], used: any = {}, byLabel: any = {}, pending: any[] = [];
  const mk = (s: string) => { let b = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step', k = b, i = 2; while (used[k]) k = b + '-' + i++; used[k] = 1; return k; };
  for (const raw of lines(spec)) {
    const l = raw.trim(), prev = steps[steps.length - 1];
    if (l.startsWith('+')) { if (prev) prev.inputs.push(l.slice(1).trim()); continue; }
    if (l.startsWith('-')) { const m = l.slice(1).trim().match(/^(.*?)\s*(?:\((waste|byproduct|product)\))?$/); if (prev && m) prev.outputs.push({ label: m[1], kind: m[2] || 'waste' }); continue; }
    let t = l, type = 'process';
    if (t.startsWith('>')) { type = 'io'; t = t.slice(1).trim(); } else if (t.startsWith('?')) { type = 'decision'; t = t.slice(1).trim(); }
    const parts = t.split('|').map(s => s.trim());
    let label = parts[0];
    const st: any = { type, ccp: '', hazards: [], limit: '', inputs: [], outputs: [] };
    const ccp = label.match(/\[(CCP\s*\d*)(?::\s*([BCPA,\s]+))?\]/i);
    if (ccp) { st.ccp = ccp[1].toUpperCase().replace(/\s+/, ' '); if (ccp[2]) st.hazards = ccp[2].split(/[,\s]+/).filter(Boolean).map(s => s.toUpperCase()); label = label.replace(ccp[0], '').trim(); }
    const lim = label.match(/\{([^}]+)\}/); if (lim) { st.limit = lim[1]; label = label.replace(lim[0], '').trim(); }
    st.label = label.replace(/\s*\/\/\s*/g, '\n'); st.id = mk(label); byLabel[label.toLowerCase()] = st.id;
    if (type === 'decision') pending.push({ st, branches: parts.slice(1) });
    steps.push(st);
  }
  pending.forEach(({ st, branches }) => {
    const nx = branches.map((b: string) => { const [lab, target] = b.split(':').map(s => s.trim()); const to = byLabel[(target || '').toLowerCase()]; return to ? { to, label: lab } : null; }).filter(Boolean);
    if (nx.length) st.next = nx;
  });
  if (steps.length && steps[steps.length - 1].next === undefined) steps[steps.length - 1].next = null;
  return steps;
}
function normalize(d: any) { if (Array.isArray(d.steps)) return d; const { spec, ...rest } = d; return { ...rest, steps: fromText(spec || '') }; }
function toText(d: any) {
  const lab: any = {}; d.steps.forEach((s: any) => { lab[s.id] = s.label.replace(/\n/g, ' // '); });
  return d.steps.map((s: any) => {
    let l = (s.type === 'io' ? '> ' : s.type === 'decision' ? '? ' : '') + lab[s.id];
    if (s.ccp) l += ' [' + s.ccp + (s.hazards && s.hazards.length ? ': ' + s.hazards.join(',') : '') + ']';
    if (s.limit) l += ' {' + s.limit + '}';
    if (s.type === 'decision' && Array.isArray(s.next)) l += s.next.map((b: any) => ' | ' + (b.label || '') + ': ' + (lab[b.to] || '')).join('');
    return [l, ...(s.inputs || []).map((i: string) => '+ ' + i), ...(s.outputs || []).map((o: any) => '- ' + o.label + (o.kind && o.kind !== 'waste' ? ' (' + o.kind + ')' : ''))].join('\n');
  }).join('\n');
}

/* ---------- grid geometry, matching ProductFlow ---------- */
function geom(d: any) {
  const col = d.layout === 'column';
  const bw = num(d.boxW, col ? 250 : 112), bh = num(d.boxH, col ? 44 : 52), hg = num(d.hGap, 44), vg = num(d.vGap, col ? 26 : 80), per = num(d.perRow, 5);
  const X0 = col ? 210 : 0;
  const maxH = d.steps.some((s: any) => s.type === 'equipment') ? bh * 1.5 : d.steps.some((s: any) => s.type === 'decision') ? bh * 1.25 : bh, pitch = maxH + vg;
  const cell = (s: any, i: number) => {
    if (s.col != null && s.row != null) return [s.col, s.row];
    if (col) return [0, i];
    const r = Math.floor(i / per); let c = i % per; if (d.layout === 'snake' && r % 2) c = per - 1 - c; return [c, r];
  };
  const at: any = {};
  d.steps.forEach((s: any, i: number) => {
    const [c, r] = cell(s, i), hh = s.type === 'decision' ? bh * 1.25 : s.type === 'equipment' ? bh * 1.5 : bh, w = s.type === 'decision' ? bw * 0.86 : bw;
    at[s.id] = { c, r, cx: X0 + c * (bw + hg) + bw / 2, cy: r * pitch + maxH / 2, w, h: hh };
  });
  const toCell = (x: number, y: number) => [Math.max(0, Math.round((x - X0 - bw / 2) / (bw + hg))), Math.max(0, Math.round((y - maxH / 2) / pitch))];
  return { at, bw, bh, hg, vg, per, X0, maxH, pitch, col, toCell };
}

function steps4render(d: any) {
  const idx: any = {}; d.steps.forEach((s: any, i: number) => { idx[s.id] = i; });
  return d.steps.map((s: any, i: number) => {
    const st: any = { id: s.id, label: s.label, type: s.type, ccp: s.ccp || undefined, hazards: s.hazards && s.hazards.length ? s.hazards : undefined, limit: s.limit || undefined, note: s.note || undefined, equip: s.equip || undefined };
    if (s.col != null && s.row != null) { st.col = s.col; st.row = s.row; }
    if (s.next !== undefined) st.next = Array.isArray(s.next) ? s.next.filter((b: any) => idx[b.to] != null).map((b: any) => ({ ...b, route: idx[b.to] < i ? 'over' : undefined })) : s.next;
    return st;
  });
}

function Render({ data }: { data: any }) {
  const d = normalize(data);
  if (!d.steps.length) return <EmptyHint text="Add the first step in the sidebar." />;
  const g = geom(d), steps = steps4render(d);
  const common = { x: 0, y: 0, layout: d.layout, boxW: g.bw, boxH: g.bh, hGap: g.hg, vGap: g.vg, numbers: d.numbers, uppercase: d.uppercase, legend: d.legend };
  if (g.col) {
    const inputs: any[] = [], outputs: any[] = [];
    d.steps.forEach((s: any) => { (s.inputs || []).forEach((l: string) => inputs.push({ to: s.id, label: l })); (s.outputs || []).forEach((o: any) => outputs.push({ from: s.id, label: o.label, kind: o.kind })); });
    return <S.ProductFlow {...common} steps={steps} inputs={inputs} outputs={outputs} />;
  }
  /* in rows, a step at the end of a row sends streams sideways; others use the top and bottom */
  const cols = Math.max(...Object.values(g.at).map((a: any) => a.c));
  const withStreams = steps.map((st: any, i: number) => {
    const s = d.steps[i], a = g.at[s.id];
    const outer = a.c === cols ? 'right' : a.c === 0 && i > 0 ? 'left' : '';
    const streams = [...(s.inputs || []).map((l: string) => ({ label: l, side: outer || 'top', dir: 'in' })), ...(s.outputs || []).map((o: any) => ({ label: o.label, side: outer || 'bottom', dir: 'out', kind: o.kind }))];
    return streams.length ? { ...st, streams } : st;
  });
  return <S.ProductFlow {...common} perRow={g.per} steps={withStreams} />;
}

function Overlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const d = normalize(data), g = geom(d);
  const [ghost, setGhost] = useState<any>(null);
  return (
    <>
      {d.steps.map((s: any) => {
        const a = g.at[s.id], on = sel && sel.kind === 'step' && sel.id === s.id;
        return <rect key={s.id} className={'mk-hit' + (on ? ' mk-on' : '')} x={a.cx - a.w / 2 - 4} y={a.cy - a.h / 2 - 4} width={a.w + 8} height={a.h + 8}
          onPointerDown={e => {
            setSel({ kind: 'step', id: s.id });
            startDrag(e, toSvg, (dx, dy) => setGhost({ id: s.id, x: a.cx + dx, y: a.cy + dy, w: a.w, h: a.h }), (dx, dy) => {
              setGhost(null);
              const [c, r] = g.toCell(a.cx + dx, a.cy + dy);
              const other = d.steps.find((o: any) => o.id !== s.id && g.at[o.id].c === c && g.at[o.id].r === r);
              set({ steps: d.steps.map((o: any) => {
                const p = g.at[o.id];
                if (o.id === s.id) return { ...o, col: c, row: r };
                if (other && o.id === other.id) return { ...o, col: a.c, row: a.r };
                return { ...o, col: p.c, row: p.r };
              }) });
            });
          }} />;
      })}
      {ghost ? (() => { const [c, r] = g.toCell(ghost.x, ghost.y); return <>
        <rect className="mk-ghost-cell" x={g.X0 + c * (g.bw + g.hg) + g.bw / 2 - ghost.w / 2} y={r * g.pitch + g.maxH / 2 - ghost.h / 2} width={ghost.w} height={ghost.h} />
        <rect className="mk-ghost" x={ghost.x - ghost.w / 2} y={ghost.y - ghost.h / 2} width={ghost.w} height={ghost.h} />
      </>; })() : null}
    </>
  );
}

function Controls({ data, set, sel, setSel }: EditProps) {
  const d = normalize(data);
  const S2 = (patch: any, key?: string) => set({ ...(data === d ? {} : d), ...patch }, key);
  const i = sel && sel.kind === 'step' ? d.steps.findIndex((s: any) => s.id === sel.id) : -1;
  const s = i >= 0 ? d.steps[i] : null;
  const up = (patch: any, key?: string) => S2({ steps: d.steps.map((x: any) => x === s ? { ...x, ...patch } : x) }, key);
  const names: [string, string][] = d.steps.map((x: any) => [x.id, x.label.split('\n')[0]]);
  const move = (k: number) => { const a = [...d.steps]; const j = i + k; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; S2({ steps: a }); };
  const addAfter = () => {
    const id = uid('step-', d.steps.map((x: any) => x.id)), a = [...d.steps];
    a.splice(i >= 0 ? i + 1 : a.length, 0, { id, label: 'New step', type: 'process', ccp: '', hazards: [], limit: '', inputs: [], outputs: [] });
    S2({ steps: a }); setSel({ kind: 'step', id });
  };
  const nextVal = !s ? '' : s.next === undefined ? 'auto' : s.next === null ? 'none' : Array.isArray(s.next) ? 'branch' : s.next;
  return (
    <>
      {s ? (
        <S.Panel kicker={'Selected step ' + (i + 1)} help="Drag it to another grid cell on the sheet; landing on a step swaps the two.">
          <S.Field id="pf-label" label="Label" multiline rows={2} value={s.label} onChange={(e: any) => up({ label: e.target.value }, 'lab-' + s.id)} />
          <Select id="pf-type" label="Kind" value={s.type} options={TYPES} onChange={v => up({ type: v, next: v === 'decision' ? (Array.isArray(s.next) ? s.next : [{ to: '', label: 'YES' }, { to: '', label: 'NO' }]) : (Array.isArray(s.next) ? undefined : s.next) })} />
          {s.type === 'equipment' ? <Select id="pf-eq" label="Equipment symbol" value={s.equip || ''} options={[['', 'Choose…'], ...EQUIP.map(e => [e[0], e[1]] as [string, string])]} onChange={v => up({ equip: v })} /> : null}
          <div className="mk-pair">
            <TextIn id="pf-ccp" label="CCP" value={s.ccp} placeholder="e.g. CCP 1" onChange={v => up({ ccp: v.toUpperCase() }, 'ccp-' + s.id)} />
            <TextIn id="pf-lim" label="Critical limit" value={s.limit} placeholder="e.g. ≥ 72 °C 15 s" onChange={v => up({ limit: v }, 'lim-' + s.id)} />
          </div>
          {s.ccp ? <div className="sd-row-btns">{HAZ.map(([k, l]) => <S.ToolButton key={k} compact on={(s.hazards || []).includes(k)} title={l} onClick={() => up({ hazards: (s.hazards || []).includes(k) ? s.hazards.filter((x: string) => x !== k) : [...(s.hazards || []), k] })}>{k}</S.ToolButton>)}</div> : null}
          {s.type !== 'decision' ? <Select id="pf-next" label="Leads to" value={nextVal}
            options={[['auto', 'The next step in the list'], ['none', 'Nothing (end of line)'], ...names.filter(([id]) => id !== s.id)]}
            onChange={v => up({ next: v === 'auto' ? undefined : v === 'none' ? null : v })} /> : (
            <Rows id={'pf-br-' + s.id} kicker="Branches" rows={Array.isArray(s.next) ? s.next : []}
              cols={[{ key: 'label', label: 'Answer', w: '0.8fr', placeholder: 'YES' }, { key: 'to', label: 'Goes to', type: 'select', options: [['', 'Choose…'], ...names] }]}
              blank={() => ({ label: 'NO', to: '' })} addLabel="+ Add branch" onChange={(rows, key) => up({ next: rows }, key)} />
          )}
          <Rows id={'pf-in-' + s.id} kicker="Inputs" rows={(s.inputs || []).map((l: string) => ({ label: l }))} cols={[{ key: 'label', label: 'Input', placeholder: 'e.g. Sugar' }]}
            blank={() => ({ label: 'Ingredient' })} addLabel="+ Add input" onChange={(rows, key) => up({ inputs: rows.map(r => r.label) }, key)} />
          <Rows id={'pf-out-' + s.id} kicker="Outputs" rows={s.outputs || []}
            cols={[{ key: 'label', label: 'Output', placeholder: 'e.g. Peel' }, { key: 'kind', label: 'Kind', type: 'select', options: [['waste', 'Waste'], ['byproduct', 'By-product'], ['product', 'Product']], w: '0.9fr' }]}
            blank={() => ({ label: 'Waste', kind: 'waste' })} addLabel="+ Add output" onChange={(rows, key) => up({ outputs: rows }, key)} />
          <div className="sd-row-btns">
            <S.ToolButton compact onClick={() => move(-1)} disabled={i === 0}>Earlier</S.ToolButton>
            <S.ToolButton compact onClick={() => move(1)} disabled={i === d.steps.length - 1}>Later</S.ToolButton>
            <S.ToolButton compact onClick={() => { S2({ steps: d.steps.filter((x: any) => x !== s) }); setSel(null); }}>Delete</S.ToolButton>
          </div>
        </S.Panel>
      ) : null}
      <Rows id="pf-steps" kicker="Steps, in order" help="Click a step on the sheet to edit everything about it." rows={d.steps}
        cols={[{ key: 'label', label: 'Step', w: '1.6fr' }, { key: 'type', label: 'Kind', type: 'select', options: TYPES }, { key: 'ccp', label: 'CCP', w: '0.7fr', placeholder: '—' }]}
        blank={() => ({ id: uid('step-', d.steps.map((x: any) => x.id)), label: 'New step', type: 'process', ccp: '', hazards: [], limit: '', inputs: [], outputs: [] })}
        addLabel="+ Add step at the end" onChange={(rows, key) => S2({ steps: rows }, key)} />
      {s ? <S.ToolButton onClick={addAfter}>+ Add a step after step {i + 1}</S.ToolButton> : null}
      <S.Panel kicker="Layout">
        <Seg value={d.layout} options={[['snake', 'Snake'], ['grid', 'Rows'], ['column', 'Column']]} onChange={v => S2({ layout: v, steps: d.steps.map((x: any) => ({ ...x, col: undefined, row: undefined })) })} />
        {d.layout !== 'column' ? <Range id="pf-per" label="Steps per row" value={num(d.perRow, 5)} min={2} max={8} onChange={v => S2({ perRow: v }, 'per')} /> : null}
        <Range id="pf-bw" label="Box width" value={geom(d).bw} min={80} max={320} step={4} onChange={v => S2({ boxW: v }, 'bw')} />
        <Range id="pf-bh" label="Box height" value={geom(d).bh} min={36} max={90} step={2} onChange={v => S2({ boxH: v }, 'bh')} />
        <Range id="pf-hg" label="Gap across" value={geom(d).hg} min={24} max={120} step={2} onChange={v => S2({ hGap: v }, 'hg')} />
        <Range id="pf-vg" label="Gap down" value={geom(d).vg} min={16} max={140} step={2} onChange={v => S2({ vGap: v }, 'vg')} />
        <Toggle on={d.numbers} label="Step numbers" onChange={v => S2({ numbers: v })} />
        <Toggle on={d.uppercase} label="Upper-case labels" onChange={v => S2({ uppercase: v })} />
        <Toggle on={d.legend} label="Legend" onChange={v => S2({ legend: v })} />
        <S.ToolButton onClick={() => S2({ steps: d.steps.map((x: any) => ({ ...x, col: undefined, row: undefined })) })}>Tidy: automatic positions</S.ToolButton>
      </S.Panel>
      <TextView id="pf-text" title="Edit as text" text={toText(d)} rows={14}
        help="> input or output. ? decision | YES: Step | NO: Step. [CCP 1: B,C] and {≥ 85 °C} after a label. + input and - waste under a step."
        onChange={t => S2({ steps: fromText(t) }, 'text')} />
    </>
  );
}

const T = (spec: string, extra: any) => ({ ...extra, steps: fromText(spec) });

export const productflow: EditorDef = {
  id: 'product-flow', num: '13', name: 'Product flow diagram', field: 'Methods',
  blurb: 'Food-industry process flows with inputs, waste streams, decisions and HACCP critical control points.',
  hint: 'Click a step to edit it. Drag a step to another grid cell; dropping on a step swaps them.',
  normalize,
  templates: [
    { name: 'Apple sauce line', desc: 'Snake layout with a CCP on heat treatment', title: 'Apple sauce processing',
      data: T('> Apple totes\nWash and inspect\n- Rejected fruit (waste)\nDe-calyx\nCook\nPulp\n- Skins and seeds (byproduct)\nMix\n+ Sugar and ascorbic acid\nHeat\nHold {≥ 85 °C for 2 min}\n? Temp/time [CCP 1: B] | YES: Fill and cap | NO: Heat\nFill and cap\nCool\nLabel\nCase and palletise\n> Ship', { layout: 'snake', perRow: 5, numbers: true, uppercase: false, legend: true }) },
    { name: 'Pasteurised milk', desc: 'Column layout, two CCPs', title: 'HTST milk pasteurisation',
      data: T('> Raw milk receival\nCold storage {≤ 4 °C}\nClarify\n- Sediment (waste)\nStandardise fat\n+ Skim or cream\nHomogenise\nPasteurise [CCP 1: B] {72 °C for 15 s}\nCool\nFill and seal [CCP 2: P]\n> Cold chain dispatch', { layout: 'column', perRow: 5, numbers: true, uppercase: false, legend: true }) }
  ],
  stats: d => [[normalize(d).steps.length, 'steps']],
  Controls, Overlay,
  Render: ({ data }) => <Render data={data} />,
  findText: (data, text) => { const d = normalize(data), t = text.toLowerCase(); const s = d.steps.find((x: any) => x.label.replace(/\n/g, ' ').toLowerCase() === t || x.label.split('\n').some((l: string) => l.toLowerCase() === t)); return s ? { kind: 'step', id: s.id } : null; },
  blank: { layout: 'snake', perRow: 5, numbers: true, uppercase: false, legend: true, steps: fromText('> Raw material\nProcess step\n> Product') },
  duplicate: (data, sel) => {
    const d = normalize(data), i = d.steps.findIndex((x: any) => x.id === sel.id); if (i < 0) return null;
    const id = uid('step-', d.steps.map((x: any) => x.id)), a = [...d.steps];
    a.splice(i + 1, 0, { ...d.steps[i], id, col: undefined, row: undefined, next: undefined });
    return { patch: { ...d, steps: a.map((x: any) => ({ ...x, col: undefined, row: undefined })) }, sel: { kind: 'step', id } };
  },
  remove: (data, sel) => { const d = normalize(data); return sel.kind === 'step' ? { ...d, steps: d.steps.filter((x: any) => x.id !== sel.id) } : null; },
};
