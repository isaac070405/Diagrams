import { S } from './sheet';
import { num, Range, RowX, Seg, startDrag, Swatches, uid } from './ui';
import type { Sel } from './shell';

type XY = [number, number];
const INKS = ['var(--ink)', 'var(--accent-700)', 'var(--edge-feedback-neg)', 'var(--edge-induce)', 'var(--paper)', ...Array.from({ length: 16 }, (_, i) => 'var(--swatch-' + (i + 1) + ')')];

export function newNote(kind: string, notes: any[], at: { x: number; y: number; w: number; h: number }) {
  const id = uid('n', notes.map(n => n.id));
  const cx = Math.round(at.x + at.w / 2), cy = Math.round(at.y + at.h / 2);
  if (kind === 'text') return { id, kind, x: cx - 40, y: cy, text: 'Label', size: 14 };
  if (kind === 'arrow') return { id, kind, x: cx - 60, y: cy + 30, x2: cx + 40, y2: cy - 20, width: 1.8 };
  return { id, kind, x: cx - 60, y: cy - 35, w: 120, h: 70, width: 1.5, dash: 'dashed' };
}

/* Hit areas over notes: drag to move; when selected, handles move arrow ends or resize shapes. */
export function NotesOverlay(p: { notes: any[]; sel: Sel; setSel: (s: Sel) => void; toSvg: (x: number, y: number) => XY; setNotes: (n: any[], key?: string) => void }) {
  const up = (id: string, patch: any) => p.setNotes(p.notes.map(n => n.id === id ? { ...n, ...patch } : n), 'note-drag-' + id);
  return (
    <>
      {p.notes.map(n => {
        const on = !!p.sel && p.sel.kind === 'note' && p.sel.id === n.id;
        const move = (e: any) => {
          p.setSel({ kind: 'note', id: n.id });
          const o = { ...n };
          startDrag(e, p.toSvg, (dx, dy) => up(n.id, { x: Math.round(o.x + dx), y: Math.round(o.y + dy), ...(n.kind === 'arrow' ? { x2: Math.round(o.x2 + dx), y2: Math.round(o.y2 + dy) } : {}) }));
        };
        const handle = (key: string, hx: number, hy: number, f: (dx: number, dy: number) => any) =>
          <rect key={key} className="mk-handle" x={hx - 5} y={hy - 5} width={10} height={10} onPointerDown={e => { const o = { ...n }; startDrag(e, p.toSvg, (dx, dy) => up(n.id, f.call(o, dx, dy))); }} />;
        if (n.kind === 'arrow') return (
          <g key={n.id}>
            <line className={'mk-hit-line' + (on ? ' mk-on' : '')} x1={n.x} y1={n.y} x2={n.x2} y2={n.y2} onPointerDown={move} />
            {on ? [handle('a', n.x, n.y, function (this: any, dx, dy) { return { x: Math.round(this.x + dx), y: Math.round(this.y + dy) }; }),
                   handle('b', n.x2, n.y2, function (this: any, dx, dy) { return { x2: Math.round(this.x2 + dx), y2: Math.round(this.y2 + dy) }; })] : null}
          </g>
        );
        if (n.kind === 'text') {
          const lines = String(n.text || '').split('\n'), sz = n.size || 14;
          const w = Math.max(...lines.map(l => l.length)) * sz * 0.56 + 8, h = lines.length * sz * 1.25 + 6;
          return <rect key={n.id} className={'mk-hit' + (on ? ' mk-on' : '')} x={n.x - 4} y={n.y - sz} width={w} height={h} onPointerDown={move} />;
        }
        return (
          <g key={n.id}>
            <rect className={'mk-hit' + (on ? ' mk-on' : '')} x={n.x - 3} y={n.y - 3} width={n.w + 6} height={n.h + 6} onPointerDown={move} />
            {on ? handle('r', n.x + n.w, n.y + n.h, function (this: any, dx, dy) { return { w: Math.max(16, Math.round(this.w + dx)), h: Math.max(16, Math.round(this.h + dy)) }; }) : null}
          </g>
        );
      })}
    </>
  );
}

export function NotesPanel(p: { notes: any[]; sel: Sel; setSel: (s: Sel) => void; setNotes: (n: any[], key?: string) => void; box: { x: number; y: number; w: number; h: number } }) {
  const n = p.sel && p.sel.kind === 'note' ? p.notes.find(q => q.id === p.sel!.id) : null;
  const upd = (patch: any, key?: string) => p.setNotes(p.notes.map(q => q.id === n.id ? { ...q, ...patch } : q), key);
  const add = (kind: string) => { const nn = newNote(kind, p.notes, p.box); p.setNotes([...p.notes, nn]); p.setSel({ kind: 'note', id: nn.id }); };
  return (
    <>
      {n ? (
        <S.Panel kicker={'Selected ' + (n.kind === 'text' ? 'label' : n.kind)} help="Drag it on the sheet. Squares move arrow ends or resize. Delete removes it.">
          {n.kind === 'text' ? <S.Field id="nt-text" label="Text" multiline rows={2} value={n.text} onChange={(e: any) => upd({ text: e.target.value }, 'nt-text')} /> : null}
          {n.kind === 'text' ? <Range id="nt-size" label="Text size" value={num(n.size, 14)} min={9} max={40} onChange={v => upd({ size: v }, 'nt-size')} /> : null}
          {n.kind === 'text' ? <Seg value={(n.bold ? 'b' : '') + (n.italic ? 'i' : '')} options={[['', 'Regular'], ['b', 'Bold'], ['i', 'Italic']]} onChange={v => upd({ bold: v === 'b', italic: v === 'i' })} /> : null}
          {n.kind !== 'text' ? <Range id="nt-w" label="Line width" value={num(n.width, 1.5)} min={0.5} max={6} step={0.25} onChange={v => upd({ width: v }, 'nt-w')} /> : null}
          {n.kind !== 'text' ? <Seg value={n.dash || ''} options={[['', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']]} onChange={v => upd({ dash: v || undefined })} /> : null}
          <Swatches label={n.kind === 'text' ? 'Colour' : 'Line colour'} value={n.color} colors={INKS} none="Ink" onChange={v => upd({ color: v })} />
          {n.kind === 'box' || n.kind === 'ellipse' ? <Swatches label="Fill" value={n.fill} none="No fill" onChange={v => upd({ fill: v })} /> : null}
          {n.kind === 'box' ? <S.ToolButton on={!!n.round} onClick={() => upd({ round: !n.round })}>Rounded corners</S.ToolButton> : null}
          {n.kind === 'arrow' ? <S.ToolButton on={n.head !== false} onClick={() => upd({ head: n.head === false })}>Arrowhead</S.ToolButton> : null}
          <S.ToolButton onClick={() => { p.setNotes(p.notes.filter(q => q !== n)); p.setSel(null); }}>Delete</S.ToolButton>
        </S.Panel>
      ) : null}
      <S.Panel kicker="Add to the sheet" help="Labels, arrows and outlines on top of any diagram. Drag any label on the sheet to nudge it; click it to find it in the forms.">
        <div className="sd-row-btns">
          <S.ToolButton compact onClick={() => add('text')}>Label</S.ToolButton>
          <S.ToolButton compact onClick={() => add('arrow')}>Arrow</S.ToolButton>
        </div>
        <div className="sd-row-btns">
          <S.ToolButton compact onClick={() => add('box')}>Box</S.ToolButton>
          <S.ToolButton compact onClick={() => add('ellipse')}>Ellipse</S.ToolButton>
        </div>
        {p.notes.map(q => (
          <div key={q.id} className="mk-row" data-on={n && n.id === q.id ? '1' : '0'}>
            <button type="button" className="mk-row-main" onClick={() => p.setSel({ kind: 'note', id: q.id })}>{q.kind === 'text' ? '“' + String(q.text).split('\n')[0] + '”' : q.kind[0].toUpperCase() + q.kind.slice(1)}</button>
            <RowX label={q.kind} onRemove={() => p.setNotes(p.notes.filter(x => x !== q))} />
          </div>
        ))}
      </S.Panel>
    </>
  );
}
