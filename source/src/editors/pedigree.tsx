import { S } from '../sheet';
import { EmptyHint, lines, num, Range, RowsText, startDrag, TextView, Toggle } from '../ui';
const SHOWN = ['affected', 'carrier', 'deceased', 'proband'];
import type { EditorDef, EditProps } from '../shell';

const FLAG: any = { affected: 'affected', carrier: 'carrier', xcarrier: 'xcarrier', 'x-carrier': 'xcarrier', deceased: 'deceased', proband: 'proband',
  unknown: 'unknownSt', 'adopted-in': 'adoptedIn', 'adopted-out': 'adoptedOut', pregnancy: 'pregnancy' };
const ROMAN: any = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5 };

function parse(d: any) {
  const people: any[] = [], unions: any[] = [], by: any = {};
  for (const l of lines(d.spec)) {
    const t = l.trim();
    const um = t.match(/^(\S+)\s*([+=/])\s*(\S+)\s*(?:>\s*(.*))?$/);
    if (um) { unions.push({ a: um[1], b: um[3], consang: um[2] === '=', divorced: um[2] === '/', children: (um[4] || '').split(',').map(s => s.trim()).filter(Boolean) }); continue; }
    const [name, sex, ...rest] = t.split(/\s+/);
    const g = name.match(/^([IVX]+)-/);
    const q: any = { id: name, name, sex: /^[mfu]$/i.test(sex || '') ? sex.toLowerCase() : 'u', gen: g ? (ROMAN[g[1]] ?? 0) : 0 };
    for (const w of rest) { const m = w.match(/^gen=(\d+)$/); if (m) q.gen = +m[1] - 1; else if (FLAG[w.toLowerCase()]) q[FLAG[w.toLowerCase()]] = true; }
    people.push(q); by[q.id] = q;
  }
  const us = unions.filter(u => by[u.a] && by[u.b]).map(u => ({ ...u, children: u.children.filter((c: string) => by[c]) }));
  layout(people, us, by, num(d.gap, 90));
  const px = d.px || {};
  people.forEach(q => { if (px[q.id] != null) q.x = px[q.id]; });
  return { people, unions: us };
}

/* Children sit centred under their parents; partners who married in sit beside the child they married. */
function layout(people: any[], unions: any[], by: any, gap: number) {
  const isChild: any = {};
  unions.forEach(u => u.children.forEach((c: string) => { isChild[c] = true; }));
  const gens = Array.from(new Set(people.map(p => p.gen))).sort((a, b) => a - b);
  const placed: any = {};
  gens.forEach(g => {
    const row = people.filter(p => p.gen === g);
    const order: any[] = [];
    const add = (p: any) => { if (p && !order.includes(p)) order.push(p); };
    const groups: { members: any[]; center: number | null }[] = [];
    unions.forEach(u => {
      const kids = u.children.map((c: string) => by[c]).filter((k: any) => k && k.gen === g);
      if (!kids.length) return;
      const members: any[] = [];
      kids.forEach((k: any) => {
        const sp = unions.find(v => (v.a === k.id && !isChild[v.b]) || (v.b === k.id && !isChild[v.a]));
        const other = sp ? by[sp.a === k.id ? sp.b : sp.a] : null;
        if (other && other.gen === g && !members.includes(other) && !order.includes(other)) members.push(other);
        members.push(k);
      });
      const pa = by[u.a], pb = by[u.b];
      groups.push({ members, center: placed[u.a] && placed[u.b] ? (pa.x + pb.x) / 2 : null });
      members.forEach(add);
    });
    row.forEach(p => { if (!order.includes(p)) { groups.push({ members: [p], center: null }); add(p); } });
    let cursor = -Infinity;
    groups.forEach(gr => {
      const ms = gr.members.filter(m => !placed[m.id]);
      if (!ms.length) return;
      const w = (ms.length - 1) * gap;
      let x0 = gr.center != null ? gr.center - w / 2 : (cursor === -Infinity ? 0 : cursor);
      if (x0 < cursor) x0 = cursor;
      ms.forEach((m, i) => { m.x = x0 + i * gap; placed[m.id] = true; });
      cursor = x0 + w + gap;
    });
  });
}

function PdOverlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const p = parse(data);
  return <>{p.people.map((q: any) => {
    const cx = 60 + q.x, cy = 30 + q.gen * 110, on = sel && sel.kind === 'person' && sel.id === q.id;
    return <rect key={q.id} className={'mk-hit' + (on ? ' mk-on' : '')} x={cx - 20} y={cy - 20} width={40} height={40}
      onPointerDown={e => { setSel({ kind: 'person', id: q.id }); const x0 = q.x; startDrag(e, toSvg, dx => set({ px: { ...(data.px || {}), [q.id]: Math.round(x0 + dx) } }, 'pd-drag-' + q.id)); }} />;
  })}</>;
}

export const pedigree: EditorDef = {
  hint: 'Drag a person sideways to move them. Arrow keys nudge the selected person.',
  blank: { gap: 90, gens: true, spec: 'I-1 m\nI-2 f\nII-1 f\nI-1 + I-2 > II-1' },
  Overlay: PdOverlay,
  nudge: (d, sel, dx) => { const q = parse(d).people.find((x: any) => x.id === sel.id); return q && dx ? { px: { ...(d.px || {}), [q.id]: q.x + dx } } : null; },
  findText: (d, text) => { const q = parse(d).people.find((x: any) => x.name === text.trim()); return q ? { kind: 'person', id: q.id } : null; },
  remove: (d, sel) => ({ spec: String(d.spec || '').split('\n').map(l => {
    const m = l.trim().match(/^(\S+)\s*([+=/])\s*(\S+)\s*(?:>\s*(.*))?$/);
    if (!m) return l.trim().split(/\s+/)[0] === sel.id ? null : l;
    if (m[1] === sel.id || m[3] === sel.id) return null;
    const kids = (m[4] || '').split(',').map(s => s.trim()).filter(s => s && s !== sel.id);
    return m[1] + ' ' + m[2] + ' ' + m[3] + (kids.length ? ' > ' + kids.join(', ') : '');
  }).filter(l => l != null).join('\n') }),
  id: 'pedigree', num: '04', name: 'Pedigree', field: 'Evolution and genetics',
  blurb: 'Standard pedigree symbols with mating, sibship and descent lines, laid out from a list of people.',
  templates: [
    {
      name: 'Autosomal recessive', desc: 'Carrier parents, an affected son and grandson', title: 'Autosomal recessive trait',
      caption: 'Filled = affected; centre dot = carrier; slash = deceased; arrow = proband (III-2).',
      data: { gap: 90, gens: true, spec: 'I-1 m carrier\nI-2 f carrier\nII-1 f carrier\nII-2 m affected\nII-3 m deceased\nII-4 m\nIII-1 f\nIII-2 m affected proband\nIII-3 f carrier\nI-1 + I-2 > II-1, II-2, II-3\nII-4 + II-1 > III-1, III-2, III-3' }
    },
    {
      name: 'X-linked recessive', desc: 'Carrier mother, affected sons', title: 'X-linked recessive inheritance (haemophilia A)',
      data: { gap: 90, gens: true, spec: 'I-1 m\nI-2 f xcarrier\nII-1 m affected\nII-2 f xcarrier\nII-3 f\nII-4 m\nII-5 m\nIII-1 m affected proband\nIII-2 f\nI-1 + I-2 > II-1, II-2, II-3\nII-4 + II-2 > III-1, III-2\nII-5 + II-3' }
    },
    {
      name: 'Consanguinity', desc: 'First-cousin union with an affected child', title: 'First-cousin marriage',
      data: { gap: 90, gens: true, spec: 'I-1 m\nI-2 f\nII-1 m carrier\nII-2 f carrier\nII-3 f\nII-4 m\nIII-1 m carrier\nIII-2 f carrier\nIV-1 f affected proband\nIV-2 m\nI-1 + I-2 > II-1, II-2\nII-3 + II-1 > III-1\nII-2 + II-4 > III-2\nIII-1 = III-2 > IV-1, IV-2' }
    }
  ],
  stats: d => { const p = parse(d); return [[p.people.length, 'people'], [p.unions.length, 'unions']]; },
  Controls: ({ data, set }) => (
    <>
      <RowsText id="pd-people" kicker="People" help="Name with a Roman numeral for the generation, e.g. II-3. Click a symbol's name on the sheet to find it." text={data.spec}
        match={l => !/[+=/]/.test(l.replace(/^\S+\s/, ''))}
        parse={l => { const [name, sex, ...rest] = l.trim().split(/\s+/); const r: any = { name, sex: /^[mfu]$/i.test(sex || '') ? sex.toLowerCase() : 'u', extra: rest.filter(w => !SHOWN.includes(w.toLowerCase())).join(' ') }; SHOWN.forEach(f => { r[f] = rest.some(w => w.toLowerCase() === f); }); return r; }}
        format={r => [r.name, r.sex || 'u', ...SHOWN.filter(f => r[f]), r.extra || ''].filter(Boolean).join(' ')}
        cols={[{ key: 'name', label: 'Name', w: '0.9fr' }, { key: 'sex', label: 'Sex', type: 'select', options: [['m', 'Male'], ['f', 'Female'], ['u', 'Unknown']], w: '0.9fr' },
          { key: 'affected', label: 'Affected', type: 'check', placeholder: 'Aff.' }, { key: 'carrier', label: 'Carrier', type: 'check', placeholder: 'Car.' },
          { key: 'deceased', label: 'Deceased', type: 'check', placeholder: 'Dec.' }, { key: 'proband', label: 'Proband', type: 'check', placeholder: 'Pro.' }]}
        blank={() => ({ name: 'III-9', sex: 'f' })} addLabel="+ Add person" onText={(v, k) => set({ spec: v }, k)} />
      <RowsText id="pd-unions" kicker="Unions and children" text={data.spec}
        match={l => /^\S+\s*[+=/]\s*\S+/.test(l.trim())}
        parse={l => { const m = l.trim().match(/^(\S+)\s*([+=/])\s*(\S+)\s*(?:>\s*(.*))?$/) || []; return { a: m[1], kind: m[2] || '+', b: m[3], children: m[4] || '' }; }}
        format={r => r.a + ' ' + (r.kind || '+') + ' ' + r.b + (String(r.children || '').trim() ? ' > ' + r.children : '')}
        cols={[{ key: 'a', label: 'Partner', w: '0.8fr' }, { key: 'kind', label: 'Union', type: 'select', options: [['+', 'Married'], ['=', 'Related'], ['/', 'Separated']], w: '0.9fr' }, { key: 'b', label: 'Partner', w: '0.8fr' }, { key: 'children', label: 'Children', w: '1.4fr' }]}
        blank={() => ({ a: 'I-1', kind: '+', b: 'I-2', children: '' })} addLabel="+ Add union" onText={(v, k) => set({ spec: v }, k)} />
      <TextView id="pd-spec" title="Edit as text" text={data.spec} rows={12} help="Person: II-3 f carrier (flags: affected, carrier, xcarrier, deceased, proband, unknown, adopted-in, adopted-out, pregnancy). Union: I-1 + I-2 > II-1, II-2." onChange={v => set({ spec: v }, 'spec')} />
      <S.Panel kicker="Layout">
        <Range id="pd-gap" label="Spacing" value={num(data.gap, 90)} min={60} max={150} step={5} onChange={v => set({ gap: v }, 'gap')} />
        <Toggle on={data.gens} label="Generation numerals" onChange={v => set({ gens: v })} />
        {data.px && Object.keys(data.px).length ? <S.ToolButton onClick={() => set({ px: {} })}>Tidy: automatic positions</S.ToolButton> : null}
      </S.Panel>
    </>
  ),
  Render: ({ data }) => {
    const p = parse(data);
    if (!p.people.length) return <EmptyHint text="Add people in the sidebar, e.g. “I-1 m”." />;
    return <S.Pedigree x={60} y={30} genGap={110} people={p.people} unions={p.unions} showGens={data.gens} />;
  },
};
