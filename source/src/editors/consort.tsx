import { S } from '../sheet';
import { Rows, TextIn, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';
import { boxH, lay, LH, type Line } from './flowbits';

const C = () => (window as any).SDConsort;

/* sheet geometry */
const BX = 8, X0 = 46, AW = 210, GAP = 26, GY = 34;
const nn = (v: number) => String(v);

function CSheet({ data }: { data: any }) {
  const r = C().calc(data), arms = r.arms, na = arms.length, out: any[] = []; let k = 0; const key = () => 'c' + k++;
  if (!na) return null;
  const total = na * AW + (na - 1) * GAP, cx = X0 + total / 2, ax = (i: number) => X0 + i * (AW + GAP), ac = (i: number) => ax(i) + AW / 2;
  const why = (n: number, text?: string): Line[] => (text && n > 0 ? [{ t: 'Reasons: ' + text }] : []);
  const A = (a: any, i: number) => data.arms[i];
  /* box contents */
  const assessed: Line[] = [{ t: 'Assessed for eligibility (n = ' + nn(r.assessed) + ')', b: true }];
  const excl: Line[] = [{ t: 'Excluded (n = ' + nn(r.excluded) + '):', b: true }, ...r.reasons.map((x: any) => ({ t: x.text + ' (n = ' + nn(x.n) + ')' }))];
  const rand: Line[] = [{ t: 'Randomised (n = ' + nn(r.randomised) + ')', b: true }];
  const alloc = arms.map((a: any, i: number): Line[] => [{ t: 'Allocated to ' + (a.name || 'arm') + ' (n = ' + nn(a.allocated) + ')', b: true }, { t: 'Received allocated intervention (n = ' + nn(a.received) + ')' }, { t: 'Did not receive allocated intervention (n = ' + nn(a.notReceived) + ')' }, ...why(a.notReceived, A(a, i).nrWhy)]);
  const fu = arms.map((a: any, i: number): Line[] => [{ t: 'Lost to follow-up (n = ' + nn(a.lost) + ')', b: true }, ...why(a.lost, A(a, i).lostWhy), { t: 'Discontinued intervention (n = ' + nn(a.disc) + ')', b: true }, ...why(a.disc, A(a, i).discWhy)]);
  const an = arms.map((a: any, i: number): Line[] => [{ t: 'Analysed (n = ' + nn(a.analysed) + ')', b: true }, { t: 'Excluded from analysis (n = ' + nn(a.exclAn) + ')' }, ...why(a.exclAn, A(a, i).exclWhy)]);
  const EW = 250, mw = Math.max(AW, 220);
  const box = (lines: Line[], x: number, y: number, w: number, h: number) => {
    out.push(<rect key={key()} className="pr-box" x={x} y={y} width={w} height={h} />);
    lay(lines, w).forEach((l, i) => out.push(<text key={key()} className={'pr-text' + (l.b ? ' pr-bold' : '')} x={x + 8} y={y + 7 + (i + 1) * LH - 4}>{l.t}</text>));
  };
  const down = (x: number, y1: number, y2: number) => { out.push(<line key={key()} className="pr-arrow" x1={x} y1={y1} x2={x} y2={y2 - 5} />); out.push(<polygon key={key()} className="pr-head" points={`${x - 4},${y2 - 7} ${x + 4},${y2 - 7} ${x},${y2}`} />); };
  const right = (y: number, x1: number, x2: number) => { out.push(<line key={key()} className="pr-arrow" x1={x1} y1={y} x2={x2 - 5} y2={y} />); out.push(<polygon key={key()} className="pr-head" points={`${x2 - 7},${y - 4} ${x2 - 7},${y + 4} ${x2},${y}`} />); };
  const band = (y: number, h: number, label: string) => { out.push(<rect key={key()} className="pr-band" x={BX} y={y} width={26} height={h} />); out.push(<text key={key()} className="pr-phase" x={BX + 13} y={y + h / 2} textAnchor="middle" transform={'rotate(-90 ' + (BX + 13) + ' ' + (y + h / 2) + ')'}>{label}</text>); };
  /* rows */
  const e1 = 6, he1 = Math.max(boxH(assessed, mw), boxH(excl, EW));
  const e2 = e1 + he1 + GY, he2 = boxH(rand, mw);
  const r3 = e2 + he2 + GY + 14, h3 = Math.max(...alloc.map((l: Line[]) => boxH(l, AW)));
  const r4 = r3 + h3 + GY, h4 = Math.max(...fu.map((l: Line[]) => boxH(l, AW)));
  const r5 = r4 + h4 + GY, h5 = Math.max(64, ...an.map((l: Line[]) => boxH(l, AW)));
  band(e1, e2 + he2 - e1, 'Enrollment'); band(r3, h3, 'Allocation'); band(r4, h4, 'Follow-Up'); band(r5, h5, 'Analysis');
  box(assessed, cx - mw / 2, e1, mw, he1); box(excl, cx + mw / 2 + 34, e1, EW, he1); right(e1 + he1 / 2, cx + mw / 2, cx + mw / 2 + 34);
  down(cx, e1 + he1, e2); box(rand, cx - mw / 2, e2, mw, he2);
  /* randomised splits to each arm */
  const ym = e2 + he2 + GY / 2 + 7;
  out.push(<line key={key()} className="pr-arrow" x1={cx} y1={e2 + he2} x2={cx} y2={ym} />);
  if (na > 1) out.push(<line key={key()} className="pr-arrow" x1={ac(0)} y1={ym} x2={ac(na - 1)} y2={ym} />);
  arms.forEach((_: any, i: number) => {
    down(ac(i), ym, r3);
    box(alloc[i], ax(i), r3, AW, h3); down(ac(i), r3 + h3, r4);
    box(fu[i], ax(i), r4, AW, h4); down(ac(i), r4 + h4, r5);
    box(an[i], ax(i), r5, AW, h5);
  });
  return <g className="pr">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const arms = data.arms || [], reasons = data.reasons || [], r = C().calc(data);
  const upd = (id: string, patch: any, kk: string) => set({ arms: arms.map((a: any) => (a.id === id ? { ...a, ...patch } : a)) }, kk);
  const f = (a: any, k: string, label: string, ph = '0') => <TextIn id={'cs-' + a.id + k} label={label} value={a[k]} placeholder={ph} onChange={v => upd(a.id, { [k]: v }, 'cs-' + a.id + k)} />;
  return (
    <>
      <S.Panel kicker="Enrollment" help="Participants assessed, then those excluded before randomisation. Randomised is worked out.">
        <TextIn id="cs-as" label="Assessed for eligibility" value={data.assessed} placeholder="0" onChange={v => set({ assessed: v }, 'cs-as')} />
      </S.Panel>
      <Rows id="cs-rs" kicker="Excluded, with reasons" help="One row per reason. They are totalled in the Excluded box." rows={reasons}
        cols={[{ key: 'reason', label: 'Reason', w: '1.8fr' }, { key: 'n', label: 'n', type: 'num', w: '0.5fr' }]}
        blank={() => ({ reason: 'Reason ' + (reasons.length + 1), n: '' })} addLabel="+ Add reason" onChange={(rows, kk) => set({ reasons: rows }, kk)} />
      <Rows id="cs-arms" kicker="Arms" help="One column per arm, up to four." rows={arms}
        cols={[{ key: 'name', label: 'Name', w: '1.6fr' }]}
        blank={() => ({ id: uid('a', arms.map((a: any) => a.id)), name: 'Arm ' + (arms.length + 1), allocated: '', notReceived: '', lost: '', disc: '', exclAn: '' })}
        addLabel="+ Add arm" onChange={(rows, kk) => set({ arms: rows.slice(0, 4).map(x => ({ ...x, id: x.id || uid('a', arms.map((a: any) => a.id)) })) }, kk)} />
      {arms.map((a: any) => (
        <S.Panel key={a.id} kicker={'Counts: ' + (a.name || 'arm')} help="Reasons are optional and appear in the box. Analysed = allocated − lost − excluded from analysis.">
          <div className="mk-pair">{f(a, 'allocated', 'Allocated')}{f(a, 'notReceived', 'Did not receive')}</div>
          {f(a, 'nrWhy', 'Reasons (did not receive)', '')}
          <div className="mk-pair">{f(a, 'lost', 'Lost to follow-up')}{f(a, 'disc', 'Discontinued')}</div>
          {f(a, 'lostWhy', 'Reasons (lost)', '')}{f(a, 'discWhy', 'Reasons (discontinued)', '')}
          {f(a, 'exclAn', 'Excluded from analysis')}{f(a, 'exclWhy', 'Reasons (excluded)', '')}
        </S.Panel>
      ))}
      <S.Panel kicker="Check" help="Worked out from your counts.">
        <ul className="tr-results">
          <li>Assessed {r.assessed}, excluded {r.excluded}, randomised {r.randomised}</li>
          {r.arms.map((a: any) => <li key={a.name}>{a.name}: allocated {a.allocated}, received {a.received}, analysed {a.analysed}</li>)}
          {r.warnings.map((w: string) => <li key={w} className="pr-warn">{w}</li>)}
        </ul>
      </S.Panel>
    </>
  );
}

const arm = (id: string, name: string, allocated: number, notReceived: number, lost: number, disc: number, exclAn: number, w: Record<string, string> = {}) =>
  ({ id, name, allocated: String(allocated), notReceived: String(notReceived), lost: String(lost), disc: String(disc), exclAn: String(exclAn), ...w });

export const consort: EditorDef = {
  id: 'consort-flow', num: '32', name: 'CONSORT flow diagram', field: 'Evidence and clinical',
  blurb: 'Participant flow through a randomised trial: enrolment, allocation, follow-up and analysis, with counts worked out for you.',
  hint: 'Enter the counts. Randomised, received and analysed are calculated, and mismatches are flagged.',
  templates: [
    { name: 'Two-arm trial', desc: 'Parallel groups, example counts', title: 'Participant flow',
      caption: 'CONSORT 2010 flow diagram of a two-arm parallel randomised trial. Example counts for practice. Template: Schulz et al., BMJ 2010;340:c332.',
      data: { assessed: '312', reasons: [{ reason: 'Not meeting inclusion criteria', n: '98' }, { reason: 'Declined to participate', n: '41' }, { reason: 'Other reasons', n: '13' }],
        arms: [arm('a0', 'Diet intervention', 80, 3, 6, 4, 1, { nrWhy: 'withdrew consent before starting', lostWhy: 'moved away (4), unreachable (2)', discWhy: 'adverse effects' }),
               arm('a1', 'Usual care', 80, 1, 9, 0, 0, { nrWhy: 'changed mind', lostWhy: 'moved away (5), unreachable (4)' })] } },
    { name: 'Three-arm trial', desc: 'Two doses and a placebo', title: 'Participant flow in a dose-response trial',
      caption: 'CONSORT 2010 flow diagram of a three-arm trial. Example counts for practice. Template: Schulz et al., BMJ 2010;340:c332.',
      data: { assessed: '240', reasons: [{ reason: 'Not meeting inclusion criteria', n: '62' }, { reason: 'Declined to participate', n: '28' }],
        arms: [arm('a0', 'High dose', 50, 2, 4, 3, 0), arm('a1', 'Low dose', 50, 1, 5, 2, 0), arm('a2', 'Placebo', 50, 0, 7, 1, 0)] } },
  ],
  blank: { assessed: '0', reasons: [], arms: [arm('a0', 'Intervention', 0, 0, 0, 0, 0), arm('a1', 'Control', 0, 0, 0, 0, 0)] },
  stats: d => { const r = C().calc(d); return [[r.assessed, 'assessed'], [Math.max(0, r.randomised), 'randomised'], [r.arms.reduce((s: number, a: any) => s + Math.max(0, a.analysed), 0), 'analysed']]; },
  Controls,
  Render: ({ data }) => <CSheet data={data} />,
};
