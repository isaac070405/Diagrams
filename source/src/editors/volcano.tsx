import { S } from '../sheet';
import { EmptyHint, num, Range, Spec, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';

const V = () => (window as any).SDVolcano;
const col = (i: number) => 'var(--swatch-' + ([3, 8, 12, 5, 14, 1, 10, 7, 16, 2][i % 10]) + ')';
const UP = col(2), DOWN = col(0);
const fm = (v: number) => (+v.toPrecision(3)).toString();

/* sheet geometry */
const L = 72, T = 20, PW = 520, PH = 400;

function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }
function model(data: any) {
  const rows = V().parse(data.text), fcT = num(data.fcT, 1), pT = num(data.pT, 0.05);
  const pts = V().classify(rows, fcT, pT, !!data.adjusted);
  return { rows, pts, fcT, pT, up: pts.filter((p: any) => p.cls === 'up'), down: pts.filter((p: any) => p.cls === 'down') };
}

function VolcanoSheet({ data }: { data: any }) {
  const m = model(data);
  if (m.pts.length < 2) return <EmptyHint text="Paste rows of name, log2 fold change and p value (one per line)." />;
  const out: any[] = []; let n = 0; const k = () => 'v' + n++;
  const xm = Math.max(Math.max(...m.pts.map((p: any) => Math.abs(p.fc))) * 1.08, m.fcT * 1.4, 1), ym = Math.max(Math.max(...m.pts.map((p: any) => p.y)) * 1.06, -Math.log10(m.pT) * 1.3, 2);
  const X = (v: number) => L + (v + xm) / (2 * xm) * PW, Y = (v: number) => T + PH - v / ym * PH;
  const xs = niceStep(2 * xm, 8), ys = niceStep(ym, 7);
  for (let v = Math.ceil(-xm / xs) * xs; v <= xm + 1e-9; v += xs) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={X(r)} y1={T + PH} x2={X(r)} y2={T + PH + 5} /><text x={X(r)} y={T + PH + 19} textAnchor="middle">{r}</text></g>); }
  for (let v = 0; v <= ym + 1e-9; v += ys) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>); }
  out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  if (data.thresholds !== false) {
    const yt = -Math.log10(m.pT);
    out.push(<line key={k()} className="vp-thr" x1={X(-m.fcT)} y1={T} x2={X(-m.fcT)} y2={T + PH} />, <line key={k()} className="vp-thr" x1={X(m.fcT)} y1={T} x2={X(m.fcT)} y2={T + PH} />);
    if (yt < ym) out.push(<line key={k()} className="vp-thr" x1={L} y1={Y(yt)} x2={L + PW} y2={Y(yt)} />);
  }
  out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + 42} textAnchor="middle">{data.xlabel || 'log2 fold change'}</text>);
  out.push(<text key={k()} className="km-title" x={22} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 22 ' + (T + PH / 2) + ')'}>{data.ylabel || (data.adjusted ? '−log10 adjusted p (BH)' : '−log10 p')}</text>);
  const r = num(data.size, 3.2), cls: any = { ns: 'vp-ns', up: 'vp-up', down: 'vp-down' };
  ['ns', 'down', 'up'].forEach(c => m.pts.filter((p: any) => p.cls === c).forEach((p: any) => out.push(<circle key={k()} className={'vp-pt ' + cls[c]} cx={X(p.fc)} cy={Y(p.y)} r={r} style={c === 'up' ? { fill: data.colUp || UP } : c === 'down' ? { fill: data.colDown || DOWN } : undefined} />)));
  /* labels for the most significant points, placed greedily without overlap */
  const nl = Math.round(num(data.labelN, 10));
  if (nl > 0) {
    const cand = m.pts.filter((p: any) => p.cls !== 'ns' && p.name).sort((a: any, b: any) => b.y - a.y || Math.abs(b.fc) - Math.abs(a.fc)).slice(0, nl);
    const placed: number[][] = [];
    const hit = (b: number[]) => placed.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]) || b[0] < L || b[2] > L + PW || b[1] < T || b[3] > T + PH;
    cand.forEach((p: any) => {
      const w = p.name.length * 6.2 + 4, h = 13, px = X(p.fc), py = Y(p.y);
      const opts = [[px + 6, py - 3], [px - 6 - w, py - 3], [px + 6, py - 16], [px - 6 - w, py - 16], [px + 6, py + 10], [px - 6 - w, py + 10], [px - w / 2, py - 18], [px - w / 2, py + 14]];
      for (const [x, y] of opts) { const b = [x, y - h + 3, x + w, y + 3]; if (!hit(b)) { placed.push(b); out.push(<text key={k()} className="vp-lab" x={x} y={y}>{p.name}</text>); break; } }
    });
  }
  if (data.legend !== false) {
    const lx = L + PW + 18;
    [[UP, data.colUp, 'Up (' + m.up.length + ')'], [DOWN, data.colDown, 'Down (' + m.down.length + ')'], ['var(--neutral-400)', undefined, 'Not significant (' + (m.pts.length - m.up.length - m.down.length) + ')']].forEach(([c, o, t]: any, i: number) => {
      out.push(<circle key={k()} className="vp-pt" cx={lx} cy={T + 14 + i * 18} r={4} style={{ fill: o || c }} />, <text key={k()} className="km-name" x={lx + 10} y={T + 18 + i * 18}>{t}</text>);
    });
  }
  return <g className="vp">{out}</g>;
}

function Controls({ data, set }: EditProps) {
  const m = model(data), fm1 = fm;
  const top = m.pts.filter((p: any) => p.cls !== 'ns').sort((a: any, b: any) => b.y - a.y).slice(0, 8);
  return (
    <>
      <Spec id="vp-text" label="Name, log2 fold change, p value" rows={8} value={data.text || ''} help="One row per gene or feature, separated by commas, tabs or spaces. Paste three spreadsheet columns straight in. A header row and bad rows are skipped."
        onChange={v => set({ text: v }, 'vp-text')} placeholder={'GENE1, 1.8, 0.0003'} />
      <S.Panel kicker="Thresholds" help="A point is called up or down when its fold change passes the cut and its p value is below the limit. Adjust for many tests with the Benjamini-Hochberg false discovery rate.">
        <div className="mk-pair">
          <TextIn id="vp-fc" label="Min |log2 FC|" value={data.fcT} placeholder="1" onChange={v => set({ fcT: v }, 'vp-fc')} />
          <TextIn id="vp-p" label="p limit" value={data.pT} placeholder="0.05" onChange={v => set({ pT: v }, 'vp-p')} />
        </div>
        <Toggle on={!!data.adjusted} label="Use adjusted p (Benjamini-Hochberg)" onChange={v => set({ adjusted: v })} />
      </S.Panel>
      <S.Panel kicker="Look">
        <TextIn id="vp-xl" label="x title" value={data.xlabel} placeholder="log2 fold change" onChange={v => set({ xlabel: v }, 'vp-xl')} />
        <TextIn id="vp-yl" label="y title" value={data.ylabel} placeholder="−log10 p" onChange={v => set({ ylabel: v }, 'vp-yl')} />
        <Range id="vp-n" label="Label the top points (0 = none)" value={num(data.labelN, 10)} min={0} max={30} onChange={v => set({ labelN: v }, 'vp-n')} />
        <Range id="vp-sz" label="Point size" value={num(data.size, 3.2)} min={1.5} max={6} step={0.1} onChange={v => set({ size: v }, 'vp-sz')} />
        <Toggle on={data.thresholds !== false} label="Threshold lines" onChange={v => set({ thresholds: v })} />
        <Toggle on={data.legend !== false} label="Legend with counts" onChange={v => set({ legend: v })} />
      </S.Panel>
      {m.pts.length ? <S.Panel kicker="Results" help="Counts use the thresholds above. The list shows the most significant points.">
        <ul className="tr-results">
          <li>{m.pts.length} rows: {m.up.length} up, {m.down.length} down, {m.pts.length - m.up.length - m.down.length} not significant</li>
          {top.map((p: any) => <li key={p.name + p.fc}><b>{p.name}</b>: log2 FC {fm1(p.fc)}, p {p.p < 0.001 ? p.p.toExponential(1) : fm1(p.p)}{data.adjusted ? ', q ' + (p.q < 0.001 ? p.q.toExponential(1) : fm1(p.q)) : ''}</li>)}
        </ul>
      </S.Panel> : null}
    </>
  );
}

/* reproducible sample data */
function rng(seed: number) { let s = seed; const u = () => { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; return { u, z: () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()) }; }
/* two-sided normal p: Abramowitz and Stegun erfc for small z, the Mills tail for large z */
function pOf(z: number) { z = Math.abs(z); if (z > 4) return Math.min(1, 2 * Math.exp(-z * z / 2) / (z * Math.sqrt(2 * Math.PI)) * (1 - 1 / (z * z))); const t = 1 / (1 + 0.3275911 * z / Math.SQRT2), x = z / Math.SQRT2; return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x); }
function sim(n: number, seed: number, named: string[], effects: number, big: number, seMin: number, seSpan: number) {
  const g = rng(seed), lines: string[] = [];
  for (let i = 0; i < n; i++) {
    const hit = i < effects, name = i < named.length ? named[i] : 'F' + String(i + 1).padStart(4, '0');
    const se = seMin + seSpan * g.u(), true_ = hit ? (g.u() < 0.5 ? -1 : 1) * (0.9 + big * g.u()) : 0.35 * g.z();
    const fc = true_ + se * g.z(), p = Math.max(1e-10, pOf(fc / se));
    lines.push(name + ', ' + (Math.round(fc * 100) / 100) + ', ' + (p < 0.001 ? p.toExponential(2) : (Math.round(p * 10000) / 10000)));
  }
  return lines.join('\n');
}
const metab = ['Betaine', 'Choline', 'Carnitine', 'Palmitic acid', 'Oleic acid', 'Linoleic acid', 'Stearic acid', 'Glucose', 'Fructose', 'Lactate', 'Pyruvate', 'Citrate', 'Succinate', 'Alanine', 'Glycine', 'Serine', 'Leucine', 'Isoleucine', 'Valine', 'Tyrosine', 'Tryptophan', 'Glutamine', 'Glutamate', 'Taurine', 'Creatinine', 'TMAO', 'Hippuric acid', 'Indoxyl sulfate', '3-Hydroxybutyrate', 'Acetylcarnitine', 'Proline betaine', 'EPA', 'DHA', 'Vitamin E'];

export const volcano: EditorDef = {
  id: 'volcano-plot', num: '36', name: 'Volcano plot', field: 'Cells and measurement',
  blurb: 'Effect size against significance for thousands of features: genes, proteins or metabolites, with thresholds and labels.',
  hint: 'Paste one row per feature: name, log2 fold change, p value. Thresholds and labels are set on the left.',
  templates: [
    { name: 'Differential expression', desc: '1,200 simulated genes', title: 'Differential gene expression, treated against control',
      caption: 'Simulated differential expression for 1,200 genes. Dashed lines: |log2 fold change| = 1 and p = 0.05. Red: up in treated. Blue: down. The 12 most significant genes are labelled. Sample data for practice.',
      data: { text: sim(1200, 5, [], 90, 1.5, 0.3, 0.45), fcT: '1', pT: '0.05', labelN: 12, adjusted: false } },
    { name: 'Metabolomics, diet against control', desc: '300 features, adjusted p', title: 'Serum metabolites after a dietary intervention',
      caption: 'Simulated serum metabolite changes (diet against control) for 300 features, with Benjamini-Hochberg adjusted p values. Names are labels for practice data only. Sample data for practice.',
      data: { text: sim(300, 11, metab, 18, 1.1, 0.25, 0.3), fcT: '0.58', pT: '0.05', labelN: 14, adjusted: true, xlabel: 'log2 fold change (diet / control)' } },
  ],
  blank: { text: 'A, 2.1, 0.0004\nB, -1.6, 0.003\nC, 0.3, 0.4\nD, -0.4, 0.2\nE, 1.2, 0.04\nF, -2.4, 0.00002\nG, 0.1, 0.8\nH, 0.9, 0.06', fcT: '1', pT: '0.05', labelN: 6 },
  stats: d => { const m = model(d); return m.pts.length ? [[m.pts.length, 'rows'], [m.up.length, 'up'], [m.down.length, 'down']] : [[0, 'rows']]; },
  Controls,
  Render: ({ data }) => <VolcanoSheet data={data} />,
};
