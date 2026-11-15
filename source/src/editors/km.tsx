import { S } from '../sheet';
import { EmptyHint, num, Rows, Seg, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const V = () => (window as any).SDSurvival;
const SP = () => (window as any).SDSpecial;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';

/* sheet geometry */
const L = 80, T = 20, PW = 520, PH = 340, RISK = 20;

function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }

function model(data: any) {
  const gs = (data.groups || []).filter((g: any) => g && g.id);
  const groups = gs.map((g: any, i: number) => {
    const subs = (data.subjects || []).filter((s: any) => s.g === g.id).map((s: any) => ({ t: parseFloat(s.time), e: !!s.event })).filter((s: any) => isFinite(s.t) && s.t >= 0);
    return { ...g, color: g.color || col(i), subs, km: V().km(subs) };
  }).filter((g: any) => g.subs.length);
  const tmax = Math.max(0, ...groups.flatMap((g: any) => g.subs.map((s: any) => s.t)));
  const lr = groups.length >= 2 ? V().logrank(groups.map((g: any) => g.subs)) : null;
  return { groups, tmax, lr };
}

function KMSheet({ data }: { data: any }) {
  const { groups, tmax, lr } = model(data), v = V();
  if (!groups.length || tmax <= 0) return <EmptyHint text="Add a group and subjects with times above 0." />;
  const out: any[] = []; let n = 0; const key = () => 'k' + n++;
  const xs = num(data.xstep, 0) > 0 ? num(data.xstep, 0) : niceStep(tmax, 8), x1 = num(data.xmax, 0) > tmax ? num(data.xmax, 0) : Math.ceil(tmax / xs - 1e-9) * xs || xs;
  const pctOn = data.percent !== false, X = (t: number) => L + t / x1 * PW, Y = (s: number) => T + PH - s * PH;
  /* grid, frame and axes */
  for (let q = 0; q <= 5; q++) {
    const s = q / 5;
    if (data.grid && q > 0 && q < 5) out.push(<line key={key()} className="km-grid" x1={L} y1={Y(s)} x2={L + PW} y2={Y(s)} />);
    out.push(<g key={key()} className="km-tick"><line x1={L - 5} y1={Y(s)} x2={L} y2={Y(s)} /><text x={L - 9} y={Y(s) + 4} textAnchor="end">{pctOn ? Math.round(s * 100) : s.toFixed(1)}</text></g>);
  }
  const ticks: number[] = []; for (let t = 0; t <= x1 + 1e-9; t += xs) ticks.push(+t.toPrecision(10));
  ticks.forEach(t => out.push(<g key={key()} className="km-tick"><line x1={X(t)} y1={T + PH} x2={X(t)} y2={T + PH + 5} /><text x={X(t)} y={T + PH + 19} textAnchor="middle">{t}</text></g>));
  out.push(<rect key={key()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  out.push(<text key={key()} className="km-title" x={L + PW / 2} y={T + PH + 42} textAnchor="middle">{data.xlabel || 'Time'}</text>);
  out.push(<text key={key()} className="km-title" x={22} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 22 ' + (T + PH / 2) + ')'}>{data.ylabel || (pctOn ? 'Survival probability (%)' : 'Survival probability')}</text>);
  /* curves */
  groups.forEach((g: any) => {
    const st = g.km.steps, last = Math.min(x1, g.subs.reduce((m: number, s: any) => Math.max(m, s.t), 0));
    if (data.ci && st.length) {
      /* a step outline of one limit, from time 0 to the last follow-up time */
      const outline = (k: string) => { const pts: number[][] = [[0, 1]]; let prev = 1; st.forEach((q: any) => { if (q.t <= x1) { pts.push([q.t, prev], [q.t, q[k]]); prev = q[k]; } }); pts.push([last, prev]); return pts; };
      const ring = [...outline('hi'), ...outline('lo').reverse()];
      out.push(<polygon key={key()} className="km-ci" points={ring.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')} style={{ fill: g.color }} />);
    }
    let d = 'M' + X(0) + ' ' + Y(1);
    st.forEach((s: any) => { if (s.t <= x1) d += 'H' + X(s.t).toFixed(1) + 'V' + Y(s.s).toFixed(1); });
    d += 'H' + X(last).toFixed(1);
    out.push(<path key={key()} className="km-line" d={d} style={{ stroke: g.color }} />);
    if (data.censor !== false) g.km.cens.forEach((c: any) => { if (c.t <= x1) out.push(<path key={key()} className="km-cens" d={'M' + X(c.t) + ' ' + (Y(c.s) - 5) + 'V' + (Y(c.s) + 5)} style={{ stroke: g.color }} />); });
    if (data.median && g.km.median !== null && g.km.median <= x1) out.push(<g key={key()} className="km-med"><line x1={L} y1={Y(0.5)} x2={X(g.km.median)} y2={Y(0.5)} style={{ stroke: g.color }} /><line x1={X(g.km.median)} y1={Y(0.5)} x2={X(g.km.median)} y2={T + PH} style={{ stroke: g.color }} /></g>);
  });
  if (data.median) out.push(<text key={key()} className="km-note" x={L + 4} y={Y(0.5) - 4}>50%</text>);
  /* legend and log-rank */
  if (data.legend !== false) groups.forEach((g: any, i: number) => {
    const y = T + 18 + i * 18, x = L + PW - 8 - Math.max(...groups.map((q: any) => q.name.length)) * 7.2 - 34;
    out.push(<line key={key()} className="km-line" x1={x} y1={y - 4} x2={x + 22} y2={y - 4} style={{ stroke: g.color }} />);
    out.push(<text key={key()} className="km-name" x={x + 28} y={y}>{g.name}</text>);
  });
  if (data.pvalue !== false && lr) out.push(<text key={key()} className="km-note" x={L + 8} y={T + PH - 10}>Log-rank {SP().fmtP(lr.p)}</text>);
  /* number at risk */
  if (data.risk !== false) {
    const y0 = T + PH + 64;
    out.push(<text key={key()} className="km-name" x={L - 70} y={y0 - 14}>Number at risk</text>);
    groups.forEach((g: any, i: number) => {
      const y = y0 + i * RISK;
      out.push(<text key={key()} className="km-risk km-rname" x={L - 24} y={y + 4} textAnchor="end" style={{ fill: g.color }}>{g.name}</text>);
      ticks.forEach(t => out.push(<text key={key()} className="km-risk" x={X(t)} y={y + 4} textAnchor="middle">{v.atRisk(g.subs, t)}</text>));
    });
  }
  return <g className="km">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const groups = data.groups || [], subs = data.subjects || [], { groups: gm, lr } = model(data);
  const opts: [any, string][] = groups.map((g: any) => [g.id, g.name || g.id]);
  const nm = (x: any) => (x === null || x === undefined ? 'not reached' : +(+x).toPrecision(4));
  return (
    <>
      <S.Panel kicker="Axes" help="Time can be any unit. Leave the step and maximum blank to choose them from the data.">
        <TextIn id="km-xl" label="Time title" value={data.xlabel} placeholder="Time (months)" onChange={v => set({ xlabel: v }, 'km-xl')} />
        <TextIn id="km-yl" label="Survival title" value={data.ylabel} placeholder="Survival probability (%)" onChange={v => set({ ylabel: v }, 'km-yl')} />
        <div className="mk-pair">
          <TextIn id="km-xs" label="Tick step" value={data.xstep} placeholder="auto" onChange={v => set({ xstep: v }, 'km-xs')} />
          <TextIn id="km-xm" label="Time maximum" value={data.xmax} placeholder="auto" onChange={v => set({ xmax: v }, 'km-xm')} />
        </div>
        <Seg value={data.percent !== false ? 'pct' : 'prop'} options={[['pct', 'Percent'], ['prop', '0 to 1']]} onChange={v => set({ percent: v === 'pct' })} />
      </S.Panel>
      <Rows id="km-g" kicker="Groups" help="One curve per group." rows={groups}
        cols={[{ key: 'name', label: 'Name', w: '1.6fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ id: uid('g', groups.map((g: any) => g.id)), name: 'Group ' + (groups.length + 1), color: col(groups.length) })}
        addLabel="+ Add group" onChange={(r, kk) => set({ groups: r.map((x, i) => ({ ...x, id: x.id || uid('g', groups.map((g: any) => g.id)), color: x.color || col(i) })) }, kk)} />
      <Rows id="km-s" kicker="Subjects" badge={String(subs.length)} fold help="One row per subject: group, follow-up time, and a tick if the event happened. Leave it unticked if the subject was censored (lost to follow-up or event-free at the end)." rows={subs}
        cols={[{ key: 'g', label: 'Group', type: 'select', options: opts, w: '1.2fr' }, { key: 'time', label: 'Time', type: 'num', w: '0.8fr' }, { key: 'event', label: 'Event', type: 'check', placeholder: 'Ev.' }]}
        blank={() => ({ id: uid('p', subs.map((s: any) => s.id)), g: groups.length ? groups[0].id : '', time: '', event: true })}
        addLabel="+ Add subject" onChange={(r, kk) => set({ subjects: r.map(x => ({ ...x, id: x.id || uid('p', subs.map((s: any) => s.id)) })) }, kk)} />
      <S.Panel kicker="Look">
        <Toggle on={data.censor !== false} label="Tick marks for censored subjects" onChange={v => set({ censor: v })} />
        <Toggle on={!!data.ci} label="95% confidence bands" onChange={v => set({ ci: v })} />
        <Toggle on={!!data.median} label="Median survival lines" onChange={v => set({ median: v })} />
        <Toggle on={data.risk !== false} label="Number at risk table" onChange={v => set({ risk: v })} />
        <Toggle on={data.pvalue !== false} label="Log-rank p value" onChange={v => set({ pvalue: v })} />
        <Toggle on={data.legend !== false} label="Legend" onChange={v => set({ legend: v })} />
        <Toggle on={!!data.grid} label="Grid lines" onChange={v => set({ grid: v })} />
      </S.Panel>
      {gm.length ? <S.Panel kicker="Results" help="Median survival is the first time the curve falls to 0.5 or below. Confidence limits use the log-log transform.">
        <ul className="tr-results">
          {gm.map((g: any) => <li key={g.id}><b>{g.name}</b>: {g.subs.length} subjects, {g.km.events} events, median {nm(g.km.median)}</li>)}
          {lr ? <li>Log-rank χ² = {lr.chi2.toFixed(2)} on {lr.df} df, {SP().fmtP(lr.p)}</li> : null}
        </ul>
      </S.Panel> : null}
    </>
  );
}

/* a reproducible pseudo-random stream, so the simulated examples never change */
function rng(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; }
function simulate(id: string, count: number, rate: number, follow: number, seed: number) {
  const r = rng(seed), out: any[] = [];
  for (let i = 0; i < count; i++) { const t = -Math.log(r()) / rate, lost = r() < 0.12 ? r() * follow : Infinity, end = Math.min(t, follow, lost); out.push({ g: id, time: String(Math.round(end * 10) / 10), event: t <= follow && t <= lost }); }
  return out;
}
const label = (rows: any[]) => rows.map((r, i) => ({ id: 'p' + i, ...r }));
const mp = [[6, 1], [6, 1], [6, 1], [6, 0], [7, 1], [9, 0], [10, 1], [10, 0], [11, 0], [13, 1], [16, 1], [17, 0], [19, 0], [20, 0], [22, 1], [23, 1], [25, 0], [32, 0], [32, 0], [34, 0], [35, 0]];
const ctl = [1, 1, 2, 2, 3, 4, 4, 5, 5, 8, 8, 8, 8, 11, 11, 12, 12, 15, 17, 22, 23];

export const km: EditorDef = {
  id: 'kaplan-meier', num: '31', name: 'Kaplan-Meier survival curve', field: 'Evidence and clinical',
  blurb: 'Time-to-event curves with censoring marks, confidence bands, a number-at-risk table, median survival and the log-rank test.',
  hint: 'Enter one row per subject: group, time, and whether the event happened or the subject was censored.',
  templates: [
    { name: 'Leukaemia remission (6-MP trial)', desc: 'A classic teaching dataset, 42 patients', title: 'Remission times in leukaemia with 6-MP or placebo',
      caption: 'Weeks in remission for 21 patients on 6-mercaptopurine and 21 on placebo (Freireich et al., 1963; a standard teaching dataset). Tick marks are censored patients. Log-rank test.',
      data: { xlabel: 'Time in remission (weeks)', percent: true, risk: true, pvalue: true, censor: true, median: true,
        groups: [{ id: 'g0', name: '6-MP', color: col(0) }, { id: 'g1', name: 'Placebo', color: col(1) }],
        subjects: label([...mp.map(([t, e]) => ({ g: 'g0', time: String(t), event: !!e })), ...ctl.map(t => ({ g: 'g1', time: String(t), event: true }))]) } },
    { name: 'Two-arm trial (simulated)', desc: 'Simulated survival with confidence bands', title: 'Overall survival by treatment arm',
      caption: 'Simulated survival times for 40 patients per arm over 36 months, with 95% confidence bands. Sample data for practice.',
      data: { xlabel: 'Time since randomisation (months)', percent: true, risk: true, pvalue: true, censor: true, ci: true,
        groups: [{ id: 'g0', name: 'Treatment', color: col(0) }, { id: 'g1', name: 'Control', color: col(1) }],
        subjects: label([...simulate('g0', 40, 0.03, 36, 11), ...simulate('g1', 40, 0.055, 36, 23)]) } },
    { name: 'Three dose groups (simulated)', desc: 'Three curves and a 2 df log-rank test', title: 'Time to relapse by dose',
      caption: 'Simulated time to relapse in three dose groups of 30 patients over 24 months. Sample data for practice.',
      data: { xlabel: 'Time to relapse (months)', percent: true, risk: true, pvalue: true, censor: true,
        groups: [{ id: 'g0', name: 'High dose', color: col(0) }, { id: 'g1', name: 'Low dose', color: col(1) }, { id: 'g2', name: 'Placebo', color: col(2) }],
        subjects: label([...simulate('g0', 30, 0.025, 24, 5), ...simulate('g1', 30, 0.045, 24, 17), ...simulate('g2', 30, 0.09, 24, 29)]) } },
  ],
  blank: { xlabel: 'Time (months)', percent: true, risk: true, pvalue: true, censor: true,
    groups: [{ id: 'g0', name: 'Group A', color: col(0) }, { id: 'g1', name: 'Group B', color: col(1) }],
    subjects: label([...[3, 5, 8, 12, 14, 20].map(t => ({ g: 'g0', time: String(t), event: true })), ...[1, 2, 3, 5, 6, 9].map(t => ({ g: 'g1', time: String(t), event: true }))]) },
  stats: d => { const m = model(d); return [[m.groups.length, 'groups'], [m.groups.reduce((s: number, g: any) => s + g.subs.length, 0), 'subjects'], [m.groups.reduce((s: number, g: any) => s + g.km.events, 0), 'events']]; },
  Controls,
  Render: ({ data }) => <KMSheet data={data} />,
};
