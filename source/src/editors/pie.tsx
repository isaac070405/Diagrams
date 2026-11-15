import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, Seg, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const P = () => (window as any).SDPie;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const fm = (v: number, dp = 1) => (+v.toFixed(dp)).toString();

/* sheet geometry */
const CX = 300, CY = 190, R = 130;

function model(data: any) {
  const items = (data.items || []).filter((x: any) => x && x.id).map((x: any, i: number) => ({ ...x, color: x.color || col(i) }));
  const sl = P().slices(items, num(data.start, 0), !!data.sort), total = sl.reduce((a: number, s: any) => a + s.value, 0);
  return { items, sl, total };
}

function PieSheet({ data }: { data: any }) {
  const { items, sl, total } = model(data);
  if (!sl.length) return <EmptyHint text="Add at least one item with a value above 0." />;
  const out: any[] = []; let n = 0; const k = () => 'p' + n++;
  const hole = num(data.hole, 0.5) * R, dp = Math.round(num(data.dp, 1)), unit = data.unit ? ' ' + data.unit : '', mode = data.labels || 'outside', P_ = P();
  const text = (s: any, withName: boolean) => [withName ? items[s.index].name : '', data.values ? fm(s.value, 2) + unit : '', data.percent !== false ? fm(s.frac * 100, dp) + '%' : ''].filter(x => x).join(withName ? ', ' : ' ');
  sl.forEach((s: any) => out.push(<path key={k()} className="pc-slice" d={P_.arc(CX, CY, hole, R, s.a0, s.a1)} style={{ fill: items[s.index].color }} />));
  if (mode === 'inside') sl.forEach((s: any) => { if (s.frac < 0.05) return; const mid = (s.a0 + s.a1) / 2, p = P_.point(CX, CY, hole > 0 ? (hole + R) / 2 : R * 0.65, mid); out.push(<text key={k()} className="pc-in" x={p[0]} y={p[1] + 4} textAnchor="middle">{text(s, false)}</text>); });
  if (mode === 'outside') {
    /* labels on each side, pushed apart so they never overlap */
    const side = (right: boolean) => {
      const L_ = sl.filter((s: any) => (Math.sin((s.a0 + s.a1) / 2) >= 0) === right).map((s: any) => { const mid = (s.a0 + s.a1) / 2, p = P_.point(CX, CY, R + 18, mid); return { s, mid, y: p[1], x: p[0] }; }).sort((a: any, b: any) => a.y - b.y);
      for (let i = 1; i < L_.length; i++) if (L_[i].y < L_[i - 1].y + 15) L_[i].y = L_[i - 1].y + 15;
      for (let i = L_.length - 2; i >= 0; i--) if (L_[i].y > L_[i + 1].y - 15 && L_[i + 1].y > CY + R + 30) L_[i].y = L_[i + 1].y - 15;
      L_.forEach((q: any) => { const a = P_.point(CX, CY, R - 2, q.mid), b = P_.point(CX, CY, R + 8, q.mid), x2 = q.x + (right ? 8 : -8); out.push(<path key={k()} className="pc-lead" d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}L${x2} ${q.y}`} />, <text key={k()} className="pc-lab" x={x2 + (right ? 4 : -4)} y={q.y + 4} textAnchor={right ? 'start' : 'end'}>{text(q.s, true)}</text>); });
    };
    side(true); side(false);
  }
  if (hole > 0 && data.center !== false) { out.push(<text key={k()} className="pc-total" x={CX} y={CY - 2} textAnchor="middle">{data.centerText || fm(total, 2).replace(/\.0+$/, '')}</text>); out.push(<text key={k()} className="pc-sub" x={CX} y={CY + 16} textAnchor="middle">{data.centerSub !== undefined ? data.centerSub : (data.unit || 'total')}</text>); }
  if (mode === 'legend' || mode === 'inside') sl.forEach((s: any, i: number) => { const y = CY - 90 + i * 22; out.push(<rect key={k()} className="pc-key" x={CX + R + 28} y={y - 10} width={13} height={13} style={{ fill: items[s.index].color }} />, <text key={k()} className="pc-lab" x={CX + R + 48} y={y + 1}>{mode === 'legend' ? text(s, true) : items[s.index].name}</text>); });
  return <g className="pc">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const items = data.items || [], { sl, total, items: im } = model(data);
  return (
    <>
      <Rows id="pc-i" kicker="Slices" help="One row per slice. Rows with a value of 0 or less are left out. Values are shares of the whole, in any unit." rows={items}
        cols={[{ key: 'name', label: 'Name', w: '1.5fr' }, { key: 'value', label: 'Value', type: 'num', w: '0.7fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ id: uid('i', items.map((x: any) => x.id)), name: 'Slice ' + (items.length + 1), value: '1', color: col(items.length) })}
        addLabel="+ Add slice" onChange={(r, kk) => set({ items: r.map((x, i) => ({ ...x, id: x.id || uid('i', items.map((q: any) => q.id)), color: x.color || col(i) })) }, kk)} />
      <S.Panel kicker="Shape" help="A hole turns the pie into a donut. The start angle is measured clockwise from the top.">
        <Range id="pc-h" label={'Hole size: ' + Math.round(num(data.hole, 0.5) * 100) + '% (0 = pie)'} value={num(data.hole, 0.5)} min={0} max={0.8} step={0.05} onChange={v => set({ hole: v }, 'pc-h')} />
        <Range id="pc-st" label={'Start angle: ' + Math.round(num(data.start, 0)) + '°'} value={num(data.start, 0)} min={0} max={359} onChange={v => set({ start: v }, 'pc-st')} />
        <Toggle on={!!data.sort} label="Largest slice first" onChange={v => set({ sort: v })} />
      </S.Panel>
      <S.Panel kicker="Labels">
        <Seg wrap value={data.labels || 'outside'} options={[['outside', 'Outside'], ['inside', 'Percent inside'], ['legend', 'Legend'], ['none', 'None']]} onChange={v => set({ labels: v })} />
        <Toggle on={data.percent !== false} label="Percent" onChange={v => set({ percent: v })} />
        <Toggle on={!!data.values} label="Values" onChange={v => set({ values: v })} />
        <div className="mk-pair"><TextIn id="pc-un" label="Unit" value={data.unit} placeholder="% energy" onChange={v => set({ unit: v }, 'pc-un')} /><TextIn id="pc-dp" label="Decimals in percent" value={data.dp} placeholder="1" onChange={v => set({ dp: v }, 'pc-dp')} /></div>
        <Toggle on={data.center !== false} label="Total in the centre (donut)" onChange={v => set({ center: v })} />
      </S.Panel>
      {sl.length ? <S.Panel kicker="Results" help="Share of the total for each slice.">
        <ul className="tr-results">
          {sl.map((s: any) => <li key={s.index}><b>{im[s.index].name}</b>: {fm(s.value, 2)}{data.unit ? ' ' + data.unit : ''}, {fm(s.frac * 100, 1)}% of the total</li>)}
          <li>Total {fm(total, 2)}{data.unit ? ' ' + data.unit : ''}</li>
        </ul>
      </S.Panel> : null}
    </>
  );
}

const it = (rows: [string, number][]) => rows.map(([name, value], i) => ({ id: 'i' + i, name, value: String(value), color: col(i) }));

export const pie: EditorDef = {
  id: 'pie-chart', num: '45', name: 'Pie and donut chart', field: 'Methods',
  blurb: 'Shares of a whole as slices: macronutrient energy, fat composition or seabed cover, with outside labels that never overlap.',
  hint: 'Enter a name and value for each slice. Percent shares are worked out for you.',
  templates: [
    { name: 'Macronutrient energy', desc: 'Share of energy from each macronutrient', title: 'Sources of dietary energy',
      caption: 'Example share of total energy intake from protein, fat, carbohydrate and alcohol (percent of energy). Illustrative values.',
      data: { hole: 0.5, unit: '% energy', labels: 'outside', percent: true, values: false, centerText: '100', centerSub: '% energy', items: it([['Carbohydrate', 47], ['Fat', 33], ['Protein', 17], ['Alcohol', 3]]) } },
    { name: 'Fatty acid composition', desc: 'A pie with percent inside', title: 'Fatty acid composition of dietary fat',
      caption: 'Example share of total fat from saturated (SFA), monounsaturated (MUFA) and polyunsaturated (PUFA) fatty acids and trans fat. Illustrative values.',
      data: { hole: 0, unit: '% of fat', labels: 'inside', percent: true, dp: 0, items: it([['SFA', 38], ['MUFA', 40], ['PUFA', 19], ['Trans fat', 3]]) } },
    { name: 'Benthic cover', desc: 'Six categories, a legend', title: 'Benthic cover on a reef flat',
      caption: 'Example percent cover of the seabed from point-intercept transects. Illustrative values.',
      data: { hole: 0.55, unit: '%', labels: 'legend', percent: true, values: false, sort: true, centerText: '100', centerSub: '% cover', items: it([['Hard coral', 32], ['Turf algae', 24], ['Sand', 18], ['Macroalgae', 12], ['Coralline algae', 8], ['Other', 6]]) } },
  ],
  blank: { hole: 0.5, labels: 'outside', percent: true, items: it([['Group A', 40], ['Group B', 35], ['Group C', 25]]) },
  stats: d => { const m = model(d); return [[m.sl.length, 'slices'], [+m.total.toPrecision(4), 'total']]; },
  Controls,
  Render: ({ data }) => <PieSheet data={data} />,
};
