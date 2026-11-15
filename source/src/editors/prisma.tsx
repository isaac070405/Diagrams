import { S } from '../sheet';
import { Rows, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';
import { lay, LH, type Line } from './flowbits';

const P = () => (window as any).SDPrisma;

/* sheet geometry: phase band, main column, side column, other-methods column */
const BX = 8, MX = 50, MW = 215, SX = 305, SW = 240, OX = 585, OW = 200, GAP = 36;

function PrismaSheet({ data }: { data: any }) {
  const r = P().calc(data), out: any[] = []; let k = 0; const key = () => 'p' + k++;
  const other = !!data.other, nn = (v: number) => String(v);
  const dbLabel = (data.dbNames || '').trim() ? 'Databases (' + data.dbNames.trim() + ')' : 'Databases';
  /* the boxes, as lines of text */
  const B: any = {
    id: [{ t: 'Records identified from:', b: true }, { t: dbLabel + ' (n = ' + nn(P().count(data.db)) + ')' }, { t: 'Registers (n = ' + nn(P().count(data.reg)) + ')' }],
    rem: [{ t: 'Records removed before screening:', b: true }, { t: 'Duplicate records removed (n = ' + nn(P().count(data.dup)) + ')' }, { t: 'Records marked as ineligible by automation tools (n = ' + nn(P().count(data.auto)) + ')' }, { t: 'Records removed for other reasons (n = ' + nn(P().count(data.otherRem)) + ')' }],
    oid: [{ t: 'Records identified from:', b: true }, { t: 'Websites (n = ' + nn(P().count(data.web)) + ')' }, { t: 'Organisations (n = ' + nn(P().count(data.org)) + ')' }, { t: 'Citation searching (n = ' + nn(P().count(data.cit)) + ')' }],
    scr: [{ t: 'Records screened', b: true }, { t: '(n = ' + nn(r.screened) + ')' }],
    exc: [{ t: 'Records excluded (n = ' + nn(P().count(data.scrExcl)) + ')', b: true }],
    sought: [{ t: 'Reports sought for retrieval', b: true }, { t: '(n = ' + nn(r.sought) + ')' }],
    notret: [{ t: 'Reports not retrieved (n = ' + nn(P().count(data.notRet)) + ')', b: true }],
    osought: [{ t: 'Reports sought for retrieval (n = ' + nn(r.otherSought) + ')', b: true }, { t: 'Reports not retrieved (n = ' + nn(P().count(data.notRetO)) + ')' }],
    ass: [{ t: 'Reports assessed for eligibility', b: true }, { t: '(n = ' + nn(r.assessed) + ')' }],
    oass: [{ t: 'Reports assessed for eligibility', b: true }, { t: '(n = ' + nn(r.otherAssessed) + ')' }],
    reasons: [{ t: 'Reports excluded (n = ' + nn(r.excluded) + '):', b: true }, ...r.reasons.map((x: any) => ({ t: x.text + ' (n = ' + nn(x.n) + ')' }))],
    inc: [...(P().count(data.studies) > 0 ? [{ t: 'Studies included in review (n = ' + nn(P().count(data.studies)) + ')', b: true }] : []), { t: 'Reports of included studies (n = ' + nn(r.included) + ')', b: P().count(data.studies) === 0 }],
  };
  const H = (lines: Line[], w: number) => lay(lines, w).length * LH + 14;
  /* row tops */
  const r1 = 10, h1 = Math.max(H(B.id, MW), H(B.rem, SW), other ? H(B.oid, OW) : 0);
  const r2 = r1 + h1 + GAP, h2 = Math.max(H(B.scr, MW), H(B.exc, SW));
  const r3 = r2 + h2 + GAP, h3 = Math.max(H(B.sought, MW), H(B.notret, SW), other ? H(B.osought, OW) : 0);
  const r4 = r3 + h3 + GAP, h4 = Math.max(H(B.ass, MW), H(B.reasons, SW), other ? H(B.oass, OW) : 0);
  const r5 = r4 + h4 + GAP, h5 = H(B.inc, MW);
  const box = (lines: Line[], x: number, y: number, w: number, h: number) => {
    out.push(<rect key={key()} className="pr-box" x={x} y={y} width={w} height={h} />);
    lay(lines, w).forEach((l, i) => out.push(<text key={key()} className={'pr-text' + (l.b ? ' pr-bold' : '')} x={x + 8} y={y + 7 + (i + 1) * LH - 4}>{l.t}</text>));
  };
  const arrowDown = (x: number, y1: number, y2: number) => { out.push(<line key={key()} className="pr-arrow" x1={x} y1={y1} x2={x} y2={y2 - 5} />); out.push(<polygon key={key()} className="pr-head" points={`${x - 4},${y2 - 7} ${x + 4},${y2 - 7} ${x},${y2}`} />); };
  const arrowRight = (y: number, x1: number, x2: number) => { out.push(<line key={key()} className="pr-arrow" x1={x1} y1={y} x2={x2 - 5} y2={y} />); out.push(<polygon key={key()} className="pr-head" points={`${x2 - 7},${y - 4} ${x2 - 7},${y + 4} ${x2},${y}`} />); };
  /* phase bands */
  const band = (y: number, h: number, label: string) => { out.push(<rect key={key()} className="pr-band" x={BX} y={y} width={26} height={h} />); out.push(<text key={key()} className="pr-phase" x={BX + 13} y={y + h / 2} textAnchor="middle" transform={'rotate(-90 ' + (BX + 13) + ' ' + (y + h / 2) + ')'}>{label}</text>); };
  band(r1, h1, 'Identification'); band(r2, r4 + h4 - r2, 'Screening'); band(r5, h5, 'Included');
  /* boxes */
  box(B.id, MX, r1, MW, h1); box(B.rem, SX, r1, SW, h1);
  box(B.scr, MX, r2, MW, h2); box(B.exc, SX, r2, SW, h2);
  box(B.sought, MX, r3, MW, h3); box(B.notret, SX, r3, SW, h3);
  box(B.ass, MX, r4, MW, h4); box(B.reasons, SX, r4, SW, h4);
  box(B.inc, MX, r5, MW, h5);
  const mc = MX + MW / 2;
  arrowDown(mc, r1 + h1, r2); arrowDown(mc, r2 + h2, r3); arrowDown(mc, r3 + h3, r4); arrowDown(mc, r4 + h4, r5);
  arrowRight(r1 + h1 / 2, MX + MW, SX); arrowRight(r2 + h2 / 2, MX + MW, SX); arrowRight(r3 + h3 / 2, MX + MW, SX); arrowRight(r4 + h4 / 2, MX + MW, SX);
  if (other) {
    box(B.oid, OX, r1, OW, h1); box(B.osought, OX, r3, OW, h3); box(B.oass, OX, r4, OW, h4);
    const oc = OX + OW / 2;
    arrowDown(oc, r1 + h1, r3); arrowDown(oc, r3 + h3, r4);
    /* from the other-methods assessed box down and left into the included box */
    const y = r5 + h5 / 2;
    out.push(<line key={key()} className="pr-arrow" x1={oc} y1={r4 + h4} x2={oc} y2={y} />);
    out.push(<line key={key()} className="pr-arrow" x1={oc} y1={y} x2={MX + MW + 5} y2={y} />);
    out.push(<polygon key={key()} className="pr-head" points={`${MX + MW + 7},${y - 4} ${MX + MW + 7},${y + 4} ${MX + MW},${y}`} />);
    out.push(<text key={key()} className="pr-side" x={OX + OW / 2} y={5} textAnchor="middle">Identification of studies via other methods</text>);
  }
  out.push(<text key={key()} className="pr-side" x={MX + (SX + SW - MX) / 2} y={5} textAnchor="middle">Identification of studies via databases and registers</text>);
  return <g className="pr">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const r = P().calc(data), reasons = data.reasons || [];
  const f = (id: string, key: string, label: string, ph = '0') => <TextIn id={'pr-' + id} label={label} value={data[key]} placeholder={ph} onChange={v => set({ [key]: v }, 'pr-' + id)} />;
  return (
    <>
      <S.Panel kicker="Identification" help="Records from the database and register searches, then the records removed before screening.">
        <TextIn id="pr-dbn" label="Database names (optional)" value={data.dbNames} placeholder="PubMed, Scopus, Web of Science" onChange={v => set({ dbNames: v }, 'pr-dbn')} />
        <div className="mk-pair">{f('db', 'db', 'Databases')}{f('reg', 'reg', 'Registers')}</div>
        <div className="mk-pair">{f('dup', 'dup', 'Duplicates removed')}{f('auto', 'auto', 'Automation tools')}</div>
        {f('orem', 'otherRem', 'Removed for other reasons')}
      </S.Panel>
      <S.Panel kicker="Screening" help="Records screened and reports sought are worked out from the counts above, so the figure always adds up.">
        <div className="mk-pair">{f('exc', 'scrExcl', 'Records excluded')}{f('nr', 'notRet', 'Reports not retrieved')}</div>
      </S.Panel>
      <S.Panel kicker="Other methods" help="Websites, organisations and citation searching form a second column.">
        <Toggle on={!!data.other} label="Add the other-methods column" onChange={v => set({ other: v })} />
        {data.other ? <>
          <div className="mk-pair">{f('web', 'web', 'Websites')}{f('org', 'org', 'Organisations')}</div>
          <div className="mk-pair">{f('cit', 'cit', 'Citation searching')}{f('nro', 'notRetO', 'Reports not retrieved')}</div>
        </> : null}
      </S.Panel>
      <Rows id="pr-rs" kicker="Reports excluded, with reasons" help="One row per reason and the number of reports. They are totalled in the box." rows={reasons}
        cols={[{ key: 'reason', label: 'Reason', w: '1.8fr' }, { key: 'n', label: 'n', type: 'num', w: '0.5fr' }]}
        blank={() => ({ reason: 'Reason ' + (reasons.length + 1), n: '' })} addLabel="+ Add reason" onChange={(rows, kk) => set({ reasons: rows }, kk)} />
      <S.Panel kicker="Included" help="Studies can be fewer than reports when several reports describe one study. Leave it blank to show reports only.">
        {f('st', 'studies', 'Studies included', '')}
      </S.Panel>
      <S.Panel kicker="Check" help="Worked out from your counts.">
        <ul className="tr-results">
          <li>Identified {r.identified + r.otherIdentified}, screened {r.screened}</li>
          <li>Sought {r.sought + r.otherSought}, assessed {r.assessedAll}</li>
          <li>Excluded with reasons {r.excluded}, included reports {r.included}</li>
          {r.warnings.map((w: string) => <li key={w} className="pr-warn">{w}</li>)}
        </ul>
      </S.Panel>
    </>
  );
}

const rs = (rows: [string, number][]) => rows.map(([reason, n]) => ({ reason, n: String(n) }));

export const prisma: EditorDef = {
  id: 'prisma-flow', num: '29', name: 'PRISMA 2020 flow diagram', field: 'Evidence and clinical',
  blurb: 'Study selection flow for a systematic review: identification, screening and inclusion, with counts worked out for you.',
  hint: 'Enter the counts from your search. Records screened, reports sought and assessed are calculated.',
  templates: [
    { name: 'Databases and registers', desc: 'The standard single-column flow', title: 'Study selection',
      caption: 'PRISMA 2020 flow diagram of study selection. Example counts for practice. Template: Page et al., BMJ 2021;372:n71.',
      data: { dbNames: 'PubMed, Embase, Scopus', db: '1248', reg: '86', dup: '312', auto: '41', otherRem: '0', scrExcl: '862', notRet: '9', studies: '38',
        reasons: rs([['Wrong population', 21], ['Wrong outcome', 18], ['Not a randomised trial', 14], ['Conference abstract only', 9], ['Duplicate report', 6]]) } },
    { name: 'With other methods', desc: 'Adds websites, organisations and citation searching', title: 'Study selection with additional sources',
      caption: 'PRISMA 2020 flow diagram including studies found by other methods. Example counts for practice. Template: Page et al., BMJ 2021;372:n71.',
      data: { other: true, dbNames: 'PubMed, Web of Science', db: '862', reg: '0', dup: '214', auto: '0', otherRem: '0', scrExcl: '566', notRet: '4', web: '18', org: '6', cit: '41', notRetO: '7', studies: '31',
        reasons: rs([['Wrong study design', 30], ['Wrong population', 25], ['No relevant outcome', 20], ['Full text not in English', 12], ['Other', 10]]) } },
  ],
  blank: { db: '0', reg: '0', dup: '0', scrExcl: '0', notRet: '0', reasons: [] },
  stats: d => { const r = P().calc(d); return [[r.identified + r.otherIdentified, 'identified'], [r.screened, 'screened'], [Math.max(0, r.included), 'included']]; },
  Controls,
  Render: ({ data }) => <PrismaSheet data={data} />,
};
