import { S } from '../sheet';
import { EmptyHint, Seg, Spec, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const R = () => (window as any).SDRare;
const H = () => (window as any).SDHeat;
const K = () => (window as any).SDKite;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const fm = (v: number, d = 3) => (isFinite(v) ? (+v.toPrecision(d)).toString() : 'n/a');

/* sheet geometry */
const L = 84, T = 20, PW = 520, PH = 360;
function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }

function model(data: any) {
  const m = H().parse(data.text); if (!m || m.rows.length < 1) return null;
  const sites = m.rows.map((r: any) => ({ name: r.name, counts: r.vals.map((v: number) => (isFinite(v) && v > 0 ? Math.round(v) : 0)) })).map((s: any) => ({ ...s, N: s.counts.reduce((a: number, b: number) => a + b, 0), S: s.counts.filter((v: number) => v > 0).length })).filter((s: any) => s.N > 0);
  if (!sites.length) return null;
  const mode = data.mode === 'sample' && sites.length >= 2 ? 'sample' : 'individual';
  const nmin = Math.min(...sites.map((s: any) => s.N));
  const curves = mode === 'individual' ? sites.map((s: any) => R().curve(s.counts, 70)) : [];
  const acc = mode === 'sample' ? R().accumulate(sites.map((s: any) => s.counts), 300, 11) : null;
  const pooled = m.cols.map((_: any, j: number) => sites.reduce((a: number, s: any) => a + s.counts[j], 0));
  return { m, sites, mode, nmin, curves, acc, pooled };
}

function RareSheet({ data }: { data: any }) {
  const md = model(data);
  if (!md) return <EmptyHint text="Paste a table: sample names down the side, species across the top, counts in the cells." />;
  const { sites, mode, nmin, curves, acc, pooled } = md;
  const out: any[] = []; let n = 0; const k = () => 'r' + n++;
  const xmax = mode === 'individual' ? Math.max(...sites.map((s: any) => s.N)) : acc!.length, chaoV = R().chao1(pooled).estimate;
  const ymax0 = mode === 'individual' ? Math.max(...sites.map((s: any) => s.S)) : Math.max(...acc!.map((a: any) => a.hi)), ymax = Math.max(ymax0, mode === 'sample' && data.chao ? chaoV : 0) * 1.08;
  const X = (v: number) => L + v / (xmax * 1.03) * PW, Y = (v: number) => T + PH - v / ymax * PH;
  const xs = niceStep(xmax * 1.03, 8), ys = niceStep(ymax, 7);
  for (let v = 0; v <= xmax * 1.03 + 1e-9; v += xs) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={X(r)} y1={T + PH} x2={X(r)} y2={T + PH + 5} /><text x={X(r)} y={T + PH + 19} textAnchor="middle">{r}</text></g>); }
  for (let v = 0; v <= ymax + 1e-9; v += ys) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>); }
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + 42} textAnchor="middle">{data.xlabel || (mode === 'individual' ? 'Number of individuals sampled' : 'Number of samples')}</text>);
  out.push(<text key={k()} className="km-title" x={24} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 24 ' + (T + PH / 2) + ')'}>{data.ylabel || 'Number of species'}</text>);
  if (mode === 'individual') {
    if (data.nmin !== false && sites.length > 1) out.push(<line key={k()} className="ra-nmin" x1={X(nmin)} y1={T} x2={X(nmin)} y2={T + PH} />, <text key={k()} className="km-note" x={X(nmin) + 5} y={T + 14}>n = {nmin}</text>);
    sites.forEach((s: any, i: number) => {
      const pts = curves[i].map((p: number[]) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
      out.push(<polyline key={k()} className="ra-line" points={pts} style={{ stroke: col(i) }} />);
      out.push(<circle key={k()} className="ra-end" cx={X(s.N)} cy={Y(s.S)} r={4.4} style={{ fill: col(i) }} />);
      if (data.nmin !== false && sites.length > 1 && s.N >= nmin) out.push(<circle key={k()} className="ra-at" cx={X(nmin)} cy={Y(R().hurlbert(s.counts, nmin))} r={4} style={{ stroke: col(i) }} />);
    });
    if (sites.length > 1 && data.legend !== false) sites.forEach((s: any, i: number) => out.push(<line key={k()} className="ra-line" x1={L + PW + 14} y1={T + 12 + i * 20} x2={L + PW + 34} y2={T + 12 + i * 20} style={{ stroke: col(i) }} />, <text key={k()} className="km-name" x={L + PW + 40} y={T + 16 + i * 20}>{s.name}</text>));
  } else {
    const a = acc!;
    if (data.band !== false) out.push(<polygon key={k()} className="ra-band" points={[...a.map((p: any) => X(p.n).toFixed(1) + ',' + Y(p.hi).toFixed(1)), ...a.slice().reverse().map((p: any) => X(p.n).toFixed(1) + ',' + Y(p.lo).toFixed(1))].join(' ')} />);
    out.push(<polyline key={k()} className="ra-line" points={a.map((p: any) => X(p.n).toFixed(1) + ',' + Y(p.mean).toFixed(1)).join(' ')} style={{ stroke: col(0) }} />);
    a.forEach((p: any) => out.push(<circle key={k()} className="ra-end" cx={X(p.n)} cy={Y(p.mean)} r={3.6} style={{ fill: col(0) }} />));
    if (data.chao) out.push(<line key={k()} className="ra-nmin" x1={L} y1={Y(chaoV)} x2={L + PW} y2={Y(chaoV)} />, <text key={k()} className="km-note" x={L + PW - 6} y={Y(chaoV) - 6} textAnchor="end">Chao1 estimate {fm(chaoV, 3)}</text>);
  }
  return <g className="ra">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const md = model(data), ind = !md || md.mode === 'individual';
  return (
    <>
      <Spec id="ra-text" label="Counts: samples by species" rows={9} value={data.text || ''} help="First row: species names. First column: sample names. Counts of individuals in the cells. Tabs or commas. Paste straight from a spreadsheet."
        onChange={v => set({ text: v }, 'ra-text')} placeholder={'\\tSp A\\tSp B\\tSp C\\nSite 1\\t12\\t3\\t1'} />
      <S.Panel kicker="Curve" help="Rarefaction gives the expected number of species in a random subsample of n individuals, exactly (Hurlbert 1971), so sites with different sample sizes can be compared at the same n. Accumulation adds whole samples in random order (300 orders), showing the mean and 95% interval, and shows whether more sampling would find more species.">
        <Seg value={ind ? 'individual' : 'sample'} options={[['individual', 'Rarefaction by individuals'], ['sample', 'Accumulation by samples']]} onChange={v => set({ mode: v })} />
        {ind ? <Toggle on={data.nmin !== false} label="Compare sites at the smallest sample size" onChange={v => set({ nmin: v })} /> : <>
          <Toggle on={data.band !== false} label="95% interval band" onChange={v => set({ band: v })} />
          <Toggle on={!!data.chao} label="Chao1 estimate of total richness" onChange={v => set({ chao: v })} />
        </>}
        <Toggle on={data.legend !== false} label="Legend" onChange={v => set({ legend: v })} />
      </S.Panel>
      {md ? <S.Panel kicker="Results" help="E[S] at the smallest sample size is the fair comparison between sites. Chao1 is a lower bound on the true richness from the number of species seen once and twice (bias-corrected). H' is the Shannon index (natural log).">
        <ul className="tr-results">
          {md.sites.map((s: any) => { const c = R().chao1(s.counts); return <li key={s.name}><b>{s.name}</b>: {s.N} individuals, {s.S} species{md.sites.length > 1 && md.mode === 'individual' ? ', E[S] at n = ' + md.nmin + ' is ' + fm(R().hurlbert(s.counts, md.nmin), 3) : ''}; Chao1 {fm(c.estimate, 3)} ({c.f1} singletons, {c.f2} doubletons); H' {fm(K().shannon(s.counts), 3)}</li>; })}
          {md.mode === 'sample' ? <li>All samples together: {md.pooled.filter((v: number) => v > 0).length} species, Chao1 {fm(R().chao1(md.pooled).estimate, 3)}</li> : null}
        </ul>
      </S.Panel> : null}
    </>
  );
}

function rng(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; }
function community(S: number, ratio: number, total: number, seed: number) { const u = rng(seed), p = Array.from({ length: S }, (_, i) => Math.pow(ratio, i)), tot = p.reduce((a, b) => a + b, 0); return p.map(v => { const e = total * v / tot; return Math.max(0, Math.round(e * (0.6 + 0.8 * u()))); }); }
const sp = (n: number) => Array.from({ length: n }, (_, i) => 'Sp' + String(i + 1).padStart(2, '0'));
const matrix = (names: string[], rows: [string, number[]][]) => '\t' + names.join('\t') + '\n' + rows.map(([n, v]) => n + '\t' + v.join('\t')).join('\n');
const reefTxt = matrix(sp(22), [['Lagoon', community(22, 0.78, 420, 3)], ['Back reef', community(22, 0.7, 160, 7)], ['Fore reef', community(22, 0.9, 700, 11)], ['Channel', community(22, 0.6, 90, 5)]]);
const quadTxt = (() => { const u = rng(21), names = sp(16), rows: [string, number[]][] = []; for (let q = 0; q < 12; q++) rows.push(['Q' + (q + 1), names.map((_, j) => (u() < Math.max(0.06, 0.8 * Math.pow(0.8, j)) ? 1 + Math.floor(u() * 6) : 0))]); return matrix(names, rows); })();
const preyTxt = matrix(['Copepods', 'Amphipods', 'Polychaetes', 'Bivalves', 'Gastropods', 'Crabs', 'Shrimp', 'Fish larvae', 'Ostracods', 'Isopods', 'Mysids', 'Brittle stars'], [['Species X', [120, 60, 14, 6, 3, 1, 1, 0, 0, 0, 0, 0]], ['Species Y', [20, 25, 30, 22, 14, 11, 7, 4, 3, 2, 1, 1]], ['Species Z', [15, 14, 12, 10, 9, 8, 7, 5, 4, 3, 2, 1]]]);

export const rarefaction: EditorDef = {
  id: 'rarefaction-curve', num: '47', name: 'Rarefaction and species accumulation', field: 'Ecology',
  blurb: 'Species richness against sampling effort: exact rarefaction to compare sites, or accumulation across samples with a 95% band and Chao1.',
  hint: 'Paste counts with samples down the side and species across the top. Curves, E[S] and Chao1 are worked out for you.',
  templates: [
    { name: 'Fish counts at four reef sites', desc: 'Rarefaction to compare sites', title: 'Rarefaction curves for four reef sites',
      caption: 'Expected species richness against the number of individuals counted at four reef sites (simulated counts). Open circles mark each site rarefied to the smallest sample, the fair comparison. Sample data for practice.',
      data: { text: reefTxt, mode: 'individual', nmin: true } },
    { name: 'Quadrat accumulation', desc: '12 quadrats, mean and 95% band', title: 'Species accumulation across quadrats',
      caption: 'Species found as quadrats are added in random order (300 orders), mean and 95% interval, with the Chao1 estimate of total richness (simulated data). A curve that still rises means more species remain to be found. Sample data for practice.',
      data: { text: quadTxt, mode: 'sample', band: true, chao: true } },
    { name: 'Prey in the guts of three fish', desc: 'Diet breadth by rarefaction', title: 'Prey diversity in three predators',
      caption: 'Rarefied number of prey types against prey items counted in the guts of three fish species (simulated). Species Z has the broadest diet at every sample size. Sample data for practice.',
      data: { text: preyTxt, mode: 'individual', nmin: true, xlabel: 'Number of prey items', ylabel: 'Number of prey types' } },
  ],
  blank: { text: '\tSp A\tSp B\tSp C\tSp D\tSp E\nSite 1\t20\t12\t5\t2\t1\nSite 2\t8\t6\t4\t3\t2', mode: 'individual' },
  stats: d => { const m = model(d); return m ? [[m.sites.length, 'samples'], [m.m.cols.length, 'species'], m.mode === 'individual' ? [m.nmin, 'min n'] : [+R().chao1(m.pooled).estimate.toPrecision(3), 'Chao1']] : [[0, 'samples']]; },
  Controls,
  Render: ({ data }) => <RareSheet data={data} />,
};
