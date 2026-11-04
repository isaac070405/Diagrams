import { S } from '../sheet';
import { EmptyHint, lines, num, Range, RowX, Seg, Select, startDrag, Swatches, TextIn, TextView, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const SHAPES: string[] = (window as any).SciDiagram.FLOW_SHAPES;
const SHAPE_NAMES: [string, string][] = SHAPES.map(s => [s, s[0].toUpperCase() + s.slice(1).replace('-', ' ')]);

/* ---------- text format ⇄ structure ---------- */
function parseText(text: string, prev?: any) {
  const boxes: any[] = [], links: any[] = [], stages: any[] = [], old: any = {};
  (prev && prev.boxes || []).forEach((b: any) => { old[b.id] = b; });
  for (const l of lines(text)) {
    const t = l.trim(); let m;
    if ((m = t.match(/^==\s*([^:]+):(.*)$/))) { stages.push({ label: m[1].trim(), ids: m[2].split(',').map(s => s.trim()).filter(Boolean) }); continue; }
    if ((m = t.match(/^([\w-]+)\s*(>>|>)\s*([\w-]+)\s*(?::\s*(.*))?$/))) { links.push({ a: m[1], b: m[3], side: m[2] === '>>', label: m[4] || '' }); continue; }
    if ((m = t.match(/^([\w-]+)\s+(?:\[([\w-]+)\]\s*)?(.*)$/))) {
      const keep = old[m[1]] || {};
      boxes.push({ ...keep, id: m[1], shape: SHAPES.includes(m[2]) ? m[2] : 'step', label: m[3].replace(/\s*\/\/\s*/g, '\n') });
    }
  }
  const oldLinks = (prev && prev.links) || [];
  links.forEach(k => { const o = oldLinks.find((q: any) => q.a === k.a && q.b === k.b); if (o) Object.assign(k, { dash: o.dash, width: o.width, color: o.color }); });
  return { boxes, links, stages };
}
function toText(d: any) {
  const out: string[] = [];
  d.boxes.forEach((b: any) => out.push(b.id + ' ' + (b.shape && b.shape !== 'step' ? '[' + b.shape + '] ' : '') + String(b.label || '').replace(/\n/g, ' // ')));
  d.links.forEach((k: any) => out.push(k.a + (k.side ? ' >> ' : ' > ') + k.b + (k.label ? ' : ' + k.label : '')));
  d.stages.forEach((s: any) => out.push('== ' + s.label + ' : ' + s.ids.join(', ')));
  return out.join('\n');
}
function normalize(d: any) {
  if (d.boxes) return d;
  const { spec, ...rest } = d;
  return { ...rest, ...parseText(spec || '') };
}

/* ---------- layout: automatic ranks, then any box the person moved keeps its place ---------- */
export function layout(d: any) {
  const boxes = d.boxes || [], byId: any = {};
  boxes.forEach((b: any) => { byId[b.id] = b; });
  const ok = (d.links || []).filter((k: any) => byId[k.a] && byId[k.b] && k.a !== k.b);
  const W = num(d.boxW, 260), side = num(d.sideW, 220), gapX = 60, gapY = num(d.gapY, 44), cols = num(d.cols, 1);
  const rank: any = {}; boxes.forEach((b: any) => { rank[b.id] = 0; });
  for (let it = 0; it < boxes.length; it++) {
    let moved = false;
    for (const k of ok) { const r = k.side ? rank[k.a] : rank[k.a] + 1; if (r > rank[k.b] && r < 60) { rank[k.b] = r; moved = true; } }
    if (!moved) break;
  }
  const isSide: any = {}; ok.forEach((k: any) => { if (k.side) isSide[k.b] = true; });
  const rows: any[][] = []; boxes.forEach((b: any) => { (rows[rank[b.id]] = rows[rank[b.id]] || []).push(b); });
  const pos: any = {}; let y = 0; const stageW = (d.stages || []).length ? 34 : 0;
  rows.forEach(row => {
    if (!row) return;
    const main = row.filter(b => !isSide[b.id]), sides = row.filter(b => isSide[b.id]);
    const hh = Math.max(...row.map(b => 26 + 17 * String(b.label || '').split('\n').length * (num(b.fontSize, 13) / 13)));
    const total = main.length * W + (main.length - 1) * 40;
    let x = stageW + Math.max(0, (W * cols + 40 * (cols - 1) - total) / 2);
    main.forEach(b => { pos[b.id] = { x, y, w: W, h: hh }; x += W + 40; });
    sides.forEach(b => {
      const parent = ok.find((k: any) => k.side && k.b === b.id);
      const px = parent && pos[parent.a] ? pos[parent.a].x + pos[parent.a].w + gapX : x;
      pos[b.id] = { x: px, y, w: side, h: hh }; x = px + side + 40;
    });
    y += hh + gapY;
  });
  boxes.forEach((b: any) => {
    const q = pos[b.id];
    if (b.w) q.w = b.w; if (b.h) q.h = b.h;
    if (b.x != null && b.y != null) { q.x = b.x; q.y = b.y; }
  });
  return { boxes, links: ok, pos };
}

function arrowPts(a: any, b: any, side: boolean): [number, number][] {
  const acx = a.x + a.w / 2, bcx = b.x + b.w / 2, acy = a.y + a.h / 2, bcy = b.y + b.h / 2;
  if (side || (Math.abs(acy - bcy) < Math.min(a.h, b.h) / 2)) {
    const yy = Math.abs(acy - bcy) < Math.min(a.h, b.h) / 2 ? (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2 : acy;
    return bcx >= acx ? [[a.x + a.w, yy], [b.x, yy]] : [[a.x, yy], [b.x + b.w, yy]];
  }
  const down = bcy > acy;
  const y1 = down ? a.y + a.h : a.y, y2 = down ? b.y : b.y + b.h;
  if (Math.abs(acx - bcx) < 2) return [[acx, y1], [bcx, y2]];
  const mid = (y1 + y2) / 2;
  return [[acx, y1], [acx, mid], [bcx, mid], [bcx, y2]];
}

function FlowSheet({ data }: { data: any }) {
  const p = layout(data);
  if (!p.boxes.length) return <EmptyHint text="Add a box from the sidebar to start." />;
  const out: any[] = [];
  (data.stages || []).forEach((s: any, i: number) => {
    const bs = s.ids.map((id: string) => p.pos[id]).filter(Boolean);
    if (!bs.length) return;
    out.push(<S.FlowStage key={'s' + i} x={Math.min(...Object.values(p.pos).map((q: any) => q.x)) - 20} y0={Math.min(...bs.map((b: any) => b.y))} y1={Math.max(...bs.map((b: any) => b.y + b.h))} label={s.label} />);
  });
  p.links.forEach((k: any, i: number) => {
    out.push(<S.FlowArrow key={'a' + i} points={arrowPts(p.pos[k.a], p.pos[k.b], k.side)} label={k.label || undefined} labelDx={k.side ? 0 : 8} labelDy={k.side ? -6 : 0}
      dash={k.dash || undefined} width={k.width || undefined} color={k.color || undefined} />);
  });
  p.boxes.forEach((b: any) => {
    const q = p.pos[b.id];
    out.push(<g key={b.id} className={b.fill ? 'mk-fill' : undefined} style={b.fill ? { ['--mk-fill' as any]: b.fill } : undefined}>
      <S.FlowNode shape={b.shape} x={q.x} y={q.y} w={q.w} h={q.h} label={b.label} color={b.stroke || undefined} border={b.border || undefined} fontSize={b.fontSize || undefined} />
    </g>);
  });
  return <>{out}</>;
}

function Overlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const p = layout(data);
  return (
    <>
      {p.links.map((k: any, i: number) => {
        const pts = arrowPts(p.pos[k.a], p.pos[k.b], k.side);
        const on = sel && sel.kind === 'link' && sel.id === k.a + '>' + k.b;
        return <polyline key={'l' + i} className={'mk-hit-line' + (on ? ' mk-on' : '')} points={pts.map(q => q.join(',')).join(' ')} onPointerDown={e => { e.stopPropagation(); setSel({ kind: 'link', id: k.a + '>' + k.b }); }} />;
      })}
      {p.boxes.map((b: any) => {
        const q = p.pos[b.id], on = sel && sel.kind === 'box' && sel.id === b.id;
        return (
          <g key={b.id}>
            <rect className={'mk-hit' + (on ? ' mk-on' : '')} x={q.x - 4} y={q.y - 4} width={q.w + 8} height={q.h + 8}
              onPointerDown={e => {
                setSel({ kind: 'box', id: b.id });
                const x0 = q.x, y0 = q.y;
                startDrag(e, toSvg, (dx, dy) => {
                  const nx = Math.round((x0 + dx) / 4) * 4, ny = Math.round((y0 + dy) / 4) * 4;
                  set({ boxes: data.boxes.map((c: any) => c.id === b.id ? { ...c, x: nx, y: ny } : c) }, 'drag-' + b.id);
                });
              }} />
            {on ? <rect className="mk-resize" x={q.x + q.w - 5} y={q.y + q.h - 5} width={10} height={10}
              onPointerDown={e => {
                const w0 = q.w, h0 = q.h;
                startDrag(e, toSvg, (dx, dy) => set({ boxes: data.boxes.map((c: any) => c.id === b.id ? { ...c, x: q.x, y: q.y, w: Math.max(60, Math.round(w0 + dx)), h: Math.max(30, Math.round(h0 + dy)) } : c) }, 'size-' + b.id));
              }} /> : null}
          </g>
        );
      })}
    </>
  );
}

function Controls({ data, set, sel, setSel }: EditProps) {
  const boxes = data.boxes || [], links = data.links || [], stages = data.stages || [];
  const ids = boxes.map((b: any) => b.id);
  const box = sel && sel.kind === 'box' ? boxes.find((b: any) => b.id === sel.id) : null;
  const link = sel && sel.kind === 'link' ? links.find((k: any) => k.a + '>' + k.b === sel.id) : null;
  const upBox = (patch: any, key?: string) => set({ boxes: boxes.map((b: any) => b.id === box.id ? { ...b, ...patch } : b) }, key);
  const upLink = (k: any, patch: any, key?: string) => set({ links: links.map((q: any) => q === k ? { ...q, ...patch } : q) }, key);
  const addBox = () => {
    const id = uid('b', ids);
    const nb = { id, shape: 'step', label: 'New step' };
    set({ boxes: [...boxes, nb], links: box ? [...links, { a: box.id, b: id, side: false, label: '' }] : links });
    setSel({ kind: 'box', id });
  };
  const names: [string, string][] = boxes.map((b: any) => [b.id, String(b.label || b.id).split('\n')[0].slice(0, 28)]);
  return (
    <>
      {box ? (
        <S.Panel kicker="Selected box" help="Drag on the sheet to move it; drag the corner square to resize. Delete removes it.">
          <S.Field id="fl-label" label="Text" multiline rows={3} value={box.label} onChange={(e: any) => upBox({ label: e.target.value }, 'label-' + box.id)} />
          <Select id="fl-shape" label="Shape" value={box.shape} options={SHAPE_NAMES} onChange={v => upBox({ shape: v })} />
          <Swatches label="Fill" value={box.fill} none="White" onChange={v => upBox({ fill: v })} />
          <Swatches label="Border" value={box.stroke} none="Ink" onChange={v => upBox({ stroke: v })} />
          <Range id="fl-bw" label="Border width" value={num(box.border, 1)} min={0.5} max={4} step={0.25} onChange={v => upBox({ border: v }, 'border')} />
          <Range id="fl-fs" label="Text size" value={num(box.fontSize, 13)} min={9} max={22} onChange={v => upBox({ fontSize: v }, 'fs')} />
          <Select id="fl-connect" label="Draw an arrow to" value="" options={[['', 'Choose a box…'], ...names.filter(([i]) => i !== box.id)]}
            onChange={v => { if (v) set({ links: [...links, { a: box.id, b: v, side: false, label: '' }] }); }} />
          <div className="sd-row-btns">
            <S.ToolButton compact onClick={() => upBox({ x: undefined, y: undefined, w: undefined, h: undefined })}>Back to layout</S.ToolButton>
            <S.ToolButton compact onClick={() => { set({ boxes: boxes.filter((b: any) => b.id !== box.id), links: links.filter((k: any) => k.a !== box.id && k.b !== box.id) }); setSel(null); }}>Delete box</S.ToolButton>
          </div>
        </S.Panel>
      ) : null}
      {link ? (
        <S.Panel kicker="Selected arrow">
          <TextIn id="fl-llabel" label="Label" value={link.label} placeholder="e.g. Yes" onChange={v => upLink(link, { label: v }, 'll')} />
          <Seg value={link.dash || ''} options={[['', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']]} onChange={v => upLink(link, { dash: v || undefined })} />
          <Range id="fl-lw" label="Line width" value={num(link.width, 1.4)} min={0.8} max={4} step={0.2} onChange={v => upLink(link, { width: v }, 'lw')} />
          <Swatches label="Colour" value={link.color} none="Ink" onChange={v => upLink(link, { color: v })} />
          <S.ToolButton onClick={() => { set({ links: links.filter((q: any) => q !== link) }); setSel(null); }}>Delete arrow</S.ToolButton>
        </S.Panel>
      ) : null}
      <S.Panel kicker="Boxes" help="Click a box here or on the sheet to edit it.">
        {boxes.map((b: any) => (
          <div key={b.id} className="mk-row" data-on={box && box.id === b.id ? '1' : '0'}>
            <button type="button" className="mk-row-main" onClick={() => setSel({ kind: 'box', id: b.id })}>{String(b.label || b.id).split('\n')[0]}</button>
            <RowX label={b.id} onRemove={() => set({ boxes: boxes.filter((c: any) => c !== b), links: links.filter((k: any) => k.a !== b.id && k.b !== b.id) })} />
          </div>
        ))}
        <S.ToolButton onClick={addBox}>{box ? '+ Add a box after this one' : '+ Add box'}</S.ToolButton>
      </S.Panel>
      <S.Panel kicker="Arrows" help="Below puts the box on the next row; beside keeps it on the same row.">
        {links.map((k: any, i: number) => (
          <div key={i} className="mk-row mk-row-grid">
            <Select id={'fl-a' + i} value={k.a} options={names} onChange={v => upLink(k, { a: v })} />
            <Select id={'fl-s' + i} value={k.side ? 'beside' : 'below'} options={[['below', 'below'], ['beside', 'beside']]} onChange={v => upLink(k, { side: v === 'beside' })} />
            <Select id={'fl-b' + i} value={k.b} options={names} onChange={v => upLink(k, { b: v })} />
            <RowX label="arrow" onRemove={() => set({ links: links.filter((q: any) => q !== k) })} />
          </div>
        ))}
        {boxes.length > 1 ? <S.ToolButton onClick={() => set({ links: [...links, { a: boxes[0].id, b: boxes[1].id, side: false, label: '' }] })}>+ Add arrow</S.ToolButton> : null}
      </S.Panel>
      <S.Panel kicker="Stage brackets">
        {stages.map((s: any, i: number) => (
          <div key={i} className="mk-row mk-row-grid2">
            <TextIn id={'fl-st' + i} value={s.label} placeholder="Stage name" onChange={v => set({ stages: stages.map((q: any) => q === s ? { ...q, label: v } : q) }, 'st' + i)} />
            <TextIn id={'fl-si' + i} value={s.ids.join(', ')} placeholder="box ids" onChange={v => set({ stages: stages.map((q: any) => q === s ? { ...q, ids: v.split(',').map(x => x.trim()).filter(Boolean) } : q) }, 'si' + i)} />
            <RowX label="stage" onRemove={() => set({ stages: stages.filter((q: any) => q !== s) })} />
          </div>
        ))}
        <S.ToolButton onClick={() => set({ stages: [...stages, { label: 'Stage', ids: box ? [box.id] : [] }] })}>+ Add stage</S.ToolButton>
      </S.Panel>
      <S.Panel kicker="Layout">
        <Seg value={num(data.cols, 1)} options={[[1, 'One column'], [2, 'Two arms'], [3, 'Three arms']]} onChange={v => set({ cols: v })} />
        <Range id="fl-w" label="Box width" value={num(data.boxW, 260)} min={140} max={380} step={10} onChange={v => set({ boxW: v }, 'bw')} />
        <Range id="fl-sw" label="Side box width" value={num(data.sideW, 220)} min={120} max={360} step={10} onChange={v => set({ sideW: v }, 'sw')} />
        <Range id="fl-gy" label="Row gap" value={num(data.gapY, 44)} min={24} max={90} onChange={v => set({ gapY: v }, 'gy')} />
        <S.ToolButton onClick={() => set({ boxes: boxes.map((b: any) => ({ ...b, x: undefined, y: undefined, w: undefined, h: undefined })) })}>Tidy: put every box back in the layout</S.ToolButton>
      </S.Panel>
      <TextView id="fl-text" title="Edit as text" text={toText(data)} rows={12}
        help="Box: id [shape] Label // new line. Arrow below: a > b : label. Beside: a >> b. Stage: == Name : a, b."
        onChange={t => set(parseText(t, data), 'text')} />
    </>
  );
}

const T = (spec: string, extra: any) => ({ ...extra, ...parseText(spec) });

export const flow: EditorDef = {
  id: 'flow-diagram', num: '03', name: 'Flow diagram', field: 'Methods',
  blurb: 'PRISMA, CONSORT and process flowcharts: drag boxes, restyle them, and draw arrows between them.',
  hint: 'Click a box or arrow to edit it. Drag boxes to move them. Delete removes the selection, Esc clears it.',
  normalize,
  templates: [
    { name: 'PRISMA 2020', desc: 'Systematic review: identification to inclusion', title: 'Study selection (PRISMA 2020)',
      data: T('id1 Records identified from databases // (n = 1 284)\nex1 Duplicates removed // (n = 312)\nsc1 Records screened // (n = 972)\nex2 Records excluded on title and abstract // (n = 801)\nre1 Reports assessed for eligibility // (n = 171)\nex3 Reports excluded (n = 107) // wrong population (n = 61) // no comparator (n = 46)\nin1 [terminal] Studies included in review // (n = 64)\nid1 > sc1\nid1 >> ex1\nsc1 > re1\nsc1 >> ex2\nre1 > in1\nre1 >> ex3\n== Identification : id1, ex1\n== Screening : sc1, ex2, re1, ex3\n== Included : in1', { boxW: 260, sideW: 230, gapY: 40, cols: 1 }) },
    { name: 'CONSORT trial', desc: 'Two-arm diet trial with losses to follow-up', title: 'Participant flow through the diet trial (CONSORT)',
      data: T('el Assessed for eligibility (n = 420)\nx0 Excluded (n = 102) // not meeting criteria (n = 77) // declined (n = 25)\nr [terminal] Randomised (n = 318)\na1 Allocated to Mediterranean diet // (n = 160)\na2 Allocated to usual diet // (n = 158)\nf1 Lost to follow-up (n = 12)\nf2 Lost to follow-up (n = 15)\nz1 [terminal] Analysed (n = 148)\nz2 [terminal] Analysed (n = 143)\nel > r\nel >> x0\nr > a1\nr > a2\na1 > f1\na2 > f2\nf1 > z1\nf2 > z2\n== Enrolment : el, x0, r\n== Allocation : a1, a2\n== Follow-up : f1, f2\n== Analysis : z1, z2', { boxW: 220, sideW: 200, gapY: 40, cols: 2 }) },
    { name: 'Lab protocol', desc: 'Steps with a decision and an output', title: 'Bradford protein assay',
      data: T('s [terminal] Start\np1 Prepare BSA standards // 0 to 2 mg/mL\np2 Add Bradford reagent // to samples and standards\nd [decision] A595 within // standard range?\nx [io] Dilute sample 1:10\nr [document] Read concentration // from standard curve\ns > p1\np1 > p2\np2 > d\nd >> x : No\nd > r : Yes', { boxW: 240, sideW: 200, gapY: 36, cols: 1 }) }
  ],
  stats: d => { const n = normalize(d); return [[n.boxes.length, 'boxes'], [n.links.length, 'arrows']]; },
  Controls,
  Overlay,
  findText: (d, text) => {
    const n = normalize(d); const t = text.toLowerCase();
    const b = n.boxes.find((x: any) => String(x.label).replace(/\n/g, ' ').toLowerCase().includes(t) || t.includes(String(x.label).split('\n')[0].toLowerCase()));
    return b ? { kind: 'box', id: b.id } : null;
  },
  blank: { boxW: 260, sideW: 220, gapY: 44, cols: 1, boxes: [{ id: 'b1', shape: 'terminal', label: 'Start' }, { id: 'b2', shape: 'step', label: 'First step' }], links: [{ a: 'b1', b: 'b2', side: false, label: '' }], stages: [] },
  connect: { kind: 'box', label: 'box', plural: 'boxes', make: (d, a, b) => { const n = normalize(d); return n.links.some((k: any) => k.a === a && k.b === b) ? null : { ...n, links: [...n.links, { a, b, side: false, label: '' }] }; } },
  nudge: (d, sel, dx, dy) => {
    if (sel.kind !== 'box') return null;
    const n = normalize(d), q = layout(n).pos[sel.id]; if (!q) return null;
    return { ...n, boxes: n.boxes.map((b: any) => b.id === sel.id ? { ...b, x: q.x + dx, y: q.y + dy } : b) };
  },
  duplicate: (d, sel) => {
    if (sel.kind !== 'box') return null;
    const n = normalize(d), b = n.boxes.find((x: any) => x.id === sel.id), q = layout(n).pos[sel.id]; if (!b || !q) return null;
    const id = uid('b', n.boxes.map((x: any) => x.id));
    return { patch: { ...n, boxes: [...n.boxes, { ...b, id, x: q.x + 24, y: q.y + 24 }] }, sel: { kind: 'box', id } };
  },
  remove: (d, sel) => sel.kind === 'box'
    ? { boxes: d.boxes.filter((b: any) => b.id !== sel.id), links: d.links.filter((k: any) => k.a !== sel.id && k.b !== sel.id) }
    : sel.kind === 'link' ? { links: d.links.filter((k: any) => k.a + '>' + k.b !== sel.id) } : null,
  Render: ({ data }) => <FlowSheet data={normalize(data)} />,
};
