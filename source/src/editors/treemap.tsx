import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const T = () => (window as any).SDTreemap;

/* sheet geometry: the treemap rectangle */
const PX = 20, PY = 20, PW = 600, PH = 400, HEAD = 20, CHAR = 6.4;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const f1 = (v: number) => (+v.toPrecision(3)).toString();
/* a label that fits: cut to the width in characters, with an ellipsis */
const fit = (s: string, w: number) => { const n = Math.floor((w - 8) / CHAR); return n < 3 ? '' : s.length <= n ? s : s.slice(0, n - 1) + '…'; };

function model(data: any) {
  const gs = (data.groups || []).filter((g: any) => g && g.id);
  const items = (data.items || []).filter((r: any) => r && gs.some((g: any) => g.id === r.g) && T().positive(r.value) > 0);
  const groups = gs.map((g: any, i: number) => ({ ...g, color: g.color || col(i), children: items.filter((r: any) => r.g === g.id).map((r: any) => ({ id: r.id, name: r.name || '', value: T().positive(r.value) })) }));
  const total = items.reduce((s: number, r: any) => s + T().positive(r.value), 0);
  return { groups, items, total };
}

function TreemapSheet({ data }: { data: any }) {
  const { groups, total } = model(data), t = T();
  if (!total) return <EmptyHint text="Add a group and at least one item with a value above 0." />;
  const heads = data.heads !== false, unit = data.unit || '';
  const lay = t.layout(groups.map((g: any) => ({ id: g.id, children: g.children })), PW, PH, { head: heads ? HEAD : 0, pad: num(data.gap, 3), sort: data.sort !== false });
  const byId: any = {}; groups.forEach((g: any) => { byId[g.id] = g; });
  const names: any = {}; groups.forEach((g: any) => g.children.forEach((c: any) => { names[c.id] = c.name; }));
  const out: any[] = []; let n = 0; const key = () => 'm' + n++;
  const pct = (v: number) => f1(v / total * 100) + '%';
  lay.forEach((g: any) => {
    const gi = byId[g.id], x = PX + g.x, y = PY + g.y;
    out.push(<rect key={key()} className="tm-group" x={x} y={y} width={g.w} height={g.h} style={{ fill: gi.color }} />);
    if (heads) {
      const label = fit(gi.name + (data.shares !== false ? ' (' + pct(g.total) + ')' : ''), g.w);
      out.push(<rect key={key()} className="tm-head" x={x} y={y} width={g.w} height={Math.min(HEAD, g.h)} style={{ fill: gi.color }} />);
      if (label && g.h >= HEAD) out.push(<text key={key()} className="tm-gname" x={x + 6} y={y + 14}>{label}</text>);
    }
    g.children.forEach((c: any) => {
      const cx = PX + c.x, cy = PY + c.y;
      out.push(<rect key={key()} className="tm-tile" x={cx} y={cy} width={c.w} height={c.h} style={{ fill: gi.color, fillOpacity: num(data.fillStrength, 0.55) }} />);
      if (data.labels === false) return;
      const nm = fit(names[c.id], c.w);
      if (!nm || c.h < 18) return;
      out.push(<text key={key()} className="tm-name" x={cx + 5} y={cy + 14}>{nm}</text>);
      const v = data.values === false ? '' : data.percent ? pct(c.value) : f1(c.value) + (unit ? ' ' + unit : '');
      const vs = fit(v, c.w);
      if (vs && c.h >= 34) out.push(<text key={key()} className="tm-val" x={cx + 5} y={cy + 28}>{vs}</text>);
    });
  });
  out.push(<rect key={key()} className="tm-frame" x={PX} y={PY} width={PW} height={PH} />);
  if (data.note !== false) out.push(<text key={key()} className="tm-note" x={PX + PW / 2} y={PY + PH + 22} textAnchor="middle">Tile area is proportional to {data.measure || 'value'}. Total {f1(total)}{unit ? ' ' + unit : ''}.</text>);
  return <g className="tm">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const groups = data.groups || [], items = data.items || [], { groups: gm, total } = model(data);
  const opts: [any, string][] = groups.map((g: any) => [g.id, g.name || g.id]);
  return (
    <>
      <S.Panel kicker="Measure" help="Area shows one measure, such as energy, catch or percent cover.">
        <TextIn id="tm-measure" label="What the area shows" value={data.measure} placeholder="value" onChange={v => set({ measure: v }, 'tm-measure')} />
        <TextIn id="tm-unit" label="Unit" value={data.unit} placeholder="kJ, t, %" onChange={v => set({ unit: v }, 'tm-unit')} />
      </S.Panel>
      <Rows id="tm-g" kicker="Groups" help="Each group is one coloured block that holds its items." rows={groups}
        cols={[{ key: 'name', label: 'Name', w: '1.6fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ id: uid('g', groups.map((g: any) => g.id)), name: 'Group ' + (groups.length + 1), color: col(groups.length) })}
        addLabel="+ Add group" onChange={(rows, kk) => set({ groups: rows.map((r, i) => ({ ...r, id: r.id || uid('g', groups.map((g: any) => g.id)), color: r.color || col(i) })) }, kk)} />
      <Rows id="tm-i" kicker="Items" help="One row per tile. Rows with a value of 0 or less are left out." rows={items}
        cols={[{ key: 'name', label: 'Item', w: '1.4fr' }, { key: 'g', label: 'Group', type: 'select', options: opts, w: '1.1fr' }, { key: 'value', label: 'Value', type: 'num', w: '0.7fr' }]}
        blank={() => ({ id: uid('it', items.map((r: any) => r.id)), name: 'Item ' + (items.length + 1), g: groups.length ? groups[groups.length - 1].id : '', value: '1' })}
        addLabel="+ Add item" onChange={(rows, kk) => set({ items: rows.map(r => ({ ...r, id: r.id || uid('it', items.map((q: any) => q.id)) })) }, kk)} />
      <S.Panel kicker="Look">
        <Toggle on={data.sort !== false} label="Largest first" onChange={v => set({ sort: v })} />
        <Toggle on={data.heads !== false} label="Group titles" onChange={v => set({ heads: v })} />
        <Toggle on={data.shares !== false} label="Group share in its title" onChange={v => set({ shares: v })} />
        <Toggle on={data.labels !== false} label="Item names" onChange={v => set({ labels: v })} />
        <Toggle on={data.values !== false} label="Item values" onChange={v => set({ values: v })} />
        <Toggle on={!!data.percent} label="Values as a percent of the total" onChange={v => set({ percent: v })} />
        <Toggle on={data.note !== false} label="Note under the figure" onChange={v => set({ note: v })} />
        <Range id="tm-gap" label="Gap inside groups" value={num(data.gap, 3)} min={0} max={8} onChange={v => set({ gap: v }, 'tm-gap')} />
        <Range id="tm-op" label="Tile fill strength" value={num(data.fillStrength, 0.55)} min={0.2} max={1} step={0.05} onChange={v => set({ fillStrength: v }, 'tm-op')} />
      </S.Panel>
      {total ? <S.Panel kicker="Results" help="Share of the total. Tiny tiles lose their labels, so the shares are listed here.">
        <ul className="tr-results">
          {gm.map((g: any) => { const s = g.children.reduce((a: number, c: any) => a + c.value, 0); return s > 0 ? <li key={g.id}><b>{g.name}</b>: {f1(s)}{data.unit ? ' ' + data.unit : ''}, {f1(s / total * 100)}% of the total</li> : null; })}
          <li>Total {f1(total)}{data.unit ? ' ' + data.unit : ''}</li>
        </ul>
      </S.Panel> : null}
    </>
  );
}

const mk = (rows: [string, string, number][]) => rows.map(([g, name, value], i) => ({ id: 'i' + i, name, g, value: String(value) }));
const grp = (names: string[]) => names.map((name, i) => ({ id: 'g' + i, name, color: col(i) }));

const dietG = grp(['Grains', 'Meat and alternatives', 'Dairy', 'Fruit and vegetables', 'Discretionary foods']);
const diet = mk([
  ['g0', 'Bread', 1500], ['g0', 'Rice and pasta', 900], ['g0', 'Breakfast cereal', 500],
  ['g1', 'Red meat', 800], ['g1', 'Poultry', 700], ['g1', 'Legumes', 300],
  ['g2', 'Cheese', 600], ['g2', 'Milk', 500], ['g2', 'Yoghurt', 250],
  ['g3', 'Vegetables', 500], ['g3', 'Fruit', 450],
  ['g4', 'Snacks', 900], ['g4', 'Sweets', 700], ['g4', 'Sugary drinks', 600],
]);
const catchG = grp(['Pelagic fish', 'Reef fish', 'Crustaceans']);
const catches = mk([
  ['g0', 'Tuna', 400], ['g0', 'Mackerel', 220], ['g0', 'Sardines', 150],
  ['g1', 'Snappers', 150], ['g1', 'Parrotfish', 120], ['g1', 'Groupers', 90],
  ['g2', 'Prawns', 180], ['g2', 'Crabs', 60], ['g2', 'Lobster', 40],
]);
const coverG = grp(['Hard coral', 'Algae', 'Other']);
const cover = mk([
  ['g0', 'Branching Acropora', 14], ['g0', 'Massive Porites', 9], ['g0', 'Plate Montipora', 6],
  ['g1', 'Turf algae', 22], ['g1', 'Macroalgae', 8], ['g1', 'Coralline algae', 5],
  ['g2', 'Sand and rubble', 24], ['g2', 'Soft coral', 7], ['g2', 'Sponges', 3], ['g2', 'Dead coral', 2],
]);

export const treemap: EditorDef = {
  id: 'treemap', num: '27', name: 'Treemap', field: 'Methods',
  blurb: 'Nested rectangles whose area shows each item\'s share of a total: dietary energy, fisheries catch or reef cover.',
  hint: 'Edit the groups and the items. Each tile\'s area is proportional to its value.',
  templates: [
    { name: 'Energy by food group', desc: 'Example daily energy intake', title: 'Daily dietary energy by food group',
      caption: 'Example mean daily energy intake (kJ) by food group and food. Tile area is proportional to energy. Sample values for practice.',
      data: { measure: 'energy', unit: 'kJ', groups: dietG, items: diet } },
    { name: 'Fisheries catch', desc: 'Example landings by group and species', title: 'Landings by group in a small fishery',
      caption: 'Example annual landings (tonnes) by group and species. Tile area is proportional to landed mass. Sample values for practice.',
      data: { measure: 'landed mass', unit: 't', groups: catchG, items: catches } },
    { name: 'Reef benthic cover', desc: 'Example percent cover by category', title: 'Benthic cover on a reef flat',
      caption: 'Example percent cover of the seabed from point-intercept transects. Tile area is proportional to cover. Sample values for practice.',
      data: { measure: 'cover', unit: '%', groups: coverG, items: cover } },
  ],
  blank: { measure: 'value', unit: '', groups: [{ id: 'g0', name: 'Group A', color: col(0) }, { id: 'g1', name: 'Group B', color: col(1) }], items: mk([['g0', 'Item 1', 6], ['g0', 'Item 2', 3], ['g1', 'Item 3', 5], ['g1', 'Item 4', 2]]) },
  stats: d => { const m = model(d); return [[m.groups.filter((g: any) => g.children.length).length, 'groups'], [m.items.length, 'tiles'], [+T().positive(m.total).toPrecision(4), 'total']]; },
  Controls,
  Render: ({ data }) => <TreemapSheet data={data} />,
};
