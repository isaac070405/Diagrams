import { S } from '../sheet';
import { EmptyHint, num, Seg, Spec, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const C = () => (window as any).SDCalib;
const fm = (v: number) => (isFinite(v) ? (+v.toPrecision(4)).toString() : 'n/a');
const sg = (v: number) => (v < 0 ? '−' : '') + fm(Math.abs(v));
const MODELS: [string, string][] = [['linear', 'Straight line'], ['log', 'Semi-log (y vs log x)'], ['4pl', 'Four-parameter']];

/* sheet geometry */
const L = 84, T = 20, PW = 520, PH = 360;
function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }

/* standards: "concentration, signal"; unknowns: "name, signal". Replicates are repeated lines. */
function parseStd(text: string) { const out: number[][] = []; String(text || '').split(/\r?\n/).forEach(l => { const f = l.trim().split(/[,\t;]+|\s+/).filter(s => s); if (f.length >= 2) { const x = parseFloat(f[0]), y = parseFloat(f[1]); if (isFinite(x) && isFinite(y)) out.push([x, y]); } }); return out; }
function parseUnk(text: string) { const out: { name: string; y: number }[] = []; String(text || '').split(/\r?\n/).forEach(l => { const f = l.trim().split(/[,\t;]+/).map(s => s.trim()).filter(s => s); if (f.length >= 2) { const y = parseFloat(f[f.length - 1]); if (isFinite(y)) out.push({ name: f.slice(0, f.length - 1).join(' '), y }); } }); return out; }

function model(data: any) {
  const m = data.model || 'linear', std = parseStd(data.std), fit = std.length >= 3 ? C().fit(std, m) : null;
  const unk = parseUnk(data.unk).map(u => {
    const x = fit ? fit.invert(u.y) : NaN, ci = fit && fit.invertCI ? fit.invertCI(u.y) : null;
    const ys = fit ? fit.pts.map((p: number[]) => p[1]) : [], out = fit ? u.y < Math.min(...ys) || u.y > Math.max(...ys) : false;
    return { ...u, x, ci, out };
  });
  return { m, std, fit, unk };
}

function CalSheet({ data }: { data: any }) {
  const { m, fit, unk } = model(data);
  if (!fit) return <EmptyHint text={m === '4pl' ? 'Paste at least 5 standards with a concentration above 0 and a signal, one per line.' : 'Paste at least 3 standards as "concentration, signal", one per line.'} />;
  const out: any[] = []; let n = 0; const k = () => 'c' + n++;
  const logx = data.logx !== undefined ? !!data.logx : m !== 'linear';
  const xsd = fit.pts.map((p: number[]) => p[0]), xe = unk.filter(u => isFinite(u.x) && u.x > 0).map(u => u.x);
  let xlo = Math.min(...xsd, ...xe), xhi = Math.max(...xsd, ...xe);
  if (logx) { xlo = Math.pow(10, Math.floor(Math.log10(Math.max(xlo, 1e-12)) - 0.15)); xhi = Math.pow(10, Math.ceil(Math.log10(xhi) + 0.15)); } else { xlo = Math.min(0, xlo); xhi = xhi * 1.05; }
  const tx = (v: number) => (logx ? Math.log10(v) : v), X = (v: number) => L + (tx(v) - tx(xlo)) / (tx(xhi) - tx(xlo)) * PW;
  const ys = [...fit.pts.map((p: number[]) => p[1]), ...unk.map(u => u.y)];
  let ya = Math.min(...ys), yb = Math.max(...ys); const pad = (yb - ya) * 0.08 || 1; ya = Math.min(0, ya - pad) === 0 && ya >= 0 ? 0 : ya - pad; yb += pad;
  const Y = (v: number) => T + PH - (v - ya) / (yb - ya) * PH;
  /* axes */
  if (logx) { for (let e = Math.round(Math.log10(xlo)); e <= Math.round(Math.log10(xhi)); e++) { const v = Math.pow(10, e); out.push(<g key={k()} className="km-tick"><line x1={X(v)} y1={T + PH} x2={X(v)} y2={T + PH + 6} /><text x={X(v)} y={T + PH + 20} textAnchor="middle">{+v.toPrecision(6)}</text></g>); for (let q = 2; q < 10; q++) { const w = v * q; if (w < xhi) out.push(<line key={k()} className="cb-minor" x1={X(w)} y1={T + PH} x2={X(w)} y2={T + PH + 3} />); } } }
  else { const st = niceStep(xhi - xlo, 8); for (let v = Math.ceil(xlo / st - 1e-9) * st; v <= xhi + 1e-9; v += st) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={X(r)} y1={T + PH} x2={X(r)} y2={T + PH + 5} /><text x={X(r)} y={T + PH + 19} textAnchor="middle">{r}</text></g>); } }
  const yst = niceStep(yb - ya, 7); for (let v = Math.ceil(ya / yst - 1e-9) * yst; v <= yb + 1e-9; v += yst) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>); }
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + 44} textAnchor="middle">{data.xlabel || 'Concentration' + (data.unit ? ' (' + data.unit + ')' : '')}</text>);
  out.push(<text key={k()} className="km-title" x={24} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 24 ' + (T + PH / 2) + ')'}>{data.ylabel || 'Signal'}</text>);
  /* curve */
  const N = 160, path = Array.from({ length: N + 1 }, (_, i) => { const t = i / N, x = logx ? Math.pow(10, Math.log10(xlo) + t * (Math.log10(xhi) - Math.log10(xlo))) : xlo + t * (xhi - xlo); if (m !== 'linear' && x <= 0) return ''; return (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(fit.predict(x)).toFixed(1); }).join('');
  const clip = 'cb-clip';
  const inner: any[] = [<path key={k()} className="cb-curve" d={path} />];
  fit.pts.forEach((p: number[]) => inner.push(<circle key={k()} className="cb-std" cx={X(p[0])} cy={Y(p[1])} r={4.4} />));
  if (data.unknowns !== false) unk.slice(0, 16).forEach(u => {
    if (!isFinite(u.x) || !(u.x > 0 || m === 'linear')) return;
    const px = X(u.x), py = Y(u.y);
    inner.push(<path key={k()} className="cb-proj" d={`M${L} ${py}H${px}V${T + PH}`} />, <path key={k()} className="cb-unk" d={`M${px} ${py - 6}L${px + 6} ${py}L${px} ${py + 6}L${px - 6} ${py}Z`} />);
    if (data.names !== false && u.name) inner.push(<text key={k()} className="cb-name" x={px + 9} y={py - 7}>{u.name}</text>);
  });
  out.push(<clipPath key={k()} id={clip}><rect x={L} y={T} width={PW} height={PH} /></clipPath>, <g key={k()} clipPath={'url(#' + clip + ')'}>{inner}</g>);
  /* equation in the empty corner */
  if (data.eq !== false) {
    const rising = m === '4pl' ? fit.params.d > fit.params.a : fit.params.b > 0, ax = rising ? L + 10 : L + PW - 10, an = rising ? 'start' : 'end', p = fit.params;
    const eq = m === 'linear' ? 'y = ' + fm(p.a) + (p.b < 0 ? ' − ' : ' + ') + fm(Math.abs(p.b)) + ' x' : m === 'log' ? 'y = ' + fm(p.a) + (p.b < 0 ? ' − ' : ' + ') + fm(Math.abs(p.b)) + ' log10(x)' : 'y = d + (a − d) / (1 + (x / c)^b)';
    out.push(<text key={k()} className="sc-eq" x={ax} y={T + 20} textAnchor={an}>{eq}</text>);
    out.push(<text key={k()} className="km-note" x={ax} y={T + 38} textAnchor={an}>{m === '4pl' ? 'a = ' + fm(p.a) + ', b = ' + fm(p.b) + ', c = ' + fm(p.c) + ', d = ' + fm(p.d) : 'R² = ' + fm(fit.r2) + ', n = ' + fit.n}</text>);
    if (m === '4pl') out.push(<text key={k()} className="km-note" x={ax} y={T + 55} textAnchor={an}>R² = {fm(fit.r2)}, n = {fit.n}</text>);
    else if (isFinite(fit.efficiency)) out.push(<text key={k()} className="km-note" x={ax} y={T + 55} textAnchor={an}>Efficiency = {fm(fit.efficiency * 100)}%</text>);
  }
  return <g className="cb">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const { m, fit, unk } = model(data);
  return (
    <>
      <Spec id="cb-std" label="Standards: concentration, signal" rows={8} value={data.std || ''} help="One reading per line. Repeat a concentration for replicates. Commas, tabs or spaces. Paste two spreadsheet columns straight in."
        onChange={v => set({ std: v }, 'cb-std')} placeholder={'0.5, 0.12\n1, 0.21'} />
      <Spec id="cb-unk" label="Unknowns: name, signal" rows={5} value={data.unk || ''} help="Samples to read off the curve. A name, then the signal. Replicates can be averaged first."
        onChange={v => set({ unk: v }, 'cb-unk')} placeholder={'Sample 1, 0.84'} />
      <S.Panel kicker="Model" help="Straight line suits a narrow working range. Semi-log fits signal against log10 concentration, the usual choice for qPCR (slope gives efficiency). Four-parameter logistic suits the S-shaped curve of an ELISA and needs 5 or more standards.">
        <Seg wrap value={m} options={MODELS} onChange={v => set({ model: v })} />
        <Toggle on={data.logx !== undefined ? !!data.logx : m !== 'linear'} label="Log scale on the concentration axis" onChange={v => set({ logx: v })} />
      </S.Panel>
      <S.Panel kicker="Labels">
        <div className="mk-pair"><TextIn id="cb-un" label="Concentration unit" value={data.unit} placeholder="ng/mL" onChange={v => set({ unit: v }, 'cb-un')} /><TextIn id="cb-yl" label="Signal title" value={data.ylabel} placeholder="Absorbance (450 nm)" onChange={v => set({ ylabel: v }, 'cb-yl')} /></div>
        <TextIn id="cb-xl" label="Concentration title" value={data.xlabel} placeholder="Concentration" onChange={v => set({ xlabel: v }, 'cb-xl')} />
        <Toggle on={data.eq !== false} label="Equation and R² on the figure" onChange={v => set({ eq: v })} />
        <Toggle on={data.unknowns !== false} label="Unknowns marked on the curve" onChange={v => set({ unknowns: v })} />
        <Toggle on={data.names !== false} label="Names beside the unknowns" onChange={v => set({ names: v })} />
      </S.Panel>
      {fit ? <S.Panel kicker="Results" help="Readings outside the range of the standards are flagged because the curve is not checked there. For the straight-line and semi-log models the 95% interval is the classical inverse-prediction interval for one new reading.">
        <ul className="tr-results">
          <li>{m === '4pl' ? 'a (bottom or top) ' + fm(fit.params.a) + ', b (slope) ' + fm(fit.params.b) + ', c (mid-point) ' + fm(fit.params.c) + ', d ' + fm(fit.params.d) : 'Intercept ' + sg(fit.params.a) + ', slope ' + sg(fit.params.b)}; R² {fm(fit.r2)}; residual SD {fm(fit.rmse)}; n = {fit.n}</li>
          {isFinite(fit.efficiency) ? <li>Amplification efficiency {fm(fit.efficiency * 100)}% (10^(−1/slope) − 1)</li> : null}
          {unk.map((u, i) => <li key={i}><b>{u.name || 'Unknown ' + (i + 1)}</b>: signal {fm(u.y)} gives {isFinite(u.x) ? fm(u.x) + (data.unit ? ' ' + data.unit : '') : 'no value (beyond the curve)'}{u.ci ? ' (95% CI ' + fm(u.ci[0]) + ' to ' + fm(u.ci[1]) + ')' : ''}{u.out ? '. Outside the standards, so treat with care.' : ''}</li>)}
        </ul>
      </S.Panel> : null}
    </>
  );
}

const rows = (a: number[][]) => a.map(([x, y]) => x + ', ' + y).join('\n');
const four = (q: number[], x: number) => +(q[3] + (q[0] - q[3]) / (1 + Math.pow(x / q[2], q[1]))).toFixed(3);
const noise = [1.02, 0.98, 1.03, 0.97, 1.01, 0.99, 1.02, 0.98, 1.0, 1.01, 0.97, 1.03, 0.99, 1.0];
const elisaX = [15.6, 31.25, 62.5, 125, 250, 500, 1000, 2000];
const elisa = rows([...elisaX.map((x, i) => [x, +(four([0.06, 1.3, 420, 2.6], x) * noise[i]).toFixed(3)]), ...elisaX.map((x, i) => [x, +(four([0.06, 1.3, 420, 2.6], x) * noise[i + 6]).toFixed(3)])]);
const bcaX = [0, 25, 125, 250, 500, 750, 1000, 1500, 2000];
const bca = rows(bcaX.map((x, i) => [x, +(0.08 + 0.00092 * x - 0.00000012 * x * x + (i % 2 ? 0.006 : -0.006)).toFixed(3)]));
const qpcr = rows([[1e2, 31.8], [1e2, 32.0], [1e3, 28.5], [1e3, 28.3], [1e4, 25.2], [1e4, 25.0], [1e5, 21.7], [1e5, 21.9], [1e6, 18.4], [1e6, 18.3], [1e7, 15.0], [1e7, 15.1]]);

export const calib: EditorDef = {
  id: 'standard-curve', num: '43', name: 'Standard curve', field: 'Cells and measurement',
  blurb: 'Calibration curve from known standards (straight line, semi-log or four-parameter), with unknown samples read back and qPCR efficiency.',
  hint: 'Paste standards as concentration, signal and the unknowns as name, signal. The fit and the readings are worked out for you.',
  templates: [
    { name: 'ELISA, four-parameter', desc: 'S-shaped curve, duplicate standards', title: 'ELISA standard curve',
      caption: 'Four-parameter logistic fit to duplicate standards (simulated). Diamonds mark three samples read off the curve. Sample data for practice.',
      data: { model: '4pl', unit: 'pg/mL', ylabel: 'Absorbance (450 nm)', std: elisa, unk: 'Control serum, 0.38\nPatient A, 0.92\nPatient B, 1.71\nPatient C, 2.35' } },
    { name: 'BCA protein assay', desc: 'Straight line over a working range', title: 'BCA protein standard curve',
      caption: 'Bovine serum albumin standards (simulated) with a straight-line fit. Samples are read from the line. Sample data for practice.',
      data: { model: 'linear', logx: false, unit: 'µg/mL', ylabel: 'Absorbance (562 nm)', std: bca, unk: 'Lysate 1, 0.52\nLysate 2, 0.88\nLysate 3, 1.31' } },
    { name: 'qPCR efficiency', desc: 'Ct against log copy number', title: 'qPCR standard curve',
      caption: 'Cycle threshold (Ct) against log10 copy number for a 10-fold dilution series in duplicate (simulated). The slope gives the amplification efficiency. Sample data for practice.',
      data: { model: 'log', unit: 'copies', ylabel: 'Ct', xlabel: 'Template (copies)', std: qpcr, unk: 'Sample 1, 24.1\nSample 2, 19.6' } },
  ],
  blank: { model: 'linear', logx: false, unit: 'mg/L', ylabel: 'Signal', std: '0, 0.05\n1, 0.21\n2, 0.38\n4, 0.79\n8, 1.55', unk: 'Sample, 0.60' },
  stats: d => { const m = model(d); return m.fit ? [[m.fit.n, 'standards'], [+m.fit.r2.toFixed(3), 'R²'], [m.unk.length, 'unknowns']] : [[0, 'standards']]; },
  Controls,
  Render: ({ data }) => <CalSheet data={data} />,
};
