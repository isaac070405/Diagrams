import { S } from '../sheet';
import { cells, EmptyHint, lines, num, Range, RowsText, Seg, Spec, Toggle } from '../ui';
const SAT = Array.from({ length: 8 }, (_, i) => 'var(--wheel-sat-' + (i + 1) + ')');
import type { EditorDef } from '../shell';

function clades(text: string, pal: string) {
  return lines(text).map(l => {
    const [lab, tips, g] = cells(l);
    return { label: lab, tips: (tips || '').split(',').map(t => t.trim().replace(/_/g, ' ')).filter(Boolean), color: 'var(--wheel-' + pal + '-' + Math.min(8, Math.max(1, parseInt(g) || 1)) + ')' };
  }).filter(c => c.tips.length);
}
function tipCount(nwk: string) { return (String(nwk).match(/[(,]\s*[^(),:;]+/g) || []).length; }

export const phylo: EditorDef = {
  blank: { layout: 'rect', support: false, italic: true, timescale: false, unit: '', rowGap: 32, w: 420, newick: '((Taxon_A,Taxon_B),Taxon_C);', clades: '' },
  id: 'phylogenetic-tree', num: '02', name: 'Phylogenetic tree', field: 'Evolution and genetics',
  blurb: 'Cladograms, phylograms and time trees from Newick text, with clade bars and a geological timescale.',
  templates: [
    {
      name: 'Great apes', desc: 'Cladogram with clade bars and support values', title: 'Phylogeny of the great apes and Old World monkeys',
      data: { layout: 'rect', support: true, italic: true, timescale: false, unit: 'subst./site', rowGap: 34, w: 420,
        newick: '(((((Homo_sapiens:0.019,Pan_troglodytes:0.021)99:0.008,Gorilla_gorilla:0.031)98:0.011,Pongo_pygmaeus:0.052)100:0.014,Hylobates_lar:0.071)100:0.021,(Macaca_mulatta:0.061,Papio_anubis:0.058)97:0.043);',
        clades: 'Hominoidea | Homo sapiens, Pan troglodytes, Gorilla gorilla, Pongo pygmaeus, Hylobates lar | 6\nCercopith. | Macaca mulatta, Papio anubis | 2' }
    },
    {
      name: 'Vertebrate time tree', desc: 'Branch lengths in Ma with epoch, period and era rows', title: 'Divergence times of jawed vertebrates',
      data: { layout: 'phylo', support: false, italic: true, timescale: true, unit: '', rowGap: 26, w: 760,
        newick: '((((((Homo_sapiens:6.4,Pan_troglodytes:6.4):83.6,(Mus_musculus:13,Rattus_norvegicus:13):77):222,(Gallus_gallus:280,Anolis_carolinensis:280):32):40,Xenopus_laevis:352):77,Danio_rerio:429):36,Callorhinchus_milii:465);',
        clades: '' }
    },
    {
      name: 'Marine mammals', desc: 'Whales among the even-toed ungulates', title: 'Cetaceans within Artiodactyla',
      data: { layout: 'slant', support: false, italic: true, timescale: false, unit: '', rowGap: 32, w: 420,
        newick: '((((Orcinus_orca,Tursiops_truncatus),Balaenoptera_musculus),Hippopotamus_amphibius),(Bos_taurus,Sus_scrofa));',
        clades: 'Cetacea | Orcinus orca, Tursiops truncatus, Balaenoptera musculus | 4' }
    }
  ],
  stats: d => [[tipCount(d.newick), 'tips']],
  Controls: ({ data, set }) => (
    <>
      <S.Panel kicker="Tree" help="Newick text, e.g. ((A:0.1,B:0.2)95:0.05,C:0.3); Underscores print as spaces. Paste output from MEGA, IQ-TREE or TimeTree.">
        <Spec id="ph-newick" label="Newick" value={data.newick} rows={7} onChange={v => set({ newick: v }, 'newick')} />
      </S.Panel>
      <S.Panel kicker="Layout">
        <Seg value={data.layout} options={[['rect', 'Cladogram'], ['phylo', 'Phylogram'], ['slant', 'Slanted']]} onChange={v => set({ layout: v })} />
        <Range id="ph-w" label="Width" value={num(data.w, 420)} min={240} max={1000} step={10} onChange={v => set({ w: v }, 'w')} />
        <Range id="ph-row" label="Row spacing" value={num(data.rowGap, 30)} min={18} max={60} onChange={v => set({ rowGap: v }, 'row')} />
        <Toggle on={data.support} label="Support values" onChange={v => set({ support: v })} />
        <Toggle on={data.italic} label="Italic species names" onChange={v => set({ italic: v })} />
        <Toggle on={data.timescale} label="Geological timescale (lengths in Ma)" onChange={v => set({ timescale: v })} />
        <S.Field id="ph-unit" label="Scale unit" value={data.unit} placeholder="e.g. subst./site" onChange={(e: any) => set({ unit: e.target.value }, 'unit')} />
      </S.Panel>
      <RowsText id="ph-clades" kicker="Clade bars" help="Tips as they appear on the tree, separated by commas." text={data.clades}
        parse={l => { const [label, tips, g] = cells(l); return { label, tips, color: SAT[Math.min(8, Math.max(1, parseInt(g) || 1)) - 1] }; }}
        format={r => [r.label, r.tips, (SAT.indexOf(r.color) + 1) || 1].join(' | ')}
        cols={[{ key: 'label', label: 'Clade', w: '0.9fr' }, { key: 'tips', label: 'Tips', w: '2fr' }, { key: 'color', label: 'Colour', type: 'color', colors: SAT }]}
        blank={() => ({ label: 'Clade', tips: '', color: SAT[0] })} addLabel="+ Add clade bar" onText={(v, k) => set({ clades: v }, k)} />
    </>
  ),
  Render: ({ data }) => {
    if (!String(data.newick || '').trim()) return <EmptyHint text="Paste a Newick tree in the sidebar." />;
    try { S.parseNewick(data.newick); } catch (e) { return <EmptyHint text="The Newick text has an error: check brackets and the closing semicolon." />; }
    return <S.PhyloTree newick={data.newick} layout={data.timescale ? 'phylo' : data.layout} x={0} y={0} w={num(data.w, 420)} rowGap={num(data.rowGap, 30)}
      showSupport={data.support} italic={data.italic} unit={data.unit || undefined} labelWidth={data.timescale ? 190 : undefined}
      timescale={data.timescale ? ['epoch', 'period', 'era'] : false} clades={clades(data.clades, 'sat')} />;
  },
};
