import { S } from '../sheet';
import { EmptyHint, num, Seg, Spec, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const F = () => (window as any).SDForest;
const FU = () => (window as any).SDFunnel;
const SP = () => (window as any).SDSpecial;
const fm = (v: number) => (isFinite(v) ? (+v.toPrecision(3)).toString() : 'n/a');

/* sheet geometry */
const L = 80, T = 20, PW = 520, PH = 380;

/* lines "study, estimate, lower, upper": the last three numbers are the effect and its 95% interval */
function parse(text: string, ratio: boolean) {
  const out: { name: string; est: number; y: number; se: number }[] = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    const f = line.split(/[,\t;]+/).map(s => s.trim()).filter(s => s);
    if (f.length < 4) return;
    const est = parseFloat(f[f.length - 3]), lo = parseFloat(f[f.length - 2]), hi = parseFloat(f[f.length - 1]), se = F().seFrom(lo, hi, ratio);
    if (!isFinite(est) || se === null || (ratio && est <= 0)) return;
    out.push({ name: f.slice(0, f.length - 3).join(' '), est, y: ratio ? Math.log(est) : est, se });
  });
  return out;
}
function model(data: any) {
  const ratio = data.measure !== 'diff', rows = parse(data.text, ratio);
  const pool = rows.length >= 2 ? F().pool(rows.map(r => ({ y: r.y, se: r.se })), data.model === 'random' ? 'random' : 'fixed') : null;
  return { ratio, rows, pool, egger: rows.length >= 3 ? FU().egger(rows.map(r => ({ y: r.y, se: r.se }))) : null };
}

function FunnelSheet({ data }: { data: any }) {
  const { ratio, rows, pool, egger } = model(data), f = F();
  if (rows.length < 3 || !pool) return <EmptyHint text={'Paste at least 3 studies as "name, estimate, lower, upper", one per line.'} />;
  const out: any[] = []; let n = 0; const k = () => 'f' + n++;
  const c = pool.est, semax = Math.max(...rows.map(r => r.se)) * 1.08, lim = FU().limit(semax, 99) * (data.l99 ? 1 : 0.76);
  let dev = Math.max(lim, ...rows.map(r => Math.abs(r.y - c))) * 1.08;
  const xa = c - dev, xb = c + dev, X = (v: number) => L + (v - xa) / (xb - xa) * PW, Y = (se: number) => T + se / semax * PH;
  const unit = (v: number) => (ratio ? Math.exp(v) : v);
  const tv: number[] = ratio ? f.ticks(Math.exp(xa), Math.exp(xb), true) : f.ticks(xa, xb, false);
  tv.forEach(v => { const yv = ratio ? Math.log(v) : v; out.push(<g key={k()} className="km-tick"><line x1={X(yv)} y1={T + PH} x2={X(yv)} y2={T + PH + 5} /><text x={X(yv)} y={T + PH + 19} textAnchor="middle">{+v.toPrecision(6)}</text></g>); });
  const yst = semax > 1 ? 0.5 : semax > 0.5 ? 0.1 : 0.05; for (let v = 0; v <= semax + 1e-9; v += yst) { const r = +v.toPrecision(6); out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>); }
  const inner: any[] = [];
  const edge = (lvl: number, sgn: number) => [[c, 0], [c + sgn * FU().limit(semax, lvl), semax]];
  const tri = [...edge(95, -1), ...edge(95, 1).reverse()];
  if (data.shade !== false) inner.push(<polygon key={k()} className="fn-shade" points={tri.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')} />);
  [-1, 1].forEach(sg => { const e = edge(95, sg); inner.push(<line key={k()} className="fn-lim" x1={X(e[0][0])} y1={Y(0)} x2={X(e[1][0])} y2={Y(semax)} />); if (data.l99) { const g = edge(99, sg); inner.push(<line key={k()} className="fn-lim fn-99" x1={X(g[0][0])} y1={Y(0)} x2={X(g[1][0])} y2={Y(semax)} />); } });
  inner.push(<line key={k()} className="fn-centre" x1={X(c)} y1={T} x2={X(c)} y2={T + PH} />);
  const nul = ratio ? 0 : 0; if (Math.abs(nul - c) > 1e-9 && nul > xa && nul < xb) inner.push(<line key={k()} className="fn-null" x1={X(nul)} y1={T} x2={X(nul)} y2={T + PH} />);
  rows.forEach(r => { inner.push(<circle key={k()} className="fn-pt" cx={X(r.y)} cy={Y(r.se)} r={num(data.size, 4.6)} />); if (data.labels && r.name) inner.push(<text key={k()} className="fn-lab" x={X(r.y) + 7} y={Y(r.se) + 3}>{r.name}</text>); });
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  out.push(<clipPath key={k()} id="fn-clip"><rect x={L} y={T} width={PW} height={PH} /></clipPath>, <g key={k()} clipPath="url(#fn-clip)">{inner}</g>);
  out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + 42} textAnchor="middle">{data.xlabel || (ratio ? 'Effect (ratio, log scale)' : 'Effect')}</text>);
  out.push(<text key={k()} className="km-title" x={24} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 24 ' + (T + PH / 2) + ')'}>{data.ylabel || 'Standard error'}</text>);
  if (data.test !== false && egger) {
    /* short lines, so they stay clear of the funnel apex */
    const lines = ["Egger's test", 'intercept ' + fm(egger.intercept), '95% CI ' + fm(egger.ci[0]) + ' to ' + fm(egger.ci[1]), SP().fmtP(egger.p) + ', k = ' + egger.k + (egger.low ? ' (low power)' : '')];
    lines.forEach((t, i) => out.push(<text key={k()} className={i ? 'km-note' : 'km-note fn-bold'} x={L + 8} y={T + 17 + i * 15}>{t}</text>));
  }
  void unit;
  return <g className="fn">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const { ratio, rows, pool, egger } = model(data);
  return (
    <>
      <Spec id="fn-text" label="Studies: name, estimate, lower, upper" rows={10} value={data.text || ''} help="One study per line: its name, the effect and its 95% confidence interval. Commas, tabs or semicolons. The standard error is worked out from the interval."
        onChange={v => set({ text: v }, 'fn-text')} placeholder={'Smith 2019, 0.80, 0.55, 1.16'} />
      <S.Panel kicker="Effect measure" help="Ratios (odds, risk, hazard) are plotted on a log scale with the centre line from the log-scale pooled estimate. Differences use a linear scale.">
        <Seg value={ratio ? 'ratio' : 'diff'} options={[['ratio', 'Ratio'], ['diff', 'Difference']]} onChange={v => set({ measure: v })} />
        <Seg value={data.model === 'random' ? 'random' : 'fixed'} options={[['fixed', 'Centre: fixed effect'], ['random', 'Random effects']]} onChange={v => set({ model: v })} />
        <TextIn id="fn-xl" label="x title" value={data.xlabel} placeholder={ratio ? 'Effect (ratio, log scale)' : 'Effect'} onChange={v => set({ xlabel: v }, 'fn-xl')} />
      </S.Panel>
      <S.Panel kicker="Look">
        <Toggle on={data.shade !== false} label="Shade the 95% funnel" onChange={v => set({ shade: v })} />
        <Toggle on={!!data.l99} label="Add 99% limits" onChange={v => set({ l99: v })} />
        <Toggle on={!!data.labels} label="Study names beside points" onChange={v => set({ labels: v })} />
        <Toggle on={data.test !== false} label="Egger's test on the figure" onChange={v => set({ test: v })} />
      </S.Panel>
      {pool ? <S.Panel kicker="Results" help="Egger's test regresses each study's effect divided by its standard error on its precision. An intercept away from 0 means small studies differ from large ones. That can be publication bias, but also real heterogeneity, chance or the choice of effect measure.">
        <ul className="tr-results">
          <li>{rows.length} studies. Pooled ({data.model === 'random' ? 'random effects' : 'fixed effect'}) {fm(ratio ? Math.exp(pool.est) : pool.est)} (95% CI {fm(ratio ? Math.exp(pool.lo) : pool.lo)} to {fm(ratio ? Math.exp(pool.hi) : pool.hi)}), I² = {fm(pool.I2 * 100)}%</li>
          {egger ? <li>Egger: intercept {fm(egger.intercept)} ± {fm(egger.se)} (95% CI {fm(egger.ci[0])} to {fm(egger.ci[1])}), {SP().fmtP(egger.p)}, slope {fm(egger.slope)}, {egger.df} df</li> : <li>Egger's test needs at least 3 studies.</li>}
          {egger && egger.low ? <li className="pr-warn">Fewer than 10 studies: the test has low power, so a high p does not rule out asymmetry.</li> : null}
        </ul>
      </S.Panel> : null}
    </>
  );
}

function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return { u, z: () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()) }; }
function sim(n: number, seed: number, theta: number, bias: number, ratio: boolean) {
  const g = rng(seed), out: string[] = [];
  for (let i = 0; i < n; i++) {
    const se = 0.07 + 0.43 * g.u() * g.u() ** 0.5, y = theta + bias * se + se * g.z(), lo = y - 1.96 * se, hi = y + 1.96 * se, e = (v: number) => Math.round((ratio ? Math.exp(v) : v) * 100) / 100;
    out.push('Study ' + String.fromCharCode(65 + i % 26) + (i >= 26 ? '2' : '') + ', ' + e(y) + ', ' + e(lo) + ', ' + e(hi));
  }
  return out.join('\n');
}

export const funnel: EditorDef = {
  id: 'funnel-plot', num: '44', name: 'Funnel plot', field: 'Evidence and clinical',
  blurb: 'Meta-analysis check for small-study effects: effect against standard error with 95% limits, and Egger\'s test for asymmetry.',
  hint: 'Paste each study as name, estimate, lower, upper. The funnel and Egger\'s test are worked out for you.',
  templates: [
    { name: 'Symmetric funnel', desc: '18 studies, no small-study effect', title: 'Funnel plot of 18 trials',
      caption: 'Odds ratios from 18 trials (simulated) against their standard errors. Points scatter evenly about the pooled estimate and inside the 95% limits. Egger\'s test is not significant. Sample data for practice.',
      data: { measure: 'ratio', model: 'fixed', text: sim(18, 4, Math.log(0.75), 0, true) } },
    { name: 'Asymmetric funnel', desc: 'Small studies show bigger effects', title: 'Funnel plot with small-study effects',
      caption: 'Odds ratios from 18 trials (simulated) in which small, imprecise trials report larger benefits. The gap on the right of the funnel base and a significant Egger intercept are the typical signs. Sample data for practice.',
      data: { measure: 'ratio', model: 'fixed', labels: false, text: sim(18, 9, Math.log(0.9), -3, true) } },
    { name: 'Mean differences', desc: 'A linear scale, 14 studies', title: 'Funnel plot of mean differences in blood pressure',
      caption: 'Mean differences in systolic blood pressure (mmHg) from 14 trials (simulated) against their standard errors. Sample data for practice.',
      data: { measure: 'diff', model: 'random', xlabel: 'Mean difference (mmHg)', text: sim(14, 15, -3, 0.4, false).replace(/(, )(-?[\d.]+)(, )(-?[\d.]+)(, )(-?[\d.]+)$/gm, (_m, a, b, c, d, e, f) => a + (+b * 12).toFixed(2) + c + (+d * 12).toFixed(2) + e + (+f * 12).toFixed(2)) } },
  ],
  blank: { measure: 'ratio', model: 'fixed', labels: true, text: 'Study A, 0.70, 0.45, 1.09\nStudy B, 0.82, 0.60, 1.12\nStudy C, 0.55, 0.30, 1.01\nStudy D, 0.95, 0.74, 1.22\nStudy E, 0.78, 0.66, 0.92\nStudy F, 0.62, 0.20, 1.92' },
  stats: d => { const m = model(d); return m.egger ? [[m.rows.length, 'studies'], [+m.egger.intercept.toFixed(2), 'Egger b0'], [+m.egger.p.toFixed(3), 'p']] : [[m.rows.length, 'studies']]; },
  Controls,
  Render: ({ data }) => <FunnelSheet data={data} />,
};
