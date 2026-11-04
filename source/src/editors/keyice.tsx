import { S } from '../sheet';
import { EmptyHint, num, Range, RowsText, Seg, Spec, TextView, Toggle } from '../ui';
import type { EditorDef } from '../shell';

/* Indented outline: each couplet is two sibling leads; "-> Name (common name)" ends a lead at a taxon. */
function parseKey(text: string): { root: any; error: string } {
  const rows = String(text || '').split('\n').filter(l => l.trim()).map(l => ({ depth: Math.floor((l.match(/^\s*/)![0].replace(/\t/g, '  ').length) / 2), text: l.trim() }));
  const root: any = { lead: '', children: [] };
  const stack: any[] = [{ depth: -1, node: root }];
  for (const r of rows) {
    const m = r.text.match(/^(.*?)\s*->\s*(.+?)\s*(?:\((.+)\))?\s*$/);
    const node: any = m ? { lead: m[1], name: m[2], note: m[3] } : { lead: r.text, children: [] };
    while (stack.length && stack[stack.length - 1].depth >= r.depth) stack.pop();
    const parent = stack[stack.length - 1].node;
    if (!parent.children) return { root: null, error: '“' + parent.lead + '” ends at a taxon, so it cannot have leads under it.' };
    parent.children.push(node);
    if (!m) stack.push({ depth: r.depth, node });
  }
  let error = '';
  const check = (n: any) => {
    if (!n.children) return;
    if (n.children.length !== 2 && !error) error = (n.lead ? '“' + n.lead + '”' : 'The top level') + ' needs exactly two leads, it has ' + n.children.length + '.';
    n.children.forEach(check);
  };
  check(root);
  return { root: error ? null : root, error };
}

export const dkey: EditorDef = {
  blank: { colW: 220, rowH: 64, numbering: 'letters', list: true, outline: 'First character present -> Taxon A\nFirst character absent -> Taxon B' },
  id: 'dichotomous-key', num: '08', name: 'Dichotomous key', field: 'Evolution and genetics',
  blurb: 'A branching key drawn from an indented outline, with the numbered couplets alongside.',
  templates: [
    { name: 'Common trees', desc: 'Pine to birch by leaf characters', title: 'Key to common trees',
      data: { colW: 220, rowH: 64, numbering: 'letters', list: true, outline:
        'Leaves needle-like or scale-like\n  Needles in bundles of two to five -> Pinus (pine)\n  Needles borne singly on the twig -> Picea (spruce)\nLeaves broad and flat\n  Leaf margin lobed\n    Lobes rounded, no bristle tips -> Quercus alba (white oak)\n    Lobes pointed, bristle-tipped -> Quercus rubra (red oak)\n  Leaf margin toothed, not lobed\n    Leaf base markedly asymmetric -> Ulmus (elm)\n    Bark peeling in papery strips -> Betula (birch)' } },
    { name: 'Intertidal animals', desc: 'Rock platform invertebrates', title: 'Key to rock platform invertebrates',
      data: { colW: 220, rowH: 60, numbering: 'primes', list: true, outline:
        'Body inside a hard shell\n  Shell in two hinged halves -> Mytilus (blue mussel)\n  Shell a single piece\n    Shell a cone, foot clamps to rock -> Cellana (limpet)\n    Shell coiled -> Austrocochlea (periwinkle)\nBody without a shell\n  Five arms around a central disc -> Patiriella (cushion star)\n  Body a soft column with tentacles -> Actinia (waratah anemone)' } }
  ],
  Controls: ({ data, set }) => {
    const p = parseKey(data.outline);
    return (
      <>
        <RowsText id="dk-rows" kicker="Leads" help="Each choice needs exactly two leads at the next level. Fill in a taxon to end a lead." text={data.outline}
          parse={l => { const depth = Math.floor((l.match(/^\s*/)![0].replace(/\t/g, '  ').length) / 2) + 1; const m = l.trim().match(/^(.*?)\s*->\s*(.+?)\s*(?:\((.+)\))?\s*$/); return m ? { depth, lead: m[1], taxon: m[2], note: m[3] || '' } : { depth, lead: l.trim(), taxon: '', note: '' }; }}
          format={r => '  '.repeat(Math.max(0, (parseInt(r.depth) || 1) - 1)) + (r.lead || '') + (String(r.taxon || '').trim() ? ' -> ' + r.taxon + (String(r.note || '').trim() ? ' (' + r.note + ')' : '') : '')}
          cols={[{ key: 'depth', label: 'Level', type: 'num', w: '0.45fr' }, { key: 'lead', label: 'Lead', w: '1.8fr' }, { key: 'taxon', label: 'Taxon', w: '0.9fr' }, { key: 'note', label: 'Common name', w: '0.9fr' }]}
          blank={() => ({ depth: 1, lead: 'New lead', taxon: '', note: '' })} addLabel="+ Add lead" onText={(v, k) => set({ outline: v }, k)} />
        {p.error ? <p className="mk-warn">{p.error}</p> : null}
        <TextView id="dk-outline" title="Edit as outline" text={data.outline} rows={12} help="Indent two spaces per level. End a lead with -> Taxon (common name)." onChange={v => set({ outline: v }, 'outline')} />
        <S.Panel kicker="Layout">
          <Seg value={data.numbering} options={[['letters', '1a / 1b'], ['primes', "1 / 1'"]]} onChange={v => set({ numbering: v })} />
          <Range id="dk-col" label="Column width" value={num(data.colW, 220)} min={150} max={320} step={10} onChange={v => set({ colW: v }, 'col')} />
          <Range id="dk-row" label="Row height" value={num(data.rowH, 64)} min={40} max={100} onChange={v => set({ rowH: v }, 'row')} />
          <Toggle on={data.list} label="Couplet list under the sheet" onChange={v => set({ list: v })} />
        </S.Panel>
      </>
    );
  },
  Render: ({ data }) => {
    const p = parseKey(data.outline);
    if (!p.root) return <EmptyHint text={p.error || 'Write the first couplet in the sidebar.'} />;
    return <S.DichotomousKey x={0} y={0} root={p.root} numbering={data.numbering} colW={num(data.colW, 220)} rowH={num(data.rowH, 64)} />;
  },
  Below: ({ data }) => {
    const p = parseKey(data.outline);
    return data.list && p.root ? <S.DichotomousKey root={JSON.parse(JSON.stringify(p.root))} view="bracketed" numbering={data.numbering} /> : null;
  },
};

const LEVELS: any[] = (window as any).SciDiagram.ICEBERG_LEVELS;

export const iceberg: EditorDef = {
  blank: { levels: 4, colorSet: 'a', sky: true, waves: true, leverage: true, seen: true, answers: '' },
  id: 'iceberg-model', num: '09', name: 'Iceberg model', field: 'Methods',
  blurb: 'Events above the waterline, patterns, structures and mental models below, with leverage notes.',
  templates: [
    { name: 'Liver health', desc: 'A rising GGT result, four levels', title: 'Why liver enzymes keep rising',
      data: { levels: 4, colorSet: 'a', sky: true, waves: true, leverage: true, seen: true,
        answers: 'Events: Liver enzyme spike at a check-up\nPatterns / Trends: GGT rising over three years\nUnderlying Structures: Weekend drinking culture; Shift work, little sleep\nMental Models: “Drinking is how we unwind”' } },
    { name: 'Plastic on beaches', desc: 'Three-level version', title: 'Plastic washing up on Sydney beaches',
      data: { levels: 3, colorSet: 'b', sky: true, waves: true, leverage: true, seen: true,
        answers: 'Events: Bottle caps on Bondi after a storm\nPatterns / Trends: More litter after every heavy rain\nUnderlying Structures: Stormwater drains run straight to the ocean; Single-use packaging is cheapest' } }
  ],
  Controls: ({ data, set }) => (
    <>
      <S.Panel kicker="Levels">
        <Seg value={data.levels} options={[[4, 'Four levels'], [3, 'Three levels']]} onChange={v => set({ levels: v })} />
        <RowsText id="ic-ans" kicker="Your answers" help="Separate several answers with a semicolon." text={data.answers}
          parse={l => { const i = l.indexOf(':'); return { level: i > 0 ? l.slice(0, i).trim() : LEVELS[0].name, ans: i > 0 ? l.slice(i + 1).trim() : l.trim() }; }}
          format={r => r.level + ': ' + (r.ans || '')}
          cols={[{ key: 'level', label: 'Level', type: 'select', options: LEVELS.map(L => [L.name, L.name]), w: '1fr' }, { key: 'ans', label: 'Answers', w: '1.8fr' }]}
          blank={() => ({ level: LEVELS[0].name, ans: '' })} addLabel="+ Add answers" onText={(v, k) => set({ answers: v }, k)} />
      </S.Panel>
      <S.Panel kicker="Look">
        <Seg value={data.colorSet} options={[['a', 'Ice'], ['b', 'Steel'], ['c', 'Grey']]} onChange={v => set({ colorSet: v })} />
        <Toggle on={data.sky} label="Sky" onChange={v => set({ sky: v })} />
        <Toggle on={data.waves} label="Waves" onChange={v => set({ waves: v })} />
        <Toggle on={data.leverage} label="Leverage labels" onChange={v => set({ leverage: v })} />
        <Toggle on={data.seen} label="Seen / unseen marks" onChange={v => set({ seen: v })} />
      </S.Panel>
    </>
  ),
  Render: ({ data }) => {
    const ans: any = {};
    String(data.answers || '').split('\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) ans[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).split(';').map(s => s.trim()).filter(Boolean); });
    const sections = LEVELS.map(L => ({ ...L, answers: ans[L.name.toLowerCase()] || [] }));
    return <S.Iceberg x={0} y={0} w={720} rowH={96} levels={data.levels} sections={sections} sky={data.sky} waves={data.waves} colorSet={data.colorSet} showLeverage={data.leverage} showSeen={data.seen} />;
  },
};
