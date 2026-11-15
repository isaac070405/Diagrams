import { S } from '../sheet';
import { EmptyHint, num, Seg, Spec, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const G = () => (window as any).SDGrowth;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const fm = (v: number, d = 3) => (isFinite(v) ? (+v.toPrecision(d)).toString() : 'n/a');
const sg = (v: number) => (v < 0 ? '−' : '') + fm(Math.abs(v));
const MODELS: [string, string][] = [['vb', 'von Bertalanffy'], ['gompertz', 'Gompertz'], ['logistic', 'Logistic']];
const PN: any = { vb: ['L∞', 'K', 't0'], gompertz: ['L∞', 'K', 'ti'], logistic: ['L∞', 'K', 'ti'] };

/* sheet geometry */
const L = 80, T = 20, PW = 520, PH = 380;
function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }

/* lines "age, size" or "age, size, group" */
function parse(text: string) {
  const out: { t: number; y: number; g: string }[] = [];
  String(text || '').split(/\r?\n/).forEach(line => { const f = line.trim().split(/[,\t;]+|\s+/).filter(s => s); if (f.length < 2) return; const t = parseFloat(f[0]), y = parseFloat(f[1]); if (isFinite(t) && isFinite(y)) out.push({ t, y, g: f.slice(2).join(' ') }); });
  return out;
}
function model(data: any) {
  const pts = parse(data.text), names: string[] = []; pts.forEach(p => { if (names.indexOf(p.g) < 0) names.push(p.g); });
  const mdl = data.model || 'vb';
  const groups = names.map((g, i) => {
    const xy = pts.filter(p => p.g === g).map(p => [p.t, p.y]);
    const all: any = {}; MODELS.forEach(([k]) => { all[k] = G().fit(xy, k); });
    return { name: g, color: col(i), pts: xy, fit: all[mdl], all };
  });
  return { pts, groups, mdl };
}

function GrowthSheet({ data }: { data: any }) {
  const { pts, groups, mdl } = model(data);
  if (pts.length < 5) return <EmptyHint text={'Paste at least 5 rows of age, size (and an optional group), one per line.'} />;
  const out: any[] = []; let n = 0; const k = () => 'g' + n++;
  const tmin = Math.min(...pts.map(p => p.t)), tmax = Math.max(...pts.map(p => p.t)), ext = num(data.extend, 0.08);
  const xa = Math.min(0, tmin), xb = tmax + (tmax - xa) * ext;
  const fitted = groups.filter(g => g.fit), ymaxFit = Math.max(0, ...fitted.map(g => (data.asym !== false ? Math.min(g.fit.q[0], Math.max(...g.pts.map((p: number[]) => p[1])) * 1.6) : 0)));
  const ya = 0, yb = Math.max(...pts.map(p => p.y), ymaxFit) * 1.08;
  const X = (v: number) => L + (v - xa) / (xb - xa) * PW, Y = (v: number) => T + PH - (v - ya) / (yb - ya) * PH;
  const xs = niceStep(xb - xa, 8), ys = niceStep(yb - ya, 7);
  for (let v = Math.ceil(xa / xs - 1e-9) * xs; v <= xb + 1e-9; v += xs) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={X(r)} y1={T + PH} x2={X(r)} y2={T + PH + 5} /><text x={X(r)} y={T + PH + 19} textAnchor="middle">{r}</text></g>); }
  for (let v = 0; v <= yb + 1e-9; v += ys) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>); }
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + 42} textAnchor="middle">{data.xlabel || 'Age'}</text>);
  out.push(<text key={k()} className="km-title" x={24} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 24 ' + (T + PH / 2) + ')'}>{data.ylabel || 'Size'}</text>);
  const inner: any[] = [];
  groups.forEach(g => {
    const f = g.fit; if (!f) return;
    const N = 100, grid = Array.from({ length: N + 1 }, (_, i) => xa + (xb - xa) * i / N);
    if (data.band !== false) { const up = grid.map(t => [t, f.predict(t) + f.half(t)]), dn = grid.map(t => [t, f.predict(t) - f.half(t)]).reverse(); if (up.every(p => isFinite(p[1]))) inner.push(<polygon key={k()} className="gc-band" points={[...up, ...dn].map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')} style={{ fill: g.color }} />); }
    if (data.asym !== false && f.q[0] < yb) inner.push(<line key={k()} className="gc-asym" x1={L} y1={Y(f.q[0])} x2={L + PW} y2={Y(f.q[0])} style={{ stroke: g.color }} />);
    inner.push(<path key={k()} className="gc-line" d={grid.map((t, i) => (i ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(f.predict(t)).toFixed(1)).join('')} style={{ stroke: g.color }} />);
  });
  groups.forEach(g => g.pts.forEach((p: number[]) => inner.push(<circle key={k()} className="gc-pt" cx={X(p[0])} cy={Y(p[1])} r={num(data.size, 3.8)} style={{ fill: g.color }} />)));
  out.push(<clipPath key={k()} id="gc-clip"><rect x={L} y={T} width={PW} height={PH} /></clipPath>, <g key={k()} clipPath="url(#gc-clip)">{inner}</g>);
  if (data.eq !== false) fitted.forEach((g, i) => { const f = g.fit, pn = PN[mdl]; out.push(<text key={k()} className="km-name" x={L + PW - 8} y={T + PH - 12 - (fitted.length - 1 - i) * 17} textAnchor="end" style={{ fill: g.color }}>{g.name ? g.name + ': ' : ''}{pn[0]} = {fm(f.q[0])}, K = {fm(f.q[1])}, {pn[2]} = {sg(f.q[2])}</text>); });
  if (groups.length > 1 && data.legend !== false) groups.forEach((g, i) => out.push(<circle key={k()} className="gc-pt" cx={L + 18} cy={T + 16 + i * 18} r={4.6} style={{ fill: g.color }} />, <text key={k()} className="km-name" x={L + 28} y={T + 20 + i * 18}>{g.name || 'all'}</text>));
  return <g className="gc">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const { pts, groups, mdl } = model(data), pn = PN[mdl];
  return (
    <>
      <Spec id="gc-text" label="Age, size and an optional group" rows={9} value={data.text || ''} help="One fish, cell count or measurement per row: age, size, then an optional group name (for example sex). Commas, tabs or spaces. Paste two or three spreadsheet columns straight in."
        onChange={v => set({ text: v }, 'gc-text')} placeholder={'2, 34.5, Female'} />
      <S.Panel kicker="Model" help="von Bertalanffy: size rises steeply and levels off at L∞ (t0 is the age at zero size). Gompertz and logistic are S-shaped with an inflection age ti. Each group is fitted separately. Compare models by AIC: the lowest is best, and a difference above about 2 matters.">
        <Seg wrap value={mdl} options={MODELS} onChange={v => set({ model: v })} />
      </S.Panel>
      <S.Panel kicker="Labels">
        <div className="mk-pair"><TextIn id="gc-xl" label="Age title" value={data.xlabel} placeholder="Age (years)" onChange={v => set({ xlabel: v }, 'gc-xl')} /><TextIn id="gc-yl" label="Size title" value={data.ylabel} placeholder="Length (cm)" onChange={v => set({ ylabel: v }, 'gc-yl')} /></div>
        <Toggle on={data.band !== false} label="95% confidence band for the curve" onChange={v => set({ band: v })} />
        <Toggle on={data.asym !== false} label="Asymptote L∞ (dashed)" onChange={v => set({ asym: v })} />
        <Toggle on={data.eq !== false} label="Parameters on the figure" onChange={v => set({ eq: v })} />
        <Toggle on={data.legend !== false} label="Group legend" onChange={v => set({ legend: v })} />
      </S.Panel>
      {pts.length >= 5 ? <S.Panel kicker="Results" help="Standard errors come from the Jacobian of the least squares fit. φ' = log10 K + 2 log10 L∞ is the growth performance index used to compare populations (von Bertalanffy).">
        <ul className="tr-results">
          {groups.map((g, i) => g.fit ? <li key={i}><b>{g.name || 'All data'}</b> (n = {g.fit.n}): {pn[0]} {fm(g.fit.q[0])} ± {fm(g.fit.se[0])}, K {fm(g.fit.q[1])} ± {fm(g.fit.se[1])}, {pn[2]} {sg(g.fit.q[2])} ± {fm(g.fit.se[2])}; R² {fm(g.fit.r2)}; residual SD {fm(g.fit.rmse)}{mdl === 'vb' ? "; φ' " + fm(g.fit.phi) : ''}. AIC: {MODELS.map(([k, name]) => name + ' ' + (g.all[k] ? fm(g.all[k].aic, 4) : 'n/a')).join(', ')}</li> : <li key={i}><b>{g.name || 'All data'}</b>: could not be fitted (needs 5 or more points over a spread of ages, or the model does not suit the data).</li>)}
        </ul>
      </S.Panel> : null}
    </>
  );
}

function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return { u, z: () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()) }; }
const r1 = (v: number) => Math.round(v * 10) / 10;
function vbData(n: number, seed: number, Linf: number, K: number, t0: number, sd: number, group = '', tmax = 12) { const g = rng(seed), out: string[] = []; for (let i = 0; i < n; i++) { const t = r1(0.5 + (tmax - 0.5) * g.u()); out.push(t + ', ' + r1(Math.max(1, Linf * (1 - Math.exp(-K * (t - t0))) + sd * g.z())) + (group ? ', ' + group : '')); } return out.join('\n'); }
function logisticData(seed: number) { const g = rng(seed), out: string[] = []; for (let t = 0; t <= 24; t += 1) for (let r = 0; r < 2; r++) out.push(t + ', ' + Math.round(1000 * Math.max(0.005, 1.4 / (1 + Math.exp(-0.45 * (t - 11))) * (1 + 0.05 * g.z()) + 0.01 * g.z())) / 1000); return out.join('\n'); }

export const growth: EditorDef = {
  id: 'growth-curve', num: '48', name: 'Growth curve', field: 'Ecology',
  blurb: 'Size at age fitted with von Bertalanffy, Gompertz or logistic curves, with L∞, K, standard errors, a 95% band and AIC to compare models.',
  hint: 'Paste age, size and an optional group on each row. The fit, the band and the AIC comparison are worked out for you.',
  templates: [
    { name: 'Fish length at age', desc: 'von Bertalanffy, 80 fish', title: 'Growth of a reef fish',
      caption: 'Total length (cm) at age (years) of 80 fish (simulated), fitted with a von Bertalanffy curve (simulated parameters: L∞ 85, K 0.22, t0 −0.6). The band is the 95% confidence interval of the curve. Sample data for practice.',
      data: { text: vbData(80, 4, 85, 0.22, -0.6, 4.5), model: 'vb', xlabel: 'Age (years)', ylabel: 'Total length (cm)' } },
    { name: 'Males and females', desc: 'Two groups, a curve each', title: 'Growth of male and female fish',
      caption: 'Length at age of 45 females and 45 males (simulated), each fitted with its own von Bertalanffy curve. Females reach a larger asymptotic length. Sample data for practice.',
      data: { text: vbData(45, 8, 92, 0.19, -0.7, 4.5, 'Female') + '\n' + vbData(45, 14, 74, 0.27, -0.5, 4, 'Male'), model: 'vb', xlabel: 'Age (years)', ylabel: 'Total length (cm)' } },
    { name: 'Bacterial growth', desc: 'Logistic curve of optical density', title: 'Growth of a bacterial culture',
      caption: 'Optical density (OD600) over 24 hours in duplicate cultures (simulated), fitted with a logistic curve. ti is the time of fastest growth. Sample data for practice.',
      data: { text: logisticData(6), model: 'logistic', xlabel: 'Time (hours)', ylabel: 'Optical density (OD600)', extend: 0.04 } },
  ],
  blank: { text: '1, 22.5\n1, 25.0\n2, 38.2\n2, 40.9\n3, 51.0\n3, 49.2\n4, 58.4\n5, 63.5\n5, 65.1\n6, 70.2\n7, 71.8\n8, 75.0\n9, 75.9\n10, 78.2', model: 'vb', xlabel: 'Age (years)', ylabel: 'Length (cm)' },
  stats: d => { const m = model(d); const f = m.groups.find(g => g.fit); return f ? [[m.pts.length, 'points'], [+f.fit.q[0].toPrecision(3), 'L∞'], [+f.fit.q[1].toPrecision(2), 'K']] : [[m.pts.length, 'points']]; },
  Controls,
  Render: ({ data }) => <GrowthSheet data={data} />,
};
