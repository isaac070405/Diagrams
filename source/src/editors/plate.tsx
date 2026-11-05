import { S } from '../sheet';
import { num, Rows, Seg, Spec, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

/* ===================== 23 Well plate labelling ===================== */
/* Wells sit on a grid: rows A, B, C... and columns 1, 2, 3... Each well belongs to at most one group (a colour and a name).
   Clicking a well paints it with the chosen group, clicking it again clears it. Clicking a row letter or a column number paints the whole row or column. */

interface Geo { r: number; c: number; pitch: number; rad: number; fs: number }
const PLATES: Record<number, Geo> = {
  6: { r: 2, c: 3, pitch: 132, rad: 56, fs: 16 },
  12: { r: 3, c: 4, pitch: 106, rad: 45, fs: 15 },
  24: { r: 4, c: 6, pitch: 86, rad: 36, fs: 13 },
  96: { r: 8, c: 12, pitch: 52, rad: 21, fs: 10.5 },
};
const ML = 38, MT = 38, PAD = 16;
const ROWS = 'ABCDEFGHIJKLMNOP';
const geoOf = (d: any): Geo => PLATES[num(d.plate, 96)] || PLATES[96];
const wid = (i: number, j: number) => ROWS[i] + (j + 1);
const cx = (g: Geo, j: number) => ML + g.pitch / 2 + j * g.pitch;
const cy = (g: Geo, i: number) => MT + g.pitch / 2 + i * g.pitch;
const frameW = (g: Geo) => ML + g.c * g.pitch + PAD;
const frameH = (g: Geo) => MT + g.r * g.pitch + PAD;

function parseId(s: string): [number, number] | null {
  const m = /^([A-Za-z])(\d{1,2})$/.exec(String(s).trim());
  return m ? [m[1].toUpperCase().charCodeAt(0) - 65, +m[2] - 1] : null;
}
/* "A1", "A1:A3", "A1:C2, D5" become a list of well names that exist on the plate */
export function expand(spec: string, g: { r: number; c: number }): string[] {
  const out: string[] = [];
  String(spec || '').split(/[,;]+/).forEach(tok => {
    const t = tok.trim(); if (!t) return;
    const [a, b] = t.split(':'); const p = parseId(a), q = b ? parseId(b) : p; if (!p || !q) return;
    for (let i = Math.min(p[0], q[0]); i <= Math.max(p[0], q[0]); i++) for (let j = Math.min(p[1], q[1]); j <= Math.max(p[1], q[1]); j++) if (i < g.r && j < g.c) out.push(wid(i, j));
  });
  return out;
}
function paint(plate: number, parts: [string, string][]) {
  const g = PLATES[plate], a: any = {};
  parts.forEach(([spec, gid]) => expand(spec, g).forEach(w => { a[w] = gid; }));
  return a;
}
const trunc = (s: string, n: number) => s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s;

function Plate({ data }: { data: any }) {
  const g = geoOf(data), W = frameW(g), H = frameH(g), cut = g.c > 6 ? 16 : 22;
  const groups: any[] = data.groups || [], assign = data.assign || {};
  const gm: any = {}; groups.forEach(x => { gm[x.id] = x; });
  const texts: any = {};
  String(data.wellText || '').split('\n').forEach(l => { const k = l.indexOf('|'); if (k < 0) return; const t = l.slice(k + 1).trim(); if (t) expand(l.slice(0, k), g).forEach(w => { texts[w] = t; }); });
  const out: any[] = [];
  const frame = `M${cut},0 H${W - 14} Q${W},0 ${W},14 V${H - 14} Q${W},${H} ${W - 14},${H} H14 Q0,${H} 0,${H - 14} V${cut} Z`;
  out.push(<path key="frame" className="wp-frame" d={frame} />);
  if (data.axes !== false) {
    for (let j = 0; j < g.c; j++) out.push(<text key={'c' + j} className="wp-axis" x={cx(g, j)} y={MT - 14} textAnchor="middle" style={{ fontSize: g.fs + 3 }}>{j + 1}</text>);
    for (let i = 0; i < g.r; i++) out.push(<text key={'r' + i} className="wp-axis" x={ML - 16} y={cy(g, i) + (g.fs + 3) * 0.35} textAnchor="middle" style={{ fontSize: g.fs + 3 }}>{ROWS[i]}</text>);
  }
  const mode = data.labels || 'id', maxCh = Math.max(2, Math.floor(g.rad * 1.9 / (g.fs * 0.56)));
  for (let i = 0; i < g.r; i++) for (let j = 0; j < g.c; j++) {
    const id = wid(i, j), grp = gm[assign[id]], x = cx(g, j), y = cy(g, i);
    out.push(<circle key={id} className="wp-well" cx={x} cy={y} r={g.rad} style={grp ? { fill: grp.color, fillOpacity: 0.55 } : undefined} />);
    const t = texts[id] != null ? texts[id] : mode === 'id' ? id : mode === 'group' && grp ? grp.name : '';
    if (t) out.push(<text key={'t' + id} className="wp-label" x={x} y={y + g.fs * 0.36} textAnchor="middle" style={{ fontSize: g.fs }}>{trunc(t, maxCh)}</text>);
  }
  if (data.legend !== false && groups.length) {
    const fs = 13, rowH = 24; let x = 0, y = H + 26;
    groups.forEach(gr => {
      const n = Object.keys(assign).filter(k => assign[k] === gr.id && expand(k, g).length).length;
      const label = gr.name + (data.counts !== false ? ' (' + n + ')' : ''), w = 26 + label.length * fs * 0.56 + 18;
      if (x > 0 && x + w > W) { x = 0; y += rowH; }
      out.push(<circle key={'lg' + gr.id} className="wp-well" cx={x + 9} cy={y - 4} r={8} style={{ fill: gr.color, fillOpacity: 0.55 }} />);
      out.push(<text key={'lt' + gr.id} className="wp-legend" x={x + 24} y={y} style={{ fontSize: fs }}>{label}</text>);
      x += w;
    });
  }
  return <g className="wp">{out}</g>;
}

/* click a well, a row letter or a column number to paint it */
function sheetClick(d: any, pt: [number, number]) {
  const g = geoOf(d), brush = d.brush || '', a = { ...(d.assign || {}) };
  const set = (ids: string[]) => {
    const all = ids.every(w => (brush ? a[w] === brush : !a[w]));
    ids.forEach(w => { if (brush && !all) a[w] = brush; else delete a[w]; });
    return { assign: a };
  };
  const [x, y] = pt;
  for (let i = 0; i < g.r; i++) for (let j = 0; j < g.c; j++) if (Math.hypot(x - cx(g, j), y - cy(g, i)) <= g.rad) return set([wid(i, j)]);
  if (x < ML - 2 && x > -12) for (let i = 0; i < g.r; i++) if (Math.abs(y - cy(g, i)) < g.pitch / 2) return set(Array.from({ length: g.c }, (_, j) => wid(i, j)));
  if (y < MT - 2 && y > -12) for (let j = 0; j < g.c; j++) if (Math.abs(x - cx(g, j)) < g.pitch / 2) return set(Array.from({ length: g.r }, (_, i) => wid(i, j)));
  return null;
}

function Controls({ data, set }: EditProps) {
  const g = geoOf(data), groups: any[] = data.groups || [];
  const brush = groups.some(x => x.id === data.brush) ? data.brush : '';
  const counts: any = {}; Object.keys(data.assign || {}).forEach(k => { if (expand(k, g).length) counts[data.assign[k]] = (counts[data.assign[k]] || 0) + 1; });
  return (
    <>
      <S.Panel kicker="Plate" help="Choose how many wells the plate has. Wells keep their group when you switch size, if they still exist.">
        <Seg value={num(data.plate, 96)} options={[[6, '6'], [12, '12'], [24, '24'], [96, '96']]} onChange={v => set({ plate: v })} />
        <Seg value={data.labels || 'id'} options={[['id', 'Well names'], ['group', 'Group names'], ['none', 'No labels']]} onChange={v => set({ labels: v })} />
        <Toggle on={data.axes !== false} label="Row letters and column numbers" onChange={v => set({ axes: v })} />
        <Toggle on={data.legend !== false} label="Legend" onChange={v => set({ legend: v })} />
        {data.legend !== false ? <Toggle on={data.counts !== false} label="Wells per group in the legend" onChange={v => set({ counts: v })} /> : null}
      </S.Panel>
      <S.Panel kicker="Paint wells" help="Pick a group, then click wells on the sheet. Click a row letter or column number to paint the whole row or column. The eraser clears wells.">
        <div className="mk-brushes">
          {groups.map(gr => (
            <S.ToolButton key={gr.id} compact on={brush === gr.id} onClick={() => set({ brush: gr.id })}>
              <span className="mk-dot" style={{ background: gr.color }} />{gr.name || 'Group'}{counts[gr.id] ? ' · ' + counts[gr.id] : ''}
            </S.ToolButton>
          ))}
          <S.ToolButton compact on={!brush} onClick={() => set({ brush: '' })}>Eraser</S.ToolButton>
        </div>
        <div className="sd-row-btns">
          <S.ToolButton compact disabled={!brush} onClick={() => { const a: any = {}; for (let i = 0; i < g.r; i++) for (let j = 0; j < g.c; j++) a[wid(i, j)] = brush; set({ assign: a }); }}>Fill the plate</S.ToolButton>
          <S.ToolButton compact onClick={() => set({ assign: {} })}>Clear all</S.ToolButton>
        </div>
      </S.Panel>
      <Rows id="wp-groups" kicker="Groups" rows={groups} cols={[{ key: 'color', label: 'Colour', type: 'color' }, { key: 'name', label: 'Name', w: '1fr' }]}
        onChange={rs => { const keep = rs.map(r => r.id); const a: any = {}; Object.keys(data.assign || {}).forEach(k => { if (keep.includes(data.assign[k])) a[k] = data.assign[k]; }); set({ groups: rs, assign: a }); }}
        blank={() => ({ id: uid('g', groups.map(x => x.id)), name: 'New group', color: 'var(--swatch-' + (groups.length % 16 + 1) + ')' })} addLabel="+ Add group" />
      <S.Panel kicker="Text inside wells" help="One line per label: wells | text. Wells are a name, a range or a list, such as A1, A1:A8 or A1:B3, D5. Short text fits best.">
        <Spec id="wp-text" label="Well labels" value={data.wellText || ''} rows={6} placeholder={'A1:A2 | S1\nH12 | Blank'} onChange={v => set({ wellText: v }, 'wp-text')} />
      </S.Panel>
    </>
  );
}

const G = (id: string, name: string, n: number) => ({ id, name, color: 'var(--swatch-' + n + ')' });
const base = { labels: 'id', axes: true, legend: true, counts: true, brush: 'g1' };

export const wellplate: EditorDef = {
  id: 'well-plate', num: '23', name: 'Well plate labelling', field: 'Methods',
  blurb: 'Label 6, 12, 24 or 96-well plates: paint wells by group, name rows and columns, add text and a legend.',
  hint: 'Pick a group in Paint wells, then click wells on the sheet. Click a row letter or a column number to paint a whole row or column.',
  blank: { ...base, plate: 96, groups: [G('g1', 'Group 1', 2), G('g2', 'Group 2', 9)], assign: {}, wellText: '' },
  templates: [
    { name: '96-well ELISA layout', desc: 'Standards, blank, controls and samples', title: '96-well plate layout for a sandwich ELISA',
      data: { ...base, plate: 96, labels: 'none', brush: 'g3',
        groups: [G('g1', 'Blank', 1), G('g2', 'Standards (duplicate)', 2), G('g3', 'Samples', 5), G('g4', 'Positive control', 9), G('g5', 'Negative control', 11)],
        assign: paint(96, [['A1:H2', 'g2'], ['A3:H10', 'g3'], ['A11:H11', 'g1'], ['A12:D12', 'g4'], ['E12:H12', 'g5']]),
        wellText: ['A1:A2 | S1', 'B1:B2 | S2', 'C1:C2 | S3', 'D1:D2 | S4', 'E1:E2 | S5', 'F1:F2 | S6', 'G1:G2 | S7', 'H1:H2 | S8', 'A11:H11 | Blk'].join('\n') } },
    { name: '6-well plate', desc: 'Control and two doses, in duplicate', title: '6-well plate: dose groups',
      data: { ...base, plate: 6, labels: 'group', brush: 'g2', groups: [G('g1', 'Control', 1), G('g2', '1 µM', 8), G('g3', '10 µM', 11)],
        assign: paint(6, [['A1:B1', 'g1'], ['A2:B2', 'g2'], ['A3:B3', 'g3']]), wellText: '' } },
    { name: '12-well plate', desc: 'Four conditions in triplicate', title: '12-well plate: conditions in triplicate',
      data: { ...base, plate: 12, labels: 'group', brush: 'g2', groups: [G('g1', 'Untreated', 1), G('g2', '1 µM', 4), G('g3', '10 µM', 8), G('g4', '100 µM', 11)],
        assign: paint(12, [['A1:C1', 'g1'], ['A2:C2', 'g2'], ['A3:C3', 'g3'], ['A4:C4', 'g4']]), wellText: '' } },
    { name: '24-well plate', desc: 'Four treatments across six time points', title: '24-well plate: treatments over time',
      data: { ...base, plate: 24, labels: 'none', brush: 'g2', groups: [G('g1', 'Control', 1), G('g2', 'Drug A', 2), G('g3', 'Drug B', 9), G('g4', 'A + B', 14)],
        assign: paint(24, [['A1:A6', 'g1'], ['B1:B6', 'g2'], ['C1:C6', 'g3'], ['D1:D6', 'g4']]),
        wellText: ['A1:D1 | 0 h', 'A2:D2 | 6 h', 'A3:D3 | 12 h', 'A4:D4 | 24 h', 'A5:D5 | 48 h', 'A6:D6 | 72 h'].join('\n') } },
  ],
  stats: d => { const g = geoOf(d); return [[g.r * g.c, 'wells'], [Object.keys(d.assign || {}).filter(k => expand(k, g).length).length, 'painted']]; },
  sheetClick,
  Controls,
  Render: ({ data }) => <Plate data={data} />,
};
