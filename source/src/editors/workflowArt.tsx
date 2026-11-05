/* Pictograms for the step cards of the Experimental workflow editor.
   Every drawing sits in a box of about 110 × 80 centred on (0, 0) and uses the .wf-* classes in app.css. */

export const LIQ = '#9cc5e6', YEL = '#f2cf5b', RED = '#c8433a', GRN = '#7fbf7b', PUR = '#8f7bc9', CLEAR = 'var(--neutral-100)';

const L = (p: any) => <g className="wf-line">{p.children}</g>;

/* a well in cross-section, liquid filling `level` (0 to 1) of its height */
export function WellG(p: { x?: number; y?: number; fill?: string; level?: number; s?: number; dots?: string }) {
  const { x = 0, y = 0, fill = LIQ, level = 0.55, s = 1 } = p;
  const top = -26, bot = 30, yt = bot - level * (bot - top), w = (yy: number) => 18 - ((yy - top) / (bot - top)) * 4;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      {level > 0 ? <path d={`M${-w(yt)},${yt} L${w(yt)},${yt} L14,24 Q14,30 8,30 L-8,30 Q-14,30 -14,24 Z`} style={{ fill }} /> : null}
      <path className="wf-outline" d="M-18,-26 L-14,24 Q-14,30 -8,30 L8,30 Q14,30 14,24 L18,-26" />
      {p.dots ? [-9, -3, 3, 9].map(dx => <circle key={dx} cx={dx} cy={27} r={2.2} style={{ fill: p.dots }} />) : null}
    </g>
  );
}

export function TubeG(p: { x?: number; y?: number; fill?: string; level?: number; s?: number; cap?: boolean; open?: boolean }) {
  const { x = 0, y = 0, fill = LIQ, level = 0.45, s = 1 } = p;
  const yt = 26 - level * 54;
  const halfW = (yy: number) => yy < 0 ? 10 : 10 - (yy / 26) * 6;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      {level > 0 ? <path d={`M${-halfW(yt)},${yt} L${halfW(yt)},${yt} L4,26 L-4,26 Z`} style={{ fill }} /> : null}
      <path className="wf-outline" d="M-10,-28 L-10,0 L-4,26 L4,26 L10,0 L10,-28" />
      {p.open ? <path className="wf-outline" d="M-10,-28 L-18,-40 L-8,-44 L0,-28 Z" style={{ fill: CLEAR }} /> : <rect className="wf-outline" x={-12} y={-34} width={24} height={7} rx={2} style={{ fill: CLEAR }} />}
    </g>
  );
}

export function PipetteG(p: { x?: number; y?: number; drop?: string; s?: number }) {
  const { x = 0, y = 0, s = 1 } = p;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect className="wf-outline" x={-4} y={-42} width={8} height={7} rx={2} style={{ fill: CLEAR }} />
      <path className="wf-outline" d="M-6,-35 H6 L7,-6 L2,4 H-2 L-7,-6 Z" style={{ fill: 'var(--paper)' }} />
      <path className="wf-outline" d="M-2,4 H2 L1,24 H-1 Z" style={{ fill: CLEAR }} />
      <line className="wf-thin" x1={-4} y1={-24} x2={4} y2={-24} />
      {p.drop ? <path d="M0,29 q-3,5 0,8 q3,-3 0,-8z" style={{ fill: p.drop, stroke: 'var(--ink)', strokeWidth: 0.8 }} /> : null}
    </g>
  );
}

export function ClockG(p: { x?: number; y?: number; r?: number }) {
  const { x = 0, y = 0, r = 15 } = p;
  return (
    <g transform={`translate(${x},${y})`}>
      <circle className="wf-outline" r={r} style={{ fill: 'var(--paper)' }} />
      <path className="wf-line" d={`M0,${-r * 0.65} V0 L${r * 0.45},${r * 0.3}`} />
      {[0, 90, 180, 270].map(a => <line key={a} className="wf-thin" x1={0} y1={-r + 2} x2={0} y2={-r + 4.5} transform={`rotate(${a})`} />)}
    </g>
  );
}

export function PlateG(p: { x?: number; y?: number; w?: number; fill?: (c: number, r: number) => string | undefined }) {
  const { x = 0, y = 0, w = 64 } = p, h = w * 0.66, sp = w / 13.2;
  const out: any[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++)
    out.push(<circle key={r * 12 + c} cx={-w / 2 + sp * 0.95 + c * sp * 1.0} cy={-h / 2 + sp * 0.95 + r * sp * 1.0} r={sp * 0.38} style={{ fill: (p.fill && p.fill(c, r)) || 'var(--paper)', stroke: 'var(--ink)', strokeWidth: 0.6 }} />);
  return (
    <g transform={`translate(${x},${y})`}>
      <rect className="wf-outline" x={-w / 2 - 2} y={-h / 2 - 2} width={w + 4} height={h + 4} rx={4} style={{ fill: CLEAR }} />
      {out}
    </g>
  );
}

export function HelixG(p: { x?: number; y?: number; w?: number; amp?: number; color?: string }) {
  const { x = 0, y = 0, w = 80, amp = 11 } = p, n = 40, pts1: string[] = [], pts2: string[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, px = -w / 2 + t * w, a = t * Math.PI * 4; pts1.push(`${px},${Math.sin(a) * amp}`); pts2.push(`${px},${-Math.sin(a) * amp}`); }
  const rungs: any[] = [];
  for (let i = 1; i < 16; i++) { const t = i / 16, px = -w / 2 + t * w, a = t * Math.PI * 4, s = Math.sin(a) * amp; if (Math.abs(s) > 3) rungs.push(<line key={i} className="wf-thin" x1={px} y1={s} x2={px} y2={-s} />); }
  return (
    <g transform={`translate(${x},${y})`}>
      {rungs}
      <polyline className="wf-strand" points={pts1.join(' ')} style={{ stroke: p.color || 'var(--accent-700)' }} />
      <polyline className="wf-strand" points={pts2.join(' ')} style={{ stroke: 'var(--swatch-9)' }} />
    </g>
  );
}

export function CellG(p: { x?: number; y?: number; r?: number; nuc?: string; dead?: boolean; s?: number }) {
  const { x = 0, y = 0, r = 13 } = p;
  return (
    <g transform={`translate(${x},${y}) scale(${p.s || 1})`}>
      <circle className="wf-outline" r={r} style={{ fill: 'var(--neutral-100)', strokeDasharray: p.dead ? '3 2' : undefined }} />
      <circle cx={r * 0.12} cy={-r * 0.1} r={r * 0.42} style={{ fill: p.nuc || 'var(--swatch-15)', stroke: 'var(--ink)', strokeWidth: 0.8 }} />
    </g>
  );
}

export function YG(p: { x: number; y: number; dir?: 'up' | 'down'; color?: string; enz?: string; s?: number; w?: number }) {
  /* an antibody: dir "up" has its arms opening upwards from (x, y), "down" has them pointing at (x, y) */
  const { x, y, dir = 'up', color = 'var(--accent-700)', s = 1 } = p, k = dir === 'up' ? -1 : 1;
  const a = 15 * s, b = 12 * s, c = 9 * s;
  const d = dir === 'up'
    ? `M${x},${y} L${x},${y - a} M${x},${y - a} L${x - c},${y - a - b} M${x},${y - a} L${x + c},${y - a - b}`
    : `M${x},${y} L${x},${y - a} M${x},${y - a} L${x - c},${y - a - b} M${x},${y - a} L${x + c},${y - a - b}`;
  void k; void d;
  const tipY = dir === 'up' ? y - a - b : y;
  const stemY = dir === 'up' ? y : y - a - b;
  const hinge = dir === 'up' ? y - a : y - b;
  return (
    <g>
      <path className="wf-ab" d={`M${x},${stemY} L${x},${hinge} M${x},${hinge} L${x - c},${tipY} M${x},${hinge} L${x + c},${tipY}`} style={{ stroke: color }} />
      {p.enz ? <g transform={`translate(${x},${stemY + (dir === 'up' ? 6 * s : -7 * s)})`}><circle r={6 * s} style={{ fill: p.enz, stroke: 'var(--ink)', strokeWidth: 0.9 }} /><text className="wf-enz" y={3.2 * s} textAnchor="middle" style={{ fontSize: 8 * s }}>E</text></g> : null}
    </g>
  );
}

export function FlaskG(p: { x?: number; y?: number; fill?: string; s?: number; swirl?: boolean }) {
  const { x = 0, y = 0, fill = 'rgba(255,255,255,0)', s = 1 } = p;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M-14,10 L14,10 L24,28 Q26,32 22,32 H-22 Q-26,32 -24,28 Z" style={{ fill }} />
      <path className="wf-outline" d="M-7,-32 H7 V-12 L25,26 Q28,32 22,32 H-22 Q-28,32 -25,26 L-7,-12 Z" />
      <line className="wf-thin" x1={-9} y1={-32} x2={9} y2={-32} />
      {p.swirl ? <path className="wf-thin" d="M-26,-10 q6,-6 12,0 M-30,-2 q6,-6 12,0 M14,-10 q6,-6 12,0" /> : null}
    </g>
  );
}

export function BuretteG(p: { x?: number; y?: number; level?: number; s?: number }) {
  const { x = 0, y = 0, level = 0.5, s = 1 } = p;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x={-4} y={-44 + 78 * (1 - level) * 0.5 + 8} width={8} height={Math.max(2, 70 * level)} style={{ fill: LIQ }} />
      <rect className="wf-outline" x={-4} y={-44} width={8} height={72} style={{ fill: 'none' }} />
      {Array.from({ length: 9 }, (_, i) => <line key={i} className="wf-thin" x1={-4} x2={i % 2 ? -1 : 1} y1={-38 + i * 8} y2={-38 + i * 8} />)}
      <path className="wf-outline" d="M-4,28 L4,28 L1,42 H-1 Z" style={{ fill: CLEAR }} />
      <rect className="wf-outline" x={-9} y={30} width={18} height={4} rx={2} style={{ fill: 'var(--swatch-9)' }} />
      <path d="M0,48 q-3,5 0,8 q3,-3 0,-8z" style={{ fill: LIQ, stroke: 'var(--ink)', strokeWidth: 0.8 }} />
    </g>
  );
}

export function GelG(p: { x?: number; y?: number; w?: number; h?: number; lanes?: number; bands?: boolean; dark?: boolean }) {
  const { x = 0, y = 0, w = 70, h = 52, lanes = 5 } = p, lw = w / lanes;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect className="wf-outline" x={-w / 2} y={-h / 2} width={w} height={h} rx={2} style={{ fill: p.dark ? '#1b2733' : '#e7efe3' }} />
      {Array.from({ length: lanes }, (_, i) => {
        const cx = -w / 2 + lw * (i + 0.5);
        return <g key={i}>
          <rect x={cx - lw * 0.3} y={-h / 2 + 3} width={lw * 0.6} height={5} style={{ fill: p.dark ? '#0b1118' : '#c8d6c3', stroke: 'var(--ink)', strokeWidth: 0.6 }} />
          {p.bands ? [0.3, 0.5, 0.72].filter((_, j) => i === 0 || (i + j) % 2 === 0).map((f, j) => <line key={j} x1={cx - lw * 0.3} x2={cx + lw * 0.3} y1={-h / 2 + h * f} y2={-h / 2 + h * f} style={{ stroke: p.dark ? '#f1f5f8' : 'var(--accent-700)', strokeWidth: 2.2 }} />) : null}
        </g>;
      })}
    </g>
  );
}

export function ColumnG(p: { x?: number; y?: number; s?: number }) {
  const { x = 0, y = 0, s = 1 } = p;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path className="wf-outline" d="M-12,0 L-12,30 Q-12,36 -6,36 H6 Q12,36 12,30 V0" style={{ fill: 'none' }} />
      <path className="wf-outline" d="M-16,-34 H16 L10,-6 V16 H-10 V-6 Z" style={{ fill: 'var(--paper)' }} />
      <rect x={-10} y={8} width={20} height={4} style={{ fill: 'var(--swatch-8)', stroke: 'var(--ink)', strokeWidth: 0.8 }} />
      <rect className="wf-outline" x={-18} y={-40} width={36} height={6} rx={2} style={{ fill: CLEAR }} />
    </g>
  );
}

export function RotorG(p: { x?: number; y?: number; r?: number }) {
  const { x = 0, y = 0, r = 32 } = p;
  return (
    <g transform={`translate(${x},${y})`}>
      <circle className="wf-outline" r={r} style={{ fill: CLEAR }} />
      <circle r={4} style={{ fill: 'var(--ink)' }} />
      {[0, 60, 120, 180, 240, 300].map(a => <g key={a} transform={`rotate(${a})`}><rect x={-4} y={-r + 5} width={8} height={14} rx={3} style={{ fill: LIQ, stroke: 'var(--ink)', strokeWidth: 0.9 }} /></g>)}
      <path className="wf-line" d={`M${r + 6},-8 a${r + 6},${r + 6} 0 0 1 -8,${r * 0.5}`} style={{ markerEnd: 'none' }} />
    </g>
  );
}

export function ScreenG(p: { x?: number; y?: number; w?: number; h?: number; dots?: boolean }) {
  const { x = 0, y = 0, w = 60, h = 44 } = p;
  const pts = Array.from({ length: 26 }, (_, i) => { const a = i * 2.4, r = 3 + ((i * 7) % 11); return [Math.cos(a) * r * 0.9 - 6, Math.sin(a) * r * 0.7 + 2] as [number, number]; });
  return (
    <g transform={`translate(${x},${y})`}>
      <rect className="wf-outline" x={-w / 2} y={-h / 2} width={w} height={h} rx={3} style={{ fill: 'var(--paper)' }} />
      <path className="wf-thin" d={`M${-w / 2 + 6},${-h / 2 + 5} V${h / 2 - 6} H${w / 2 - 5}`} />
      {pts.map(([a, b], i) => <circle key={i} cx={a} cy={b} r={1.5} style={{ fill: i % 5 === 0 ? RED : 'var(--accent-700)' }} />)}
      <rect className="wf-outline" x={-9} y={h / 2} width={18} height={5} style={{ fill: CLEAR }} />
    </g>
  );
}

export function ReaderG(p: { x?: number; y?: number }) {
  const { x = 0, y = 0 } = p;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect className="wf-outline" x={-44} y={-4} width={88} height={34} rx={4} style={{ fill: CLEAR }} />
      <rect x={-34} y={12} width={50} height={10} rx={2} style={{ fill: 'var(--paper)', stroke: 'var(--ink)', strokeWidth: 1 }} />
      {[-28, -20, -12, -4, 4, 12].map(dx => <circle key={dx} cx={dx} cy={17} r={2.6} style={{ fill: YEL, stroke: 'var(--ink)', strokeWidth: 0.6 }} />)}
      <rect x={24} y={8} width={14} height={9} rx={1.5} style={{ fill: '#cfe3d4', stroke: 'var(--ink)', strokeWidth: 0.8 }} />
      <rect className="wf-outline" x={-12} y={-30} width={24} height={26} rx={3} style={{ fill: 'var(--paper)' }} />
      <path d="M0,-4 V10" style={{ stroke: PUR, strokeWidth: 3, opacity: 0.55 }} />
      <text className="wf-art-text" x={0} y={-16} textAnchor="middle">λ</text>
    </g>
  );
}

export function ThermoG(p: { x?: number; y?: number }) {
  const { x = 0, y = 0 } = p;
  return (
    <g transform={`translate(${x},${y})`}>
      <path className="wf-outline" d="M-46,24 V-6 L-34,-22 H34 L46,-6 V24 Z" style={{ fill: CLEAR }} />
      <rect className="wf-outline" x={-40} y={-4} width={80} height={14} rx={2} style={{ fill: 'var(--paper)' }} />
      {[-28, -18, -8, 2, 12, 22].map(dx => <path key={dx} className="wf-thin" d={`M${dx - 3},-2 H${dx + 3} L${dx + 1},8 H${dx - 1} Z`} style={{ fill: LIQ }} />)}
      <rect x={-18} y={14} width={36} height={7} rx={1.5} style={{ fill: '#1d2a36' }} />
      <text className="wf-art-text" x={0} y={19.6} textAnchor="middle" style={{ fill: '#8fe3a1', fontSize: 6.5 }}>95 °C</text>
    </g>
  );
}

export function BlockG(p: { x?: number; y?: number; label?: string }) {
  const { x = 0, y = 0 } = p;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect className="wf-outline" x={-34} y={2} width={68} height={24} rx={3} style={{ fill: CLEAR }} />
      {[-20, -7, 6, 19].map(dx => <TubeG key={dx} x={dx} y={-8} s={0.55} fill={LIQ} level={0.5} />)}
      <text className="wf-art-text" x={0} y={19} textAnchor="middle">{p.label || '37 °C'}</text>
    </g>
  );
}

export function Drops(p: { x: number; y: number; n?: number; color?: string }) {
  return <g>{Array.from({ length: p.n || 3 }, (_, i) => <path key={i} d={`M${p.x + i * 9},${p.y} q-3,5 0,8 q3,-3 0,-8z`} style={{ fill: p.color || LIQ, stroke: 'var(--ink)', strokeWidth: 0.7 }} />)}</g>;
}

export function Arrow(p: { d: string; head?: boolean }) { return <path className="wf-thin" d={p.d} style={{ markerEnd: p.head === false ? undefined : 'url(#wf-head)' }} />; }

/* ---------- keyed pictograms ---------- */
export const ART: Record<string, [string, () => any]> = {
  none: ['None', () => null],
  coat: ['Coat the well', () => <g><PipetteG x={-26} y={-6} drop={LIQ} /><WellG x={16} y={4} level={0.5} fill="#e9eef3" dots="var(--swatch-14)" /></g>],
  block: ['Block', () => <g><WellG x={0} y={0} level={0.8} fill="#e8dcc8" dots="var(--swatch-14)" /><text className="wf-art-text" x={0} y={-2} textAnchor="middle">BSA</text></g>],
  pipette: ['Pipette in', () => <g><PipetteG x={-22} y={-8} drop={LIQ} /><WellG x={22} y={6} level={0.4} /></g>],
  wash: ['Wash', () => <g><WellG x={-6} y={6} level={0.65} fill="#cfe4f5" /><Arrow d="M-44,-22 q10,-12 22,-4" /><Arrow d="M34,-4 q8,10 -2,24" /><Drops x={22} y={-30} n={3} /></g>],
  incubate: ['Incubate', () => <g><WellG x={-22} y={4} level={0.5} /><ClockG x={26} y={-6} r={17} /></g>],
  substrate: ['Add substrate', () => <g><PipetteG x={-24} y={-8} drop="#7fb4e6" /><WellG x={22} y={6} level={0.7} fill="#7fb4e6" /></g>],
  stop: ['Stop solution', () => <g><PipetteG x={-24} y={-8} drop={YEL} /><WellG x={22} y={6} level={0.7} fill={YEL} /></g>],
  reader: ['Plate reader', () => <ReaderG y={10} />],
  plate: ['96-well plate', () => <PlateG w={74} />],
  plateCells: ['Plate with cells', () => <PlateG w={74} fill={(c, r) => (c < 8 && r < 6 ? '#c8d8f0' : undefined)} />],
  tube: ['Tube', () => <TubeG level={0.5} s={1.15} />],
  tubeCells: ['Tube of cells', () => <g><TubeG level={0.55} fill="#f1dede" s={1.15} /><CellG x={-2} y={14} r={5} s={0.9} /><CellG x={4} y={8} r={5} s={0.9} /><CellG x={-4} y={4} r={5} s={0.9} /></g>],
  cells: ['Cells', () => <g><CellG x={-26} y={-8} /><CellG x={0} y={10} r={14} /><CellG x={26} y={-10} r={12} /></g>],
  lyse: ['Lyse cells', () => <g><CellG x={-26} y={0} dead /><Arrow d="M-8,0 H10" /><path className="wf-strand" d="M22,-14 q10,-8 18,0 t-6,16 t-14,6 M30,10 q10,-4 8,12" style={{ stroke: 'var(--accent-700)' }} /></g>],
  stain: ['Stain / label', () => <g><TubeG x={-18} y={2} level={0.5} fill="#f3e6e6" s={0.95} /><YG x={26} y={14} dir="up" color="var(--swatch-5)" s={0.9} /><YG x={14} y={-6} dir="up" color="var(--swatch-11)" s={0.9} /><circle cx={34} cy={-8} r={3.4} style={{ fill: GRN }} /></g>],
  centrifuge: ['Centrifuge', () => <RotorG />],
  spin: ['Spin column', () => <g><ColumnG x={-4} y={4} s={1} /><Arrow d="M26,-18 v14" /></g>],
  elute: ['Elute', () => <g><TubeG x={-14} y={0} level={0.28} fill="#dbe9f6" s={0.95} open /><Drops x={18} y={-22} n={2} /><HelixG x={22} y={22} w={34} amp={5} /></g>],
  dna: ['DNA', () => <HelixG w={96} amp={14} />],
  heat: ['Heat block', () => <BlockG label="56 °C" />],
  vortex: ['Mix', () => <g><TubeG level={0.5} s={1.1} /><path className="wf-thin" d="M-30,-6 q-6,6 0,14 M30,-6 q6,6 0,14 M-38,-10 q-8,10 0,22 M38,-10 q8,10 0,22" /></g>],
  mixTube: ['PCR tube mix', () => <g><TubeG x={-6} y={4} level={0.4} s={0.95} /><Drops x={22} y={-22} n={3} color={GRN} /></g>],
  thermocycler: ['Thermocycler', () => <ThermoG y={8} />],
  gelPour: ['Pour gel', () => <g><path className="wf-outline" d="M-34,24 H34 V8 H-34 Z" style={{ fill: CLEAR }} /><path d="M-30,8 V-4 H30 V8" style={{ fill: '#e7efe3', stroke: 'var(--ink)', strokeWidth: 1 }} /><path className="wf-outline" d="M-10,-36 H10 L6,-18 H-6 Z" style={{ fill: 'var(--paper)' }} /><path d="M-1,-18 q-3,6 0,10" style={{ stroke: '#cfe3c8', strokeWidth: 3, fill: 'none' }} /></g>],
  loadGel: ['Load samples', () => <g><PipetteG x={-8} y={-12} drop={PUR} s={0.8} /><GelG y={26} w={86} h={34} lanes={5} /></g>],
  runGel: ['Run the gel', () => <g><rect className="wf-outline" x={-44} y={-4} width={88} height={32} rx={3} style={{ fill: CLEAR }} /><GelG y={14} w={60} h={16} lanes={5} /><path d="M-44,-4 L-60,-24 M44,-4 L60,-24" className="wf-thin" /><rect x={-24} y={-36} width={48} height={14} rx={2} style={{ fill: 'var(--paper)', stroke: 'var(--ink)', strokeWidth: 1.2 }} /><text className="wf-art-text" x={0} y={-26} textAnchor="middle">+  −</text></g>],
  gelImage: ['Image the gel', () => <GelG w={84} h={60} lanes={6} bands dark />],
  burette: ['Burette and flask', () => <g><BuretteG x={-22} y={-16} s={0.78} level={0.7} /><FlaskG x={16} y={10} s={0.8} fill="rgba(143,200,255,.6)" /></g>],
  swirl: ['Swirl the flask', () => <FlaskG y={4} fill="rgba(143,200,255,.6)" swirl />],
  endpoint: ['End point (colour change)', () => <g><FlaskG x={-22} y={4} s={0.85} fill="rgba(255,255,255,.4)" /><Arrow d="M2,6 H16" /><FlaskG x={34} y={4} s={0.85} fill="rgba(226,99,148,.7)" /></g>],
  record: ['Read the volume', () => <g><BuretteG x={-6} y={-6} s={0.8} level={0.55} /><path className="wf-thin" d="M12,-8 h26 M38,-8 l-5,-4 M38,-8 l-5,4" /><text className="wf-art-text" x={46} y={-4}>V</text></g>],
  fluidics: ['Flow cytometer', () => <g><path className="wf-outline" d="M-6,-36 V-8 L-1,14 V34 H1 V14 L6,-8 V-36" style={{ fill: CLEAR }} /><path d="M-40,2 H-2" style={{ stroke: RED, strokeWidth: 2 }} /><circle cx={0} cy={2} r={3.4} style={{ fill: GRN }} /><path className="wf-thin" d="M3,3 L34,22 M3,1 L34,-18" /><rect className="wf-outline" x={32} y={-26} width={14} height={12} style={{ fill: CLEAR }} /><rect className="wf-outline" x={32} y={16} width={14} height={12} style={{ fill: CLEAR }} /></g>],
  plots: ['Dot plots', () => <g><ScreenG x={-4} y={-2} w={64} h={46} /></g>],
  freezer: ['Store at 4 °C', () => <g><rect className="wf-outline" x={-22} y={-34} width={44} height={68} rx={4} style={{ fill: CLEAR }} /><line className="wf-thin" x1={-22} y1={-8} x2={22} y2={-8} /><text className="wf-art-text" x={0} y={-16} textAnchor="middle">4 °C</text><line className="wf-line" x1={14} y1={-24} x2={14} y2={-12} /></g>],
};
export const ART_OPTIONS: [string, string][] = Object.entries(ART).map(([k, v]) => [k, v[0]]);
