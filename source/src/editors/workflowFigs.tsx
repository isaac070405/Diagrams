import { S } from '../sheet';
import { layout, Molecule } from '../lib/molecule';
import { num } from '../ui';
import { CellG, YG } from './workflowArt';

/* Special figures for the Experimental workflow editor. Each one draws from (0, 0) at the size its `size` returns. */

export const Defs = () => (
  <defs>
    <marker id="wf-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--ink)' }} /></marker>
    <marker id="wf-head-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style={{ fill: '#2f5d9a' }} /></marker>
    <marker id="wf-head-soft" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style={{ fill: '#8da7cc' }} /></marker>
  </defs>
);

const T = (p: any) => <text className={p.c || 'wf-fig-text'} x={p.x} y={p.y} textAnchor={p.a || 'start'} transform={p.t} style={p.style}>{p.children}</text>;
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()); }
const fmt = (v: number) => { const a = Math.abs(v); return a >= 100 ? String(Math.round(v)) : a >= 10 ? String(+v.toFixed(1)) : String(+v.toPrecision(3)); };

/* ================= 96-well plate ================= */
export const PLATE_MODES: [string, string][] = [['elisa', 'ELISA (standards, blank, samples)'], ['ldh', 'Cytotoxicity (controls and doses)']];
const SP = 26, PX = 26, PY = 20;
function wellOf(d: any, c: number, r: number) {
  const p = d.plate;
  if (p.mode === 'ldh') {
    if (r === 0) { const g = Math.floor(c / 3); return { kind: ['bg', 'spont', 'max', 'vol'][g], text: ['M', 'Sp', 'Mx', 'V'][g], idx: g }; }
    return { kind: 'dose', idx: Math.floor(c / 3), text: '' };
  }
  const R = Math.max(1, Math.min(4, Math.round(num(p.reps, 2))));
  if (c < R) return r < 7 ? { kind: 'std', idx: r, text: 'S' + (r + 1) } : { kind: 'blank', idx: 0, text: 'B' };
  const g = Math.floor((c - R) / R), n = g * 8 + r;
  return n < num(p.samples, 16) ? { kind: 'sample', idx: n, text: String(n + 1) } : { kind: 'none', idx: 0, text: '' };
}
const KIND_FILL: any = { std: 'var(--accent-700)', blank: 'var(--neutral-500)', sample: 'var(--swatch-9)', none: 'var(--paper)', bg: 'var(--neutral-500)', spont: 'var(--swatch-4)', max: 'var(--swatch-11)', vol: 'var(--swatch-15)', dose: 'var(--accent-700)' };
export const plateFig = {
  size: (_d: any): [number, number] => [PX + 12 * SP + 200, PY + 8 * SP + 6],
  draw: (d: any) => {
    const p = d.plate, out: any[] = [], ldh = p.mode === 'ldh';
    const R = Math.max(1, Math.min(4, Math.round(num(p.reps, 2))));
    out.push(<rect key="frame" className="wf-outline" x={PX - 4} y={PY - 4} width={12 * SP + 8} height={8 * SP + 8} rx={10} style={{ fill: 'var(--neutral-100)' }} />);
    for (let c = 0; c < 12; c++) out.push(<T key={'c' + c} x={PX + c * SP + SP / 2} y={PY - 9} a="middle" c="wf-axis">{c + 1}</T>);
    for (let r = 0; r < 8; r++) out.push(<T key={'r' + r} x={PX - 12} y={PY + r * SP + SP / 2 + 3.5} a="middle" c="wf-axis">{'ABCDEFGH'[r]}</T>);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) {
      const w: any = wellOf(d, c, r), cx = PX + c * SP + SP / 2, cy = PY + r * SP + SP / 2;
      let op = 1;
      if (w.kind === 'std') op = 1 - (w.idx / 7) * 0.8;
      if (w.kind === 'dose') op = 0.25 + (w.idx / 3) * 0.75;
      if (w.kind === 'sample') op = 0.75;
      const light = w.kind === 'none' ? 0 : 1;
      out.push(<g key={r * 12 + c}>
        <circle cx={cx} cy={cy} r={SP * 0.4} style={{ fill: 'var(--paper)', stroke: 'var(--ink)', strokeWidth: 1 }} />
        {light ? <circle cx={cx} cy={cy} r={SP * 0.4 - 0.6} style={{ fill: KIND_FILL[w.kind], opacity: op }} /> : null}
        {w.text ? <T x={cx} y={cy + 3} a="middle" c="wf-well" style={{ fill: op > 0.55 ? '#fff' : 'var(--ink)' }}>{w.text}</T> : null}
      </g>);
    }
    /* legend */
    const lx = PX + 12 * SP + 22; let ly = PY + 6;
    const key = (fill: string, op: number, label: string, sub?: string) => {
      out.push(<g key={'k' + ly}><circle cx={lx + 8} cy={ly + 6} r={7.5} style={{ fill: 'var(--paper)', stroke: 'var(--ink)', strokeWidth: 1 }} /><circle cx={lx + 8} cy={ly + 6} r={7} style={{ fill, opacity: op }} />
        <T x={lx + 24} y={ly + 10} c="wf-leg">{label}</T>{sub ? <T x={lx + 24} y={ly + 23} c="wf-leg-sub">{sub}</T> : null}</g>);
      ly += sub ? 36 : 25;
    };
    if (!ldh) {
      const top = num(p.top, 1000), f = Math.max(1.1, num(p.dilution, 2));
      key(KIND_FILL.std, 1, `Standards S1 to S7`, `${fmt(top)} to ${fmt(top / Math.pow(f, 6))} ${p.unit || ''}, ${R} wells each`);
      key(KIND_FILL.blank, 1, 'Blank (B)', 'Buffer only, no analyte');
      key(KIND_FILL.sample, 0.75, `Samples 1 to ${Math.min(num(p.samples, 16), 8 * Math.floor((12 - R) / R))}`, `${R} wells each`);
      key('var(--paper)', 0, 'Unused');
    } else {
      key(KIND_FILL.bg, 1, 'M: medium only', 'Background');
      key(KIND_FILL.spont, 1, 'Sp: spontaneous release', 'Untreated cells');
      key(KIND_FILL.max, 1, 'Mx: maximum release', 'Cells plus lysis buffer');
      key(KIND_FILL.vol, 1, 'V: volume control');
      key(KIND_FILL.dose, 0.4, 'Rows B to H: compounds 1 to 7', 'Four doses, low to high, in triplicate');
    }
    return <g>{out}</g>;
  },
};

/* ================= well cross-section (ELISA formats) ================= */
export const WELL_TYPES: [string, string][] = [['direct', 'Direct'], ['indirect', 'Indirect'], ['sandwich', 'Sandwich'], ['competitive', 'Competitive']];
const AG = 'var(--swatch-12)', AB1 = 'var(--accent-700)', AB2 = 'var(--swatch-9)', ENZ = '#e0b23c';
const antigen = (x: number, y: number, k?: any) => <circle key={k} cx={x} cy={y} r={6} style={{ fill: AG, stroke: 'var(--ink)', strokeWidth: 0.9 }} />;
const WELL_LEG: any = {
  direct: [['ag', 'Antigen coated on the well'], ['abE', 'Enzyme-labelled primary antibody']],
  indirect: [['ag', 'Antigen coated on the well'], ['ab1', 'Primary antibody'], ['abE', 'Enzyme-labelled secondary antibody']],
  sandwich: [['ab1', 'Capture antibody'], ['ag', 'Antigen from the sample'], ['abE', 'Enzyme-labelled detection antibody']],
  competitive: [['ag', 'Antigen (coated, or free from the sample)'], ['abE', 'Enzyme-labelled antibody']],
};
export const wellFig = {
  size: (_d: any): [number, number] => [310, 320],
  draw: (d: any) => {
    const type = d.well.type, S0 = 204, out: any[] = [];
    out.push(<path key="liq" d={`M${68},${S0 - 160} L${69},190 Q70,${S0} 84,${S0} H216 Q230,${S0} 231,190 L${232},${S0 - 160} Z`} style={{ fill: '#7fb4e6', opacity: d.well.colour === false ? 0 : 0.28 }} />);
    out.push(<path key="w" className="wf-outline" d={`M60,10 L68,190 Q70,${S0} 84,${S0} H216 Q230,${S0} 232,190 L240,10`} />);
    const xs = [105, 150, 195];
    if (type === 'direct') xs.forEach(x => { out.push(antigen(x, 198, 'a' + x), <YG key={'y' + x} x={x} y={192} dir="down" color={AB1} enz={ENZ} />); });
    if (type === 'indirect') xs.forEach(x => { out.push(antigen(x, 198, 'a' + x), <YG key={'p' + x} x={x} y={192} dir="down" color={AB1} />, <YG key={'s' + x} x={x} y={165} dir="down" color={AB2} enz={ENZ} />); });
    if (type === 'sandwich') xs.forEach(x => { out.push(<YG key={'c' + x} x={x} y={S0} dir="up" color={AB1} />, antigen(x, 172, 'a' + x), <YG key={'d' + x} x={x} y={164} dir="down" color={AB2} enz={ENZ} />); });
    if (type === 'competitive') {
      xs.forEach(x => out.push(antigen(x, 198, 'a' + x)));
      out.push(<YG key="b1" x={105} y={192} dir="down" color={AB1} enz={ENZ} />);
      out.push(antigen(188, 112, 'fa'), <YG key="b2" x={188} y={105} dir="down" color={AB1} enz={ENZ} />, <YG key="b3" x={118} y={120} dir="up" color={AB1} enz={ENZ} />);
      out.push(<path key="wa" className="wf-thin" d="M190,64 V36" style={{ markerEnd: 'url(#wf-head)' }} />, <T key="wt" x={184} y={32} a="end" c="wf-leg-sub">washed away</T>);
    }
    /* legend */
    let ly = S0 + 26;
    out.push(<g key="lsub"><rect x={70} y={ly + 4 + 20 * WELL_LEG[type].length - 12} width={12} height={12} style={{ fill: '#7fb4e6', opacity: 0.5, stroke: 'var(--ink)', strokeWidth: 0.8 }} /><T x={92} y={ly + 4 + 20 * WELL_LEG[type].length - 2} c="wf-leg">Substrate turns blue where enzyme is bound</T></g>);
    WELL_LEG[type].forEach(([sym, label]: [string, string], i: number) => {
      const y = ly + i * 20;
      out.push(<g key={'l' + i}>
        {sym === 'ag' ? antigen(76, y - 4) : sym === 'ab1' ? <YG x={76} y={y + 3} dir="up" color={AB1} s={0.55} /> : <YG x={76} y={y + 3} dir="up" color={AB1} enz={ENZ} s={0.55} />}
        <T x={92} y={y} c="wf-leg">{label}</T>
      </g>);
    });
    return <g>{out}</g>;
  },
};

/* ================= PCR ================= */
export const thermalFig = {
  size: (_d: any): [number, number] => [600, 252],
  draw: (d: any) => {
    const t = d.thermal, x0 = 52, yb = 190, H = 150, Y = (v: number) => yb - (Math.max(0, Math.min(100, v)) / 100) * H, ramp = 9;
    const seg: [number, number, string, string][] = [
      [num(t.init, 95), 50, t.initT, ''],
      [num(t.den, 95), 28, t.denT, ''], [num(t.ann, 55), 28, t.annT, ''], [num(t.ext, 72), 36, t.extT, ''],
      [num(t.den, 95), 28, '', ''], [num(t.ann, 55), 28, '', ''], [num(t.ext, 72), 36, '', ''],
      [num(t.den, 95), 28, '', ''], [num(t.ann, 55), 28, '', ''], [num(t.ext, 72), 36, '', ''],
      [num(t.fin, 72), 50, t.finT, ''], [num(t.hold, 4), 40, '∞', ''],
    ];
    let x = x0, pts: string[] = [`${x0 - 14},${Y(seg[0][0])}`]; const out: any[] = [];
    const marks: any[] = [];
    seg.forEach(([T0, w, time, name], i) => {
      pts.push(`${x},${Y(T0)}`); pts.push(`${x + w},${Y(T0)}`);
      const showLab = i < 4 || i >= 10;
      if (showLab) {
        marks.push(<g key={'m' + i}><T x={x + w / 2} y={Y(T0) - 7} a="middle" c="wf-fig-bold">{fmt(T0)} °C</T>{time ? <T x={x + w / 2} y={yb + 14} a="middle" c="wf-leg-sub">{time}</T> : null}
          {name ? <T x={x + w / 2} y={Y(T0) + 16} a="middle" c="wf-leg-sub" style={{ fill: 'var(--neutral-700)' }}>{name}</T> : null}</g>);
      }
      x += w + ramp;
      if (i === 3 || i === 6) x += 0;
    });
    const xCycStart = x0 + 50 + ramp, xCycEnd = xCycStart + 3 * (28 + 28 + 36 + 3 * ramp) - ramp;
    out.push(<polyline key="p" points={pts.join(' ')} className="wf-profile" />);
    out.push(<path key="ax" className="wf-axisline" d={`M${x0 - 14},${Y(100) - 6} V${yb} H${x + 6}`} />);
    [0, 25, 50, 75, 100].forEach(v => out.push(<g key={'t' + v}><line className="wf-axisline" x1={x0 - 18} x2={x0 - 14} y1={Y(v)} y2={Y(v)} /><T x={x0 - 22} y={Y(v) + 3.5} a="end" c="wf-axis">{v}</T></g>));
    out.push(<T key="yl" x={0} y={0} a="middle" c="wf-axis" t={`translate(8 ${Y(50)}) rotate(-90)`}>Temperature (°C)</T>);
    out.push(<T key="xl" x={(x0 + x) / 2} y={yb + 34} a="middle" c="wf-axis">Time</T>);
    out.push(<path key="br" className="wf-axisline" d={`M${xCycStart - 4},${Y(95) - 16} V${Y(95) - 24} H${xCycEnd + 4} V${Y(95) - 16}`} />);
    out.push(<T key="cy" x={(xCycStart + xCycEnd) / 2} y={Y(95) - 30} a="middle" c="wf-fig-bold">{'× ' + (t.cycles || 30) + ' cycles'}</T>);
    return <g>{out}{marks}</g>;
  },
};

export const cycleFig = {
  size: (_d: any): [number, number] => [520, 168],
  draw: (d: any) => {
    const t = d.thermal, out: any[] = [], wv = (x: number, y: number, w: number, col: string, k: string) => {
      const pts = Array.from({ length: 21 }, (_, i) => `${x + (i / 20) * w},${y + Math.sin(i * 1.3) * 2.6}`).join(' ');
      return <polyline key={k} className="wf-strand" points={pts} style={{ stroke: col }} />;
    };
    const A = 'var(--accent-700)', B = 'var(--swatch-9)', NEW = 'var(--swatch-4)';
    const panels = [
      { name: 'Denature', temp: fmt(num(t.den, 95)) + ' °C', note: 'Heat separates the two strands' },
      { name: 'Anneal', temp: fmt(num(t.ann, 55)) + ' °C', note: 'Primers bind their targets' },
      { name: 'Extend', temp: fmt(num(t.ext, 72)) + ' °C', note: 'Polymerase copies each strand' },
    ];
    panels.forEach((p, i) => {
      const ox = i * 180 + 4;
      out.push(<g key={'p' + i}>
        <rect x={ox} y={4} width={150} height={96} rx={6} style={{ fill: 'var(--neutral-100)', stroke: 'var(--neutral-400)', strokeWidth: 1 }} />
        {wv(ox + 12, 34, 126, A, 'a')}{wv(ox + 12, 76, 126, B, 'b')}
        {i >= 1 ? <g>
          <line x1={ox + 20} y1={72} x2={ox + 52} y2={72} className="wf-primer" style={{ stroke: NEW }} /><path d="M52,0 l-5,-3 v6z" transform={`translate(${ox},72)`} style={{ fill: NEW }} />
          <line x1={ox + 130} y1={38} x2={ox + 98} y2={38} className="wf-primer" style={{ stroke: NEW }} /><path d="M-52,0 l5,-3 v6z" transform={`translate(${ox + 150},38)`} style={{ fill: NEW }} />
        </g> : null}
        {i === 2 ? <g>
          <line x1={ox + 20} y1={72} x2={ox + 92} y2={72} className="wf-primer" style={{ stroke: NEW }} /><path d="M92,0 l-6,-3.5 v7z" transform={`translate(${ox},72)`} style={{ fill: NEW }} />
          <line x1={ox + 130} y1={38} x2={ox + 58} y2={38} className="wf-primer" style={{ stroke: NEW }} /><path d="M-92,0 l6,-3.5 v7z" transform={`translate(${ox + 150},38)`} style={{ fill: NEW }} />
          <circle cx={ox + 98} cy={72} r={5.5} style={{ fill: '#e0b23c', stroke: 'var(--ink)', strokeWidth: 0.9 }} /><circle cx={ox + 52} cy={38} r={5.5} style={{ fill: '#e0b23c', stroke: 'var(--ink)', strokeWidth: 0.9 }} />
        </g> : null}
        <T x={ox + 75} y={120} a="middle" c="wf-fig-bold">{(i + 1) + '  ' + p.name + ', ' + p.temp}</T>
        <T x={ox + 75} y={136} a="middle" c="wf-leg-sub">{p.note}</T>
        {i < 2 ? <path className="wf-thin" d={`M${ox + 156},52 H${ox + 174}`} style={{ markerEnd: 'url(#wf-head)' }} /> : null}
      </g>);
    });
    out.push(<T key="lg" x={4} y={160} c="wf-leg-sub">Primers (green) are extended by DNA polymerase (gold). Each cycle doubles the number of copies.</T>);
    return <g>{out}</g>;
  },
};

export const doublingFig = {
  size: (_d: any): [number, number] => [300, 200],
  draw: (d: any) => {
    const n = Math.max(1, Math.round(num(d.thermal.cycles, 30))), out: any[] = [];
    const vals = [0, 1, 2, 3, 4, 5].map(i => Math.pow(2, i));
    vals.forEach((v, i) => {
      const h = (Math.log2(v) / 5) * 90 + 6, x = 24 + i * 44;
      out.push(<g key={i}><rect x={x} y={120 - h} width={30} height={h} style={{ fill: 'var(--accent-700)', opacity: 0.45 + i * 0.1 }} /><T x={x + 15} y={114 - h} a="middle" c="wf-fig-bold">{v}</T><T x={x + 15} y={136} a="middle" c="wf-axis">{i}</T></g>);
    });
    out.push(<line key="b" className="wf-axisline" x1={16} x2={290} y1={120} y2={120} />, <T key="xl" x={153} y={152} a="middle" c="wf-axis">Cycle number</T>);
    const copies = Math.pow(2, n), exp = Math.floor(Math.log10(copies)), man = copies / Math.pow(10, exp);
    out.push(<T key="t1" x={153} y={174} a="middle" c="wf-leg">{`Ideal yield after ${n} cycles:`}</T>);
    out.push(<T key="t2" x={153} y={190} a="middle" c="wf-fig-bold">{`2^${n} ≈ ${n > 19 ? man.toFixed(1) + ' × 10^' + exp : copies.toLocaleString('en-US')} copies per template`.replace(/\^(\d+)/g, (_m, g) => toSup(g))}</T>);
    return <g>{out}</g>;
  },
};
const toSup = (s: string) => s.replace(/\d/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]);

/* ================= gel ================= */
const LADDER = '5000,3000,2000,1500,1000,750,500,250,100';
export const gelFig = {
  size: (d: any): [number, number] => [70 + Math.max(2, d.gel.lanes.length) * 44 + 54, 296],
  draw: (d: any) => {
    const g = d.gel, lanes: any[] = g.lanes, lw = 44, x0 = 70, gy = 52, GH = 214, GW = lanes.length * lw + 16;
    const lo = Math.log10(Math.max(10, num(g.min, 100))), hi = Math.log10(Math.max(20, num(g.max, 10000)));
    const Y = (bp: number) => gy + 26 + ((hi - Math.log10(Math.max(1, bp))) / ((hi - lo) || 1)) * (GH - 52);
    const dark = !g.invert, out: any[] = [];
    out.push(<rect key="g" className="wf-outline" x={x0} y={gy} width={GW} height={GH} rx={3} style={{ fill: dark ? '#17212b' : '#f6f8f4' }} />);
    const long = Math.max(...lanes.map((l: any) => String(l.name || '').length)) > 6;
    lanes.forEach((l: any, i: number) => {
      const cx = x0 + 8 + lw * (i + 0.5);
      out.push(<rect key={'w' + i} x={cx - 14} y={gy + 6} width={28} height={9} style={{ fill: dark ? '#05090d' : '#d9ded6', stroke: dark ? '#4c5b69' : 'var(--neutral-500)', strokeWidth: 0.8 }} />);
      out.push(long ? <T key={'n' + i} x={cx + 4} y={gy - 8} c="wf-leg" t={`rotate(-38 ${cx + 4} ${gy - 8})`}>{l.name}</T> : <T key={'n' + i} x={cx} y={gy - 8} a="middle" c="wf-leg">{l.name}</T>);
      String(l.bands || '').split(/[,\s]+/).map(s => parseFloat(s)).filter(v => isFinite(v) && v > 0).forEach((bp, j) => {
        const y = Y(bp), col = dark ? '#f2f6fa' : '#27394d';
        out.push(<g key={'b' + i + '_' + j}><rect x={cx - 15} y={y - 4} width={30} height={8} rx={4} style={{ fill: col, opacity: l.ladder ? 0.16 : 0.2 }} /><rect x={cx - 13} y={y - 1.8} width={26} height={3.6} rx={1.8} style={{ fill: col, opacity: l.ladder ? 0.72 : 0.95 }} /></g>);
        if (l.ladder && i === lanes.findIndex((q: any) => q.ladder)) out.push(<g key={'k' + j}><line className="wf-axisline" x1={x0 - 6} x2={x0} y1={y} y2={y} /><T x={x0 - 9} y={y + 3.5} a="end" c="wf-axis">{bp}</T></g>);
      });
    });
    const ax = x0 + GW + 20;
    out.push(<path key="ar" className="wf-thin" d={`M${ax},${gy + 20} V${gy + GH - 20}`} style={{ markerEnd: 'url(#wf-head)' }} />);
    out.push(<T key="neg" x={ax + 6} y={gy + 18} c="wf-axis">−</T>, <T key="pos" x={ax + 6} y={gy + GH - 14} c="wf-axis">+</T>);
    out.push(<T key="bp" x={x0 - 9} y={gy + GH + 18} a="end" c="wf-axis">bp</T>, <T key="dir" x={x0 + GW / 2} y={gy + GH + 18} a="middle" c="wf-leg-sub">DNA runs towards the anode (+)</T>);
    return <g>{out}</g>;
  },
};
export const DEFAULT_LANES = [{ name: 'Ladder', bands: LADDER, ladder: true }, { name: 'Sample 1', bands: '1000' }, { name: 'Sample 2', bands: '750,500' }, { name: 'Control +', bands: '1000' }, { name: 'Control −', bands: '' }];

/* ================= titration ================= */
export const INDICATORS: [string, string, number, number][] = [['phenolphthalein', 'Phenolphthalein', 8.2, 10], ['bromothymol', 'Bromothymol blue', 6, 7.6], ['methylred', 'Methyl red', 4.4, 6.2], ['methylorange', 'Methyl orange', 3.1, 4.4], ['none', 'No indicator', 0, 0]];
export function titration(d: any) {
  const t = d.titr, Ca = num(t.ca, 0.1), Va = num(t.va, 25), Cb = num(t.cb, 0.1), weak = t.type === 'wasb', Ka = Math.pow(10, -num(t.pka, 4.76)), Kw = 1e-14;
  const veq = (Ca * Va) / (Cb || 1e-9), vmax = veq * 2;
  const ph = (v: number) => {
    const Vt = Va + v, na = (Cb * v) / Vt, ca = (Ca * Va) / Vt;
    const f = (lh: number) => { const h = Math.pow(10, lh); const A = weak ? (ca * Ka) / (Ka + h) : ca; return h + na - Kw / h - A; };
    let a = -14, b = 0;
    for (let i = 0; i < 70; i++) { const m = (a + b) / 2; if (f(m) > 0) b = m; else a = m; }
    return -((a + b) / 2);
  };
  const pts: [number, number][] = []; for (let i = 0; i <= 200; i++) { const v = (i / 200) * vmax; pts.push([v, ph(v)]); }
  return { pts, veq, vmax, pHeq: ph(veq), weak, half: weak ? [veq / 2, ph(veq / 2)] : null };
}
export const titrFig = {
  size: (_d: any): [number, number] => [470, 280],
  draw: (d: any) => {
    const t = titration(d), X0 = 50, Y0 = 20, W = 360, H = 210, out: any[] = [];
    const X = (v: number) => X0 + (v / t.vmax) * W, Y = (p: number) => Y0 + H - (p / 14) * H;
    const ind = INDICATORS.find(i => i[0] === d.titr.indicator);
    if (ind && ind[0] !== 'none') out.push(<g key="ind"><rect x={X0} y={Y(ind[3])} width={W} height={Y(ind[2]) - Y(ind[3])} style={{ fill: 'var(--swatch-13)', opacity: 0.16 }} /><T x={X0 + W + 6} y={(Y(ind[2]) + Y(ind[3])) / 2 + 3.5} c="wf-leg-sub">{ind[1]}</T><T x={X0 + W + 6} y={(Y(ind[2]) + Y(ind[3])) / 2 + 16} c="wf-leg-sub">{'pH ' + ind[2] + ' to ' + ind[3]}</T></g>);
    [0, 2, 4, 6, 8, 10, 12, 14].forEach(p => out.push(<g key={'y' + p}><line className="wf-grid" x1={X0} x2={X0 + W} y1={Y(p)} y2={Y(p)} /><T x={X0 - 8} y={Y(p) + 3.5} a="end" c="wf-axis">{p}</T></g>));
    const step = [1, 2, 5, 10, 20, 25, 50].find(s => t.vmax / s <= 8) || 100;
    for (let v = 0; v <= t.vmax + 1e-6; v += step) out.push(<g key={'x' + v}><line className="wf-axisline" x1={X(v)} x2={X(v)} y1={Y0 + H} y2={Y0 + H + 4} /><T x={X(v)} y={Y0 + H + 16} a="middle" c="wf-axis">{fmt(v)}</T></g>);
    out.push(<path key="ax" className="wf-axisline" d={`M${X0},${Y0} V${Y0 + H} H${X0 + W}`} />);
    out.push(<polyline key="c" className="wf-profile" points={t.pts.map(([v, p]) => `${X(v)},${Y(p)}`).join(' ')} />);
    out.push(<path key="eq" className="wf-guide" d={`M${X(t.veq)},${Y0 + H} V${Y(t.pHeq)} H${X0}`} />);
    out.push(<circle key="ep" cx={X(t.veq)} cy={Y(t.pHeq)} r={4.5} style={{ fill: RED_, stroke: 'var(--paper)', strokeWidth: 1.2 }} />);
    out.push(<T key="el" x={X(t.veq) + 10} y={Y(t.pHeq) + 18} c="wf-fig-bold">{`Equivalence point: ${fmt(t.veq)} mL, pH ${t.pHeq.toFixed(2)}`}</T>);
    if (t.half) {
      out.push(<path key="hf" className="wf-guide" d={`M${X(t.half[0])},${Y0 + H} V${Y(t.half[1])} H${X0}`} />, <circle key="hp" cx={X(t.half[0])} cy={Y(t.half[1])} r={3.8} style={{ fill: 'var(--accent-700)', stroke: 'var(--paper)', strokeWidth: 1.2 }} />,
        <T key="hl" x={X(t.half[0]) + 8} y={Y(t.half[1]) + 16} c="wf-leg-sub">{`Half-equivalence: pH = pKa = ${num(d.titr.pka, 4.76)}`}</T>);
    }
    out.push(<T key="xl" x={X0 + W / 2} y={Y0 + H + 36} a="middle" c="wf-axis">Volume of titrant added (mL)</T>);
    out.push(<T key="yl" x={0} y={0} a="middle" c="wf-axis" t={`translate(10 ${Y0 + H / 2}) rotate(-90)`}>pH</T>);
    return <g>{out}</g>;
  },
};
const RED_ = '#c8433a';

/* ================= flow cytometry ================= */
export const fluidicsFig = {
  size: (_d: any): [number, number] => [470, 262],
  draw: (_d: any) => {
    const BLUE = '#3f6fc4';
    return <g>
      {/* sheath and sample */}
      <rect className="wf-outline" x={18} y={8} width={96} height={40} rx={4} style={{ fill: '#dbe9f6' }} /><T x={66} y={32} a="middle" c="wf-leg">Sheath fluid</T>
      <path className="wf-line" d="M66,48 V70 H168" style={{ fill: 'none' }} /><path className="wf-thin" d="M150,70 H168" style={{ markerEnd: 'url(#wf-head)' }} />
      <path className="wf-outline" d="M232,8 h30 v10 l-4,28 h-22 l-4,-28 z" style={{ fill: '#f3e1e1' }} /><T x={282} y={22} c="wf-leg">Sample (cells)</T>
      <path className="wf-thin" d="M217,46 V108" />
      {/* flow cell */}
      <path className="wf-outline" d="M172,58 H262 L226,130 V220 H208 V130 Z" style={{ fill: '#eef5fb' }} />
      <rect x={215} y={110} width={4} height={110} style={{ fill: '#f0b9b9' }} />
      {[150, 176, 202].map((y, i) => <circle key={y} cx={217} cy={y} r={4} style={{ fill: i === 0 ? '#e0803a' : '#c1556f', stroke: 'var(--ink)', strokeWidth: 0.8 }} />)}
      <T x={266} y={96} c="wf-leg-sub">hydrodynamic focusing</T>
      <T x={200} y={192} a="end" c="wf-leg-sub">cells pass one at a time</T>
      {/* laser */}
      <rect className="wf-outline" x={14} y={134} width={62} height={26} rx={4} style={{ fill: 'var(--neutral-100)' }} /><T x={45} y={151} a="middle" c="wf-leg">Laser</T>
      <line x1={76} y1={147} x2={212} y2={147} style={{ stroke: BLUE, strokeWidth: 3.2 }} />
      <circle cx={217} cy={147} r={7} style={{ fill: 'none', stroke: BLUE, strokeWidth: 1.4 }} />
      {/* forward scatter */}
      <line x1={224} y1={147} x2={330} y2={147} style={{ stroke: BLUE, strokeWidth: 1.6, strokeDasharray: '5 3', opacity: 0.8 }} />
      <rect className="wf-outline" x={330} y={132} width={110} height={30} rx={3} style={{ fill: 'var(--neutral-100)' }} /><T x={385} y={151} a="middle" c="wf-leg">FSC detector</T><T x={385} y={177} a="middle" c="wf-leg-sub">cell size</T>
      {/* side scatter and fluorescence */}
      <path d="M222,153 L262,212 H410" style={{ fill: 'none', stroke: '#6b8e5a', strokeWidth: 1.8, strokeDasharray: '5 3' }} />
      <line x1={292} y1={202} x2={304} y2={222} style={{ stroke: 'var(--ink)', strokeWidth: 2 }} /><line x1={352} y1={202} x2={364} y2={222} style={{ stroke: 'var(--ink)', strokeWidth: 2 }} />
      <rect className="wf-outline" x={272} y={182} width={46} height={18} rx={3} style={{ fill: 'var(--neutral-100)' }} /><T x={295} y={194.5} a="middle" c="wf-leg-sub">SSC</T>
      <rect className="wf-outline" x={334} y={182} width={46} height={18} rx={3} style={{ fill: '#d7ecd4' }} /><T x={357} y={194.5} a="middle" c="wf-leg-sub">FL1</T>
      <rect className="wf-outline" x={406} y={198} width={52} height={28} rx={3} style={{ fill: '#f6dcc2' }} /><T x={432} y={215} a="middle" c="wf-leg-sub">FL2</T>
      <T x={262} y={240} c="wf-leg-sub">dichroic mirrors split light by colour</T>
      <path className="wf-thin" d="M217,222 V250" style={{ markerEnd: 'url(#wf-head)' }} /><T x={226} y={258} c="wf-leg-sub">waste</T>
    </g>;
  },
};

function inside(pt: [number, number], poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export const gatingFig = {
  size: (_d: any): [number, number] => [600, 214],
  draw: (d: any) => {
    const f = d.flow, r = rng(11), Wd = 164, out: any[] = [];
    const clamp = (v: number) => Math.max(0.02, Math.min(0.98, v));
    const plot = (ox: number, title: string, xl: string, yl: string, pts: [number, number][], extra: any) => {
      out.push(<g key={title}>
        <T x={ox} y={12} c="wf-fig-bold">{title}</T>
        <rect x={ox} y={22} width={Wd} height={Wd} style={{ fill: 'var(--paper)', stroke: 'var(--ink)', strokeWidth: 1.2 }} />
        {pts.map(([a, b], i) => <circle key={i} cx={ox + a * Wd} cy={22 + (1 - b) * Wd} r={1.25} style={{ fill: 'var(--accent-700)', opacity: 0.5 }} />)}
        {extra}
        <T x={ox + Wd / 2} y={22 + Wd + 15} a="middle" c="wf-axis">{xl}</T>
        <T x={0} y={0} a="middle" c="wf-axis" t={`translate(${ox - 8} ${22 + Wd / 2}) rotate(-90)`}>{yl}</T>
      </g>);
    };
    const blob = (n: number, cx: number, cy: number, sx: number, sy: number, rho = 0) => Array.from({ length: n }, () => { const a = gauss(r), b = gauss(r); return [clamp(cx + sx * a), clamp(cy + sy * (rho * a + Math.sqrt(1 - rho * rho) * b))] as [number, number]; });
    /* 1 cells */
    const p1 = [...blob(70, 0.1, 0.12, 0.05, 0.05), ...blob(150, 0.33, 0.2, 0.05, 0.045), ...blob(50, 0.5, 0.42, 0.055, 0.07), ...blob(110, 0.72, 0.6, 0.07, 0.08)];
    const g1: [number, number][] = [[0.2, 0.08], [0.5, 0.1], [0.5, 0.36], [0.2, 0.36]];
    const in1 = p1.filter(p => inside(p, g1)).length;
    const poly = (g: [number, number][], ox: number) => g.map(([a, b]) => `${ox + a * Wd},${22 + (1 - b) * Wd}`).join(' ');
    plot(0, '1  Cells', 'FSC-A', 'SSC-A', p1, <g><polygon points={poly(g1, 0)} className="wf-gate" /><T x={0 + 0.22 * Wd} y={22 + (1 - 0.4) * Wd} c="wf-gate-text">{f.pop1 || 'Lymphocytes'} {Math.round(in1 / p1.length * 100)}%</T></g>);
    /* 2 singlets */
    const p2 = [...Array.from({ length: 200 }, () => { const x = 0.12 + r() * 0.78; return [x, clamp(x * 0.95 + gauss(r) * 0.02)] as [number, number]; }), ...Array.from({ length: 35 }, () => { const x = 0.35 + r() * 0.55; return [x, clamp(x * 0.58 + gauss(r) * 0.03)] as [number, number]; })];
    const g2: [number, number][] = [[0.08, 0.04], [0.14, 0.0], [0.97, 0.88], [0.9, 0.99], [0.04, 0.2]];
    const g2b: [number, number][] = [[0.06, 0.06], [0.18, 0.02], [0.98, 0.86], [0.94, 0.99], [0.02, 0.14]];
    const in2 = p2.filter(p => inside(p, g2b)).length;
    plot(215, '2  Single cells', 'FSC-A', 'FSC-H', p2, <g><polygon points={poly(g2b, 215)} className="wf-gate" /><T x={215 + 0.44 * Wd} y={22 + (1 - 0.72) * Wd + 18} c="wf-gate-text" style={{ transform: 'none' }}>{f.pop2 || 'Singlets'} {Math.round(in2 / p2.length * 100)}%</T></g>);
    void g2;
    /* 3 phenotype quadrants */
    const q = String(f.q || '5,34,50,11').split(',').map(s => Math.max(0, parseFloat(s) || 0)), tot = q.reduce((a, b) => a + b, 0) || 1;
    const N = 320, cnt = q.map(v => Math.round((v / tot) * N));
    const p3 = [...blob(cnt[0], 0.2, 0.74, 0.07, 0.07), ...blob(cnt[1], 0.76, 0.74, 0.08, 0.08), ...blob(cnt[2], 0.2, 0.2, 0.08, 0.07), ...blob(cnt[3], 0.76, 0.2, 0.08, 0.07)];
    const qpct = [[0, 0.5, 1, 0.5], [0.5, 0.5, 1, 0.5], [0, 0, 1, 0.5], [0.5, 0, 1, 0.5]].map(([a, b]) => p3.filter(p => (a === 0 ? p[0] < 0.5 : p[0] >= 0.5) && (b === 0.5 ? p[1] >= 0.5 : p[1] < 0.5)).length / p3.length * 100);
    const lab = (a: number, b: number, v: number, k: string) => <T key={k} x={430 + a * Wd} y={22 + (1 - b) * Wd} a="middle" c="wf-gate-text">{v.toFixed(1)}%</T>;
    plot(430, '3  Phenotype', f.a || 'CD3', f.b || 'CD4', p3, <g>
      <line x1={430 + Wd / 2} y1={22} x2={430 + Wd / 2} y2={22 + Wd} className="wf-gate" style={{ fill: 'none' }} /><line x1={430} y1={22 + Wd / 2} x2={430 + Wd} y2={22 + Wd / 2} className="wf-gate" style={{ fill: 'none' }} />
      {lab(0.25, 0.93, qpct[0], 'q1')}{lab(0.75, 0.93, qpct[1], 'q2')}{lab(0.25, 0.07, qpct[2], 'q3')}{lab(0.75, 0.07, qpct[3], 'q4')}
    </g>);
    return <g>{out}<path className="wf-thin" d="M170,102 H198" style={{ markerEnd: 'url(#wf-head)' }} /><path className="wf-thin" d="M385,102 H413" style={{ markerEnd: 'url(#wf-head)' }} /></g>;
  },
};

/* ================= LDH reaction ================= */
const MOL: any = {
  lactate: 'CC(O)C(=O)O', pyruvate: 'CC(=O)C(=O)O',
  int: 'Ic1ccc(cc1)[n+]1nc(nn1-c1ccc(cc1)[N+](=O)[O-])-c1ccccc1',
  formazan: 'Ic1ccc(cc1)NN=C(N=Nc1ccc(cc1)[N+](=O)[O-])c1ccccc1',
};
export const reactionFig = {
  size: (_d: any): [number, number] => [740, 382],
  draw: (d: any) => {
    const r = d.reaction, BL = '#2f5d9a', SOFT = '#8da7cc';
    const mol = (k: string, x: number, y: number, scale: number) => r.structures !== false && !layout(MOL[k]).error ? <Molecule mol={layout(MOL[k])} at={{ x, y, scale }} /> : null;
    const oval = (x: number, y: number, rx: number, ry: number, lines: string[]) => <g><ellipse cx={x} cy={y} rx={rx} ry={ry} style={{ fill: '#d23c34' }} />{lines.map((l, i) => <T key={i} x={x} y={y + 4 + (i - (lines.length - 1) / 2) * 15} a="middle" c="wf-oval">{l}</T>)}</g>;
    return <g>
      {/* damaged cell */}
      <ellipse cx={74} cy={70} rx={64} ry={46} style={{ fill: 'none', stroke: 'var(--ink)', strokeWidth: 1.6, strokeDasharray: '7 4' }} /><ellipse cx={74} cy={70} rx={24} ry={15} style={{ fill: '#35318f' }} />
      <T x={74} y={10} a="middle" c="wf-fig-bold">Damaged cell</T>
      <path d="M40,120 C40,152 64,172 98,178" style={{ fill: 'none', stroke: BL, strokeWidth: 3, markerEnd: 'url(#wf-head-blue)' }} />
      {oval(116, 208, 92, 36, ['Lactate dehydrogenase', '(LDH)'])}
      {/* lactate to pyruvate */}
      {mol('lactate', 260, 44, 32)}<T x={260} y={108} a="middle" c="wf-fig-bold">Lactate</T>
      <line x1={260} y1={124} x2={260} y2={262} style={{ stroke: BL, strokeWidth: 3, markerEnd: 'url(#wf-head-blue)' }} />
      {mol('pyruvate', 260, 304, 32)}<T x={260} y={362} a="middle" c="wf-fig-bold">Pyruvate</T>
      {/* NAD cycle */}
      <circle cx={375} cy={76} r={22} style={{ fill: '#7fae3a' }} /><S.ChemText className="wf-oval" x={375} y={80} textAnchor="middle">{'NAD^{+}'}</S.ChemText>
      <circle cx={375} cy={196} r={22} style={{ fill: '#2e8fd8' }} /><T x={375} y={200} a="middle" c="wf-oval">NADH</T>
      <path d="M354,88 C294,112 294,166 354,186" style={{ fill: 'none', stroke: SOFT, strokeWidth: 4, markerEnd: 'url(#wf-head-soft)' }} />
      <path d="M397,194 C450,208 480,176 506,152" style={{ fill: 'none', stroke: SOFT, strokeWidth: 4, markerEnd: 'url(#wf-head-soft)' }} />
      <path d="M506,114 C480,70 450,70 400,76" style={{ fill: 'none', stroke: SOFT, strokeWidth: 4, markerEnd: 'url(#wf-head-soft)' }} />
      {/* diaphorase, INT, formazan */}
      {oval(580, 154, 58, 26, ['Diaphorase'])}
      {mol('formazan', 590, 52, 15)}<T x={668} y={36} a="start" c="wf-fig-bold" style={{ fill: '#a8322b' }}>Formazan</T>
      <T x={668} y={51} a="start" c="wf-leg-sub" style={{ fill: '#a8322b' }}>red, read at 490 nm</T>
      <line x1={604} y1={252} x2={604} y2={186} style={{ stroke: BL, strokeWidth: 3, markerEnd: 'url(#wf-head-blue)' }} />
      <path d="M604,126 V100" style={{ stroke: BL, strokeWidth: 3, fill: 'none', markerEnd: 'url(#wf-head-blue)' }} />
      {mol('int', 604, 304, 15)}<T x={604} y={372} a="middle" c="wf-fig-bold">Iodonitrotetrazolium (INT)</T>
    </g>;
  },
};

export const FIGS: Record<string, { label: string; size: (d: any) => [number, number]; draw: (d: any) => any }> = {
  well: { label: 'Well cross-section (ELISA format)', ...wellFig },
  plate: { label: '96-well plate layout', ...plateFig },
  fluidics: { label: 'Flow cytometer: fluidics and optics', ...fluidicsFig },
  gating: { label: 'Gating strategy', ...gatingFig },
  reaction: { label: 'Coupled enzyme reaction', ...reactionFig },
  cycle: { label: 'One PCR cycle', ...cycleFig },
  thermal: { label: 'Thermal cycling profile', ...thermalFig },
  doubling: { label: 'Amplification', ...doublingFig },
  gel: { label: 'Gel image', ...gelFig },
  titration: { label: 'Titration curve', ...titrFig },
};
void CellG;
