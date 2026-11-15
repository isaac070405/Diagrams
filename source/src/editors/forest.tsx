import { S } from '../sheet';
import { EmptyHint, num, Rows, Seg, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const F = () => (window as any).SDForest;
const SP = () => (window as any).SDSpecial;

/* sheet geometry */
const X0 = 8, PL = 250, PW = 270, RH = 25, TOP = 44;
const f2 = (v: number) => (isFinite(v) ? v.toFixed(2) : '');
const pct = (v: number) => (v * 100).toFixed(1);

function model(data: any) {
  const ratio = data.measure !== 'diff';
  const rows = (data.studies || []).map((s: any) => {
    const est = parseFloat(s.est), lo = parseFloat(s.lo), hi = parseFloat(s.hi), se = F().seFrom(lo, hi, ratio);
    const ok = isFinite(est) && se !== null && (!ratio || est > 0);
    return { id: s.id, name: s.name || '', est, lo, hi, se, ok, y: ok ? (ratio ? Math.log(est) : est) : NaN };
  }).filter((r: any) => r.ok);
  const res = rows.length ? F().pool(rows.map((r: any) => ({ y: r.y, se: r.se })), data.model === 'fixed' ? 'fixed' : 'random') : null;
  const back = (v: number) => (ratio ? Math.exp(v) : v);
  const pooled = res ? { est: back(res.est), lo: back(res.lo), hi: back(res.hi) } : null;
  return { ratio, rows, res, pooled };
}

function ForestSheet({ data }: { data: any }) {
  const { ratio, rows, res, pooled } = model(data), f = F();
  if (!rows.length || !res || !pooled) return <EmptyHint text="Add at least one study with an effect and an interval where the upper limit is above the lower." />;
  const out: any[] = []; let n = 0; const key = () => 'f' + n++;
  const allLo = Math.min(...rows.map((r: any) => r.lo), pooled.lo), allHi = Math.max(...rows.map((r: any) => r.hi), pooled.hi), nul = ratio ? 1 : 0;
  const tr = (v: number) => (ratio ? Math.log(v) : v);
  let a = tr(Math.min(allLo, nul)), b = tr(Math.max(allHi, nul));
  const pad = (b - a) * 0.06 || 0.5; a -= pad; b += pad;
  const X = (v: number) => PL + (tr(v) - a) / (b - a) * PW;
  const clampX = (x: number) => Math.max(PL, Math.min(PL + PW, x));
  const unit = data.effectLabel || (ratio ? 'Odds ratio' : 'Mean difference'), nr = rows.length, wmax = Math.max(...res.weights);
  const colX = PL + PW + 30, colW = colX + Math.max(150, (unit.length + 10) * 7.4);
  const showW = data.weights !== false;
  const fmt = (e: number, l: number, h: number) => f2(e) + ' [' + f2(l) + ', ' + f2(h) + ']';
  /* column heads */
  out.push(<text key={key()} className="fp-head" x={X0} y={TOP - 14}>Study</text>);
  out.push(<text key={key()} className="fp-head" x={colX} y={TOP - 14}>{unit} [95% CI]</text>);
  if (showW) out.push(<text key={key()} className="fp-head" x={colW + 44} y={TOP - 14} textAnchor="end">Weight</text>);
  out.push(<line key={key()} className="fp-rule" x1={X0} y1={TOP - 6} x2={colW + 50} y2={TOP - 6} />);
  /* null line */
  const yEnd = TOP + (nr + 1) * RH + 6;
  out.push(<line key={key()} className="fp-null" x1={X(nul)} y1={TOP - 4} x2={X(nul)} y2={yEnd} />);
  rows.forEach((r: any, i: number) => {
    const cy = TOP + i * RH + RH / 2, w = res.weights[i], s = 5 + 11 * Math.sqrt(w / wmax);
    out.push(<text key={key()} className="fp-name" x={X0} y={cy + 4}>{r.name}</text>);
    out.push(<line key={key()} className="fp-ci" x1={clampX(X(r.lo))} y1={cy} x2={clampX(X(r.hi))} y2={cy} />);
    out.push(<rect key={key()} className="fp-box" x={X(r.est) - s / 2} y={cy - s / 2} width={s} height={s} />);
    out.push(<text key={key()} className="fp-num" x={colX} y={cy + 4}>{fmt(r.est, r.lo, r.hi)}</text>);
    if (showW) out.push(<text key={key()} className="fp-num" x={colW + 44} y={cy + 4} textAnchor="end">{pct(w)}</text>);
  });
  /* pooled estimate */
  if (data.summary !== false) {
    const cy = TOP + nr * RH + RH / 2 + 4, h = 7;
    out.push(<line key={key()} className="fp-rule" x1={X0} y1={cy - RH / 2} x2={colW + 50} y2={cy - RH / 2} />);
    out.push(<text key={key()} className="fp-name fp-bold" x={X0} y={cy + 4}>Overall ({data.model === 'fixed' ? 'fixed effect' : 'random effects'})</text>);
    out.push(<polygon key={key()} className="fp-diamond" points={[[X(pooled.lo), cy], [X(pooled.est), cy - h], [X(pooled.hi), cy], [X(pooled.est), cy + h]].map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')} />);
    out.push(<text key={key()} className="fp-num fp-bold" x={colX} y={cy + 4}>{fmt(pooled.est, pooled.lo, pooled.hi)}</text>);
    if (showW) out.push(<text key={key()} className="fp-num fp-bold" x={colW + 44} y={cy + 4} textAnchor="end">100.0</text>);
  }
  /* axis */
  const ay = yEnd + 4;
  const tv: number[] = ratio ? f.ticks(Math.exp(a), Math.exp(b), true) : f.ticks(a, b, false);
  out.push(<line key={key()} className="fp-axis" x1={PL} y1={ay} x2={PL + PW} y2={ay} />);
  tv.forEach(v => out.push(<g key={key()} className="fp-tick"><line x1={X(v)} y1={ay} x2={X(v)} y2={ay + 5} /><text x={X(v)} y={ay + 18} textAnchor="middle">{+v.toPrecision(6)}</text></g>));
  if (data.left || data.right) {
    if (data.left) out.push(<text key={key()} className="fp-side" x={X(nul) - 6} y={ay + 36} textAnchor="end">← {data.left}</text>);
    if (data.right) out.push(<text key={key()} className="fp-side" x={X(nul) + 6} y={ay + 36}>{data.right} →</text>);
  }
  /* heterogeneity */
  if (data.hetero !== false) {
    const p = SP(), ty = ay + (data.left || data.right ? 58 : 40);
    out.push(<text key={key()} className="fp-note" x={X0} y={ty}>Heterogeneity: I² = {pct(res.I2)}%, τ² = {res.tau2.toFixed(3)}, Q = {res.Q.toFixed(2)} (df = {res.df}{res.df > 0 ? ', ' + p.fmtP(res.pQ) : ''})</text>);
    out.push(<text key={key()} className="fp-note" x={X0} y={ty + 16}>Test for overall effect: z = {res.z.toFixed(2)} ({p.fmtP(res.p)})</text>);
  }
  return <g className="fp">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const studies = data.studies || [], { ratio, rows, res, pooled } = model(data), skipped = studies.length - rows.length;
  return (
    <>
      <S.Panel kicker="Effect measure" help="Ratios (odds, risk, hazard) use a log axis with the null at 1 and are pooled on the log scale. Differences use a linear axis with the null at 0.">
        <Seg value={ratio ? 'ratio' : 'diff'} options={[['ratio', 'Ratio (null = 1)'], ['diff', 'Difference (null = 0)']]} onChange={v => set({ measure: v })} />
        <Seg value={data.model === 'fixed' ? 'fixed' : 'random'} options={[['random', 'Random effects'], ['fixed', 'Fixed effect']]} onChange={v => set({ model: v })} />
        <TextIn id="fp-unit" label="Measure name" value={data.effectLabel} placeholder={ratio ? 'Odds ratio' : 'Mean difference'} onChange={v => set({ effectLabel: v }, 'fp-unit')} />
        <div className="mk-pair">
          <TextIn id="fp-left" label="Favours (left)" value={data.left} placeholder="Treatment" onChange={v => set({ left: v }, 'fp-left')} />
          <TextIn id="fp-right" label="Favours (right)" value={data.right} placeholder="Control" onChange={v => set({ right: v }, 'fp-right')} />
        </div>
      </S.Panel>
      <Rows id="fp-st" kicker="Studies" help="One row per study: the effect and its 95% interval. The standard error is worked out from the interval. Rows with a bad interval are skipped." rows={studies}
        cols={[{ key: 'name', label: 'Study', w: '1.4fr' }, { key: 'est', label: 'Effect', type: 'num', w: '0.7fr' }, { key: 'lo', label: 'Lower', type: 'num', w: '0.7fr' }, { key: 'hi', label: 'Upper', type: 'num', w: '0.7fr' }]}
        blank={() => ({ id: uid('s', studies.map((s: any) => s.id)), name: 'Study ' + (studies.length + 1), est: '', lo: '', hi: '' })}
        addLabel="+ Add study" onChange={(r, kk) => set({ studies: r.map(x => ({ ...x, id: x.id || uid('s', studies.map((s: any) => s.id)) })) }, kk)} />
      <S.Panel kicker="Look">
        <Toggle on={data.summary !== false} label="Pooled estimate (diamond)" onChange={v => set({ summary: v })} />
        <Toggle on={data.weights !== false} label="Weight column" onChange={v => set({ weights: v })} />
        <Toggle on={data.hetero !== false} label="Heterogeneity and overall test" onChange={v => set({ hetero: v })} />
      </S.Panel>
      {res && pooled ? <S.Panel kicker="Results" help="Pooled on the analysis scale, then shown on the measure's own scale.">
        <ul className="tr-results">
          <li>Pooled {(data.effectLabel || (ratio ? 'odds ratio' : 'mean difference')).toLowerCase()} {f2(pooled.est)} (95% CI {f2(pooled.lo)} to {f2(pooled.hi)})</li>
          <li>I² = {pct(res.I2)}%, τ² = {res.tau2.toFixed(3)}, Q = {res.Q.toFixed(2)} on {res.df} df</li>
          <li>Overall effect z = {res.z.toFixed(2)}, {SP().fmtP(res.p)}</li>
          {skipped > 0 ? <li>{skipped} row{skipped > 1 ? 's' : ''} skipped: need an effect and an upper limit above the lower{ratio ? ', all above 0' : ''}</li> : null}
        </ul>
      </S.Panel> : null}
    </>
  );
}

const st = (rows: [string, number, number, number][]) => rows.map(([name, est, lo, hi], i) => ({ id: 's' + i, name, est: String(est), lo: String(lo), hi: String(hi) }));

export const forest: EditorDef = {
  id: 'forest-plot', num: '30', name: 'Forest plot', field: 'Evidence and clinical',
  blurb: 'Meta-analysis figure: each study as a box and interval, a pooled diamond, weights and heterogeneity (I², τ², Q).',
  hint: 'Enter each study\'s effect and 95% interval. The pooled estimate and heterogeneity are worked out for you.',
  templates: [
    { name: 'Odds ratios, random effects', desc: 'Six example trials, a ratio scale', title: 'Effect of an intervention on the odds of the outcome',
      caption: 'Example odds ratios with 95% confidence intervals from six trials, pooled by random effects (DerSimonian-Laird). Box area is proportional to weight. Sample values for practice.',
      data: { measure: 'ratio', model: 'random', effectLabel: 'Odds ratio', left: 'Favours treatment', right: 'Favours control',
        studies: st([['Chen 2015', 0.62, 0.38, 1.01], ['Okafor 2016', 0.81, 0.55, 1.19], ['Rossi 2018', 0.45, 0.26, 0.78], ['Smith 2019', 0.93, 0.61, 1.42], ['Tanaka 2020', 0.58, 0.40, 0.84], ['Walker 2022', 0.70, 0.49, 1.00]]) } },
    { name: 'Mean differences, fixed effect', desc: 'Five example trials, a linear scale', title: 'Effect of a diet on systolic blood pressure',
      caption: 'Example mean differences in systolic blood pressure (mmHg) with 95% confidence intervals, pooled by a fixed-effect model. Sample values for practice.',
      data: { measure: 'diff', model: 'fixed', effectLabel: 'Mean difference (mmHg)', left: 'Favours diet', right: 'Favours control',
        studies: st([['Adams 2014', -4.2, -7.9, -0.5], ['Baker 2016', -2.8, -5.6, 0.0], ['Cruz 2017', -6.1, -9.4, -2.8], ['Dubois 2019', -1.5, -4.9, 1.9], ['Evans 2021', -3.7, -6.2, -1.2]]) } },
    { name: 'Hazard ratios, with heterogeneity', desc: 'Four example trials that disagree', title: 'Hazard of death by treatment arm',
      caption: 'Example hazard ratios with 95% confidence intervals. The trials disagree, so random effects widen the pooled interval. Sample values for practice.',
      data: { measure: 'ratio', model: 'random', effectLabel: 'Hazard ratio', left: 'Favours treatment', right: 'Favours control',
        studies: st([['Trial A', 0.55, 0.42, 0.72], ['Trial B', 1.15, 0.88, 1.50], ['Trial C', 0.72, 0.51, 1.02], ['Trial D', 1.30, 0.95, 1.78]]) } },
  ],
  blank: { measure: 'ratio', model: 'random', effectLabel: 'Odds ratio', left: 'Favours treatment', right: 'Favours control', studies: st([['Study 1', 0.8, 0.5, 1.3], ['Study 2', 0.6, 0.4, 0.9], ['Study 3', 1.1, 0.7, 1.7]]) },
  stats: d => { const m = model(d); return m.res && m.pooled ? [[m.rows.length, 'studies'], [+m.pooled.est.toFixed(2), 'pooled'], [Math.round(m.res.I2 * 100), 'I² %']] : [[0, 'studies']]; },
  Controls,
  Render: ({ data }) => <ForestSheet data={data} />,
};
