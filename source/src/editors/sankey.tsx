import { S } from '../sheet';
import { EmptyHint, num, Range, Seg, Spec, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const K = () => (window as any).SDSankey;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const fm = (v: number) => (+v.toPrecision(4)).toString();

/* sheet geometry: the flow area, with room for the first column's labels on the left and the last on the right */
const LM = 150, RM = 170, W = 560, H = 340, TM = 14;

function model(data: any) {
  const links = K().parse(data.text), lay = links.length ? K().layout(links, W, H, { nodeW: num(data.nodeW, 14), pad: num(data.pad, 14), justify: data.align !== 'left' }) : null;
  return { links, lay };
}

function SankeySheet({ data }: { data: any }) {
  const { links, lay } = model(data);
  if (!links.length) return <EmptyHint text={'Paste flows as "source, target, value", one per line.'} />;
  if (lay.error) return <EmptyHint text={lay.error} />;
  const out: any[] = []; let n = 0; const k = () => 'k' + n++;
  const unit = data.unit ? ' ' + data.unit : '', maxD = Math.max(...lay.nodes.map((q: any) => q.depth)), mode = data.color || 'source';
  const colorOf = (id: number) => col(id);
  const Y = (v: number) => TM + v, X = (v: number) => LM + v, op = num(data.opacity, 0.42);
  /* links, widest first so thin ones stay visible */
  lay.links.slice().sort((a: any, b: any) => b.w - a.w).forEach((l: any) => {
    const x0 = X(l.x0), x1 = X(l.x1), xm = (x0 + x1) / 2, h = l.w / 2;
    const d = `M${x0} ${Y(l.sy - h)}C${xm} ${Y(l.sy - h)} ${xm} ${Y(l.ty - h)} ${x1} ${Y(l.ty - h)}L${x1} ${Y(l.ty + h)}C${xm} ${Y(l.ty + h)} ${xm} ${Y(l.sy + h)} ${x0} ${Y(l.sy + h)}Z`;
    const c = mode === 'grey' ? 'var(--neutral-400)' : colorOf(mode === 'target' ? l.t : l.s);
    out.push(<path key={k()} className="sk-link" d={d} style={{ fill: c, fillOpacity: op }} />);
  });
  lay.nodes.forEach((nd: any) => {
    out.push(<rect key={k()} className="sk-node" x={X(nd.x)} y={Y(nd.y)} width={nd.w} height={Math.max(1, nd.h)} style={{ fill: colorOf(nd.id) }} />);
    const left = nd.depth === 0 && maxD > 0, tx = left ? X(nd.x) - 7 : X(nd.x) + nd.w + 7;
    const label = nd.name + (data.values !== false ? ' (' + fm(nd.value) + unit + ')' : '');
    out.push(<text key={k()} className="sk-label" x={tx} y={Y(nd.y + nd.h / 2) + 4} textAnchor={left ? 'end' : 'start'}>{label}</text>);
  });
  return <g className="sk">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const { links, lay } = model(data);
  const issues: string[] = [];
  if (lay && !lay.error) lay.nodes.forEach((nd: any) => { if (nd.vin > 0 && nd.vout > 0 && Math.abs(nd.vin - nd.vout) > 1e-9 * Math.max(nd.vin, nd.vout)) issues.push(nd.name + ': in ' + fm(nd.vin) + ', out ' + fm(nd.vout)); });
  return (
    <>
      <Spec id="sk-text" label="Flows: source, target, value" rows={10} value={data.text || ''} help="One flow per row. The same name in two rows is the same node. Flows must move forward, with no loops. Commas, tabs or semicolons. Paste three spreadsheet columns straight in."
        onChange={v => set({ text: v }, 'sk-text')} placeholder={'Intake, Absorbed, 90\nIntake, Lost, 10'} />
      <S.Panel kicker="Values">
        <TextIn id="sk-un" label="Unit (optional)" value={data.unit} placeholder="kJ" onChange={v => set({ unit: v }, 'sk-un')} />
        <Toggle on={data.values !== false} label="Values in the labels" onChange={v => set({ values: v })} />
      </S.Panel>
      <S.Panel kicker="Look" help="Last stops can sit in the final column (justified) or next to where their flow comes from (left).">
        <Seg value={data.color || 'source'} options={[['source', 'Colour by source'], ['target', 'By target'], ['grey', 'Grey']]} onChange={v => set({ color: v })} />
        <Seg value={data.align === 'left' ? 'left' : 'justify'} options={[['justify', 'Justified'], ['left', 'Left']]} onChange={v => set({ align: v })} />
        <Range id="sk-nw" label="Node width" value={num(data.nodeW, 14)} min={6} max={30} onChange={v => set({ nodeW: v }, 'sk-nw')} />
        <Range id="sk-pd" label="Space between nodes" value={num(data.pad, 14)} min={4} max={40} onChange={v => set({ pad: v }, 'sk-pd')} />
        <Range id="sk-op" label="Flow opacity" value={num(data.opacity, 0.42)} min={0.15} max={0.9} step={0.05} onChange={v => set({ opacity: v }, 'sk-op')} />
      </S.Panel>
      {lay && !lay.error ? <S.Panel kicker="Check" help="A node with flows in and out should pass on what it receives. A difference is drawn as it is: the node is as tall as the larger side.">
        <ul className="tr-results">
          <li>{links.length} flows, {lay.nodes.length} nodes, {lay.columns} columns</li>
          <li>Starts: {lay.nodes.filter((q: any) => !q.vin).map((q: any) => q.name + ' ' + fm(q.vout)).join(', ') || 'none'}</li>
          <li>Ends: {lay.nodes.filter((q: any) => !q.vout).map((q: any) => q.name + ' ' + fm(q.vin)).join(', ') || 'none'}</li>
          {issues.length ? issues.map(i => <li key={i} className="pr-warn">Unbalanced {i}</li>) : <li>Every middle node passes on what it receives.</li>}
        </ul>
      </S.Panel> : lay && lay.error ? <S.Panel kicker="Check"><ul className="tr-results"><li className="pr-warn">{lay.error}</li></ul></S.Panel> : null}
    </>
  );
}

export const sankey: EditorDef = {
  id: 'sankey-diagram', num: '42', name: 'Sankey diagram', field: 'Methods',
  blurb: 'Flows between stages as bands whose width is the amount: energy partition, participant flow or carbon in a food web.',
  hint: 'Paste flows as source, target, value. Bands, columns and the balance check are worked out for you.',
  templates: [
    { name: 'Dietary energy partition', desc: 'From intake to heat and storage', title: 'Partition of dietary energy',
      caption: 'Example partition of 10,000 kJ of gross energy intake into faecal and urinary losses, then metabolisable energy into heat and storage. Band width is proportional to energy. Illustrative values.',
      data: { unit: 'kJ', text: ['Gross energy intake, Faecal energy, 500', 'Gross energy intake, Urinary energy, 300', 'Gross energy intake, Metabolisable energy, 9200', 'Metabolisable energy, Basal metabolism, 6000', 'Metabolisable energy, Diet-induced thermogenesis, 900', 'Metabolisable energy, Physical activity, 1800', 'Metabolisable energy, Energy stored, 500'].join('\n') } },
    { name: 'Participant flow', desc: 'A trial from screening to completion', title: 'Flow of participants through a dietary trial',
      caption: 'Example flow of 312 people assessed for a two-arm trial to completion or withdrawal. Band width is the number of people. Illustrative counts.',
      data: { unit: '', color: 'target', align: 'left', text: ['Assessed, Excluded, 152', 'Assessed, Randomised, 160', 'Randomised, Diet arm, 80', 'Randomised, Usual care arm, 80', 'Diet arm, Completed (diet), 73', 'Diet arm, Withdrew (diet), 7', 'Usual care arm, Completed (usual care), 71', 'Usual care arm, Withdrew (usual care), 9'].join('\n') } },
    { name: 'Carbon flow in the sea', desc: 'Where fixed carbon goes', title: 'Fate of carbon fixed by phytoplankton',
      caption: 'Illustrative fate of 100 units of carbon fixed by phytoplankton: grazing, the microbial loop and sinking. The numbers are made up to show the diagram and are not measurements.',
      data: { unit: '', text: ['Primary production, Grazed by zooplankton, 40', 'Primary production, Microbial loop, 35', 'Primary production, Sinking, 25', 'Grazed by zooplankton, Fish, 8', 'Grazed by zooplankton, Faecal pellets, 12', 'Grazed by zooplankton, Respired by zooplankton, 20', 'Microbial loop, Respired by microbes, 30', 'Microbial loop, Dissolved organic carbon, 5', 'Sinking, Buried, 3', 'Sinking, Remineralised, 22'].join('\n') } },
  ],
  blank: { unit: '', text: 'Source A, Stage 1, 60\nSource A, Stage 2, 40\nStage 1, End X, 45\nStage 1, End Y, 15\nStage 2, End Y, 25\nStage 2, End Z, 15' },
  stats: d => { const m = model(d); return m.lay && !m.lay.error ? [[m.links.length, 'flows'], [m.lay.nodes.length, 'nodes']] : [[m.links.length, 'flows']]; },
  Controls,
  Render: ({ data }) => <SankeySheet data={data} />,
};
