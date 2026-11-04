import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, Seg, startDrag, Swatches, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

/* Apex A at the top, B bottom left, C bottom right. A point (a, b, c) sits at a·A + b·B + c·C after a + b + c is scaled to 1. */
const SIDE = 520, H = SIDE * Math.sqrt(3) / 2;
const A: [number, number] = [SIDE / 2, 0], B: [number, number] = [0, H], C: [number, number] = [SIDE, H];
function xy(a: number, b: number, c: number): [number, number] | null {
  const s = a + b + c; if (!(s > 0) || a < 0 || b < 0 || c < 0) return null;
  a /= s; b /= s; c /= s;
  return [a * A[0] + b * B[0] + c * C[0], a * A[1] + b * B[1] + c * C[1]];
}
function bary(x: number, y: number): [number, number, number] {
  const a = Math.max(0, Math.min(1, 1 - y / H));
  const c0 = (x - A[0] * a - B[0] * (1 - a)) / (C[0] - B[0]);
  const c = Math.max(0, Math.min(1 - a, c0));
  return [a, 1 - a - c, c];
}
const r1 = (v: number) => Math.round(v * 1000) / 10;
const VIR = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];
function viridis(t: number) {
  t = Math.max(0, Math.min(1, t)); const i = Math.min(3, Math.floor(t * 4)), f = t * 4 - i;
  const h = (s: string) => [1, 3, 5].map(k => parseInt(s.slice(k, k + 2), 16));
  const p = h(VIR[i]), q = h(VIR[i + 1]);
  return 'rgb(' + p.map((v, k) => Math.round(v + (q[k] - v) * f)).join(',') + ')';
}
function verts(s: string) {
  return String(s || '').split(';').map(t => t.split(',').map(v => parseFloat(v))).filter(v => v.length === 3 && v.every(isFinite));
}

/* text style: a size and a colour for one item, falling back to the sheet-wide setting for that kind of text */
const ts = (data: any, kind: string, own?: any) => {
  const st: any = {}, sz = num(own && own.size, num(data.text && data.text[kind + 'Size'], NaN)), col = (own && own.ink) || (data.text && data.text[kind + 'Ink']);
  if (isFinite(sz)) st.fontSize = sz + 'px';
  if (col) st.fill = col;
  return st;
};
const fmtV = (v: number) => (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1));
function TernarySheet({ data }: { data: any }) {
  const out: any[] = [];
  let k = 0; const K = () => 't' + k++;
  const step = num(data.grid, 10), names = [data.nameA || 'A', data.nameB || 'B', data.nameC || 'C'];
  /* regions under everything else */
  (data.regions || []).forEach((r: any) => {
    const ps = verts(r.verts).map(v => xy(v[0], v[1], v[2])).filter(Boolean) as [number, number][];
    if (ps.length < 3) return;
    out.push(<polygon key={K()} className="tn-region" points={ps.map(p => p.join(',')).join(' ')} style={{ fill: r.color || 'var(--accent-100)' }} />);
    if (r.label) {
      const cx = ps.reduce((s, p) => s + p[0], 0) / ps.length, cy = ps.reduce((s, p) => s + p[1], 0) / ps.length;
      const ls = String(r.label).split('//').map(s => s.trim());
      const wide = Math.max(...ls.map(l => l.length * 7.4)), xs = ps.map(p => p[0]), ys = ps.map(p => p[1]);
      const fits = Math.max(...xs) - Math.min(...xs) > wide + 10 && Math.max(...ys) - Math.min(...ys) > ls.length * 16 + 6;
      const rst = ts(data, 'region', r), lh = Math.max(16, num(r.size, num(data.text && data.text.regionSize, 13)) * 1.25);
      if (fits) ls.forEach((l, j) => out.push(<S.ChemText key={K()} className="tn-rlabel" x={cx + num(r.dx, 0)} y={cy + num(r.dy, 0) + (j - (ls.length - 1) / 2) * lh + 4} textAnchor="middle" style={rst}>{l}</S.ChemText>));
      else {
        /* too small to hold its name: label it outside the triangle with a leader */
        const right = cx >= SIDE / 2, ex = right ? Math.max(SIDE / 2 + (H - cy) / Math.sqrt(3), cx) + 40 : Math.min(SIDE / 2 - (H - cy) / Math.sqrt(3), cx) - 40;
        out.push(<line key={K()} className="tn-leader" x1={cx} y1={cy} x2={ex + (right ? -4 : 4)} y2={cy} />);
        out.push(<S.ChemText key={K()} className="tn-rlabel" x={ex} y={cy + 4} textAnchor={right ? 'start' : 'end'} style={rst}>{ls.join(' ')}</S.ChemText>);
      }
    }
  });
  /* grid and ticks: lines of constant a, b and c */
  if (step > 0 && step < 100) {
    for (let v = step; v < 100 - 1e-6; v += step) {
      const f = v / 100;
      const lines: [[number, number, number], [number, number, number]][] = [[[f, 1 - f, 0], [f, 0, 1 - f]], [[0, f, 1 - f], [1 - f, f, 0]], [[1 - f, 0, f], [0, 1 - f, f]]];
      lines.forEach(([p, q], j) => { const a = xy(...p)!, b = xy(...q)!; out.push(<line key={K()} className={'tn-grid' + (data.minorGrid && Math.abs((v / (step * 2)) - Math.round(v / (step * 2))) > 1e-6 ? ' tn-grid-minor' : '')} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} data-axis={j} />); });
    }
  }
  out.push(<polygon key={K()} className="tn-frame" points={[A, B, C].map(p => p.join(',')).join(' ')} />);
  if (data.ticks !== false && step > 0) {
    for (let v = 0; v <= 100 + 1e-6; v += step) {
      const f = v / 100, lab = fmtV(v), tst = ts(data, 'tick');
      /* A along the left edge, B along the bottom, C along the right edge */
      const pa = xy(f, 1 - f, 0)!, pb = xy(0, f, 1 - f)!, pc = xy(1 - f, 0, f)!;
      out.push(<g key={K()} className="tn-ticks">
        <line x1={pa[0]} y1={pa[1]} x2={pa[0] - 7} y2={pa[1]} /><text x={pa[0] - 10} y={pa[1] + 4} textAnchor="end" className="tn-tlabel" style={tst}>{lab}</text>
        <line x1={pb[0]} y1={pb[1]} x2={pb[0] - 4} y2={pb[1] + 7} /><text x={pb[0] - 6} y={pb[1] + 21} textAnchor="middle" className="tn-tlabel" style={tst}>{lab}</text>
        <line x1={pc[0]} y1={pc[1]} x2={pc[0] + 6} y2={pc[1] - 4} /><text x={pc[0] + 9} y={pc[1] - 4} textAnchor="start" className="tn-tlabel" style={tst}>{lab}</text>
      </g>);
    }
  }
  /* apex names: 100 % of one component */
  const ap = (k: string) => ts(data, 'apex', { size: data['size' + k], ink: data['ink' + k] });
  out.push(<S.ChemText key={K()} className="tn-apex" x={A[0]} y={A[1] - 16} textAnchor="middle" style={ap('A')}>{names[0]}</S.ChemText>);
  out.push(<S.ChemText key={K()} className="tn-apex" x={B[0] - 30} y={B[1] + (data.ticks !== false ? 44 : 24)} textAnchor="middle" style={ap('B')}>{names[1]}</S.ChemText>);
  out.push(<S.ChemText key={K()} className="tn-apex" x={C[0] + 30} y={C[1] + (data.ticks !== false ? 44 : 24)} textAnchor="middle" style={ap('C')}>{names[2]}</S.ChemText>);
  if (data.unit) out.push(<text key={K()} className="tn-unit" x={SIDE / 2} y={H + (data.ticks !== false ? 62 : 40)} textAnchor="middle" style={ts(data, 'unit')}>{data.unit}</text>);
  /* points */
  const pts = (data.points || []).map((p: any) => ({ ...p, q: xy(num(p.a, 0), num(p.b, 0), num(p.c, 0)) })).filter((p: any) => p.q);
  const vals = pts.map((p: any) => parseFloat(p.value)).filter(isFinite), vmin = Math.min(...vals), vmax = Math.max(...vals);
  const sizes = pts.map((p: any) => parseFloat(p.size)).filter(isFinite), smin = Math.min(...sizes), smax = Math.max(...sizes);
  const base = num(data.pointSize, 7);
  const rad = (p: any) => data.sizeBy && isFinite(parseFloat(p.size)) ? base * 0.6 + (smax > smin ? (parseFloat(p.size) - smin) / (smax - smin) : 0.5) * base * 1.6 : base;
  const fill = (p: any) => data.colorBy && isFinite(parseFloat(p.value)) ? viridis(vmax > vmin ? (parseFloat(p.value) - vmin) / (vmax - vmin) : 0.5) : (p.color || 'var(--accent)');
  if (data.connect && pts.length > 1) out.push(<polyline key={K()} className="tn-path" points={pts.map((p: any) => p.q.join(',')).join(' ')} />);
  pts.forEach((p: any) => {
    out.push(<circle key={K()} className="tn-pt" cx={p.q[0]} cy={p.q[1]} r={rad(p)} style={{ fill: fill(p) }} />);
    if (p.label && data.labels !== false) out.push(<S.ChemText key={K()} className="tn-plabel" x={p.q[0] + rad(p) + 5} y={p.q[1] + 4} style={ts(data, 'point', { size: p.lsize, ink: p.lcolor })}>{p.label}</S.ChemText>);
  });
  /* legends for colour and size */
  let ly = 0;
  if (data.colorBy && vals.length) {
    const lx = SIDE + 70;
    out.push(<text key={K()} className="tn-ltitle" x={lx} y={ly}>{data.valueName || 'Value'}</text>);
    for (let i = 0; i < 40; i++) out.push(<rect key={K()} x={lx} y={ly + 10 + (39 - i) * 2.5} width={10} height={2.6} style={{ fill: viridis(i / 39) }} />);
    [0, 0.5, 1].forEach(f => out.push(<text key={K()} className="tn-tlabel" x={lx + 16} y={ly + 10 + (1 - f) * 97 + 4}>{+(vmin + f * (vmax - vmin)).toPrecision(3)}{data.valueUnit ? ' ' + data.valueUnit : ''}</text>));
    ly += 130;
  }
  if (data.sizeBy && sizes.length) {
    const lx = SIDE + 70;
    out.push(<text key={K()} className="tn-ltitle" x={lx} y={ly}>{data.sizeName || 'Size'}</text>);
    [1, 0.5, 0].forEach((f, j) => { const r = base * 0.6 + f * base * 1.6, cy = ly + 22 + j * 30; out.push(<circle key={K()} className="tn-pt" cx={lx + 12} cy={cy} r={r} style={{ fill: 'var(--neutral-600)' }} />); out.push(<text key={K()} className="tn-tlabel" x={lx + 34} y={cy + 4}>{+(smin + f * (smax - smin)).toPrecision(3)}{data.sizeUnit ? ' ' + data.sizeUnit : ''}</text>); });
  }
  if (Array.isArray(data.drawing)) {
    const ds = data.drawing.map((v: any) => xy(v[0], v[1], v[2])).filter(Boolean) as [number, number][];
    if (ds.length > 1) out.push(<polyline key={K()} className="tn-drawing" points={[...ds, ...(ds.length > 2 ? [ds[0]] : [])].map(p => p.join(',')).join(' ')} />);
    ds.forEach((p, j) => out.push(<g key={K()}><circle className="tn-drawdot" cx={p[0]} cy={p[1]} r={4.5} /><text className="tn-tlabel" x={p[0] + 7} y={p[1] - 6}>{j + 1}</text></g>));
  }
  if (!pts.length && !(data.regions || []).length) out.push(<EmptyHint key={K()} text="" />);
  return <g className="tn">{out}</g>;
}

function Overlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  return <>{(data.points || []).map((p: any, i: number) => {
    const q = xy(num(p.a, 0), num(p.b, 0), num(p.c, 0)); if (!q) return null;
    const on = sel && sel.kind === 'pt' && sel.id === String(i);
    return <circle key={i} className={'mk-hit' + (on ? ' mk-on' : '')} cx={q[0]} cy={q[1]} r={12}
      onPointerDown={e => {
        setSel({ kind: 'pt', id: String(i) });
        startDrag(e, toSvg, (_dx, _dy, at) => { const [a, b, c] = bary(at[0], at[1]); set({ points: data.points.map((x: any, j: number) => j === i ? { ...x, a: r1(a), b: r1(b), c: r1(c) } : x) }, 'tn-drag-' + i); });
      }} />;
  })}</>;
}

function Controls({ data, set, sel, setSel }: EditProps) {
  const pts = data.points || [], i = sel && sel.kind === 'pt' ? +sel.id : -1, p = pts[i];
  const up = (patch: any, key?: string) => set({ points: pts.map((x: any, j: number) => j === i ? { ...x, ...patch } : x) }, key);
  const sum = p ? num(p.a, 0) + num(p.b, 0) + num(p.c, 0) : 0;
  return (
    <>
      {p ? (
        <S.Panel kicker="Selected point" help={'Drag it inside the triangle. The three parts always add up to 100' + (Math.abs(sum - 100) > 0.5 ? '; these add up to ' + Math.round(sum * 10) / 10 + ' and are scaled to 100 when drawn.' : '.')}>
          <TextIn id="tn-plab" label="Label" value={p.label} onChange={v => up({ label: v }, 'tn-l')} />
          <div className="mk-pair3">
            <TextIn id="tn-pa" label={data.nameA || 'A'} value={p.a} onChange={v => up({ a: v }, 'tn-a')} />
            <TextIn id="tn-pb" label={data.nameB || 'B'} value={p.b} onChange={v => up({ b: v }, 'tn-b')} />
            <TextIn id="tn-pc" label={data.nameC || 'C'} value={p.c} onChange={v => up({ c: v }, 'tn-c')} />
          </div>
          {data.colorBy ? <TextIn id="tn-pv" label={data.valueName || 'Value'} value={p.value} onChange={v => up({ value: v }, 'tn-v')} /> : <Swatches label="Colour" value={p.color} none="Steel" onChange={v => up({ color: v })} />}
          {data.sizeBy ? <TextIn id="tn-ps" label={data.sizeName || 'Size'} value={p.size} onChange={v => up({ size: v }, 'tn-s')} /> : null}
          <div className="mk-pair">
            <TextIn id="tn-plsz" label="Label size (px)" value={p.lsize} placeholder={String(num(data.text && data.text.pointSize, 12))} onChange={v => up({ lsize: v }, 'tn-lsz')} />
          </div>
          <Swatches label="Label colour" value={p.lcolor} none="Sheet default" onChange={v => up({ lcolor: v })} />
          <S.ToolButton onClick={() => { set({ points: pts.filter((_: any, j: number) => j !== i) }); setSel(null); }}>Delete point</S.ToolButton>
        </S.Panel>
      ) : null}
      <S.Panel kicker="Components" help="Each corner is 100 % of one component and 0 % of the other two.">
        <TextIn id="tn-na" label="Top corner" value={data.nameA} onChange={v => set({ nameA: v }, 'tn-na')} />
        <div className="mk-pair">
          <TextIn id="tn-nb" label="Bottom left" value={data.nameB} onChange={v => set({ nameB: v }, 'tn-nb')} />
          <TextIn id="tn-nc" label="Bottom right" value={data.nameC} onChange={v => set({ nameC: v }, 'tn-nc')} />
        </div>
        <TextIn id="tn-unit" label="Units note" value={data.unit} placeholder="e.g. wt% or % of energy" onChange={v => set({ unit: v }, 'tn-unit')} />
      </S.Panel>
      <Rows id="tn-pts" kicker="Points" help="Any three numbers: they are scaled to add up to 100. Click a point on the sheet to edit it." rows={pts}
        cols={[{ key: 'label', label: 'Label', w: '1.3fr' }, { key: 'a', label: (data.nameA || 'A').slice(0, 6), type: 'num', w: '0.6fr' }, { key: 'b', label: (data.nameB || 'B').slice(0, 6), type: 'num', w: '0.6fr' }, { key: 'c', label: (data.nameC || 'C').slice(0, 6), type: 'num', w: '0.6fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ label: 'New point', a: 33.3, b: 33.3, c: 33.4 })} addLabel="+ Add point" onChange={(rows, key) => set({ points: rows }, key)} />
      <S.Panel kicker="Encode a fourth and fifth variable">
        <Toggle on={data.colorBy} label="Colour points by a value" onChange={v => set({ colorBy: v })} />
        {data.colorBy ? <div className="mk-pair"><TextIn id="tn-vn" label="Value name" value={data.valueName} placeholder="e.g. Reflectance" onChange={v => set({ valueName: v }, 'tn-vn')} /><TextIn id="tn-vu" label="Unit" value={data.valueUnit} placeholder="e.g. %" onChange={v => set({ valueUnit: v }, 'tn-vu')} /></div> : null}
        {data.colorBy ? <Rows id="tn-vals" kicker="Values" rows={pts.map((x: any) => ({ label: x.label, value: x.value }))} cols={[{ key: 'label', label: 'Point', w: '1.4fr' }, { key: 'value', label: 'Value', type: 'num' }]}
          blank={() => ({ label: 'New point', value: '' })} addLabel="+ Add point" onChange={(rows, key) => set({ points: rows.map((r, j) => ({ ...(pts[j] || { a: 33.3, b: 33.3, c: 33.4 }), label: r.label, value: r.value })) }, key)} /> : null}
        <Toggle on={data.sizeBy} label="Size points by a value" onChange={v => set({ sizeBy: v })} />
        {data.sizeBy ? <div className="mk-pair"><TextIn id="tn-sn" label="Size name" value={data.sizeName} placeholder="e.g. Grain size" onChange={v => set({ sizeName: v }, 'tn-sn')} /><TextIn id="tn-su" label="Unit" value={data.sizeUnit} placeholder="e.g. µm" onChange={v => set({ sizeUnit: v }, 'tn-su')} /></div> : null}
        {data.sizeBy ? <Rows id="tn-sizes" kicker="Sizes" rows={pts.map((x: any) => ({ label: x.label, size: x.size }))} cols={[{ key: 'label', label: 'Point', w: '1.4fr' }, { key: 'size', label: 'Size', type: 'num' }]}
          blank={() => ({ label: 'New point', size: '' })} addLabel="+ Add point" onChange={(rows, key) => set({ points: rows.map((r, j) => ({ ...(pts[j] || { a: 33.3, b: 33.3, c: 33.4 }), label: r.label, size: r.size })) }, key)} /> : null}
      </S.Panel>
      <S.Panel kicker="Draw a region" help={Array.isArray(data.drawing) ? 'Click the sheet to add corners, in order around the region. ' + (data.drawing.length < 3 ? 'At least 3 are needed.' : data.drawing.length + ' corners so far.') : 'Click corner points on the sheet, as many as the region needs, then finish.'}>
        {Array.isArray(data.drawing) ? <>
          <TextIn id="tn-dlab" label="Label for the new region" value={data.drawLabel} placeholder="e.g. Tide-dominated // estuaries" onChange={v => set({ drawLabel: v }, 'tn-dl')} />
          <Toggle on={data.snap !== false} label={'Snap corners to the grid' + (num(data.grid, 10) > 0 ? ' (every ' + fmtV(num(data.grid, 10)) + ')' : ' (whole percent)')} onChange={v => set({ snap: v })} />
          <div className="sd-row-btns">
            <S.ToolButton compact on={data.drawing.length >= 3} onClick={() => { if (data.drawing.length < 3) return; set({ regions: [...(data.regions || []), { label: data.drawLabel || 'Region ' + ((data.regions || []).length + 1), verts: data.drawing.map((v: any) => v.map((x: number) => r1(x / 100) ).join(',')).join('; '), color: 'var(--swatch-' + (((data.regions || []).length * 5) % 16 + 1) + ')' }], drawing: undefined, drawLabel: '' }); }}>Finish region</S.ToolButton>
            <S.ToolButton compact onClick={() => set({ drawing: data.drawing.slice(0, -1) })}>Undo last corner</S.ToolButton>
            <S.ToolButton compact onClick={() => set({ drawing: undefined })}>Cancel</S.ToolButton>
          </div>
        </> : <S.ToolButton onClick={() => set({ drawing: [], drawLabel: '' })}>Start drawing a region</S.ToolButton>}
      </S.Panel>
      <Rows id="tn-reg" kicker="Regions" help="Corners of each region as compositions: a,b,c; a,b,c; … Use // in a label for a new line. Size sets the label's text size; Text sets its colour." rows={data.regions || []}
        cols={[{ key: 'label', label: 'Label', w: '1fr' }, { key: 'verts', label: 'Corners', w: '1.4fr' }, { key: 'size', label: 'Size', type: 'num', w: '0.45fr', placeholder: '13' }, { key: 'color', label: 'Fill', type: 'color' }, { key: 'ink', label: 'Text', type: 'color' }]}
        blank={() => ({ label: 'Region', verts: '100,0,0; 50,50,0; 50,0,50', color: 'var(--swatch-3)' })} addLabel="+ Add region" onChange={(rows, key) => set({ regions: rows }, key)} />
      <S.Panel kicker="Look">
        <Seg wrap value={num(data.grid, 10)} options={[[0, 'No grid'], [10, 'Every 10'], [20, 'Every 20'], [25, 'Every 25'], [100 / 3, 'Every 33.3'], [50, 'Every 50']]} onChange={v => set({ grid: v })} />
        <Toggle on={data.ticks !== false} label="Tick labels" onChange={v => set({ ticks: v })} />
        <Toggle on={data.labels !== false} label="Point labels" onChange={v => set({ labels: v })} />
        <Toggle on={data.connect} label="Join points in order (a trend or path)" onChange={v => set({ connect: v })} />
        <Range id="tn-psz" label="Point size" value={num(data.pointSize, 7)} min={3} max={16} onChange={v => set({ pointSize: v }, 'tn-psz')} />
      </S.Panel>
      <TextPanel data={data} set={set} />
    </>
  );
}

/* sizes and colours for every kind of text, and for each corner name on its own */
function TextPanel({ data, set }: { data: any; set: any }) {
  const tx = data.text || {}, upT = (p: any, key?: string) => set({ text: { ...tx, ...p } }, key);
  const row = (kind: string, label: string, def: number) => <div key={kind} className="mk-pair">
    <Range id={'tn-t-' + kind} label={label + ' size'} value={num(tx[kind + 'Size'], def)} min={8} max={28} step={0.5} onChange={v => upT({ [kind + 'Size']: v }, 'tn-t-' + kind)} />
    <Swatches label={label + ' colour'} value={tx[kind + 'Ink']} none="Ink" onChange={v => upT({ [kind + 'Ink']: v })} />
  </div>;
  return <S.Panel kicker="Text" help="Sheet-wide sizes and colours for each kind of text. A region's or point's own setting wins over these.">
    {[['A', data.nameA || 'Top corner'], ['B', data.nameB || 'Bottom left'], ['C', data.nameC || 'Bottom right']].map(([k, n]) => <div key={k} className="mk-pair">
      <Range id={'tn-sz' + k} label={n + ' size'} value={num(data['size' + k], num(tx.apexSize, 16))} min={8} max={32} step={0.5} onChange={v => set({ ['size' + k]: v }, 'tn-sz' + k)} />
      <Swatches label={n + ' colour'} value={data['ink' + k]} none="Ink" onChange={v => set({ ['ink' + k]: v })} />
    </div>)}
    {row('region', 'Region labels', 13)}
    {row('tick', 'Tick labels', 12)}
    {row('point', 'Point labels', 12)}
    {row('unit', 'Units note', 12)}
  </S.Panel>;
}

/* the three "mostly" regions: each corner's kite, split at the edge midpoints and the centre */
const KITES = (la: string, lb: string, lc: string, ca: string, cb: string, cc: string) => [
  { label: la, verts: '100,0,0; 50,50,0; 33.3,33.3,33.3; 50,0,50', color: ca },
  { label: lb, verts: '0,100,0; 50,50,0; 33.3,33.3,33.3; 0,50,50', color: cb },
  { label: lc, verts: '0,0,100; 50,0,50; 33.3,33.3,33.3; 0,50,50', color: cc },
];

export const ternary: EditorDef = {
  id: 'ternary-plot', num: '15', name: 'Ternary plot', field: 'Cells and measurement',
  blurb: 'Three-part compositions in a triangle: foods by macronutrient energy, rocks by mineral or oxide content.',
  hint: 'Click a point to edit it; drag it inside the triangle and its three percentages update.',
  templates: [
    { name: 'Macronutrient energy', desc: 'Foods by % of energy from protein, fat and carbohydrate', title: 'Where foods sit by macronutrient energy',
      caption: 'Share of energy from each macronutrient (Atwater factors 4, 9 and 4 kcal/g), approximate values per 100 g.',
      data: { nameA: 'Protein', nameB: 'Fat', nameC: 'Carbohydrate', unit: '% of energy', grid: 10, ticks: true, labels: true, pointSize: 6,
        regions: KITES('Mostly // protein', 'Mostly // fat', 'Mostly // carbohydrate', 'var(--swatch-13)', 'var(--swatch-7)', 'var(--swatch-3)'),
        points: [['Chicken breast', 79, 21, 0], ['Canned tuna', 92, 8, 0], ['Salmon', 41, 59, 0], ['Eggs', 36, 62, 2], ['Firm tofu', 42, 50, 8], ['Cheddar', 25, 74, 1],
          ['Whole milk', 21, 48, 31], ['Almonds', 13, 72, 15], ['Lentils', 30, 3, 67], ['Rolled oats', 14, 15, 71], ['White rice', 9, 2, 89], ['Banana', 4, 3, 93]]
          .map(([label, a, b, c]) => ({ label, a, b, c, color: 'var(--ink)' })) } },
    { name: 'Sandstone (QFL)', desc: 'Quartz, feldspar and lithic fragments', title: 'Sandstone classification by framework grains',
      caption: 'Simplified QFL scheme: Q = quartz, F = feldspar, L = lithic fragments, as % of framework grains.',
      data: { nameA: 'Q', nameB: 'F', nameC: 'L', unit: '% of framework grains', grid: 10, ticks: true, labels: true, pointSize: 6,
        regions: [{ label: 'Quartz arenite', verts: '100,0,0; 90,10,0; 90,0,10', color: 'var(--swatch-8)' },
          { label: 'Subarkose', verts: '90,10,0; 75,25,0; 75,12.5,12.5; 90,5,5', color: 'var(--swatch-9)' }, { label: 'Sublitharenite', verts: '90,0,10; 90,5,5; 75,12.5,12.5; 75,0,25', color: 'var(--swatch-4)' },
          { label: 'Arkose', verts: '75,25,0; 0,100,0; 0,50,50; 75,12.5,12.5', color: 'var(--swatch-12)' }, { label: 'Litharenite', verts: '75,0,25; 75,12.5,12.5; 0,50,50; 0,0,100', color: 'var(--swatch-3)' }],
        points: [['Sample 1', 93, 4, 3], ['Sample 2', 80, 15, 5], ['Sample 3', 55, 35, 10], ['Sample 4', 60, 10, 30]].map(([label, a, b, c]) => ({ label, a, b, c, color: 'var(--ink)' })) } },
    { name: 'Coastal systems', desc: 'River, wave and tide control of coastal depositional systems', title: 'Classification of coastal depositional systems',
      caption: 'Coastal systems by the relative power of river, wave and tide processes. RDD: river-dominated delta; WDD: wave-dominated delta; TDD: tide-dominated delta. Deltas form where river input is high; estuaries, strandplains and tidal flats where it is low.',
      data: { nameA: 'River', nameB: 'Wave', nameC: 'Tide', unit: 'relative power of each process', grid: 0, ticks: false, labels: true, pointSize: 7, sizeA: 18, sizeB: 18, sizeC: 18,
        regions: [
          { label: 'RDD', verts: '100,0,0; 75,25,0; 75,0,25', color: 'var(--swatch-14)', size: 18 },
          { label: 'WDD', verts: '75,25,0; 64,36,0; 64,18,18; 75,12.5,12.5', color: 'var(--swatch-8)', size: 14 },
          { label: 'TDD', verts: '75,12.5,12.5; 64,18,18; 64,0,36; 75,0,25', color: 'var(--swatch-12)', size: 14 },
          { label: 'Wave-dominated // estuaries', verts: '64,36,0; 14,86,0; 14,43,43; 64,18,18', color: 'var(--swatch-7)', size: 15 },
          { label: 'Tide-dominated // estuaries', verts: '64,18,18; 14,43,43; 14,0,86; 64,0,36', color: 'var(--swatch-9)', size: 15 },
          { label: 'Strandplain', verts: '14,86,0; 0,100,0; 0,50,50; 14,43,43', color: 'var(--swatch-10)', size: 14 },
          { label: 'Tidal flat // or creek', verts: '14,43,43; 0,50,50; 0,0,100; 14,0,86', color: 'var(--swatch-3)', size: 14 }],
        points: [] } },
    { name: 'Oxide composition', desc: 'Colour and size by two more measured values', title: 'Oxide composition of four samples',
      data: { nameA: 'SiO_2', nameB: 'Al_2O_3', nameC: 'Fe_2O_3', unit: 'wt%', grid: 10, ticks: true, labels: false, pointSize: 7, colorBy: true, sizeBy: true,
        valueName: 'Reflectance', valueUnit: '%', sizeName: 'Grain size', sizeUnit: 'µm', regions: [],
        points: [{ label: 'S1', a: 54, b: 22, c: 24, value: 20, size: 3 }, { label: 'S2', a: 37, b: 38, c: 25, value: 45, size: 8 }, { label: 'S3', a: 19, b: 56, c: 25, value: 62, size: 14 }, { label: 'S4', a: 10, b: 68, c: 22, value: 80, size: 20 }] } }
  ],
  blank: { nameA: 'A', nameB: 'B', nameC: 'C', unit: '', grid: 10, ticks: true, labels: true, pointSize: 7, regions: [], points: [{ label: 'Point 1', a: 33.3, b: 33.3, c: 33.4 }] },
  stats: d => [[(d.points || []).length, 'points'], [(d.regions || []).length, 'regions']],
  Controls, Overlay,
  Render: ({ data }) => <TernarySheet data={data} />,
  /* while drawing a region, each click on the sheet adds a corner (snapped to the grid if asked) */
  sheetClick: (d, pt) => {
    if (!Array.isArray(d.drawing)) return null;
    let [a, b, c] = bary(pt[0], pt[1]).map(v => v * 100);
    const st = num(d.grid, 10) > 0 ? num(d.grid, 10) : 1;
    if (d.snap !== false) { a = Math.round(a / st) * st; b = Math.round(b / st) * st; a = Math.min(100, Math.max(0, a)); b = Math.min(100 - a, Math.max(0, b)); c = 100 - a - b; }
    return { drawing: [...d.drawing, [a, b, c].map(v => Math.round(v * 100) / 100)] };
  },
  findText: (d, text) => { const i = (d.points || []).findIndex((p: any) => p.label === text.trim()); return i >= 0 ? { kind: 'pt', id: String(i) } : null; },
  remove: (d, sel) => sel.kind === 'pt' ? { points: d.points.filter((_: any, j: number) => j !== +sel.id) } : null,
  duplicate: (d, sel) => { const p = d.points[+sel.id]; return p ? { patch: { points: [...d.points, { ...p, label: p.label + ' (copy)' }] }, sel: { kind: 'pt', id: String(d.points.length) } } : null; },
  nudge: (d, sel, dx, dy) => {
    const p = d.points[+sel.id]; if (!p) return null;
    const q = xy(num(p.a, 0), num(p.b, 0), num(p.c, 0)); if (!q) return null;
    const [a, b, c] = bary(q[0] + dx, q[1] + dy);
    return { points: d.points.map((x: any, j: number) => j === +sel.id ? { ...x, a: r1(a), b: r1(b), c: r1(c) } : x) };
  },
};
void uid;
