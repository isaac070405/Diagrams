import { S } from '../sheet';
import { EmptyHint, Seg, Spec, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const E = () => (window as any).SDEpi;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const fm = (v: number, d = 3) => (isFinite(v) ? (+v.toPrecision(d)).toString() : 'n/a');

/* sheet geometry */
const L = 70, T = 30, PW = 560, PH = 340;

/* marker lines "date, label" */
function markers(text: string) { const out: { day: number; label: string }[] = []; String(text || '').split(/\r?\n/).forEach(l => { const f = l.split(/[,\t;]+/).map(s => s.trim()); if (f.length < 1) return; const d = E().day(f[0]); if (isFinite(d)) out.push({ day: d, label: f.slice(1).join(', ') }); }); return out; }

function model(data: any) {
  const cases = E().parse(data.text);
  const w = data.width === 'auto' || data.width === undefined ? 0 : +data.width;
  const span = cases.length ? Math.max(...cases.map((c: any) => c.day)) - Math.min(...cases.map((c: any) => c.day)) + 1 : 0;
  const width = w || (span <= 14 ? 1 : span <= 35 ? 2 : 7);
  const exp = E().day(data.exposure), pop = parseFloat(data.pop), marks = markers(data.marks);
  const b = cases.length ? E().bin(cases, width, data.align === 'monday' ? 'monday' : 'first', [exp, ...marks.map(x => x.day)]) : null;
  /* days from exposure to onset, over cases */
  let inc: number[] = []; if (isFinite(exp)) cases.forEach((c: any) => { for (let i = 0; i < c.n; i++) inc.push(c.day - exp); }); inc.sort((a, c) => a - c);
  const median = inc.length ? (inc[Math.floor((inc.length - 1) / 2)] + inc[Math.ceil((inc.length - 1) / 2)]) / 2 : NaN;
  return { cases, b, marks, width, exp, pop, inc, incMedian: median };
}

function EpiSheet({ data }: { data: any }) {
  const { b, marks, width, exp } = model(data);
  if (!b) return <EmptyHint text={'Paste onset dates as yyyy-mm-dd, one per line. A count and a category can follow: "2026-03-02, 4, Confirmed".'} />;
  const out: any[] = []; let n = 0; const k = () => 'e' + n++;
  const nb = b.bins.length, bw = PW / nb, X = (d: number) => L + (d - b.start) / (nb * width) * PW;
  const ymaxData = Math.max(...b.bins.map((x: any) => x.total)), st = ymaxData <= 8 ? 1 : ymaxData <= 20 ? 2 : ymaxData <= 50 ? 5 : ymaxData <= 100 ? 10 : Math.pow(10, Math.floor(Math.log10(ymaxData / 4))) * (ymaxData / Math.pow(10, Math.floor(Math.log10(ymaxData / 4))) / 4 >= 3.5 ? 5 : ymaxData / Math.pow(10, Math.floor(Math.log10(ymaxData / 4))) / 4 >= 1.5 ? 2 : 1);
  const ymax = Math.ceil((ymaxData + 0.01) / st) * st, Y = (v: number) => T + PH - v / ymax * PH;
  for (let v = 0; v <= ymax + 1e-9; v += st) { out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(v)} x2={L} y2={Y(v)} /><text x={L - 9} y={Y(v) + 4} textAnchor="end">{v}</text></g>); if (data.grid) out.push(<line key={k()} className="km-grid" x1={L} y1={Y(v)} x2={L + PW} y2={Y(v)} />); }
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  /* boxes: one square per case when the bars are tall enough, otherwise solid bars */
  const unit = PH / ymax, boxes = data.style !== 'bars' && bw >= 6 && unit >= 6 && ymax <= 60, bx = Math.min(bw - 2, unit - 1.5), size = boxes ? Math.min(bx, bw - 2) : 0;
  b.bins.forEach((bin: any, i: number) => {
    const x0 = L + i * bw; let level = 0;
    bin.by.forEach((c: number, ci: number) => {
      if (!c) return;
      if (boxes) for (let j = 0; j < c; j++) { out.push(<rect key={k()} className="ep-box" x={x0 + (bw - size) / 2} y={Y(level + 1) + (unit - size) / 2} width={size} height={size} style={{ fill: col(ci) }} />); level++; }
      else { out.push(<rect key={k()} className="ep-bar" x={x0 + 1} y={Y(level + c)} width={Math.max(1, bw - 2)} height={c * unit} style={{ fill: col(ci) }} />); level += c; }
    });
  });
  /* date labels, thinned so they never overlap */
  const per = Math.max(1, Math.ceil(46 / bw));
  b.bins.forEach((bin: any, i: number) => { if (i % per) return; const x = L + i * bw + (width === 1 ? bw / 2 : 0), lab = width === 1 ? E().fmt(bin.start) : E().fmt(bin.start); out.push(<g key={k()} className="km-tick"><line x1={x} y1={T + PH} x2={x} y2={T + PH + 5} /><text x={x} y={T + PH + 18} textAnchor="middle">{lab}</text></g>); });
  const yr = (d: number) => new Date(d * 86400000).getUTCFullYear(), y1 = yr(b.start), y2 = yr(b.start + nb * width - 1);
  out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + 42} textAnchor="middle">{data.xlabel || 'Date of onset' + (y1 === y2 ? ' (' + y1 + ')' : ' (' + y1 + ' to ' + y2 + ')') + (width > 1 ? ', ' + width + '-day groups' + (data.align === 'monday' ? ' from Monday' : '') : '')}</text>);
  out.push(<text key={k()} className="km-title" x={22} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 22 ' + (T + PH / 2) + ')'}>{data.ylabel || 'Number of cases'}</text>);
  /* markers: exposure and other events, and the median onset */
  const mk = [...(isFinite(exp) ? [{ day: exp, label: data.exposureLabel || 'Exposure' }] : []), ...marks];
  mk.forEach((m, i) => { if (m.day < b.start || m.day > b.start + nb * width) return; const x = X(m.day) + (width === 1 ? bw / 2 : 0); out.push(<line key={k()} className="ep-mark" x1={x} y1={T} x2={x} y2={T + PH} />, <text key={k()} className="ep-marklab" x={x + 4} y={T + 12 + (i % 2) * 13}>{m.label}</text>); });
  if (data.median) { const x = X(b.median) + (width === 1 ? bw / 2 : 0); out.push(<line key={k()} className="ep-median" x1={x} y1={T} x2={x} y2={T + PH} />, <text key={k()} className="km-note" x={x} y={T - 7} textAnchor="middle">Median onset {E().fmt(b.median)}</text>); }
  if (b.cats.length > 1 || b.cats[0]) b.cats.forEach((c: string, i: number) => out.push(<rect key={k()} className="ep-box" x={L + PW - 150} y={T + 10 + i * 18} width={11} height={11} style={{ fill: col(i) }} />, <text key={k()} className="km-name" x={L + PW - 133} y={T + 20 + i * 18}>{c || 'Cases'}</text>));
  return <g className="ep">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const m = model(data), b = m.b;
  return (
    <>
      <Spec id="ep-text" label="Onset dates: date, count, category" rows={10} value={data.text || ''} help="One line per case, or per day with a count. The date is yyyy-mm-dd. An optional count and an optional category (for example Confirmed or Probable) follow. Commas, tabs or semicolons."
        onChange={v => set({ text: v }, 'ep-text')} placeholder={'2026-03-02\n2026-03-03, 4, Confirmed'} />
      <S.Panel kicker="Groups of days" help="Group cases by 1 day for a short outbreak (about 14 days or less) and by weeks for a longer one. Weekly groups can start on a Monday.">
        <Seg wrap value={data.width === undefined ? 'auto' : String(data.width)} options={[['auto', 'Auto'], ['1', '1 day'], ['2', '2 days'], ['3', '3 days'], ['7', '1 week']]} onChange={v => set({ width: v === 'auto' ? undefined : +v })} />
        <Seg value={data.align === 'monday' ? 'monday' : 'first'} options={[['first', 'From the first case'], ['monday', 'From a Monday']]} onChange={v => set({ align: v })} />
        <Seg value={data.style === 'bars' ? 'bars' : 'boxes'} options={[['boxes', 'A box per case'], ['bars', 'Solid bars']]} onChange={v => set({ style: v })} />
      </S.Panel>
      <S.Panel kicker="Exposure and population" help="With an exposure date, the Results panel gives days from exposure to onset (the incubation period) and a line marks the exposure. With the number of people at risk it gives the attack rate.">
        <div className="mk-pair"><TextIn id="ep-ex" label="Exposure date" value={data.exposure} placeholder="yyyy-mm-dd" onChange={v => set({ exposure: v }, 'ep-ex')} /><TextIn id="ep-exl" label="Exposure label" value={data.exposureLabel} placeholder="Exposure" onChange={v => set({ exposureLabel: v }, 'ep-exl')} /></div>
        <TextIn id="ep-pop" label="People at risk" value={data.pop} placeholder="e.g. 120" onChange={v => set({ pop: v }, 'ep-pop')} />
      </S.Panel>
      <Spec id="ep-marks" label="Other events: date, label" rows={3} value={data.marks || ''} help="Lines to mark on the curve, such as a control measure or a second exposure."
        onChange={v => set({ marks: v }, 'ep-marks')} placeholder={'2026-03-20, Kitchen closed'} />
      <S.Panel kicker="Look">
        <TextIn id="ep-xl" label="Date axis title" value={data.xlabel} placeholder="Date of onset" onChange={v => set({ xlabel: v }, 'ep-xl')} />
        <TextIn id="ep-yl" label="Count axis title" value={data.ylabel} placeholder="Number of cases" onChange={v => set({ ylabel: v }, 'ep-yl')} />
        <Toggle on={!!data.median} label="Median onset line" onChange={v => set({ median: v })} />
        <Toggle on={!!data.grid} label="Grid lines" onChange={v => set({ grid: v })} />
      </S.Panel>
      {b ? <S.Panel kicker="Results" help="Attack rate is cases divided by people at risk. The incubation period is the time from exposure to onset: the middle, and the shortest and longest.">
        <ul className="tr-results">
          <li>{b.total} cases from {E().fmt(b.first, true)} to {E().fmt(b.last, true)} ({b.last - b.first + 1} days); median onset {E().fmt(b.median, true)}</li>
          <li>Busiest {b.width === 1 ? 'day' : b.width + '-day group'}: {b.width === 1 ? E().fmt(b.peak.start) : E().fmt(b.peak.start) + ' to ' + E().fmt(b.peak.end)} with {b.peak.total} cases</li>
          {b.cats.length > 1 || b.cats[0] ? <li>By category: {b.cats.map((c: string, i: number) => (c || 'Cases') + ' ' + b.bins.reduce((a: number, x: any) => a + x.by[i], 0)).join(', ')}</li> : null}
          {isFinite(m.pop) && m.pop > 0 ? <li>Attack rate {fm(b.total / m.pop * 100, 3)}% ({b.total} of {m.pop})</li> : null}
          {m.inc.length ? <li>Incubation period: median {fm(m.incMedian, 3)} days (shortest {m.inc[0]}, longest {m.inc[m.inc.length - 1]})</li> : null}
        </ul>
      </S.Panel> : null}
    </>
  );
}

function rng(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; }
const daysFrom = (start: string, i: number) => { const d = new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10)) + i * 86400000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };
const series = (start: string, counts: number[][], cats: string[]) => counts.map((c, i) => c.map((n, j) => (n ? daysFrom(start, i) + ', ' + n + (cats[j] ? ', ' + cats[j] : '') : '')).filter(x => x).join('\n')).filter(x => x).join('\n');
const jit = (seed: number, base: number[]) => { const u = rng(seed); return base.map(v => Math.max(0, Math.round(v * (0.75 + 0.5 * u())))); };

const food = series('2026-03-14', [[0, 0], [2, 1], [6, 3], [9, 4], [6, 2], [3, 2], [1, 1], [1, 0]], ['Confirmed', 'Probable']);
const flu = (() => { const a = jit(3, [2, 4, 8, 15, 24, 31, 28, 19, 11, 6, 3, 1]), b = jit(9, [0, 1, 2, 3, 5, 9, 14, 17, 13, 8, 4, 2]), lines: string[] = []; a.forEach((n, w) => { if (n) lines.push(daysFrom('2026-01-05', w * 7 + 2) + ', ' + n + ', Influenza A'); if (b[w]) lines.push(daysFrom('2026-01-05', w * 7 + 3) + ', ' + b[w] + ', Influenza B'); }); return lines.join('\n'); })();
const clusterText = series('2026-05-01', [[1], [2], [4], [3], [2], [1], [0], [0], [0], [0], [0], [0], [0], [1], [2], [4], [6], [5], [3], [2], [1], [1]], ['']);

export const epicurve: EditorDef = {
  id: 'epidemic-curve', num: '50', name: 'Epidemic curve', field: 'Evidence and clinical',
  blurb: 'Cases by date of onset as a histogram with a box for each case, coloured by category, with exposure and event lines, the median onset and the attack rate.',
  hint: 'Paste onset dates, with an optional count and category. The curve, median onset and incubation period are worked out for you.',
  templates: [
    { name: 'Foodborne outbreak', desc: 'A point source: one sharp peak', title: 'Outbreak after a shared meal',
      caption: 'Cases by day of onset after a function on 14 March (simulated). One peak a day or two after exposure is the shape of a point-source outbreak. Each box is one case. Sample data for practice.',
      data: { text: food, exposure: '2026-03-14', exposureLabel: 'Shared meal', pop: '120', median: true, width: 1 } },
    { name: 'Influenza by week', desc: 'Two subtypes over 12 weeks, weekly groups', title: 'Weekly influenza cases by subtype',
      caption: 'Cases per week by influenza subtype over 12 weeks (simulated). Weeks start on a Monday. Subtype A peaks first. Sample data for practice.',
      data: { text: flu, width: 7, align: 'monday', style: 'bars', median: false } },
    { name: 'Spread to a second wave', desc: 'Secondary cases and a control measure', title: 'A cluster with secondary cases',
      caption: 'Cases by day of onset (simulated). The first wave follows one exposure, and a second wave about two weeks later follows contact with the first cases. The line marks when control measures began. Sample data for practice.',
      data: { text: clusterText, marks: '2026-04-29, Exposure\n2026-05-16, Contacts isolated', median: false, width: 1 } },
  ],
  blank: { text: '2026-03-02\n2026-03-02\n2026-03-03\n2026-03-03\n2026-03-03\n2026-03-04\n2026-03-04\n2026-03-05\n2026-03-06', width: 1 },
  stats: d => { const m = model(d); return m.b ? [[m.b.total, 'cases'], [m.b.last - m.b.first + 1, 'days'], [m.b.peak.total, 'peak']] : [[0, 'cases']]; },
  Controls,
  Render: ({ data }) => <EpiSheet data={data} />,
};
