import { S } from '../sheet';
import { cells, EmptyHint, lines, num, RowsText, Seg, Spec, startDrag, TextView, Toggle, idOf } from '../ui';

const sw = (n: any) => /^\d+$/.test(String(n || '').trim()) ? 'var(--swatch-' + String(n).trim() + ')' : undefined;
const swn = (c: any) => { const m = String(c || '').match(/swatch-(\d+)/); return m ? m[1] : ''; };
const BAND_OPTS: [string, string][] = [['producer', 'Producer'], ['primary', 'Primary'], ['secondary', 'Secondary'], ['tertiary', 'Tertiary'], ['apex', 'Apex']];
const BAND_NAMES = ['producer', 'primary', 'secondary', 'tertiary', 'apex'];
import type { EditorDef, EditProps } from '../shell';

const BANDS: any = { producer: 0, producers: 0, primary: 1, secondary: 2, tertiary: 3, apex: 4 };

function web(d: any) {
  const nodes: any[] = [], edges: any[] = [], by: any = {};
  for (const l of lines(d.spec)) {
    const m = l.match(/^(.+?)\s*>\s*(.+?)\s*(?:\((minor|major)\))?\s*$/);
    if (m && !l.includes(':')) { edges.push({ from: idOf(m[1]), to: idOf(m[2]), weight: m[3] }); continue; }
    const [name, band, col] = cells(l, ':');
    if (!name) continue;
    const b = band == null ? 0 : (BANDS[band.toLowerCase()] ?? Math.max(0, Math.min(4, parseInt(band) || 0)));
    const q: any = { id: idOf(name), name, band: b }; if (sw(col)) q.color = sw(col); nodes.push(q); by[q.id] = q;
  }
  const per: any = {};
  nodes.forEach(n => { (per[n.band] = per[n.band] || []).push(n); });
  const widest = Math.max(1, ...Object.values(per).map((a: any) => a.length));
  Object.values(per).forEach((a: any) => a.forEach((n: any, i: number) => { n.x = (widest - a.length) * 0.7 + i * 1.4; }));
  const pos = d.pos || {};
  nodes.forEach(n => { const q = pos[n.id]; if (q) { n.x = q[0]; n.dy = q[1]; } });
  return { nodes, edges: edges.filter(e => by[e.from] && by[e.to]) };
}

export const foodweb: EditorDef = {
  id: 'food-web', num: '05', name: 'Food web', field: 'Ecology',
  blurb: 'Organisms in trophic bands with arrows from the eaten to the eater, weighted by importance.',
  templates: [
    { name: 'Grassland', desc: 'Grasses to hawks over five bands', title: 'Grassland food web',
      data: { color: true, spec: 'Grasses : producer\nSeed plants : producer\nGrasshopper : primary\nField mouse : primary\nRabbit : primary\nShrew : secondary\nSnake : secondary\nBarn owl : tertiary\nHawk : apex\nGrasses > Grasshopper\nGrasses > Rabbit\nSeed plants > Field mouse\nSeed plants > Grasshopper (minor)\nGrasshopper > Shrew\nField mouse > Snake\nField mouse > Barn owl\nRabbit > Hawk (major)\nShrew > Barn owl\nSnake > Hawk\nBarn owl > Hawk (minor)' } },
    { name: 'Rocky reef', desc: 'Temperate reef off New South Wales', title: 'Temperate rocky reef food web',
      data: { color: true, spec: 'Kelp : producer\nPhytoplankton : producer\nPurple sea urchin : primary\nAbalone : primary\nZooplankton : primary\nBlue groper : secondary\nEastern rock lobster : secondary\nYellowtail kingfish : tertiary\nGrey nurse shark : apex\nKelp > Purple sea urchin (major)\nKelp > Abalone\nPhytoplankton > Zooplankton (major)\nPurple sea urchin > Blue groper\nPurple sea urchin > Eastern rock lobster (major)\nAbalone > Eastern rock lobster (minor)\nZooplankton > Yellowtail kingfish (minor)\nBlue groper > Grey nurse shark (minor)\nYellowtail kingfish > Grey nurse shark' } },
    { name: 'Hydrothermal vent', desc: 'Chemosynthetic deep-sea vent community', title: 'Chemosynthetic food web of a deep-sea hydrothermal vent',
      data: { color: true, spec: 'Chemosynthetic bacteria : producer\nScaly-foot gastropod : primary\nVent shrimp : primary\nGiant tubeworm : primary\nHydrothermal mussel : primary\nVent clam : primary\nVent zooplankton : primary\nVent crab : secondary\nZoarcid fish : secondary\nDandelion siphonophore : secondary\nDeep-sea octopus : tertiary\nChemosynthetic bacteria > Scaly-foot gastropod (major)\nChemosynthetic bacteria > Vent shrimp (major)\nChemosynthetic bacteria > Giant tubeworm (major)\nChemosynthetic bacteria > Hydrothermal mussel (major)\nChemosynthetic bacteria > Vent clam (major)\nChemosynthetic bacteria > Vent zooplankton\nVent shrimp > Vent crab\nVent shrimp > Zoarcid fish\nGiant tubeworm > Vent crab (minor)\nHydrothermal mussel > Vent crab\nVent clam > Zoarcid fish (minor)\nVent zooplankton > Dandelion siphonophore (major)\nVent zooplankton > Vent shrimp (minor)\nVent crab > Deep-sea octopus\nZoarcid fish > Deep-sea octopus\nDandelion siphonophore > Deep-sea octopus (minor)' } }
  ],
  stats: d => { const p = web(d); return [[p.nodes.length, 'organisms'], [p.edges.length, 'links']]; },
  hint: 'Drag an organism sideways in its band, or up or down to change its level. Connect draws who eats whom.',
  blank: { color: true, spec: 'Producer : producer\nGrazer : primary\nProducer > Grazer' },
  Overlay: FwOverlay,
  connect: { kind: 'org', label: 'organism', make: (d, a, b) => { const p = web(d), A = p.nodes.find((n: any) => n.id === a), B = p.nodes.find((n: any) => n.id === b); return A && B ? { spec: String(d.spec || '').replace(/\s*$/, '') + '\n' + A.name + ' > ' + B.name } : null; } },
  nudge: (d, sel, dx, dy) => { const n = web(d).nodes.find((x: any) => x.id === sel.id); if (!n) return null; return { pos: { ...(d.pos || {}), [n.id]: [Math.round((n.x + dx / FW_COL) * 100) / 100, (n.dy || 0) + dy] } }; },
  findText: (d, text) => { const n = web(d).nodes.find((x: any) => x.name.toLowerCase() === text.toLowerCase()); return n ? { kind: 'org', id: n.id } : null; },
  remove: (d, sel) => {
    const p = web(d), n = p.nodes.find((x: any) => x.id === sel.id); if (!n) return null;
    return { spec: String(d.spec || '').split('\n').filter(l => { const m = l.match(/^(.+?)\s*>\s*(.+?)\s*(?:\((minor|major)\))?\s*$/); if (m && !l.includes(':')) return idOf(m[1]) !== n.id && idOf(m[2]) !== n.id; return idOf(cells(l, ':')[0]) !== n.id; }).join('\n') };
  },
  Controls: ({ data, set }) => (
    <>
      <RowsText id="fw-org" kicker="Organisms" help="Click an organism on the sheet to find its row." text={data.spec} match={l => !/>/.test(l) || l.includes(':')}
        parse={l => { const [name, band, col] = cells(l, ':'); return { name, band: (band || 'producer').toLowerCase(), color: sw(col) }; }}
        format={r => [r.name, BAND_NAMES.includes(r.band) ? r.band : 'producer', swn(r.color)].filter(Boolean).join(' : ')}
        cols={[{ key: 'name', label: 'Organism', w: '1.5fr' }, { key: 'band', label: 'Level', type: 'select', options: BAND_OPTS }, { key: 'color', label: 'Box colour', type: 'color' }]}
        blank={() => ({ name: 'New organism', band: 'primary' })} addLabel="+ Add organism" onText={(v, k) => set({ spec: v }, k)} />
      <RowsText id="fw-links" kicker="Who eats whom" help="Arrows run from the eaten to the eater." text={data.spec} match={l => />/.test(l) && !l.includes(':')}
        parse={l => { const m = l.match(/^(.+?)\s*>\s*(.+?)\s*(?:\((minor|major)\))?\s*$/) || []; return { prey: m[1] || '', pred: m[2] || '', weight: m[3] || 'normal' }; }}
        format={r => r.prey + ' > ' + r.pred + (r.weight && r.weight !== 'normal' ? ' (' + r.weight + ')' : '')}
        cols={[{ key: 'prey', label: 'Eaten', type: 'select', options: web(data).nodes.map((n: any) => [n.name, n.name]) }, { key: 'pred', label: 'Eater', type: 'select', options: web(data).nodes.map((n: any) => [n.name, n.name]) }, { key: 'weight', label: 'Weight', type: 'select', options: [['minor', 'Minor'], ['normal', 'Normal'], ['major', 'Major']], w: '0.8fr' }]}
        blank={() => { const n = web(data).nodes; return { prey: n[0] ? n[0].name : '', pred: n[1] ? n[1].name : '', weight: 'normal' }; }} addLabel="+ Add link" onText={(v, k) => set({ spec: v }, k)} />
      <TextView id="fw-spec" title="Edit as text" text={data.spec} rows={12} help="Organism: Name : level : colour 1–16. Link: Prey > Predator (major) or (minor)." onChange={v => set({ spec: v }, 'spec')} />
      <S.Panel kicker="Bands"><Toggle on={data.color} label="Colour the trophic bands" onChange={v => set({ color: v })} />{data.pos && Object.keys(data.pos).length ? <S.ToolButton onClick={() => set({ pos: {} })}>Tidy: automatic positions</S.ToolButton> : null}</S.Panel>
    </>
  ),
  Render: ({ data }) => {
    const p = web(data);
    if (!p.nodes.length) return <EmptyHint text="Add an organism, e.g. “Kelp : producer”." />;
    return <S.FoodWeb x={0} y={0} nodes={p.nodes} edges={p.edges} colorBands={data.color} />;
  },
};

/* Hover: dim unrelated organisms, mark prey (incoming) and predators (outgoing) of the hovered one. */
function fwFocus(el: Element, id: string | null) {
  const svg = el.ownerSVGElement; const g = svg && svg.querySelector('.sd-foodweb'); if (!g) return;
  g.classList.toggle('fw-focus', !!id);
  g.querySelectorAll('.fw-self,.fw-prey,.fw-pred,.fw-in,.fw-out').forEach(x => x.classList.remove('fw-self', 'fw-prey', 'fw-pred', 'fw-in', 'fw-out'));
  if (!id) return;
  const node = (i: string) => g.querySelector('.sd-fw-node[data-id="' + i + '"]');
  node(id)?.classList.add('fw-self');
  g.querySelectorAll('[data-from]').forEach(x => {
    const f = x.getAttribute('data-from') as string, t = x.getAttribute('data-to') as string;
    if (t === id) { x.classList.add('fw-in'); node(f)?.classList.add('fw-prey'); }
    if (f === id) { x.classList.add('fw-out'); node(t)?.classList.add('fw-pred'); }
  });
}

const FW_COL = 150, FW_BAND = 96, FW_X = 170;
function FwOverlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const p = web(data);
  return <>{p.nodes.map((n: any) => {
    const w = Math.max(84, String(n.name).length * 7.2 + 26), cx = FW_X + (n.x || 0) * FW_COL, cy = (4 - n.band) * FW_BAND + FW_BAND * 0.5 + 18 + (n.dy || 0);
    const on = sel && sel.kind === 'org' && sel.id === n.id;
    return <rect key={n.id} className={'mk-hit' + (on ? ' mk-on' : '')} x={cx - w / 2 - 3} y={cy - 20} width={w + 6} height={40}
      onPointerEnter={e => fwFocus(e.currentTarget, n.id)} onPointerLeave={e => fwFocus(e.currentTarget, null)}
      onPointerDown={e => {
        setSel({ kind: 'org', id: n.id });
        const x0 = n.x || 0, dy0 = n.dy || 0, band0 = n.band;
        startDrag(e, toSvg, (dx, dy) => {
          const ny = cy + dy, band = Math.max(0, Math.min(4, 4 - Math.floor(ny / FW_BAND)));
          const center = (4 - band) * FW_BAND + FW_BAND * 0.5 + 18, ndy = Math.max(-34, Math.min(30, Math.round(ny - center)));
          const patch: any = { pos: { ...(data.pos || {}), [n.id]: [Math.round((x0 + dx / FW_COL) * 100) / 100, band === band0 ? Math.round(dy0 + dy) : ndy] } };
          if (band !== band0) patch.spec = String(data.spec || '').split('\n').map(l => { const c = cells(l, ':'); return !(/>/.test(l) && !l.includes(':')) && idOf(c[0]) === n.id ? [c[0], BAND_NAMES[band], ...(c.slice(2).filter(Boolean))].join(' : ') : l; }).join('\n');
          set(patch, 'fw-drag-' + n.id);
        });
      }} />;
  })}</>;
}

function traits(text: string) {
  const out: any = {};
  lines(text).forEach(l => { const [k, rest] = cells(l, '='); if (!k || !rest) return; const [dom, rec] = cells(rest, '/'); out[k.toUpperCase()] = { dom: dom || k.toUpperCase(), rec: rec || k.toLowerCase() }; });
  return out;
}
function validGeno(g: string) {
  if (!/^[A-Za-z]{2,6}$/.test(g) || g.length % 2) return false;
  for (let i = 0; i < g.length; i += 2) if (g[i].toLowerCase() !== g[i + 1].toLowerCase()) return false;
  return true;
}

export const punnett: EditorDef = {
  blank: { pA: 'Aa', pB: 'Aa', nameA: 'Parent 1', nameB: 'Parent 2', traits: 'A = Dominant / Recessive', pheno: true, ratios: true, cell: 96 },
  id: 'punnett-square', num: '06', name: 'Punnett square', field: 'Evolution and genetics',
  blurb: 'Gametes, the genotype grid, phenotypes and ratios from two parent genotypes, up to three genes.',
  templates: [
    { name: 'Monohybrid', desc: 'Aa × Aa, seed colour', title: 'Monohybrid cross: seed colour in peas', data: { pA: 'Aa', pB: 'Aa', nameA: 'Parent 1', nameB: 'Parent 2', traits: 'A = Yellow seed / Green seed', pheno: true, ratios: true, cell: 96 } },
    { name: 'Dihybrid', desc: 'AaBb × AaBb, 9:3:3:1', title: 'Dihybrid cross: colour and shape', data: { pA: 'AaBb', pB: 'AaBb', nameA: 'F1 parent', nameB: 'F1 parent', traits: 'A = Yellow / Green\nB = Round / Wrinkled', pheno: true, ratios: true, cell: 82 } },
    { name: 'Test cross', desc: 'Aa × aa, 1:1', title: 'Test cross', data: { pA: 'Aa', pB: 'aa', nameA: 'Unknown', nameB: 'Recessive tester', traits: 'A = Tall / Short', pheno: true, ratios: true, cell: 96 } }
  ],
  Controls: ({ data, set }) => (
    <>
      <S.Panel kicker="Parents" help="Write each genotype as allele pairs, e.g. Aa or AaBb. Capital = dominant.">
        <div className="mk-pair">
          <S.Field id="pn-a" label="Parent 1" value={data.pA} onChange={(e: any) => set({ pA: e.target.value.replace(/\s/g, '') }, 'pA')} />
          <S.Field id="pn-b" label="Parent 2" value={data.pB} onChange={(e: any) => set({ pB: e.target.value.replace(/\s/g, '') }, 'pB')} />
        </div>
        <div className="mk-pair">
          <S.Field id="pn-na" label="Name 1" value={data.nameA} placeholder="e.g. Mother" onChange={(e: any) => set({ nameA: e.target.value }, 'nA')} />
          <S.Field id="pn-nb" label="Name 2" value={data.nameB} placeholder="e.g. Father" onChange={(e: any) => set({ nameB: e.target.value }, 'nB')} />
        </div>
      </S.Panel>
      <RowsText id="pn-traits" kicker="Traits" help="One gene per row: its letter, then the dominant and recessive phenotypes." text={data.traits}
        parse={l => { const [k, rest] = cells(l, '='); const [dom, rec] = cells(rest || '', '/'); return { gene: k, dom, rec }; }}
        format={r => String(r.gene || 'A').toUpperCase() + ' = ' + (r.dom || '') + ' / ' + (r.rec || '')}
        cols={[{ key: 'gene', label: 'Gene', w: '0.5fr' }, { key: 'dom', label: 'Dominant', w: '1.2fr' }, { key: 'rec', label: 'Recessive', w: '1.2fr' }]}
        blank={() => ({ gene: 'B', dom: 'Dominant', rec: 'Recessive' })} addLabel="+ Add gene" onText={(v, k) => set({ traits: v }, k)} />
      <S.Panel kicker="Show">
        <Toggle on={data.pheno} label="Phenotype colours" onChange={v => set({ pheno: v })} />
        <Toggle on={data.ratios} label="Ratios" onChange={v => set({ ratios: v })} />
        <Seg value={num(data.cell, 90)} options={[[64, 'Small'], [82, 'Medium'], [96, 'Large']]} onChange={v => set({ cell: v })} />
      </S.Panel>
    </>
  ),
  Render: ({ data }) => {
    const a = String(data.pA || ''), b = String(data.pB || '');
    if (!validGeno(a) || !validGeno(b) || a.length !== b.length) return <EmptyHint text="Both parents need the same genes, written as pairs (Aa, AaBb)." />;
    return <S.PunnettSquare x={0} y={0} pA={a} pB={b} nameA={data.nameA} nameB={data.nameB} traits={traits(data.traits)} cell={num(data.cell, 90)} showPheno={data.pheno} showRatios={data.ratios} />;
  },
};

export const pyramid: EditorDef = {
  blank: { kind: 'energy', scale: 'linear', unit: '', transfer: true, tiers: '1000 | Producer\n100 | Primary consumer\n10 | Secondary consumer' },
  id: 'ecological-pyramid', num: '07', name: 'Ecological pyramid', field: 'Ecology',
  blurb: 'Pyramids of numbers, biomass and energy, linear or log scaled, with transfer efficiencies.',
  templates: [
    { name: 'Energy', desc: 'Ryegrass to barn owl, kJ m⁻² y⁻¹', title: 'Pyramid of energy in a grassland',
      data: { kind: 'energy', scale: 'log', unit: 'kJ m^{-2} y^{-1}', transfer: true, tiers: '87000 | Perennial ryegrass | Lolium perenne\n14000 | Field grasshopper | Chorthippus brunneus\n1600 | Common shrew | Sorex araneus\n160 | Barn owl | Tyto alba' } },
    { name: 'Inverted biomass', desc: 'English Channel plankton (Harvey, 1950)', title: 'Inverted pyramid of biomass',
      data: { kind: 'biomass', scale: 'linear', unit: 'g dry mass m^{-2} (Harvey, 1950)', transfer: false, tiers: '4 | Phytoplankton | diatoms, dinoflagellates\n21 | Zooplankton and bottom fauna | copepods, benthos' } },
    { name: 'Numbers', desc: 'Oak woodland, inverted at the base', title: 'Pyramid of numbers in an oak woodland',
      data: { kind: 'numbers', scale: 'log', unit: 'individuals per 0.1 ha (illustrative)', transfer: false, tiers: '6 | Pedunculate oak | Quercus robur\n4200 | Green oak tortrix (larvae) | Tortrix viridana\n24 | Great tit | Parus major\n1 | Eurasian sparrowhawk | Accipiter nisus' } }
  ],
  stats: d => [[lines(d.tiers).length, 'levels']],
  Controls: ({ data, set }) => (
    <>
      <S.Panel kicker="Kind">
        <Seg value={data.kind} options={[['energy', 'Energy'], ['biomass', 'Biomass'], ['numbers', 'Numbers']]} onChange={v => set({ kind: v })} />
        <Seg value={data.scale} options={[['linear', 'Linear'], ['log', 'Log scale']]} onChange={v => set({ scale: v })} />
        <Toggle on={data.transfer} label="Transfer efficiency between levels" onChange={v => set({ transfer: v })} />
      </S.Panel>
      <RowsText id="py-tiers" kicker="Trophic levels" help="Bottom level first." text={data.tiers}
        parse={l => { const [value, common, sci, col] = cells(l); return { value, common, sci, color: sw(col) }; }}
        format={r => [r.value, r.common || '', r.sci || '', swn(r.color)].join(' | ').replace(/( \| )+$/, '')}
        cols={[{ key: 'value', label: 'Value', type: 'num', w: '0.8fr' }, { key: 'common', label: 'Common name', w: '1.3fr' }, { key: 'sci', label: 'Scientific', w: '1.1fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ value: 10, common: 'New level', sci: '' })} addLabel="+ Add level" onText={(v, k) => set({ tiers: v }, k)} />
      <S.Panel kicker="Units"><S.Field id="py-unit" label="Units" value={data.unit} placeholder="e.g. kJ m^{-2} y^{-1}" onChange={(e: any) => set({ unit: e.target.value }, 'unit')} /></S.Panel>
    </>
  ),
  Render: ({ data }) => {
    const tiers = lines(data.tiers).map(l => { const [v, c, s, col] = cells(l); return { value: num(v, 0), common: c, sci: s, color: sw(col) }; }).filter(t => t.value > 0);
    if (!tiers.length) return <EmptyHint text="Add a level, e.g. “87000 | Ryegrass | Lolium perenne”." />;
    return <S.EcoPyramid x={0} y={0} w={820} tierH={54} kind={data.kind} scale={data.scale} tiers={tiers} unit={data.unit || false} showTransfer={data.transfer} />;
  },
};
