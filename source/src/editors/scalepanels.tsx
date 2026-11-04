import { S } from '../sheet';
import { num, Range, RowX, Seg, startDrag, Swatches, Toggle } from '../ui';
import type { EditProps } from '../shell';
import { ASPECTS, aspectCrop, cropAspect, cropOf, niceStep, panelGeo, SHEET_W, ZOOMS, zoomCrop, type Crop } from './scalegeo';
import { fmt } from './scalegfx';

type XY = [number, number];

/* ---------- grid over the micrograph: spacing in real units ---------- */
export function gridStepOf(d: any, ppu: number, pw: number) {
  const s = num(d.gridStep, 0);
  return s > 0 ? s : niceStep(pw / ppu / 6);
}
export function GridSvg({ d, ppu, pw, ph }: { d: any; ppu: number; pw: number; ph: number }) {
  const step = gridStepOf(d, ppu, pw), sp = step * ppu;
  if (!d.gridOn || sp < 5) return null;
  const nx = Math.min(200, Math.floor(pw / sp)), ny = Math.min(200, Math.floor(ph / sp));
  const col = d.gridColor || 'var(--paper)', w = num(d.gridWidth, 1), st: any = { stroke: col, strokeWidth: w, strokeOpacity: num(d.gridOpacity, 60) / 100, fill: 'none' };
  const kind = d.gridStyle || 'lines';
  let path = '';
  if (kind === 'lines') {
    for (let i = 1; i <= nx; i++) path += 'M' + +(i * sp).toFixed(2) + ',0V' + +ph.toFixed(2);
    for (let j = 1; j <= ny; j++) path += 'M0,' + +(j * sp).toFixed(2) + 'H' + +pw.toFixed(2);
  } else {
    const a = kind === 'dots' ? 0.01 : Math.min(5, sp / 4);
    for (let i = 1; i <= nx; i++) for (let j = 1; j <= ny; j++) { const x = +(i * sp).toFixed(2), y = +(j * sp).toFixed(2); path += 'M' + (x - a) + ',' + y + 'H' + (x + a) + 'M' + x + ',' + (y - a) + 'V' + (y + a); }
  }
  return (
    <g className="mk-grid-lines">
      <path d={path} style={{ ...st, strokeWidth: kind === 'dots' ? w * 3 : w, strokeLinecap: kind === 'dots' ? 'round' : undefined }} />
      {d.gridLabel ? <text x={pw - 8} y={ph - 8} className="mk-dim" style={{ fill: 'var(--ink)', fontSize: '11px', textAnchor: 'end', stroke: 'var(--paper)', strokeWidth: 2.5, paintOrder: 'stroke' }}>{'Grid ' + fmt(step) + ' ' + d.unit}</text> : null}
    </g>
  );
}

export function GridPanel({ data, set }: EditProps) {
  const pw = num(data.pw, SHEET_W), g = panelGeo(data, pw, !!data.cropping), step = gridStepOf(data, g.ppu, pw), tooFine = step * g.ppu < 5;
  return (
    <S.Panel kicker="Grid" help="Lines at a fixed real spacing, for counting and orientation. Spacing follows the calibration.">
      <Toggle on={!!data.gridOn} label="Show grid" onChange={v => set({ gridOn: v })} />
      {data.gridOn ? <>
        <S.Field id="gr-step" label={'Spacing (' + data.unit + ')'} value={data.gridStep == null ? '' : data.gridStep} placeholder={'auto, ' + fmt(step)} onChange={(e: any) => set({ gridStep: e.target.value }, 'gr-step')} />
        {tooFine ? <p className="mk-warn">Spacing is under 5 px on the sheet, so the grid is hidden. Use a larger value.</p> : null}
        <Seg value={data.gridStyle || 'lines'} options={[['lines', 'Lines'], ['cross', 'Crosses'], ['dots', 'Dots']]} onChange={v => set({ gridStyle: v })} />
        <Swatches label="Grid colour" value={data.gridColor} colors={['var(--ink)', 'var(--accent-700)', 'var(--edge-feedback-neg)', 'var(--swatch-6)', 'var(--swatch-11)']} none="White" onChange={v => set({ gridColor: v })} />
        <Range id="gr-op" label="Opacity %" value={num(data.gridOpacity, 60)} min={10} max={100} onChange={v => set({ gridOpacity: v }, 'gr-op')} />
        <Range id="gr-w" label="Line width" value={num(data.gridWidth, 1)} min={0.5} max={3} step={0.5} onChange={v => set({ gridWidth: v }, 'gr-w')} />
        <Toggle on={!!data.gridLabel} label="Print the spacing" onChange={v => set({ gridLabel: v })} />
      </> : null}
    </S.Panel>
  );
}

/* ---------- crop and rotate ---------- */
export function CropPanel({ data, set, top }: EditProps & { top: EditProps }) {
  const c = cropOf(data), q = num(data.q, 0), cropped = c.l + c.r + c.t + c.b > 0, turned = q % 4 !== 0 || data.flipX || data.flipY || num(data.ang, 0) !== 0;
  const edge = (k: keyof Crop, label: string) => <Range id={'cr-' + k} label={label + ' %'} value={Math.round(c[k] * 100)} min={0} max={80} onChange={v => set({ crop: { ...c, [k]: v / 100 } }, 'cr-' + k)} />;
  /* turning or flipping carries the crop with the image, so the same region stays framed */
  const cw90 = (k: Crop): Crop => ({ l: k.b, t: k.l, r: k.t, b: k.r });
  const turn = (to: number) => { let k = c; for (let i = ((to - q) % 4 + 4) % 4; i > 0; i--) k = cw90(k); set({ q: ((to % 4) + 4) % 4, ...(cropped ? { crop: k } : {}) }); };
  const flip = (horizontal: boolean) => {
    const sourceX = horizontal !== (q % 2 === 1);
    set({ ...(sourceX ? { flipX: !data.flipX } : { flipY: !data.flipY }), ...(cropped ? { crop: horizontal ? { ...c, l: c.r, r: c.l } : { ...c, t: c.b, b: c.t } } : {}) });
  };
  const pw = num(data.pw, SHEET_W), full = panelGeo(data, pw), ca = cropAspect(full.OW, full.OH, c), none = !cropped;
  const asp = none ? 'full' : (ASPECTS.find(([, a]) => Math.abs(a / ca - 1) < 0.01) || ['free'])[0];
  return (
    <S.Panel kicker="Crop and rotate" help="The calibration follows the crop and the turn, and graphics stay on the same spot of the image.">
      <Seg wrap value={q % 4} options={[[0, 'Original'], [1, '90° cw'], [2, '180°'], [3, '90° ccw']]} onChange={v => turn(v)} />
      <Seg wrap value={asp} options={[['full', 'Full'], ...ASPECTS.map(([n]) => [n, n] as [string, string])]}
        onChange={v => set({ crop: v === 'full' ? undefined : aspectCrop(full.OW, full.OH, c, ASPECTS.find(([n]) => n === v)![1]) })} />
      <div className="sd-row-btns">
        {ZOOMS.map(z => <S.ToolButton key={z} compact disabled={full.cw <= 1 / z + 0.005} onClick={() => set({ crop: zoomCrop(full.OW, full.OH, c, z) })} title={'Zoom to ' + Math.round(100 / z) + '% of the width, about the centre of the crop'}>{z + '×'}</S.ToolButton>)}
      </div>
      <div className="sd-row-btns">
        <S.ToolButton compact onClick={() => turn(q + 3)} title="Rotate 90° anticlockwise">↺ 90°</S.ToolButton>
        <S.ToolButton compact onClick={() => turn(q + 1)} title="Rotate 90° clockwise">↻ 90°</S.ToolButton>
      </div>
      <div className="sd-row-btns">
        <S.ToolButton compact on={!!(q % 2 ? data.flipY : data.flipX)} onClick={() => flip(true)}>Flip ↔</S.ToolButton>
        <S.ToolButton compact on={!!(q % 2 ? data.flipX : data.flipY)} onClick={() => flip(false)}>Flip ↕</S.ToolButton>
      </div>
      <Range id="cr-ang" label="Straighten °" value={num(data.ang, 0)} min={-45} max={45} step={0.5} onChange={v => set({ ang: v }, 'cr-ang')} />
      <Toggle on={!!top.data.cropping} label={top.data.cropping ? 'Cropping: drag the frame, then switch off' : 'Crop on the sheet'} onChange={v => top.set({ cropping: v, tool: 'select', draft: [] })} />
      {edge('l', 'Left')}{edge('r', 'Right')}{edge('t', 'Top')}{edge('b', 'Bottom')}
      <S.ToolButton disabled={!cropped && !turned} onClick={() => set({ crop: undefined, q: 0, flipX: false, flipY: false, ang: 0 })}>Reset crop and rotate</S.ToolButton>
    </S.Panel>
  );
}

/* the crop frame: the whole oriented image is shown while it is on, the frame drags by edges and corners */
export function CropOverlay({ data, set, toSvg }: EditProps & { toSvg: (x: number, y: number) => XY }) {
  const pw = num(data.pw, SHEET_W), g = panelGeo(data, pw, true), ph = g.ph, c = cropOf(data);
  const x = c.l * pw, y = c.t * ph, w = (1 - c.l - c.r) * pw, h = (1 - c.t - c.b) * ph;
  const clamp = (o: Crop, patch: Partial<Crop>): Crop => {
    const n = { ...o, ...patch };
    n.l = Math.max(0, Math.min(0.9 - n.r, n.l)); n.r = Math.max(0, Math.min(0.9 - n.l, n.r));
    n.t = Math.max(0, Math.min(0.9 - n.b, n.t)); n.b = Math.max(0, Math.min(0.9 - n.t, n.b));
    return n;
  };
  const H = (key: string, hx: number, hy: number, f: (o: Crop, dx: number, dy: number) => Partial<Crop>, cur: string) =>
    <rect key={key} className="mk-handle" style={{ cursor: cur }} x={hx - 5} y={hy - 5} width={10} height={10}
      onPointerDown={e => { const o = { ...c }; startDrag(e, toSvg, (dx, dy) => set({ crop: clamp(o, f(o, dx, dy)) }, 'crop-drag')); }} />;
  return (
    <>
      <path d={'M0,0H' + pw + 'V' + ph + 'H0Z M' + x + ',' + y + 'V' + (y + h) + 'H' + (x + w) + 'V' + y + 'Z'} fillRule="evenodd" style={{ fill: 'var(--ink)', fillOpacity: 0.45, pointerEvents: 'none' }} />
      <rect x={x} y={y} width={w} height={h} style={{ fill: 'none', stroke: 'var(--paper)', strokeWidth: 1.5, strokeDasharray: '5 3', pointerEvents: 'none' }} />
      {H('nw', x, y, (o, dx, dy) => ({ l: o.l + dx / pw, t: o.t + dy / ph }), 'nwse-resize')}
      {H('ne', x + w, y, (o, dx, dy) => ({ r: o.r - dx / pw, t: o.t + dy / ph }), 'nesw-resize')}
      {H('sw', x, y + h, (o, dx, dy) => ({ l: o.l + dx / pw, b: o.b - dy / ph }), 'nesw-resize')}
      {H('se', x + w, y + h, (o, dx, dy) => ({ r: o.r - dx / pw, b: o.b - dy / ph }), 'nwse-resize')}
      {H('n', x + w / 2, y, (o, _dx, dy) => ({ t: o.t + dy / ph }), 'ns-resize')}
      {H('s', x + w / 2, y + h, (o, _dx, dy) => ({ b: o.b - dy / ph }), 'ns-resize')}
      {H('w', x, y + h / 2, (o, dx) => ({ l: o.l + dx / pw }), 'ew-resize')}
      {H('e', x + w, y + h / 2, (o, dx) => ({ r: o.r - dx / pw }), 'ew-resize')}
    </>
  );
}

/* ---------- panels: several micrographs on one sheet, each with its own calibration ---------- */
export function PanelsPanel({ data, set }: EditProps) {
  const panels: any[] = data.panels, n = panels.length, active = Math.max(0, Math.min(n - 1, num(data.active, 0)));
  const letter = (i: number) => data.letters === 'A' ? String.fromCharCode(65 + i % 26) : data.letters === 'a' ? String.fromCharCode(97 + i % 26) : '';
  const what = (p: any) => p.img === 'sample:artery' ? 'Artery example' : p.img ? 'Your micrograph' : 'Drawn example';
  const go = (patch: any) => set(patch);
  const add = () => {
    const src = panels[active], pid = 'p' + (Math.max(0, ...panels.map(p => num(String(p.pid).slice(1), 0))) + 1);
    const copy = { ...src, pid, shapes: [], bx: undefined, by: undefined, barHidden: false };
    go({ panels: [...panels, copy], active: n, cols: data.cols > 1 ? data.cols : 2, letters: data.letters || 'A' });
  };
  const remove = (i: number) => go({ panels: panels.filter((_, j) => j !== i), active: Math.max(0, Math.min(n - 2, active > i ? active - 1 : active)) });
  const move = (d: number) => { const j = active + d; if (j < 0 || j >= n) return; const a = [...panels]; [a[active], a[j]] = [a[j], a[active]]; go({ panels: a, active: j }); };
  return (
    <S.Panel kicker="Panels" help="Each panel keeps its own image, calibration, scale bar and graphics. Click a panel on the sheet to edit it.">
      {panels.map((p, i) => (
        <div key={p.pid} className="mk-row" data-on={i === active ? '1' : '0'}>
          <button type="button" className="mk-row-main" onClick={() => go({ active: i })}>{(letter(i) || 'Panel ' + (i + 1)) + ' · ' + what(p)}</button>
          {n > 1 ? <RowX label={'panel ' + (i + 1)} onRemove={() => remove(i)} /> : null}
        </div>
      ))}
      <div className="sd-row-btns">
        <S.ToolButton compact onClick={add} disabled={n >= 6}>Add panel</S.ToolButton>
        <S.ToolButton compact onClick={() => move(-1)} disabled={active === 0} title="Move earlier">◀</S.ToolButton>
        <S.ToolButton compact onClick={() => move(1)} disabled={active === n - 1} title="Move later">▶</S.ToolButton>
      </div>
      {n > 1 ? <>
        <Seg value={Math.min(num(data.cols, 1), n)} options={[[1, '1 column'], [2, '2 columns'], [3, '3 columns']]} onChange={v => go({ cols: v })} />
        <Range id="pn-gap" label="Gap" value={num(data.gap, 12)} min={0} max={60} onChange={v => go({ gap: v })} />
      </> : null}
      <Seg value={data.letters || ''} options={[['', 'No letters'], ['A', 'A, B, C'], ['a', 'a, b, c']]} onChange={v => set({ letters: v })} />
      {data.letters ? <Range id="pn-ls" label="Letter size" value={num(data.letterSize, 26)} min={12} max={60} onChange={v => set({ letterSize: v }, 'pn-ls')} /> : null}
    </S.Panel>
  );
}
