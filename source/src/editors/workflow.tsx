import { S } from '../sheet';
import { EmptyHint, NumField, Rows, Select, Seg, TextIn, Toggle, uid } from '../ui';
import type { EditorDef, EditProps } from '../shell';
import { ART, ART_OPTIONS } from './workflowArt';
import { DEFAULT_LANES, Defs, FIGS, INDICATORS, PLATE_MODES, WELL_TYPES } from './workflowFigs';

/* 22 · Experimental workflow. A row of numbered step cards, each with a pictogram, followed by the figures
   that explain the method: well cross-sections, a 96-well plate map, a gel, a thermal profile, a titration curve. */

const FIG_ORDER = ['well', 'plate', 'fluidics', 'gating', 'reaction', 'cycle', 'thermal', 'doubling', 'gel', 'titration'];
const CARD_W = 156, GAP = 34, ROW_GAP = 46, ART_H = 96;

export function norm(d: any) {
  d = d || {};
  return {
    perRow: 4, showNums: true, showTime: true, figs: [], ...d,
    steps: Array.isArray(d.steps) ? d.steps : [],
    plate: { mode: 'elisa', reps: 2, samples: 16, top: '1000', unit: 'pg/mL', dilution: 2, ...d.plate },
    well: { type: 'direct', colour: true, ...d.well },
    thermal: { init: 95, initT: '3 min', den: 95, denT: '30 s', ann: 55, annT: '30 s', ext: 72, extT: '60 s', cycles: 30, fin: 72, finT: '5 min', hold: 4, ...d.thermal },
    gel: { invert: false, min: 100, max: 10000, ...d.gel, lanes: d.gel && Array.isArray(d.gel.lanes) ? d.gel.lanes : DEFAULT_LANES },
    titr: { type: 'sasb', ca: '0.100', va: '25.0', cb: '0.100', pka: '4.76', indicator: 'phenolphthalein', ...d.titr },
    flow: { pop1: 'Lymphocytes', pop2: 'Singlets', a: 'CD3', b: 'CD4', q: '5,34,50,11', ...d.flow },
    reaction: { structures: true, ...d.reaction },
  };
}

function wrap(text: string, width: number, px: number): string[] {
  const max = Math.max(8, Math.floor(width / (px * 0.5)));
  const out: string[] = [];
  for (const para of String(text || '').split(/\n/)) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if ((line + ' ' + w).trim().length > max) { if (line) out.push(line); line = w; } else line = (line + ' ' + w).trim();
    }
    if (line) out.push(line);
  }
  return out;
}

/* ---------- layout ---------- */
function layoutSteps(d: any) {
  const per = Math.max(1, Math.min(8, Math.round(d.perRow))), cards: any[] = [];
  let y = 0, rowStart = 0;
  d.steps.forEach((s: any, i: number) => {
    const title = wrap(s.title, CARD_W - 16, 14).slice(0, 2), detail = wrap(s.detail, CARD_W - 18, 11.5).slice(0, 7);
    const h = ART_H + 12 + title.length * 17 + (detail.length ? 6 + detail.length * 14 : 0) + (d.showTime && s.time ? 22 : 8);
    cards.push({ s, i, title, detail, h, col: i % per, row: Math.floor(i / per), x: (i % per) * (CARD_W + GAP), y: 0 });
    void rowStart;
  });
  const rows = Math.ceil(d.steps.length / per);
  for (let r = 0; r < rows; r++) {
    const row = cards.filter(c => c.row === r), hh = Math.max(...row.map(c => c.h));
    row.forEach(c => { c.y = y; c.h = hh; });
    y += hh + ROW_GAP;
  }
  const n = Math.min(per, d.steps.length);
  return { cards, per, width: n ? n * CARD_W + (n - 1) * GAP : 0, height: cards.length ? y - ROW_GAP : 0 };
}

function layoutFigs(d: any, top: number, maxW: number) {
  const keys = FIG_ORDER.filter(k => (d.figs || []).includes(k)), out: any[] = [];
  let x = 0, y = top, rowH = 0;
  keys.forEach(k => {
    const [w, h] = FIGS[k].size(d), H = h + 30;
    if (x > 0 && x + w > maxW + 1) { x = 0; y += rowH + 30; rowH = 0; }
    out.push({ k, x, y, w, h });
    x += w + 40; rowH = Math.max(rowH, H);
  });
  return { figs: out, bottom: y + rowH, width: Math.max(0, ...out.map(f => f.x + f.w)) };
}

function Render({ data }: any) {
  const d = norm(data);
  if (!d.steps.length && !(d.figs || []).length) return <EmptyHint text="Add a step in the sidebar." />;
  const L = layoutSteps(d), out: any[] = [];
  L.cards.forEach(c => {
    const A = ART[c.s.art] ? ART[c.s.art][1] : null;
    let ty = ART_H + 18;
    out.push(<g key={'c' + c.s.id} transform={`translate(${c.x},${c.y})`} className="wf-card">
      <rect className="wf-box" x={0} y={0} width={CARD_W} height={c.h} rx={7} />
      {A ? <g transform={`translate(${CARD_W / 2},${ART_H / 2 + 6})`}>{A()}</g> : null}
      {d.showNums ? <g><circle cx={16} cy={16} r={11} className="wf-badge" /><text className="wf-badge-text" x={16} y={20.5} textAnchor="middle">{c.i + 1}</text></g> : null}
      {c.title.map((t: string, j: number) => <text key={'t' + j} className="wf-title" x={CARD_W / 2} y={ty + j * 17} textAnchor="middle">{t}</text>)}
      {c.detail.map((t: string, j: number) => <text key={'d' + j} className="wf-detail" x={CARD_W / 2} y={ty + c.title.length * 17 + 4 + j * 14} textAnchor="middle">{t}</text>)}
      {d.showTime && c.s.time ? <text className="wf-time" x={CARD_W / 2} y={c.h - 9} textAnchor="middle">{c.s.time}</text> : null}
    </g>);
    const next = L.cards[c.i + 1];
    if (next && next.row === c.row) out.push(<line key={'a' + c.s.id} className="wf-flow" x1={c.x + CARD_W + 3} x2={next.x - 4} y1={c.y + ART_H / 2 + 6} y2={c.y + ART_H / 2 + 6} style={{ markerEnd: 'url(#wf-head)' }} />);
    else if (next) {
      const yb = c.y + c.h, my = yb + ROW_GAP / 2, xa = c.x + CARD_W / 2, xb = next.x + CARD_W / 2;
      out.push(<path key={'a' + c.s.id} className="wf-flow" d={`M${xa},${yb + 2} V${my} H${xb} V${next.y - 4}`} style={{ markerEnd: 'url(#wf-head)' }} />);
    }
  });
  const F = layoutFigs(d, L.cards.length ? L.height + 54 : 0, Math.max(L.width, 700));
  F.figs.forEach((f: any) => {
    out.push(<g key={'f' + f.k} transform={`translate(${f.x},${f.y})`}>
      <text className="wf-fig-head" x={0} y={0}>{FIGS[f.k].label}</text>
      <line className="wf-fig-rule" x1={0} x2={f.w} y1={8} y2={8} />
      <g transform="translate(0,26)">{FIGS[f.k].draw(d)}</g>
    </g>);
  });
  return <g className="wf"><Defs />{out}</g>;
}

function Overlay({ data, sel, setSel }: any) {
  const d = norm(data), L = layoutSteps(d);
  return <>{L.cards.map(c => {
    const on = sel && sel.kind === 'step' && sel.id === c.s.id;
    return <rect key={c.s.id} className={'mk-hit' + (on ? ' mk-on' : '')} style={{ cursor: 'pointer' }} x={c.x - 3} y={c.y - 3} width={CARD_W + 6} height={c.h + 6} rx={9} onPointerDown={(e: any) => { e.stopPropagation(); setSel({ kind: 'step', id: c.s.id }); }} />;
  })}</>;
}

/* ---------- controls ---------- */
function Controls({ data, set, sel, setSel }: EditProps) {
  const d = norm(data);
  const S2 = (p: any, key?: string) => set({ ...d, ...p }, key);
  const sub = (k: string, p: any, key?: string) => S2({ [k]: { ...d[k], ...p } }, key);
  const st = sel && sel.kind === 'step' ? d.steps.find((x: any) => x.id === sel.id) : null;
  const upS = (p: any, key?: string) => S2({ steps: d.steps.map((x: any) => x === st ? { ...x, ...p } : x) }, key);
  const has = (k: string) => (d.figs || []).includes(k);
  const toggleFig = (k: string, on: boolean) => S2({ figs: FIG_ORDER.filter(f => (f === k ? on : has(f))) });
  const idx = st ? d.steps.indexOf(st) : -1;
  const move = (dir: number) => { const a = [...d.steps]; const j = idx + dir; if (j < 0 || j >= a.length) return; [a[idx], a[j]] = [a[j], a[idx]]; S2({ steps: a }); };
  return <>
    {st ? <S.Panel kicker={'Step ' + (idx + 1)} help="Click a card on the sheet to edit it here.">
      <TextIn id="wf-title" label="Title" value={st.title} onChange={v => upS({ title: v }, 'tt-' + st.id)} />
      <S.Field id="wf-detail" label="What you do" multiline rows={4} value={st.detail || ''} onChange={(e: any) => upS({ detail: e.target.value }, 'dt-' + st.id)} />
      <div className="mk-pair">
        <TextIn id="wf-time" label="Time or condition" value={st.time} placeholder="e.g. 1 h, 37 °C" onChange={v => upS({ time: v }, 'tm-' + st.id)} />
        <Select id="wf-art" label="Picture" value={st.art} options={ART_OPTIONS} onChange={v => upS({ art: v })} />
      </div>
      <div className="sd-row-btns">
        <S.ToolButton compact disabled={idx === 0} onClick={() => move(-1)}>Move earlier</S.ToolButton>
        <S.ToolButton compact disabled={idx === d.steps.length - 1} onClick={() => move(1)}>Move later</S.ToolButton>
        <S.ToolButton compact onClick={() => { S2({ steps: d.steps.filter((x: any) => x !== st) }); setSel(null); }}>Delete step</S.ToolButton>
      </div>
    </S.Panel> : null}
    <Rows id="wf-s" kicker="Steps" help="Pick a picture for each step, or choose None."
      rows={d.steps} cols={[{ key: 'title', label: 'Title', w: '1.5fr' }, { key: 'art', label: 'Picture', type: 'select', options: ART_OPTIONS, w: '1.1fr' }, { key: 'time', label: 'Time', w: '0.8fr' }]}
      blank={() => ({ id: uid('s', d.steps.map((x: any) => x.id)), art: 'pipette', title: 'New step', detail: '', time: '' })} addLabel="+ Add step"
      onChange={(rows, key) => S2({ steps: rows }, key)} />
    <S.Panel kicker="Layout">
      <span className="sd-help">Steps per row</span>
      <Seg value={d.perRow} options={[[3, '3'], [4, '4'], [5, '5'], [6, '6']]} onChange={v => S2({ perRow: v })} />
      <Toggle on={d.showNums} label="Step numbers" onChange={v => S2({ showNums: v })} />
      <Toggle on={d.showTime} label="Times and conditions" onChange={v => S2({ showTime: v })} />
    </S.Panel>
    <S.Panel kicker="Figures" help="Figures print under the steps. Each one has its own settings below.">
      {FIG_ORDER.map(k => <Toggle key={k} on={has(k)} label={FIGS[k].label} onChange={v => toggleFig(k, v)} />)}
    </S.Panel>
    {has('well') ? <S.Panel kicker="Well cross-section">
      <Seg wrap value={d.well.type} options={WELL_TYPES} onChange={v => sub('well', { type: v })} />
      <Toggle on={d.well.colour !== false} label="Blue substrate colour" onChange={v => sub('well', { colour: v })} />
    </S.Panel> : null}
    {has('plate') ? <S.Panel kicker="96-well plate" help="Rows A to H, columns 1 to 12.">
      <Select id="wf-pm" label="Layout" value={d.plate.mode} options={PLATE_MODES} onChange={v => sub('plate', { mode: v })} />
      {d.plate.mode === 'elisa' ? <>
        <span className="sd-help">Replicate wells per standard or sample</span>
        <Seg value={d.plate.reps} options={[[1, '1'], [2, '2'], [3, '3']]} onChange={v => sub('plate', { reps: v })} />
        <div className="mk-pair">
          <NumField id="wf-top" label="Top standard" value={d.plate.top} onChange={v => sub('plate', { top: v }, 'pt')} />
          <NumField id="wf-unit" label="Unit" value={d.plate.unit} onChange={v => sub('plate', { unit: v }, 'pu')} />
        </div>
        <div className="mk-pair">
          <NumField id="wf-dil" label="Dilution factor" value={d.plate.dilution} onChange={v => sub('plate', { dilution: v }, 'pd')} />
          <NumField id="wf-ns" label="Number of samples" value={d.plate.samples} onChange={v => sub('plate', { samples: v }, 'ps')} />
        </div>
      </> : null}
    </S.Panel> : null}
    {has('thermal') || has('cycle') || has('doubling') ? <S.Panel kicker="PCR programme">
      {([['init', 'initT', 'Initial denaturation'], ['den', 'denT', 'Denature'], ['ann', 'annT', 'Anneal'], ['ext', 'extT', 'Extend'], ['fin', 'finT', 'Final extension']] as [string, string, string][]).map(([a, b, l]) =>
        <div key={a} className="mk-pair"><NumField id={'wf-' + a} label={l + ' (°C)'} value={d.thermal[a]} onChange={v => sub('thermal', { [a]: v }, a)} /><TextIn id={'wf-' + b} label="Time" value={d.thermal[b]} onChange={v => sub('thermal', { [b]: v }, b)} /></div>)}
      <div className="mk-pair"><NumField id="wf-cy" label="Cycles" value={d.thermal.cycles} onChange={v => sub('thermal', { cycles: v }, 'cy')} /><NumField id="wf-hold" label="Hold (°C)" value={d.thermal.hold} onChange={v => sub('thermal', { hold: v }, 'hold')} /></div>
    </S.Panel> : null}
    {has('gel') ? <>
      <Rows id="wf-g" kicker="Gel lanes" help="Band sizes in bp, separated by commas. Tick Ladder to print its sizes on the left."
        rows={d.gel.lanes} cols={[{ key: 'name', label: 'Lane', w: '1fr' }, { key: 'bands', label: 'Bands (bp)', w: '1.4fr' }, { key: 'ladder', label: 'Ladder', type: 'check' }]}
        blank={() => ({ name: 'Sample', bands: '500', ladder: false })} addLabel="+ Add lane" onChange={(rows, key) => sub('gel', { lanes: rows }, key)} />
      <S.Panel kicker="Gel image">
        <Toggle on={!d.gel.invert} label="Dark gel with light bands" onChange={v => sub('gel', { invert: !v })} />
        <div className="mk-pair"><NumField id="wf-gmin" label="Smallest size (bp)" value={d.gel.min} onChange={v => sub('gel', { min: v }, 'gmin')} /><NumField id="wf-gmax" label="Largest size (bp)" value={d.gel.max} onChange={v => sub('gel', { max: v }, 'gmax')} /></div>
      </S.Panel>
    </> : null}
    {has('titration') ? <S.Panel kicker="Titration">
      <Seg value={d.titr.type} options={[['sasb', 'Strong acid, strong base'], ['wasb', 'Weak acid, strong base']]} onChange={v => sub('titr', { type: v })} />
      <div className="mk-pair"><NumField id="wf-ca" label="Acid (mol/L)" value={d.titr.ca} onChange={v => sub('titr', { ca: v }, 'ca')} /><NumField id="wf-va" label="Acid volume (mL)" value={d.titr.va} onChange={v => sub('titr', { va: v }, 'va')} /></div>
      <div className="mk-pair"><NumField id="wf-cb" label="Base (mol/L)" value={d.titr.cb} onChange={v => sub('titr', { cb: v }, 'cb')} />{d.titr.type === 'wasb' ? <NumField id="wf-pka" label="pKa" value={d.titr.pka} onChange={v => sub('titr', { pka: v }, 'pka')} /> : <span />}</div>
      <Select id="wf-ind" label="Indicator band" value={d.titr.indicator} options={INDICATORS.map(i => [i[0], i[1]] as [string, string])} onChange={v => sub('titr', { indicator: v })} />
    </S.Panel> : null}
    {has('gating') ? <S.Panel kicker="Gating" help="Percentages are counted from the plotted cells. Enter four weights for the upper-left, upper-right, lower-left and lower-right quadrants.">
      <div className="mk-pair"><TextIn id="wf-p1" label="Gate 1 name" value={d.flow.pop1} onChange={v => sub('flow', { pop1: v }, 'p1')} /><TextIn id="wf-p2" label="Gate 2 name" value={d.flow.pop2} onChange={v => sub('flow', { pop2: v }, 'p2')} /></div>
      <div className="mk-pair"><TextIn id="wf-ma" label="Marker on x" value={d.flow.a} onChange={v => sub('flow', { a: v }, 'ma')} /><TextIn id="wf-mb" label="Marker on y" value={d.flow.b} onChange={v => sub('flow', { b: v }, 'mb')} /></div>
      <TextIn id="wf-q" label="Quadrant weights" value={d.flow.q} onChange={v => sub('flow', { q: v }, 'fq')} />
    </S.Panel> : null}
    {has('reaction') ? <S.Panel kicker="Reaction scheme">
      <Toggle on={d.reaction.structures !== false} label="Draw chemical structures" onChange={v => sub('reaction', { structures: v })} />
    </S.Panel> : null}
  </>;
}

/* ---------- templates ---------- */
let n = 0;
const st = (art: string, title: string, detail = '', time = '') => ({ id: 's' + ++n, art, title, detail, time });
const T = (steps: any[]) => { n = 0; return steps; };

const ELISA_FIGS = ['well', 'plate'];
const wellCap = 'Each well is read at 450 nm after the stop solution is added. Colour intensity rises with the amount of enzyme-labelled antibody that stays bound.';

export const workflow: EditorDef = {
  id: 'experimental-workflow', num: '22', name: 'Experimental workflow', field: 'Methods',
  blurb: 'Step-by-step method figures: four ELISA formats with a 96-well plate, flow cytometry, an LDH assay, DNA isolation, PCR, gel electrophoresis and titration.',
  hint: 'Click a step card to edit it. Figures sit under the steps and have their own settings in the sidebar.',
  normalize: norm,
  templates: [
    { name: 'ELISA: direct', desc: 'Antigen coated, enzyme-labelled primary antibody', title: 'Direct ELISA workflow',
      caption: 'Direct ELISA. ' + wellCap,
      data: norm({ perRow: 4, figs: ELISA_FIGS, well: { type: 'direct' }, steps: T([
        st('coat', 'Coat', 'Add antigen in coating buffer, 100 µL per well. Seal the plate.', '4 °C, overnight'),
        st('wash', 'Wash', 'Empty the wells and wash 3 times with PBS-T.'),
        st('block', 'Block', 'Add 1% BSA in PBS to cover the free plastic.', '1 h, room temperature'),
        st('pipette', 'Add labelled antibody', 'Add enzyme-conjugated primary antibody in blocking buffer.', '1 to 2 h, room temperature'),
        st('wash', 'Wash', 'Wash 3 to 5 times to remove unbound antibody.'),
        st('substrate', 'Add substrate', 'Add TMB. Bound enzyme turns it blue.', '15 min, in the dark'),
        st('stop', 'Stop', 'Add 2 M H₂SO₄. The blue turns yellow.'),
        st('reader', 'Read', 'Measure absorbance at 450 nm.'),
      ]) }) },
    { name: 'ELISA: indirect', desc: 'Unlabelled primary and enzyme-labelled secondary antibody', title: 'Indirect ELISA workflow',
      caption: 'Indirect ELISA. The labelled secondary antibody binds any primary antibody, which amplifies the signal. ' + wellCap,
      data: norm({ perRow: 5, figs: ELISA_FIGS, well: { type: 'indirect' }, steps: T([
        st('coat', 'Coat', 'Add antigen in coating buffer, 100 µL per well.', '4 °C, overnight'),
        st('wash', 'Wash', 'Wash 3 times with PBS-T.'),
        st('block', 'Block', 'Add 1% BSA in PBS.', '1 h, room temperature'),
        st('pipette', 'Primary antibody', 'Add unlabelled primary antibody.', '1 to 2 h'),
        st('wash', 'Wash', 'Wash 3 times.'),
        st('pipette', 'Secondary antibody', 'Add enzyme-conjugated secondary antibody against the primary.', '1 h, room temperature'),
        st('wash', 'Wash', 'Wash 3 to 5 times.'),
        st('substrate', 'Add substrate', 'Add TMB.', '15 min, in the dark'),
        st('reader', 'Stop and read', 'Add 2 M H₂SO₄ and read at 450 nm.'),
      ]) }) },
    { name: 'ELISA: sandwich', desc: 'Capture antibody, antigen from the sample, detection antibody', title: 'Sandwich ELISA workflow',
      caption: 'Sandwich ELISA. The antigen is held between a capture and a detection antibody, so the assay is specific and sensitive. ' + wellCap,
      data: norm({ perRow: 5, figs: ELISA_FIGS, well: { type: 'sandwich' }, plate: { mode: 'elisa', reps: 2, samples: 16, top: '1000', unit: 'pg/mL', dilution: 2 }, steps: T([
        st('coat', 'Coat', 'Add capture antibody in coating buffer.', '4 °C, overnight'),
        st('wash', 'Wash', 'Wash 3 times with PBS-T.'),
        st('block', 'Block', 'Add 1% BSA in PBS.', '1 h, room temperature'),
        st('pipette', 'Add samples', 'Add standards, blank and samples in duplicate. The antigen binds the capture antibody.', '2 h, room temperature'),
        st('wash', 'Wash', 'Wash 3 to 5 times.'),
        st('pipette', 'Detection antibody', 'Add enzyme-labelled detection antibody against a second epitope.', '1 h, room temperature'),
        st('wash', 'Wash', 'Wash 3 to 5 times.'),
        st('substrate', 'Add substrate', 'Add TMB.', '15 min, in the dark'),
        st('reader', 'Stop and read', 'Add 2 M H₂SO₄. Read at 450 nm and fit the standard curve.'),
      ]) }) },
    { name: 'ELISA: competitive', desc: 'Sample antigen competes with coated antigen', title: 'Competitive ELISA workflow',
      caption: 'Competitive ELISA. Antigen in the sample competes with coated antigen for a limited amount of labelled antibody, so the signal falls as the antigen concentration rises. ' + wellCap,
      data: norm({ perRow: 5, figs: ELISA_FIGS, well: { type: 'competitive' }, steps: T([
        st('coat', 'Coat', 'Add antigen in coating buffer.', '4 °C, overnight'),
        st('wash', 'Wash', 'Wash 3 times with PBS-T.'),
        st('block', 'Block', 'Add 1% BSA in PBS.', '1 h, room temperature'),
        st('vortex', 'Pre-incubate', 'In a separate tube, mix each sample or standard with a fixed amount of labelled antibody.', '1 h'),
        st('pipette', 'Add the mixture', 'Transfer the mixture to the coated wells. Free antibody binds the coated antigen.', '1 h, room temperature'),
        st('wash', 'Wash', 'Wash 3 to 5 times. Antibody bound to sample antigen is removed.'),
        st('substrate', 'Add substrate', 'Add TMB.', '15 min, in the dark'),
        st('reader', 'Stop and read', 'Add 2 M H₂SO₄. Read at 450 nm. A high signal means little antigen in the sample.'),
      ]) }) },
    { name: 'Flow cytometry', desc: 'Stain, acquire and gate', title: 'Flow cytometry workflow',
      caption: 'Cells are labelled with fluorescent antibodies, pass the laser one at a time, and are gated by size, then by marker expression.',
      data: norm({ perRow: 3, figs: ['fluidics', 'gating'], steps: T([
        st('tubeCells', 'Prepare cells', 'Harvest the cells, count them and adjust to 1 × 10⁶ cells per tube.'),
        st('pipette', 'Block Fc receptors', 'Add Fc block to reduce non-specific antibody binding.', '10 min, on ice'),
        st('stain', 'Stain', 'Add fluorescent antibodies and a viability dye.', '30 min, on ice, dark'),
        st('centrifuge', 'Wash', 'Add buffer, spin at 300 g and discard the supernatant.', '5 min'),
        st('fluidics', 'Acquire', 'Run the tube on the cytometer. Record at least 10,000 events in the gate of interest.'),
        st('plots', 'Analyse', 'Gate cells, then single cells, then live cells positive for each marker.'),
      ]) }) },
    { name: 'LDH assay', desc: 'Cytotoxicity by released lactate dehydrogenase', title: 'LDH cytotoxicity assay workflow',
      caption: 'Damaged cells release LDH. LDH turns lactate to pyruvate and NAD⁺ to NADH. Diaphorase uses NADH to reduce INT to red formazan, read at 490 nm. Cytotoxicity (%) = (experimental − spontaneous) ÷ (maximum − spontaneous) × 100.',
      data: norm({ perRow: 4, figs: ['reaction', 'plate'], plate: { mode: 'ldh' }, steps: T([
        st('plateCells', 'Seed cells', 'Seed 1 × 10⁴ cells per well in a 96-well plate.', 'overnight'),
        st('pipette', 'Treat', 'Add compound doses. Keep medium-only, spontaneous and maximum release controls.'),
        st('incubate', 'Incubate', '37 °C, 5% CO₂.', '24 h'),
        st('lyse', 'Lyse the maximum control', 'Add lysis buffer to the maximum release wells.', '45 min before the end'),
        st('centrifuge', 'Spin and transfer', 'Spin the plate. Move 50 µL of supernatant to a new plate.', '5 min'),
        st('substrate', 'Add reaction mix', 'Add 50 µL of LDH reagent: lactate, NAD⁺, diaphorase and INT.'),
        st('incubate', 'Develop', 'Protect from light.', '30 min, room temperature'),
        st('reader', 'Stop and read', 'Add stop solution. Read A490 and subtract the A680 background.'),
      ]) }) },
    { name: 'DNA isolation', desc: 'Silica spin-column extraction', title: 'DNA isolation workflow',
      caption: 'Silica spin-column DNA extraction. DNA binds the membrane in the presence of ethanol and salt, contaminants are washed through, and low-salt buffer elutes the DNA.',
      data: norm({ perRow: 4, figs: [], steps: T([
        st('tubeCells', 'Collect the sample', 'Pellet the cells, or cut up tissue, and place it in a 1.5 mL tube.'),
        st('heat', 'Lyse', 'Add lysis buffer and proteinase K to digest proteins.', '56 °C, 10 min'),
        st('spin', 'Bind', 'Add ethanol and load onto a silica spin column. DNA binds the membrane.'),
        st('centrifuge', 'Spin', 'Discard the flow-through.', '8,000 g, 1 min'),
        st('wash', 'Wash', 'Add wash buffers 1 and 2. Spin after each to remove salt and protein.'),
        st('centrifuge', 'Dry spin', 'Spin with the lid open to remove all ethanol.', '3 min'),
        st('elute', 'Elute', 'Add 50 to 100 µL of warm elution buffer to the membrane, wait, then spin.', '1 min'),
        st('dna', 'Check', 'Measure A260/A280 (about 1.8 for pure DNA) and run a gel.'),
      ]) }) },
    { name: 'PCR', desc: 'Polymerase chain reaction with thermal profile', title: 'Polymerase chain reaction (PCR) workflow',
      caption: 'Each cycle denatures the template, anneals primers and extends them with a heat-stable polymerase, so the target doubles every cycle.',
      data: norm({ perRow: 5, figs: ['cycle', 'thermal', 'doubling'], steps: T([
        st('mixTube', 'Master mix', 'Combine buffer, dNTPs, MgCl₂, primers, Taq polymerase and water on ice.'),
        st('pipette', 'Add template', 'Add 1 to 100 ng of template to each tube. Include a no-template control.'),
        st('thermocycler', 'Load the cycler', 'Place the tubes in the block and start the programme.'),
        st('dna', 'Amplify', 'Run denaturation, annealing and extension for 30 cycles (profile below).', '1.5 to 2 h'),
        st('gelImage', 'Analyse', 'Run the product on an agarose gel and check its size.'),
      ]) }) },
    { name: 'Gel electrophoresis', desc: 'Agarose gel with ladder and samples', title: 'Agarose gel electrophoresis workflow',
      caption: 'DNA is negatively charged and moves towards the anode. Smaller fragments move faster through the gel, so band position gives fragment size.',
      data: norm({ perRow: 4, figs: ['gel'], steps: T([
        st('gelPour', 'Make the gel', 'Melt 1% agarose in TAE buffer, add a DNA stain, pour and insert the comb.', '30 min to set'),
        st('loadGel', 'Load', 'Cover the gel with buffer. Load the ladder and each sample mixed with loading dye.'),
        st('runGel', 'Run', 'Apply 100 V. DNA moves from the wells towards the anode (+).', '30 to 45 min'),
        st('gelImage', 'Image', 'View under UV or blue light and photograph the gel.'),
      ]) }) },
    { name: 'Titration', desc: 'Acid–base titration with a titration curve', title: 'Acid–base titration workflow',
      caption: 'The end point is the first permanent colour change of the indicator. At the equivalence point the amount of base added equals the amount of acid in the flask.',
      data: norm({ perRow: 5, figs: ['titration'], titr: { type: 'sasb', indicator: 'phenolphthalein' }, steps: T([
        st('burette', 'Set up', 'Fill the burette with titrant and record the start volume. Pipette the acid into the flask.'),
        st('pipette', 'Add indicator', 'Add 2 to 3 drops of indicator to the flask.'),
        st('swirl', 'Titrate', 'Add titrant while swirling. Go dropwise near the end point.'),
        st('endpoint', 'End point', 'Stop at the first colour change that lasts 30 seconds.'),
        st('record', 'Record', 'Read the final volume. Repeat until three titres agree within 0.10 mL.'),
      ]) }) },
  ],
  stats: data => { const d = norm(data); return [[d.steps.length, 'steps'], [(d.figs || []).length, 'figures']]; },
  Controls, Overlay, Render,
  findText: (data, text) => { const d = norm(data), t = text.toLowerCase(); const s = d.steps.find((x: any) => String(x.title).toLowerCase() === t); return s ? { kind: 'step', id: s.id } : null; },
  remove: (data, sel) => { const d = norm(data); return sel.kind === 'step' ? { ...d, steps: d.steps.filter((x: any) => x.id !== sel.id) } : null; },
  duplicate: (data, sel) => {
    const d = norm(data), s = sel.kind === 'step' && d.steps.find((x: any) => x.id === sel.id); if (!s) return null;
    const id = uid('s', d.steps.map((x: any) => x.id)), i = d.steps.indexOf(s), steps = [...d.steps]; steps.splice(i + 1, 0, { ...s, id });
    return { patch: { ...d, steps }, sel: { kind: 'step', id } };
  },
  blank: norm({ perRow: 4, figs: [], steps: [{ id: 's1', art: 'pipette', title: 'Step one', detail: '', time: '' }, { id: 's2', art: 'incubate', title: 'Step two', detail: '', time: '' }, { id: 's3', art: 'reader', title: 'Step three', detail: '', time: '' }] }),
};
