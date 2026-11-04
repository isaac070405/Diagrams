import { useEffect, useRef, useState } from 'react';
import { S, dragState } from './sheet';

export function lines(text: string): string[] {
  return String(text || '').split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim() && !l.trim().startsWith('//'));
}
export function cells(line: string, sep = '|'): string[] { return line.split(sep).map(s => s.trim()); }
export function idOf(s: string) { return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'; }
export function num(v: any, d: number) { const n = parseFloat(v); return isFinite(n) ? n : d; }
export const br = (s: string) => String(s || '').replace(/\s*\/\/\s*/g, '\n');

/* A row of compact choices: one is on. */
export function Seg(p: { value: any; options: [any, string][]; onChange: (v: any) => void; wrap?: boolean }) {
  return (
    <div className="sd-row-btns" style={p.wrap ? { flexWrap: 'wrap' } : undefined}>
      {p.options.map(([v, l]) => <S.ToolButton key={String(v)} compact on={p.value === v} onClick={() => p.onChange(v)}>{l}</S.ToolButton>)}
    </div>
  );
}
export function Toggle(p: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return <S.ToolButton on={!!p.on} onClick={() => p.onChange(!p.on)}>{p.label}</S.ToolButton>;
}
export function Spec(p: { id: string; label: string; value: string; rows?: number; help?: string; onChange: (v: string) => void; placeholder?: string }) {
  return <S.Field id={p.id} label={p.label} multiline code rows={p.rows || 7} value={p.value} placeholder={p.placeholder} help={p.help} onChange={(e: any) => p.onChange(e.target.value)} />;
}
export function NumField(p: { id: string; label: string; value: any; onChange: (v: string) => void; placeholder?: string }) {
  return <S.Field id={p.id} label={p.label} value={p.value} placeholder={p.placeholder} onChange={(e: any) => p.onChange(e.target.value)} />;
}
export function Range(p: { id: string; label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return <S.Field id={p.id} label={p.label + ': ' + p.value} type="range" min={p.min} max={p.max} step={p.step || 1} value={p.value} onChange={(e: any) => p.onChange(+e.target.value)} />;
}
/* Shown on the sheet when a spec parses to nothing. */
export function EmptyHint(p: { text: string }) {
  return <text className="mk-empty" x={0} y={0}>{p.text}</text>;
}

/* ---------- direct editing helpers ---------- */
export const SWATCHES = Array.from({ length: 16 }, (_, i) => 'var(--swatch-' + (i + 1) + ')');

export function Swatches(p: { label: string; value?: string; onChange: (v: string | undefined) => void; colors?: string[]; none?: string }) {
  const cs = p.colors || SWATCHES;
  return (
    <div className="mk-swatches" role="group" aria-label={p.label}>
      <span>{p.label}</span>
      <div>
        <button type="button" className="mk-sw mk-sw-none" data-on={!p.value ? '1' : '0'} title={p.none || 'Default'} aria-label={p.none || 'Default'} onClick={() => p.onChange(undefined)} />
        {cs.map(c => <button key={c} type="button" className="mk-sw" data-on={p.value === c ? '1' : '0'} style={{ background: c }} aria-label={c.replace(/var\(--|\)/g, '')} onClick={() => p.onChange(c)} />)}
      </div>
    </div>
  );
}

export function Select(p: { id: string; label?: string; value: any; options: [any, string][]; onChange: (v: string) => void; small?: boolean }) {
  const sel = <select id={p.id} className="sd-input mk-select" value={p.value == null ? '' : String(p.value)} onChange={e => p.onChange(e.target.value)}>
    {p.options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
  </select>;
  return p.label ? <label className="sd-field"><span>{p.label}</span>{sel}</label> : sel;
}

export function TextIn(p: { id: string; value: any; placeholder?: string; onChange: (v: string) => void; label?: string }) {
  const inp = <input id={p.id} className="sd-input" value={p.value == null ? '' : p.value} placeholder={p.placeholder} onChange={e => p.onChange(e.target.value)} />;
  return p.label ? <label className="sd-field"><span>{p.label}</span>{inp}</label> : inp;
}

export function RowX(p: { onRemove: () => void; label: string }) {
  return <button type="button" className="mk-x" aria-label={'Remove ' + p.label} title="Remove" onClick={p.onRemove}>×</button>;
}

/* Text view of a structured list: kept for people who prefer typing. */
export function TextView(p: { id: string; title: string; text: string; help: string; rows?: number; onChange: (t: string) => void }) {
  return (
    <details className="mk-details">
      <summary>{p.title}</summary>
      <Spec id={p.id} label="" value={p.text} rows={p.rows || 10} help={p.help} onChange={p.onChange} />
    </details>
  );
}

export function uid(prefix: string, taken: string[]) {
  let i = taken.length + 1; while (taken.includes(prefix + i)) i++; return prefix + i;
}

/* Pointer drag on an SVG element in sheet units. */
export function startDrag(e: any, toSvg: (x: number, y: number) => [number, number], move: (dx: number, dy: number, at: [number, number]) => void, end?: (dx: number, dy: number, at: [number, number]) => void, click?: () => void) {
  e.stopPropagation(); e.preventDefault();
  dragState.on = true;
  const s = toSvg(e.clientX, e.clientY);
  let last: [number, number] = s, moved = false;
  const mv = (ev: PointerEvent) => { const q = toSvg(ev.clientX, ev.clientY); last = q; if (!moved && Math.hypot(q[0] - s[0], q[1] - s[1]) < 2) return; moved = true; move(q[0] - s[0], q[1] - s[1], q); };
  const up = () => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    if (moved && end) end(last[0] - s[0], last[1] - s[1], last);
    if (!moved && click) click();
    dragState.on = false; dragState.listeners.forEach(f => f());
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}

/* ---------- forms over text ---------- */
/* Clicking a label on the sheet asks every open form whether one of its rows says that. */
export const focusBus = {
  listeners: new Set<(t: string) => boolean>(),
  emit(t: string) { for (const f of Array.from(this.listeners)) if (f(t)) return true; return false; },
};
export const normT = (s: any) => String(s == null ? '' : s).replace(/\s*\/\/\s*/g, ' ').replace(/_/g, ' ').toLowerCase().replace(/[^a-z0-9À-￿]+/g, ' ').trim();

export interface Col { key: string; label: string; type?: 'text' | 'num' | 'select' | 'color' | 'check'; options?: [any, string][]; w?: string; placeholder?: string; colors?: string[] }

export function Rows(p: { id: string; kicker: string; help?: string; rows: any[]; cols: Col[]; onChange: (rows: any[], key?: string) => void; blank: () => any; addLabel: string }) {
  const [hi, setHi] = useState(-1);
  const [open, setOpen] = useState('');
  const ref = useRef<any>({ rows: p.rows });
  ref.current.rows = p.rows;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = (text: string) => {
      const t = normT(text); if (!t) return false;
      const i = ref.current.rows.findIndex((r: any) => p.cols.some(c => (c.type || 'text') === 'text' && normT(r[c.key]) && (normT(r[c.key]) === t || (t.length > 6 && normT(r[c.key]).includes(t)) || (normT(r[c.key]).length > 6 && t.includes(normT(r[c.key]))))));
      if (i < 0) return false;
      setHi(i);
      setTimeout(() => {
        const row = box.current && box.current.querySelector('[data-row="' + i + '"]') as HTMLElement;
        if (row) { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); const inp = row.querySelector('input') as HTMLInputElement; inp && inp.focus(); }
      }, 30);
      return true;
    };
    focusBus.listeners.add(f);
    return () => { focusBus.listeners.delete(f); };
  }, []);
  const up = (i: number, patch: any, key?: string) => p.onChange(p.rows.map((r, j) => j === i ? { ...r, ...patch } : r), key);
  const grid = p.cols.map(c => c.type === 'color' ? '26px' : c.type === 'check' ? '28px' : (c.w || '1fr')).join(' ') + ' 14px 18px';
  return (
    <S.Panel kicker={p.kicker} help={p.help}>
      <div className="mk-rows" ref={box}>
        <div className="mk-rows-head" style={{ gridTemplateColumns: grid }}>{p.cols.map(c => <span key={c.key} title={c.label}>{c.type === 'color' ? '' : c.type === 'check' ? (c.placeholder || c.label) : c.label}</span>)}<span /><span /></div>
        {p.rows.map((r, i) => (
          <div key={i} data-row={i}>
            <div className="mk-rows-row" data-on={hi === i ? '1' : '0'} style={{ gridTemplateColumns: grid }} onFocus={() => setHi(i)}>
              {p.cols.map(c => {
                const id = p.id + '-' + i + '-' + c.key, v = r[c.key];
                if (c.type === 'select') return <select key={c.key} id={id} aria-label={c.label} className="sd-input mk-select" value={v == null ? '' : String(v)} onChange={e => up(i, { [c.key]: e.target.value })}>{(c.options || []).map(([ov, ol]) => <option key={String(ov)} value={String(ov)}>{ol}</option>)}</select>;
                if (c.type === 'color') return <button key={c.key} type="button" className="mk-sw mk-sw-pick" aria-label={c.label} title={c.label} style={{ background: v || undefined }} data-none={v ? '0' : '1'} onClick={() => setOpen(open === id ? '' : id)} />;
                if (c.type === 'check') return <label key={c.key} className="mk-check" title={c.label}><input id={id} type="checkbox" checked={!!v} onChange={e => up(i, { [c.key]: e.target.checked })} /></label>;
                return <input key={c.key} id={id} aria-label={c.label} className="sd-input" inputMode={c.type === 'num' ? 'decimal' : undefined} value={v == null ? '' : String(v)} placeholder={c.placeholder} onChange={e => up(i, { [c.key]: e.target.value }, id)} />;
              })}
              <span className="mk-move">
                <button type="button" aria-label={'Move row ' + (i + 1) + ' up'} disabled={i === 0} onClick={() => { const a = [...p.rows]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; p.onChange(a); }}>▲</button>
                <button type="button" aria-label={'Move row ' + (i + 1) + ' down'} disabled={i === p.rows.length - 1} onClick={() => { const a = [...p.rows]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; p.onChange(a); }}>▼</button>
              </span>
              <RowX label={'row ' + (i + 1)} onRemove={() => p.onChange(p.rows.filter((_, j) => j !== i))} />
            </div>
            {p.cols.filter(c => c.type === 'color' && open === p.id + '-' + i + '-' + c.key).map(c => (
              <Swatches key={c.key} label={c.label} value={r[c.key]} colors={c.colors} onChange={v => { up(i, { [c.key]: v }); setOpen(''); }} />
            ))}
          </div>
        ))}
      </div>
      <S.ToolButton onClick={() => p.onChange([...p.rows, p.blank()])}>{p.addLabel}</S.ToolButton>
    </S.Panel>
  );
}

/* A form over the lines of a text spec that match `match`; other lines are kept as they are. */
export function RowsText(p: { id: string; kicker: string; help?: string; text: string; match?: (line: string) => boolean; parse: (line: string) => any; format: (row: any) => string; cols: Col[]; blank: () => any; addLabel: string; onText: (t: string, key?: string) => void; filterOut?: (row: any) => boolean }) {
  const all = String(p.text || '').split('\n');
  const isRow = (l: string) => !!l.trim() && !l.trim().startsWith('//') && (!p.match || p.match(l));
  const rows = all.filter(isRow).map(p.parse);
  const keep = all.filter(l => !isRow(l));
  return <Rows id={p.id} kicker={p.kicker} help={p.help} rows={rows} cols={p.cols} blank={p.blank} addLabel={p.addLabel}
    onChange={(rs, key) => p.onText([...keep.filter(l => l.trim()), ...rs.map(p.format)].join('\n'), key ? p.id + key : undefined)} />;
}
