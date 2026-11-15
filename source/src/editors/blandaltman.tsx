import { S } from '../sheet';
import { EmptyHint, Rows, Seg, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const D = () => (window as any).SDDiag;
const SP = () => (window as any).SDSpecial;
const sig = (v: number) => +v.toPrecision(3);

/* sheet geometry */
const L = 80, T = 20, PW = 520, PH = 340;

function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }
function ticks(a: number, b: number, n: number) { const st = niceStep(b - a, n), out: number[] = []; for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) out.push(+v.toPrecision(10)); return out; }
const model = (data: any) => D().blandAltman(data.pairs || [], data.mode === 'pct' ? 'pct' : 'abs');

function BASheet({ data }: { data: any }) {
  const r = model(data);
  if (!r) return <EmptyHint text="Add at least 3 pairs of measurements with a value for both methods." />;
  const out: any[] = []; let n = 0; const k = () => 'b' + n++;
  const pct = data.mode === 'pct', unit = pct ? '%' : data.unit ? ' ' + data.unit : '';
  const xs = r.points.map((p: any) => p.m), x0r = Math.min(...xs), x1r = Math.max(...xs), padx = (x1r - x0r) * 0.06 || 1;
  const xa = x0r - padx, xb = x1r + padx;
  const dev = Math.max(Math.abs(r.hiCI.hi - r.bias), Math.abs(r.bias - r.loCI.lo), ...r.points.map((p: any) => Math.abs(p.d - r.bias))) * 1.08 || 1;
  const ya = r.bias - dev, yb = r.bias + dev;
  const X = (v: number) => L + (v - xa) / (xb - xa) * PW, Y = (v: number) => T + PH - (v - ya) / (yb - ya) * PH;
  const fm = (v: number) => (+v.toPrecision(3)).toString();
  /* confidence bands first, so everything draws on top */
  if (data.bands !== false) {
    [[r.biasCI, 'bias'], [r.hiCI, 'hi'], [r.loCI, 'lo']].forEach(([c]: any) => out.push(<rect key={k()} className="ba-band" x={L} y={Y(c.hi)} width={PW} height={Math.max(1, Y(c.lo) - Y(c.hi))} />));
  }
  ticks(xa, xb, 7).forEach(v => out.push(<g key={k()} className="km-tick"><line x1={X(v)} y1={T + PH} x2={X(v)} y2={T + PH + 5} /><text x={X(v)} y={T + PH + 19} textAnchor="middle">{v}</text></g>));
  ticks(ya, yb, 7).forEach(v => out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(v)} x2={L} y2={Y(v)} /><text x={L - 9} y={Y(v) + 4} textAnchor="end">{v}</text></g>));
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  if (ya < 0 && yb > 0) out.push(<line key={k()} className="ba-zero" x1={L} y1={Y(0)} x2={L + PW} y2={Y(0)} />);
  out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + 42} textAnchor="middle">{data.xlabel || 'Mean of ' + (data.nameA || 'Method A') + ' and ' + (data.nameB || 'Method B') + (pct || !data.unit ? '' : ' (' + data.unit + ')')}</text>);
  out.push(<text key={k()} className="km-title" x={22} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 22 ' + (T + PH / 2) + ')'}>{data.ylabel || (pct ? 'Difference (% of mean)' : (data.nameA || 'Method A') + ' − ' + (data.nameB || 'Method B') + (data.unit ? ' (' + data.unit + ')' : ''))}</text>);
  /* regression of the difference on the mean */
  if (data.trend) out.push(<line key={k()} className="ba-trend" x1={X(x0r)} y1={Y(r.intercept + r.slope * x0r)} x2={X(x1r)} y2={Y(r.intercept + r.slope * x1r)} />);
  r.points.forEach((p: any) => out.push(<circle key={k()} className="ba-pt" cx={X(p.m)} cy={Y(p.d)} r={3.6} />));
  out.push(<line key={k()} className="ba-bias" x1={L} y1={Y(r.bias)} x2={L + PW} y2={Y(r.bias)} />);
  out.push(<line key={k()} className="ba-loa" x1={L} y1={Y(r.loa.hi)} x2={L + PW} y2={Y(r.loa.hi)} />);
  out.push(<line key={k()} className="ba-loa" x1={L} y1={Y(r.loa.lo)} x2={L + PW} y2={Y(r.loa.lo)} />);
  if (data.labels !== false) {
    const lab = (y: number, a: string, b: string) => { out.push(<text key={k()} className="ba-lab" x={L + PW + 8} y={y - 2}>{a}</text>); out.push(<text key={k()} className="ba-lab ba-labv" x={L + PW + 8} y={y + 12}>{b}</text>); };
    lab(Y(r.loa.hi), '+1.96 SD', fm(r.loa.hi) + unit); lab(Y(r.bias), 'Mean difference', fm(r.bias) + unit); lab(Y(r.loa.lo), '−1.96 SD', fm(r.loa.lo) + unit);
  }
  return <g className="ba">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const pairs = data.pairs || [], r = model(data), pct = data.mode === 'pct', unit = pct ? '%' : data.unit ? ' ' + data.unit : '';
  const fm = (v: number) => (+v.toPrecision(3)).toString();
  const ci = (c: any) => '95% CI ' + fm(c.lo) + ' to ' + fm(c.hi);
  return (
    <>
      <S.Panel kicker="Methods" help="The plot shows A − B against the mean of A and B. Pick percent when the spread grows with the size of the measurement.">
        <div className="mk-pair">
          <TextIn id="ba-na" label="Method A" value={data.nameA} placeholder="Method A" onChange={v => set({ nameA: v }, 'ba-na')} />
          <TextIn id="ba-nb" label="Method B" value={data.nameB} placeholder="Method B" onChange={v => set({ nameB: v }, 'ba-nb')} />
        </div>
        <TextIn id="ba-un" label="Unit" value={data.unit} placeholder="kJ/day" onChange={v => set({ unit: v }, 'ba-un')} />
        <Seg value={pct ? 'pct' : 'abs'} options={[['abs', 'Difference'], ['pct', '% of the mean']]} onChange={v => set({ mode: v })} />
      </S.Panel>
      <Rows id="ba-p" kicker="Pairs" badge={String(pairs.length)} fold help="One row per participant: the same quantity measured by both methods." rows={pairs}
        cols={[{ key: 'a', label: data.nameA || 'A', type: 'num' }, { key: 'b', label: data.nameB || 'B', type: 'num' }]}
        blank={() => ({ id: uid('p', pairs.map((x: any) => x.id)), a: '', b: '' })}
        addLabel="+ Add pair" onChange={(rows, kk) => set({ pairs: rows.map(x => ({ ...x, id: x.id || uid('p', pairs.map((q: any) => q.id)) })) }, kk)} />
      <S.Panel kicker="Look">
        <Toggle on={data.bands !== false} label="95% CI bands on the bias and limits" onChange={v => set({ bands: v })} />
        <Toggle on={data.labels !== false} label="Labels with values" onChange={v => set({ labels: v })} />
        <Toggle on={!!data.trend} label="Trend line of difference on mean" onChange={v => set({ trend: v })} />
      </S.Panel>
      {r ? <S.Panel kicker="Results" help="Limits of agreement are bias ± 1.96 SD. Their CIs use Student's t and the Bland and Altman (1999) standard error. A slope away from 0 means the bias changes with the size of the measurement.">
        <ul className="tr-results">
          <li>{r.n} pairs</li>
          <li>Mean difference {fm(r.bias)}{unit} ({ci(r.biasCI)}), {SP().fmtP(r.pBias)}</li>
          <li>SD of differences {fm(r.sd)}{unit}</li>
          <li>Upper limit {fm(r.loa.hi)}{unit} ({ci(r.hiCI)})</li>
          <li>Lower limit {fm(r.loa.lo)}{unit} ({ci(r.loCI)})</li>
          <li>Slope of difference on mean {sig(r.slope)}, {SP().fmtP(r.pSlope)}</li>
        </ul>
      </S.Panel> : null}
    </>
  );
}

function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()); }
function pairsOf(n: number, seed: number, mu: number, sdTrue: number, bias: number, prop: number, sdErr: number, dp: number) {
  const z = rng(seed), f = Math.pow(10, dp), out: any[] = [];
  for (let i = 0; i < n; i++) { const truth = mu + sdTrue * z(); out.push({ id: 'p' + i, a: String(Math.round((truth * (1 + prop) + bias + sdErr * z()) * f) / f), b: String(Math.round((truth + sdErr * z() * 0.5) * f) / f) }); }
  return out;
}

export const blandaltman: EditorDef = {
  id: 'bland-altman', num: '34', name: 'Bland-Altman plot', field: 'Evidence and clinical',
  blurb: 'Agreement between two measurement methods: bias, 95% limits of agreement and their confidence intervals.',
  hint: 'Enter one row per participant with the value from each method.',
  templates: [
    { name: 'FFQ against food record', desc: 'Energy intake, bias grows with intake', title: 'Agreement between a food frequency questionnaire and a food record',
      caption: 'Bland-Altman plot of energy intake (kJ/day) from a food frequency questionnaire (A) and a 4-day food record (B) in 40 adults (simulated). Solid line: mean difference. Dashed lines: 95% limits of agreement. Sample data for practice.',
      data: { nameA: 'FFQ', nameB: 'Food record', unit: 'kJ/day', mode: 'abs', bands: true, labels: true, trend: true, pairs: pairsOf(40, 5, 8800, 1700, 400, 0.08, 900, 0) } },
    { name: 'Vitamin D, two assays', desc: 'Small bias, percent difference', title: 'Agreement between two serum 25-hydroxyvitamin D assays',
      caption: 'Bland-Altman plot of serum 25(OH)D (nmol/L) from two assays in 45 samples (simulated), as the difference in percent of the pair mean. Sample data for practice.',
      data: { nameA: 'Immunoassay', nameB: 'LC-MS/MS', unit: 'nmol/L', mode: 'pct', bands: true, labels: true, pairs: pairsOf(45, 9, 62, 20, 3, 0.02, 6, 1) } },
    { name: 'Body fat, BIA and DXA', desc: 'Percent body fat from two devices', title: 'Agreement between bioimpedance and DXA for body fat',
      caption: 'Bland-Altman plot of body fat (%) from bioimpedance analysis (A) and dual-energy X-ray absorptiometry (B) in 36 adults (simulated). Sample data for practice.',
      data: { nameA: 'BIA', nameB: 'DXA', unit: '%', mode: 'abs', bands: true, labels: true, pairs: pairsOf(36, 17, 28, 7, -1.5, 0, 2.6, 1) } },
  ],
  blank: { nameA: 'Method A', nameB: 'Method B', unit: '', mode: 'abs', bands: true, labels: true, pairs: [[10, 11], [12, 12.5], [15, 14], [18, 19.5], [20, 21], [24, 23], [27, 29], [30, 30.5]].map(([a, b], i) => ({ id: 'p' + i, a: String(a), b: String(b) })) },
  stats: d => { const r = model(d); return r ? [[r.n, 'pairs'], [+r.bias.toPrecision(3), 'bias'], [+r.sd.toPrecision(3), 'SD']] : [[0, 'pairs']]; },
  Controls,
  Render: ({ data }) => <BASheet data={data} />,
};
