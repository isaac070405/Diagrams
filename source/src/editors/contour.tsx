import { S } from '../sheet';
import { EmptyHint, num, Range, Rows, Select, Seg, Swatches, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const C = () => (window as any).SDContour;

/* geometry of the plot area on the sheet */
const L = 70, T = 20, PW = 520, PH = 400;
const FNS: [string, string][] = [['peak', 'One peak'], ['twopeaks', 'Two peaks'], ['saddle', 'Saddle'], ['ridge', 'Ridges'], ['slope', 'Slope with ripples']];
const RAMPS: [string, string][] = [['viridis', 'Viridis'], ['ocean', 'Ocean'], ['heat', 'Heat'], ['diverging', 'Diverging'], ['grey', 'Grey']];

function pointsOf(data: any) {
  return (data.points || []).map((p: any) => ({ x: parseFloat(p.x), y: parseFloat(p.y), z: parseFloat(p.z) })).filter((p: any) => isFinite(p.x) && isFinite(p.y) && isFinite(p.z));
}
/* domain: typed bounds win, otherwise the data's own bounds (table) or 0 to 10 (built-in surface) */
function domain(data: any) {
  const pts = data.mode === 'fn' ? [] : pointsOf(data);
  const lo = (k: string, d: number) => pts.length ? Math.min(...pts.map((p: any) => p[k])) : d, hi = (k: string, d: number) => pts.length ? Math.max(...pts.map((p: any) => p[k])) : d;
  let x0 = num(data.x0, lo('x', 0)), x1 = num(data.x1, hi('x', 10)), y0 = num(data.y0, lo('y', 0)), y1 = num(data.y1, hi('y', 10));
  if (!(x1 > x0)) x1 = x0 + 1;
  if (!(y1 > y0)) y1 = y0 + 1;
  return { x0, x1, y0, y1 };
}
function gridOf(data: any) {
  const d = domain(data), n = Math.max(20, Math.min(120, Math.round(num(data.res, 60))));
  const ny = Math.max(20, Math.round(n * (PH / PW)));
  if (data.mode === 'fn') return C().surfaceGrid(data.fn || 'peak', d.x0, d.x1, d.y0, d.y1, num(data.zlo, 0), num(data.zhi, 100), n, ny);
  const pts = pointsOf(data);
  return pts.length ? C().idw(pts, d.x0, d.x1, d.y0, d.y1, n, ny, num(data.power, 2), num(data.smooth, 0.05)) : null;
}
const decimals = (step: number) => step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step) - 1e-9));
const fmt = (v: number, dp: number) => (+v.toFixed(dp)).toString();

function ticks(a: number, b: number, n: number) {
  const st = C().niceStep(b - a, n), out: number[] = [];
  for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) out.push(+(+v).toPrecision(12));
  return { out, st };
}

function ContourSheet({ data }: { data: any }) {
  const g = gridOf(data);
  if (!g) return <EmptyHint text="Add at least three points, or switch to a built-in surface." />;
  const d = domain(data), c = C(), out: any[] = [];
  let k = 0; const K = () => 'c' + k++;
  const [zmin, zmax] = c.range(g);
  const step = num(data.step, 0), lv: number[] = c.levels(zmin, zmax, Math.round(num(data.count, 10)), step > 0 ? step : 0);
  const lstep = lv.length > 1 ? lv[1] - lv[0] : step > 0 ? step : Math.max(1e-6, (zmax - zmin) / 10), dp = decimals(lstep);
  const flip = !!data.invertY;
  const X = (x: number) => L + (x - d.x0) / (d.x1 - d.x0) * PW;
  const Y = (y: number) => flip ? T + (y - d.y0) / (d.y1 - d.y0) * PH : T + PH - (y - d.y0) / (d.y1 - d.y0) * PH;
  const ramp = data.ramp || 'viridis', rev = !!data.reverse;
  const t = (z: number) => zmax > zmin ? (z - zmin) / (zmax - zmin) : 0.5;
  const edges = [-Infinity, ...lv, Infinity];
  /* filled bands: one path each, coloured by the band's mid value */
  if (data.fill !== false) {
    for (let b = 0; b < edges.length - 1; b++) {
      const lo = edges[b], hi = edges[b + 1], mid = (isFinite(lo) ? lo : zmin) / 2 + (isFinite(hi) ? hi : zmax) / 2;
      const col = c.color(ramp, t(mid), rev);
      out.push(<path key={K()} className="ct-band" d={c.bandPath(g, lo, hi, X, Y)} style={{ fill: col, stroke: col }} />);
    }
  }
  out.push(<rect key={K()} className="ct-frame" x={L} y={T} width={PW} height={PH} />);
  /* axes */
  const xt = ticks(d.x0, d.x1, 7), yt = ticks(d.y0, d.y1, 6), xdp = decimals(xt.st), ydp = decimals(yt.st);
  xt.out.forEach(v => out.push(<g key={K()} className="ct-tick"><line x1={X(v)} y1={T + PH} x2={X(v)} y2={T + PH + 6} /><text className="tn-tlabel" x={X(v)} y={T + PH + 20} textAnchor="middle">{fmt(v, xdp)}</text></g>));
  yt.out.forEach(v => out.push(<g key={K()} className="ct-tick"><line x1={L - 6} y1={Y(v)} x2={L} y2={Y(v)} /><text className="tn-tlabel" x={L - 10} y={Y(v) + 4} textAnchor="end">{fmt(v, ydp)}</text></g>));
  if (data.xlabel) out.push(<text key={K()} className="ct-axis" x={L + PW / 2} y={T + PH + 46} textAnchor="middle">{data.xlabel}</text>);
  if (data.ylabel) out.push(<text key={K()} className="ct-axis" x={L - 50} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 ' + (L - 50) + ' ' + (T + PH / 2) + ')'}>{data.ylabel}</text>);
  /* lines and labels */
  if (data.lines !== false) {
    const every = Math.max(0, Math.round(num(data.index, 5)));
    lv.forEach((z, i) => {
      const polys = c.lines(g, z);
      if (!polys.length) return;
      const dstr = polys.map((p: any) => 'M' + p.pts.map((q: number[]) => X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join('L') + (p.closed ? 'Z' : '')).join('');
      const major = every > 0 && (Math.round((z - lv[0]) / lstep)) % every === 0;
      out.push(<path key={K()} className={'ct-line' + (major ? ' ct-major' : '')} d={dstr} style={data.ink ? { stroke: data.ink } : undefined} />);
      if (data.labels !== false && (major || every === 0 || data.labelAll)) {
        const sp = c.labelSpot(polys, X, Y, 70);
        if (sp) out.push(<text key={K()} className="ct-label" x={sp.x} y={sp.y + 4} textAnchor="middle" transform={'rotate(' + sp.angle.toFixed(1) + ' ' + sp.x.toFixed(1) + ' ' + sp.y.toFixed(1) + ')'}>{fmt(z, dp)}</text>);
      }
      void i;
    });
  }
  if (data.showPoints && data.mode !== 'fn') pointsOf(data).forEach((p: any) => out.push(<circle key={K()} className="ct-pt" cx={X(p.x)} cy={Y(p.y)} r={3} />));
  /* colour bar */
  if (data.fill !== false) {
    const bx = L + PW + 36, bh = PH;
    for (let i = 0; i < 60; i++) out.push(<rect key={K()} x={bx} y={T + bh - (i + 1) * bh / 60} width={14} height={bh / 60 + 0.6} style={{ fill: c.color(ramp, (i + 0.5) / 60, rev) }} />);
    out.push(<rect key={K()} className="ct-frame" x={bx} y={T} width={14} height={bh} />);
    const zt = ticks(zmin, zmax, 6), zdp = decimals(zt.st);
    zt.out.forEach(v => out.push(<g key={K()} className="ct-tick"><line x1={bx + 14} y1={T + bh - t(v) * bh} x2={bx + 19} y2={T + bh - t(v) * bh} /><text className="tn-tlabel" x={bx + 24} y={T + bh - t(v) * bh + 4}>{fmt(v, zdp)}</text></g>));
    const title = [data.zlabel, data.zunit ? '(' + data.zunit + ')' : ''].filter(Boolean).join(' ');
    if (title) out.push(<text key={K()} className="ct-axis" x={bx} y={T - 6}>{title}</text>);
  }
  return <g className="ct">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const fn = data.mode === 'fn', pts = data.points || [], d = domain(data);
  return (
    <>
      <S.Panel kicker="Surface" help={fn ? 'A built-in surface scaled between the lowest and highest value.' : 'Paste or type points (x, y, value). The grid between them is filled by inverse distance weighting.'}>
        <Seg value={fn ? 'fn' : 'table'} options={[['table', 'My points'], ['fn', 'Built-in surface']]} onChange={v => set({ mode: v })} />
        {fn ? <>
          <Select id="ct-fn" label="Shape" value={data.fn || 'peak'} options={FNS} onChange={v => set({ fn: v })} />
          <div className="mk-pair">
            <TextIn id="ct-zlo" label="Lowest value" value={data.zlo} placeholder="0" onChange={v => set({ zlo: v }, 'ct-zlo')} />
            <TextIn id="ct-zhi" label="Highest value" value={data.zhi} placeholder="100" onChange={v => set({ zhi: v }, 'ct-zhi')} />
          </div>
        </> : <Range id="ct-pow" label="Distance weighting power" value={num(data.power, 2)} min={1} max={4} step={0.5} onChange={v => set({ power: v }, 'ct-pow')} />}
        {fn ? null : <Range id="ct-smo" label="Smoothing (fraction of the plot size)" value={num(data.smooth, 0.05)} min={0} max={0.2} step={0.01} onChange={v => set({ smooth: v }, 'ct-smo')} />}
      </S.Panel>
      {fn ? null : <Rows id="ct-pts" kicker="Points" help="One row per measurement. Click a row to edit." rows={pts}
        cols={[{ key: 'x', label: 'x', type: 'num', w: '0.8fr' }, { key: 'y', label: 'y', type: 'num', w: '0.8fr' }, { key: 'z', label: data.zlabel ? String(data.zlabel).slice(0, 8) : 'value', type: 'num', w: '0.8fr' }]}
        blank={() => ({ x: '', y: '', z: '' })} addLabel="+ Add point" onChange={(rows, key) => set({ points: rows }, key)} />}
      <S.Panel kicker="Axes" help="Leave a bound empty to use the data's own range.">
        <div className="mk-pair">
          <TextIn id="ct-x0" label="x from" value={data.x0} placeholder={String(+d.x0.toPrecision(4))} onChange={v => set({ x0: v }, 'ct-x0')} />
          <TextIn id="ct-x1" label="x to" value={data.x1} placeholder={String(+d.x1.toPrecision(4))} onChange={v => set({ x1: v }, 'ct-x1')} />
        </div>
        <div className="mk-pair">
          <TextIn id="ct-y0" label="y from" value={data.y0} placeholder={String(+d.y0.toPrecision(4))} onChange={v => set({ y0: v }, 'ct-y0')} />
          <TextIn id="ct-y1" label="y to" value={data.y1} placeholder={String(+d.y1.toPrecision(4))} onChange={v => set({ y1: v }, 'ct-y1')} />
        </div>
        <TextIn id="ct-xl" label="x title" value={data.xlabel} placeholder="e.g. Distance east (km)" onChange={v => set({ xlabel: v }, 'ct-xl')} />
        <TextIn id="ct-yl" label="y title" value={data.ylabel} placeholder="e.g. Depth (m)" onChange={v => set({ ylabel: v }, 'ct-yl')} />
        <div className="mk-pair">
          <TextIn id="ct-zl" label="Value name" value={data.zlabel} placeholder="e.g. Temperature" onChange={v => set({ zlabel: v }, 'ct-zl')} />
          <TextIn id="ct-zu" label="Unit" value={data.zunit} placeholder="e.g. °C" onChange={v => set({ zunit: v }, 'ct-zu')} />
        </div>
        <Toggle on={!!data.invertY} label="Put y = 0 at the top (depth or time downward)" onChange={v => set({ invertY: v })} />
      </S.Panel>
      <S.Panel kicker="Contour levels" help="The level step is rounded to 1, 2 or 5 times a power of ten. Type a step to fix it.">
        <Range id="ct-n" label="About this many levels" value={num(data.count, 10)} min={3} max={25} onChange={v => set({ count: v }, 'ct-n')} />
        <TextIn id="ct-step" label="Fixed step (optional)" value={data.step} placeholder="auto" onChange={v => set({ step: v }, 'ct-step')} />
        <Range id="ct-res" label="Grid detail (columns)" value={num(data.res, 60)} min={20} max={120} onChange={v => set({ res: v }, 'ct-res')} />
      </S.Panel>
      <S.Panel kicker="Look">
        <Toggle on={data.fill !== false} label="Filled bands and colour bar" onChange={v => set({ fill: v })} />
        <Toggle on={data.lines !== false} label="Contour lines" onChange={v => set({ lines: v })} />
        <Toggle on={data.labels !== false} label="Level labels" onChange={v => set({ labels: v })} />
        <Toggle on={!!data.labelAll} label="Label every line (not only index lines)" onChange={v => set({ labelAll: v })} />
        <Range id="ct-idx" label="Bold index line every N levels (0 = none)" value={num(data.index, 5)} min={0} max={10} onChange={v => set({ index: v }, 'ct-idx')} />
        {fn ? null : <Toggle on={!!data.showPoints} label="Show the data points" onChange={v => set({ showPoints: v })} />}
        <Seg wrap value={data.ramp || 'viridis'} options={RAMPS} onChange={v => set({ ramp: v })} />
        <Toggle on={!!data.reverse} label="Reverse the colours" onChange={v => set({ reverse: v })} />
        <Swatches label="Line colour" value={data.ink} none="Ink" onChange={v => set({ ink: v })} />
      </S.Panel>
    </>
  );
}

const round = (v: number, dp: number) => +v.toFixed(dp);
/* a smooth sea floor: shelf, slope and a canyon, sampled on 7 x 6 stations with small position offsets */
function seaFloor() {
  const f = (x: number, y: number) => 30 + 1900 / (1 + Math.exp(-(x - 6 - 0.4 * Math.sin(y)) / 0.9)) + 450 * Math.exp(-Math.pow(y - 4.2, 2) / 0.5) * (x > 4 ? Math.min(1, (x - 4) / 3) : 0);
  const rows: any[] = [];
  for (let j = 0; j < 6; j++) for (let i = 0; i < 7; i++) {
    const x = round(Math.min(10, Math.max(0, i * 10 / 6 + ((i * 7 + j * 3) % 5 - 2) * 0.12)), 2), y = round(Math.min(8, Math.max(0, j * 8 / 5 + ((i * 5 + j * 11) % 5 - 2) * 0.12)), 2);
    rows.push({ x, y, z: Math.round(f(x, y) / 10) * 10 });
  }
  return rows;
}
/* temperature by month and depth: a summer thermocline over a cold deep layer */
function thermocline() {
  const rows: any[] = [];
  for (const m of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) for (const dz of [0, 10, 20, 30, 40, 60, 80, 100]) {
    const warm = 0.5 - 0.5 * Math.cos(2 * Math.PI * m / 12), top = 11 + 10 * warm, cold = 10.5;
    rows.push({ x: m, y: dz, z: round(cold + (top - cold) / (1 + Math.exp((dz - (12 + 18 * warm)) / 6)), 1) });
  }
  return rows;
}

export const contour: EditorDef = {
  id: 'contour-plot', num: '25', name: 'Contour plot', field: 'Methods',
  blurb: 'Lines and filled bands of equal value from a grid of measurements: sea-floor depth, temperature by depth and season, or a two-factor response.',
  hint: 'Edit the points on the left. The grid is filled between them by inverse distance weighting.',
  templates: [
    { name: 'Sea-floor depth', desc: 'Bathymetry from echo-sounder stations', title: 'Bathymetry of a continental shelf and slope',
      caption: 'Depth below the sea surface from 42 soundings, interpolated by inverse distance weighting. Contour interval 200 m.',
      data: { mode: 'table', points: seaFloor(), xlabel: 'Distance east (km)', ylabel: 'Distance north (km)', zlabel: 'Depth', zunit: 'm', ramp: 'ocean', count: 10, step: '200', res: 70, smooth: 0.06, index: 5, fill: true, lines: true, labels: true, showPoints: true } },
    { name: 'Temperature by depth and month', desc: 'A thermocline forming in summer', title: 'Seasonal thermocline in a temperate bay',
      caption: 'Water temperature by depth and month, with the surface layer warming and stratifying in summer.',
      data: { mode: 'table', points: thermocline(), xlabel: 'Month (0 = January)', ylabel: 'Depth (m)', zlabel: 'Temperature', zunit: '°C', ramp: 'heat', count: 10, res: 70, smooth: 0.01, index: 5, invertY: true, fill: true, lines: true, labels: true } },
    { name: 'Two-nutrient response', desc: 'A built-in surface with a response peak', title: 'Response to two nutrients',
      caption: 'Response as a percentage of the maximum across a range of intakes of two nutrients.',
      data: { mode: 'fn', fn: 'twopeaks', zlo: 20, zhi: 100, x0: '0', x1: '10', y0: '0', y1: '10', xlabel: 'Nutrient A intake (mg per day)', ylabel: 'Nutrient B intake (mg per day)', zlabel: 'Response', zunit: '% of maximum', ramp: 'viridis', count: 8, res: 70, index: 0, fill: true, lines: true, labels: true, labelAll: true } },
  ],
  blank: { mode: 'table', points: [{ x: 0, y: 0, z: 1 }, { x: 10, y: 0, z: 4 }, { x: 0, y: 10, z: 3 }, { x: 10, y: 10, z: 9 }, { x: 5, y: 5, z: 6 }], ramp: 'viridis', count: 8, res: 60, index: 5, fill: true, lines: true, labels: true },
  stats: d => { const g = gridOf(d); if (!g) return [[0, 'points']]; const [lo, hi] = C().range(g); return [[C().levels(lo, hi, Math.round(num(d.count, 10)), num(d.step, 0)).length, 'levels'], [d.mode === 'fn' ? 0 : pointsOf(d).length, 'points'], [+hi.toPrecision(4), 'highest value']]; },
  Controls,
  Render: ({ data }) => <ContourSheet data={data} />,
};
