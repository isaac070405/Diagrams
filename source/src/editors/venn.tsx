import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, Spec, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const V = () => (window as any).SDVenn;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const LET = 'ABC';
const MAXSETS = 3;

function model(data: any) {
  const ic = data.ignoreCase !== false;
  const sets = (data.sets || []).filter((s: any) => s && s.id).slice(0, MAXSETS).map((s: any, i: number) => ({ ...s, color: s.color || col(i), items: V().items(s.text, ic) }));
  const regs = sets.length >= 2 ? V().regions(sets.map((s: any) => s.items), ic) : {};
  return { sets, regs, ic };
}
const label = (id: string, sets: any[]) => id.split('').map(c => sets[c.charCodeAt(0) - 65].name || LET[c.charCodeAt(0) - 65]).join(' ∩ ');

function VennSheet({ data }: { data: any }) {
  const { sets, regs } = model(data);
  if (sets.length < 2 || sets.every((s: any) => !s.items.length)) return <EmptyHint text="Add two or three sets and paste their items, one per line." />;
  const out: any[] = []; let n = 0; const k = () => 'v' + n++;
  const cnt = (id: string) => (regs[id] ? regs[id].length : 0), tot = sets.map((s: any) => s.items.length);
  const cx = 330, cy = 200, op = num(data.fillStrength, 0.35), all = Object.values(regs).reduce((a: number, r: any) => a + r.length, 0) as number;
  const val = (id: string) => (data.percent ? (all ? Math.round(cnt(id) / all * 1000) / 10 + '%' : '0%') : String(cnt(id)));
  const circ = (x: number, y: number, r: number, i: number) => out.push(<circle key={k()} className="vn-circ" cx={x} cy={y} r={r} style={{ fill: sets[i].color, fillOpacity: op, stroke: sets[i].color }} />);
  /* names go in a region only when it has few items, so they never run into the next region */
  const maxNames = sets.length === 2 ? 5 : 2;
  const text = (id: string, x: number, y: number) => {
    if (!cnt(id) && data.zeros === false) return;
    const nm = data.names && cnt(id) > 0 && cnt(id) <= maxNames ? regs[id].slice(0, maxNames) : [], up = nm.length * 6;
    out.push(<text key={k()} className="vn-count" x={x} y={y - up} textAnchor="middle">{val(id)}</text>);
    nm.forEach((s: string, j: number) => out.push(<text key={k()} className="vn-item" x={x} y={y - up + 14 + j * 12} textAnchor="middle">{s.length > 14 ? s.slice(0, 13) + '…' : s}</text>));
  };
  const title = (i: number, x: number, y: number, anchor: string) => out.push(<text key={k()} className="vn-name" x={x} y={y} textAnchor={anchor as any}>{sets[i].name || LET[i]}{data.totals !== false ? ' (n = ' + tot[i] + ')' : ''}</text>);
  if (sets.length === 2) {
    let r1 = 110, r2 = 110, d = 120;
    if (data.scale !== false && tot[0] > 0 && tot[1] > 0) {
      const big = Math.max(tot[0], tot[1]); r1 = 120 * Math.sqrt(tot[0] / big); r2 = 120 * Math.sqrt(tot[1] / big);
      d = V().solveD(r1, r2, Math.PI * r1 * r1 * cnt('AB') / tot[0]);
    }
    const x1 = cx - d / 2 - (r1 - r2) / 2 * 0, x2 = x1 + d;
    circ(x1, cy, r1, 0); circ(x2, cy, r2, 1);
    const left = x1 - r1, lensL = Math.max(x2 - r2, left), lensR = Math.min(x1 + r1, x2 + r2), right = x2 + r2;
    text('A', (left + Math.min(lensL, x1 + r1)) / 2, cy + 4); text('AB', (lensL + lensR) / 2, cy + 4); text('B', (Math.max(lensR, x2 - r2) + right) / 2, cy + 4);
    const ty = cy - Math.max(r1, r2) - 14; title(0, x1 - r1, ty, 'start'); title(1, x2 + r2, ty, 'end');
  } else {
    const r = 110, pos = [[cx - 62, cy - 44], [cx + 62, cy - 44], [cx, cy + 62]];
    pos.forEach((p, i) => circ(p[0], p[1], r, i));
    text('A', cx - 112, cy - 58); text('B', cx + 112, cy - 58); text('C', cx, cy + 138); text('AB', cx, cy - 90); text('AC', cx - 58, cy + 44); text('BC', cx + 58, cy + 44); text('ABC', cx, cy - 6);
    title(0, cx - 130, cy - 170, 'middle'); title(1, cx + 130, cy - 170, 'middle'); title(2, cx, cy + 194, 'middle');
  }
  if (data.note !== false && sets.length === 3) out.push(<text key={k()} className="vn-note" x={cx} y={cy + 216} textAnchor="middle">Circles are the same size. Areas are not drawn to scale.</text>);
  if (data.note !== false && sets.length === 2 && data.scale !== false) out.push(<text key={k()} className="vn-note" x={cx} y={cy + 150} textAnchor="middle">Circle and overlap areas are drawn to scale.</text>);
  return <g className="vn">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const sets = data.sets || [], { sets: sm, regs } = model(data);
  const upd = (id: string, patch: any, kk: string) => set({ sets: sets.map((s: any) => (s.id === id ? { ...s, ...patch } : s)) }, kk);
  const ids = Object.keys(regs).sort((a, b) => a.length - b.length || a.localeCompare(b));
  return (
    <>
      <Rows id="vn-s" kicker="Sets" help="Two or three sets. Paste each set's items in the box below its name." rows={sets}
        cols={[{ key: 'name', label: 'Name', w: '1.6fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ id: uid('s', sets.map((s: any) => s.id)), name: 'Set ' + LET[sets.length], color: col(sets.length), text: '' })}
        addLabel="+ Add set" onChange={(r, kk) => set({ sets: r.slice(0, MAXSETS).map((x, i) => ({ ...x, id: x.id || uid('s', sets.map((s: any) => s.id)), color: x.color || col(i) })) }, kk)} />
      {sets.slice(0, MAXSETS).map((s: any) => <S.Panel key={s.id} kicker={'Items: ' + (s.name || 'set')} help="One per line, or separated by commas, semicolons or tabs. Repeats count once.">
        <Spec id={'vn-t-' + s.id} label="Items" rows={5} value={s.text || ''} onChange={v => upd(s.id, { text: v }, 'vn-t-' + s.id)} />
      </S.Panel>)}
      <S.Panel kicker="Compare">
        <Toggle on={data.ignoreCase !== false} label="Ignore upper and lower case" onChange={v => set({ ignoreCase: v })} />
      </S.Panel>
      <S.Panel kicker="Look">
        <Toggle on={data.totals !== false} label="Set sizes in the titles" onChange={v => set({ totals: v })} />
        <Toggle on={!!data.percent} label="Percent of all items, not counts" onChange={v => set({ percent: v })} />
        <Toggle on={!!data.names} label="Item names in small regions (up to 5 for two sets, 2 for three)" onChange={v => set({ names: v })} />
        <Toggle on={data.zeros !== false} label="Show regions with 0" onChange={v => set({ zeros: v })} />
        <Toggle on={data.scale !== false} label="Two sets to scale" onChange={v => set({ scale: v })} />
        <Toggle on={data.note !== false} label="Note under the figure" onChange={v => set({ note: v })} />
        <Range id="vn-op" label="Fill strength" value={num(data.fillStrength, 0.35)} min={0.1} max={0.8} step={0.05} onChange={v => set({ fillStrength: v }, 'vn-op')} />
      </S.Panel>
      {sm.length >= 2 ? <S.Panel kicker="Results" help="Each item sits in exactly one region: the sets it belongs to and no others.">
        <ul className="tr-results">
          {ids.map(id => <li key={id}><b>{id.length === 1 ? label(id, sm) + ' only' : label(id, sm)}</b> ({regs[id].length}): {regs[id].slice(0, 12).join(', ')}{regs[id].length > 12 ? ', and ' + (regs[id].length - 12) + ' more' : ''}</li>)}
        </ul>
      </S.Panel> : null}
    </>
  );
}

const list = (a: string[]) => a.join('\n');
const set3 = (names: string[], lists: string[][]) => names.map((name, i) => ({ id: 's' + i, name, color: col(i), text: list(lists[i]) }));
const genes = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => 'GENE' + String(from + i).padStart(3, '0'));

export const venn: EditorDef = {
  id: 'venn-diagram', num: '39', name: 'Venn diagram', field: 'Methods',
  blurb: 'Overlaps between two or three lists: paste the items and the counts in every region are worked out, with the shared items listed.',
  hint: 'Paste each set\'s items, one per line. Counts for every overlap are worked out for you.',
  templates: [
    { name: 'Two gene lists', desc: 'Two sets drawn to scale', title: 'Genes changed under heat and cold stress',
      caption: 'Genes changed under heat stress and cold stress (simulated lists). Circle and overlap areas are proportional to the numbers of genes. Sample data for practice.',
      data: { scale: true, sets: set3(['Heat stress', 'Cold stress'], [genes(1, 70), genes(51, 98)]) } },
    { name: 'Foods eaten by three diets', desc: 'Three sets with named items', title: 'Foods reported by three dietary patterns',
      caption: 'Foods reported in food records of three dietary patterns (example lists). The centre holds foods eaten in all three. Sample data for practice.',
      data: { names: true, sets: set3(['Mediterranean', 'Vegetarian', 'Western'], [
        ['Olive oil', 'Fish', 'Tomato', 'Legumes', 'Whole grains', 'Yoghurt', 'Leafy greens', 'Nuts', 'Fruit', 'Cheese', 'Wine'],
        ['Legumes', 'Whole grains', 'Tofu', 'Leafy greens', 'Nuts', 'Fruit', 'Yoghurt', 'Tomato', 'Eggs', 'Cheese'],
        ['Red meat', 'White bread', 'Cheese', 'Fruit', 'Eggs', 'Fish', 'Soft drink', 'Chips', 'Yoghurt', 'Processed meat']]) } },
    { name: 'Species at three reef sites', desc: 'Presence across sites', title: 'Fish species recorded at three reef sites',
      caption: 'Fish species recorded on visual surveys at three reef sites (example lists). Counts are numbers of species. Sample data for practice.',
      data: { sets: set3(['Lagoon', 'Back reef', 'Fore reef'], [
        ['Parrotfish', 'Damselfish', 'Butterflyfish', 'Wrasse', 'Surgeonfish', 'Goatfish', 'Rabbitfish', 'Cardinalfish', 'Blenny'],
        ['Parrotfish', 'Damselfish', 'Butterflyfish', 'Wrasse', 'Surgeonfish', 'Snapper', 'Grouper', 'Triggerfish', 'Angelfish', 'Goby'],
        ['Parrotfish', 'Damselfish', 'Wrasse', 'Surgeonfish', 'Snapper', 'Grouper', 'Triggerfish', 'Jack', 'Barracuda', 'Shark', 'Fusilier', 'Anthias']]) } },
  ],
  blank: { scale: true, sets: set3(['Set A', 'Set B'], [['a', 'b', 'c', 'd', 'e'], ['d', 'e', 'f', 'g']]) },
  stats: d => { const m = model(d); return m.sets.length >= 2 ? [[m.sets.length, 'sets'], [Object.keys(m.regs).length, 'regions'], [Object.values(m.regs).reduce((a: number, r: any) => a + r.length, 0) as number, 'items']] : [[m.sets.length, 'sets']]; },
  Controls,
  Render: ({ data }) => <VennSheet data={data} />,
};
