import { S } from '../sheet';
import { EmptyHint, Rows, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const D = () => (window as any).SDDiag;
const SP = () => (window as any).SDSpecial;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const key = (id: string) => 'v_' + id;
const short = (n: any) => String(n || '').slice(0, 7);
const f2 = (v: number) => v.toFixed(2);
const f3 = (v: number) => v.toFixed(3);
const sig = (v: number) => +v.toPrecision(3);

/* sheet geometry: a square plot */
const L = 70, T = 20, PS = 400;

function model(data: any) {
  const subs = data.subjects || [];
  const markers = (data.markers || []).filter((m: any) => m && m.id).map((m: any, i: number) => {
    const pos = subs.filter((s: any) => s.case).map((s: any) => s[key(m.id)]), neg = subs.filter((s: any) => !s.case).map((s: any) => s[key(m.id)]);
    return { ...m, color: m.color || col(i), roc: D().roc(pos, neg, !!m.low) };
  }).filter((m: any) => m.roc);
  return { markers };
}

function RocSheet({ data }: { data: any }) {
  const { markers } = model(data);
  if (!markers.length) return <EmptyHint text="Add a marker and subjects: at least one case (ticked) and one non-case with values." />;
  const out: any[] = []; let n = 0; const k = () => 'r' + n++;
  const X = (v: number) => L + v * PS, Y = (v: number) => T + PS - v * PS;
  for (let q = 0; q <= 5; q++) {
    const v = q / 5;
    if (data.grid && q > 0 && q < 5) { out.push(<line key={k()} className="km-grid" x1={X(v)} y1={T} x2={X(v)} y2={T + PS} />); out.push(<line key={k()} className="km-grid" x1={L} y1={Y(v)} x2={L + PS} y2={Y(v)} />); }
    out.push(<g key={k()} className="km-tick"><line x1={X(v)} y1={T + PS} x2={X(v)} y2={T + PS + 5} /><text x={X(v)} y={T + PS + 19} textAnchor="middle">{v.toFixed(1)}</text></g>);
    out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(v)} x2={L} y2={Y(v)} /><text x={L - 9} y={Y(v) + 4} textAnchor="end">{v.toFixed(1)}</text></g>);
  }
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PS} height={PS} />);
  if (data.diag !== false) out.push(<line key={k()} className="rc-chance" x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} />);
  out.push(<text key={k()} className="km-title" x={L + PS / 2} y={T + PS + 42} textAnchor="middle">{data.xlabel || '1 − Specificity (false positive rate)'}</text>);
  out.push(<text key={k()} className="km-title" x={22} y={T + PS / 2} textAnchor="middle" transform={'rotate(-90 22 ' + (T + PS / 2) + ')'}>{data.ylabel || 'Sensitivity (true positive rate)'}</text>);
  markers.forEach((m: any, i: number) => {
    const pts = m.roc.points.map((p: any) => X(p.fpr).toFixed(1) + ',' + Y(p.tpr).toFixed(1)).join(' ');
    if (data.fill && markers.length === 1) out.push(<polygon key={k()} className="rc-area" points={X(0) + ',' + Y(0) + ' ' + pts + ' ' + X(1) + ',' + Y(0)} style={{ fill: m.color }} />);
    out.push(<polyline key={k()} className="km-line" points={pts} style={{ stroke: m.color }} />);
    if (data.cutoff !== false && m.roc.best) {
      const b = m.roc.best, px = X(1 - b.spec), py = Y(b.sens);
      out.push(<circle key={k()} className="rc-best" cx={px} cy={py} r={5} style={{ stroke: m.color }} />);
      if (markers.length === 1) out.push(<text key={k()} className="km-note" x={px + 10} y={py + 16}>Cutoff {sig(b.cut)}: sensitivity {Math.round(b.sens * 100)}%, specificity {Math.round(b.spec * 100)}%</text>);
    }
  });
  if (data.legend !== false) {
    const lx = L + PS - 8, w = Math.max(...markers.map((m: any) => (m.name + ' AUC ' + f2(m.roc.auc) + ' (' + f2(m.roc.lo) + ' to ' + f2(m.roc.hi) + ')').length)) * 6.6 + 40;
    markers.forEach((m: any, i: number) => {
      const y = T + PS - 18 - (markers.length - 1 - i) * 18, x = lx - w;
      out.push(<line key={k()} className="km-line" x1={x} y1={y - 4} x2={x + 22} y2={y - 4} style={{ stroke: m.color }} />);
      out.push(<text key={k()} className="km-name" x={x + 28} y={y}>{m.name} AUC {f2(m.roc.auc)} ({f2(m.roc.lo)} to {f2(m.roc.hi)})</text>);
    });
  }
  return <g className="rc">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const markers = data.markers || [], subs = data.subjects || [], { markers: mm } = model(data);
  const nCase = subs.filter((s: any) => s.case).length;
  return (
    <>
      <Rows id="rc-m" kicker="Markers" help="Each marker or score gets its own curve. Tick Low if lower values mean disease (for example ferritin and iron deficiency)." rows={markers}
        cols={[{ key: 'name', label: 'Name', w: '1.4fr' }, { key: 'color', label: 'Colour', type: 'color' }, { key: 'low', label: 'Low = disease', type: 'check', placeholder: 'Low' }]}
        blank={() => ({ id: uid('m', markers.map((m: any) => m.id)), name: 'Marker ' + (markers.length + 1), color: col(markers.length), low: false })}
        addLabel="+ Add marker" onChange={(r, kk) => set({ markers: r.map((x, i) => ({ ...x, id: x.id || uid('m', markers.map((m: any) => m.id)), color: x.color || col(i) })) }, kk)} />
      <Rows id="rc-s" kicker="Subjects" badge={nCase + ' / ' + subs.length} fold help="One row per subject: tick Case if they have the condition, then a value for each marker. The badge shows cases out of subjects." rows={subs}
        cols={[{ key: 'case', label: 'Case', type: 'check', placeholder: 'Case' }, ...markers.map((m: any) => ({ key: key(m.id), label: short(m.name), type: 'num' as const, w: '1fr' }))]}
        blank={() => ({ id: uid('p', subs.map((s: any) => s.id)), case: false })}
        addLabel="+ Add subject" onChange={(r, kk) => set({ subjects: r.map(x => ({ ...x, id: x.id || uid('p', subs.map((s: any) => s.id)) })) }, kk)} />
      <S.Panel kicker="Look">
        <Toggle on={data.diag !== false} label="Chance line (AUC 0.5)" onChange={v => set({ diag: v })} />
        <Toggle on={data.cutoff !== false} label="Mark the best cutoff (Youden)" onChange={v => set({ cutoff: v })} />
        <Toggle on={!!data.fill} label="Shade the area (one marker)" onChange={v => set({ fill: v })} />
        <Toggle on={data.legend !== false} label="Legend with AUC" onChange={v => set({ legend: v })} />
        <Toggle on={!!data.grid} label="Grid lines" onChange={v => set({ grid: v })} />
      </S.Panel>
      {mm.length ? <S.Panel kicker="Results" help="AUC by the trapezoid rule. 95% CI from the Hanley and McNeil standard error. The p value tests AUC = 0.5. The best cutoff maximises sensitivity + specificity − 1 (Youden). Curves are not compared formally.">
        <ul className="tr-results">
          {mm.map((m: any) => <li key={m.id}><b>{m.name}</b>: AUC {f3(m.roc.auc)} (95% CI {f3(m.roc.lo)} to {f3(m.roc.hi)}), {SP().fmtP(m.roc.p)}; best cutoff {sig(m.roc.best.cut)} ({Math.round(m.roc.best.sens * 100)}% sensitive, {Math.round(m.roc.best.spec * 100)}% specific); {m.roc.n1} cases, {m.roc.n0} non-cases</li>)}
        </ul>
      </S.Panel> : null}
    </>
  );
}

/* reproducible normal draws */
function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()); }
const r1 = (v: number) => String(Math.round(v * 10) / 10);
function cohort(nCase: number, nCtl: number, seed: number, markers: { id: string; muCase: number; muCtl: number; sd: number }[]) {
  const z = rng(seed), rows: any[] = [];
  for (let i = 0; i < nCase + nCtl; i++) {
    const isCase = i < nCase, shared = z(), row: any = { id: 'p' + i, case: isCase };
    markers.forEach(m => { row[key(m.id)] = r1((isCase ? m.muCase : m.muCtl) + m.sd * (0.6 * shared + 0.8 * z())); });
    rows.push(row);
  }
  return rows;
}

export const roc: EditorDef = {
  id: 'roc-curve', num: '33', name: 'ROC curve', field: 'Evidence and clinical',
  blurb: 'Diagnostic accuracy: sensitivity against 1 − specificity for one or more markers, with AUC, its 95% CI and the best cutoff.',
  hint: 'Enter one row per subject: tick Case if they have the condition, then a value for each marker.',
  templates: [
    { name: 'One biomarker', desc: '100 simulated subjects', title: 'Diagnostic accuracy of a biomarker',
      caption: 'ROC curve for a biomarker in 40 cases and 60 non-cases (simulated). The circle marks the cutoff that maximises sensitivity + specificity − 1. Sample data for practice.',
      data: { markers: [{ id: 'm0', name: 'Biomarker', color: col(0), low: false }], cutoff: true, subjects: cohort(40, 60, 7, [{ id: 'm0', muCase: 5.4, muCtl: 4.0, sd: 1.3 }]) } },
    { name: 'Two screening tools', desc: 'Two markers on the same people', title: 'Comparison of two screening measures',
      caption: 'ROC curves for waist circumference and BMI as screens for metabolic syndrome in 45 cases and 55 non-cases (simulated). Sample data for practice.',
      data: { markers: [{ id: 'm0', name: 'Waist (cm)', color: col(0), low: false }, { id: 'm1', name: 'BMI', color: col(1), low: false }], cutoff: true,
        subjects: cohort(45, 55, 21, [{ id: 'm0', muCase: 99, muCtl: 88, sd: 9 }, { id: 'm1', muCase: 29.5, muCtl: 26, sd: 3.8 }]) } },
    { name: 'Low value means disease', desc: 'Serum ferritin and iron deficiency', title: 'Serum ferritin to detect iron deficiency',
      caption: 'ROC curve for serum ferritin (ug/L) in 35 iron-deficient and 65 iron-replete participants (simulated). Low values indicate deficiency, so the marker is flipped. Sample data for practice.',
      data: { markers: [{ id: 'm0', name: 'Ferritin', color: col(0), low: true }], cutoff: true, fill: true, subjects: cohort(35, 65, 3, [{ id: 'm0', muCase: 18, muCtl: 42, sd: 14 }]) } },
  ],
  blank: { markers: [{ id: 'm0', name: 'Marker', color: col(0), low: false }], cutoff: true,
    subjects: [1, 2, 2, 3, 4, 5].map((v, i) => ({ id: 'p' + i, case: i >= 3, v_m0: String(v) })).concat([{ id: 'p6', case: true, v_m0: '6' }, { id: 'p7', case: false, v_m0: '3' }]) },
  stats: d => { const m = model(d); const s = d.subjects || []; return m.markers.length ? [[s.filter((x: any) => x.case).length, 'cases'], [s.filter((x: any) => !x.case).length, 'non-cases'], [+m.markers[0].roc.auc.toFixed(2), 'AUC']] : [[s.length, 'subjects']]; },
  Controls,
  Render: ({ data }) => <RocSheet data={data} />,
};
