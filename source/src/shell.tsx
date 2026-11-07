import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { S, Sheet } from './sheet';
import { rasterBlob, slug, svgBlob } from './lib/export';
import { saveFile, store } from './lib/platform';
import { deleteSheet, listSheets, saveSheet, type SavedSheet, where } from './lib/workspace';
import { NotesOverlay, NotesPanel } from './notes';
import { focusBus } from './ui';
import { ThemeSwitch } from './theme';

export interface Doc { v: 1; editor: string; title: string; caption: string; number: string; font: string; data: any; notes?: any[]; nudges?: Record<string, [number, number]>; }
export interface Template { name: string; desc: string; title: string; caption?: string; data: any; }
export type Sel = { kind: string; id: string } | null;
export interface EditProps { data: any; set: (patch: any, key?: string) => void; doc: Doc; sel: Sel; setSel: (s: Sel) => void; }
export interface EditorDef {
  id: string; num: string; name: string; field: string; blurb: string;
  templates: Template[];
  normalize?: (data: any) => any;
  Controls: (p: EditProps) => any;
  Render: (p: { data: any; doc: Doc; sel?: Sel }) => any;
  Below?: (p: { data: any; doc: Doc }) => any;
  stats?: (data: any) => [number, string][];
  sheetClick?: (data: any, pt: [number, number]) => any | null;
  Overlay?: (p: EditProps & { toSvg: (x: number, y: number) => [number, number] }) => any;
  remove?: (data: any, sel: NonNullable<Sel>) => any | null;
  findText?: (data: any, text: string) => Sel;
  /* arrow keys move the selection; returns a data patch */
  nudge?: (data: any, sel: NonNullable<Sel>, dx: number, dy: number) => any | null;
  /* Ctrl/Cmd+D copies the selection; returns the patch and the copy's selection */
  duplicate?: (data: any, sel: NonNullable<Sel>) => { patch: any; sel: Sel } | null;
  /* connect mode: click a source item, then a target item of this kind */
  connect?: { kind: string; label: string; plural?: string; make: (data: any, from: string, to: string) => any | null };
  blank?: any;
  hint?: string;
}

export function blankDoc(def: EditorDef, t: Template = def.templates[0]): Doc {
  return { v: 1, editor: def.id, title: t.title, caption: t.caption || '', number: '1', font: 'arial', data: JSON.parse(JSON.stringify(t.data)), notes: [], nudges: {} };
}
export function norm(def: EditorDef, data: any) { return def.normalize ? def.normalize(data) : data; }

/* ---------- history: capped near 60 steps; typing in one field or one drag coalesces ---------- */
function useHistory(initial: Doc) {
  const [st, setSt] = useState({ list: [initial], i: 0 });
  const last = useRef({ key: '', t: 0 });
  const doc = st.list[st.i];
  const commit = useCallback((next: Doc, key?: string) => {
    setSt(s => {
      const now = Date.now();
      const merge = key && last.current.key === key && now - last.current.t < 900 && s.i > 0;
      last.current = { key: key || '', t: now };
      const base = s.list.slice(0, merge ? s.i : s.i + 1);
      const list = [...base, next].slice(-60);
      return { list, i: list.length - 1 };
    });
  }, []);
  const undo = useCallback(() => { last.current.key = ''; setSt(s => s.i > 0 ? { ...s, i: s.i - 1 } : s); }, []);
  const redo = useCallback(() => { last.current.key = ''; setSt(s => s.i < s.list.length - 1 ? { ...s, i: s.i + 1 } : s); }, []);
  return { doc, commit, undo, redo, canUndo: st.i > 0, canRedo: st.i < st.list.length - 1 };
}

const Undo = <svg viewBox="0 0 24 24"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1" /></svg>;
const Redo = <svg viewBox="0 0 24 24"><path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1" /></svg>;

export function Toast(p: { msg: string }) {
  return p.msg ? <div className="mk-toast" role="status">{p.msg}</div> : null;
}

export function EditorShell(p: { def: EditorDef; onHome: () => void }) {
  const def = p.def;
  const docKey = 'sd-maker:doc:' + def.id;
  const saved = store.get(docKey, null);
  const first = saved && saved.v === 1 && saved.editor === def.id ? saved : blankDoc(def);
  const h = useHistory({ ...first, data: norm(def, first.data) });
  const doc = h.doc;
  const [sel, setSel] = useState<Sel>(null);
  const [toast, setToast] = useState('');
  const [note, setNote] = useState('Saved in this browser');
  const [sheets, setSheets] = useState<SavedSheet[]>([]);
  const [place, setPlace] = useState<'workspace' | 'browser'>('browser');
  const [vname, setVname] = useState('');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const tRef = useRef<any>(0);
  const boxRef = useRef({ x: 0, y: 0, w: 400, h: 200 });
  const zoomKey = 'sd-maker:zoom:' + def.id;
  const [zoom, setZoomRaw] = useState<number>(() => store.get(zoomKey, 0));
  const [track, setTrackRaw] = useState<boolean>(() => store.get('sd-maker:track', true));
  const setTrack = (v: boolean) => { setTrackRaw(v); store.set('sd-maker:track', v); };
  /* auto track: the point being looked at (the pointer, the selection, or the view centre) stays put while the zoom changes */
  const anchor = useRef<{ pt: [number, number]; at: [number, number] } | null>(null);
  const svgPt = (cx: number, cy: number): [number, number] | null => {
    const svg = svgRef.current as any; const m = svg && svg.getScreenCTM(); if (!m) return null;
    const p = svg.createSVGPoint(); p.x = cx; p.y = cy; const q = p.matrixTransform(m.inverse()); return [q.x, q.y];
  };
  const curZoom = () => { const svg = svgRef.current; return zoom || (svg ? svg.getBoundingClientRect().width / Math.max(1, +(svg.getAttribute('width') || 1)) : 1); };
  const setZoom = (z: number, client?: [number, number]) => {
    const el = canvasRef.current;
    if (track && el && z > 0) {
      const r = el.getBoundingClientRect();
      let at: [number, number] = client || [r.left + r.width / 2, r.top + r.height / 2];
      const on = !client && document.querySelector('.mk-overlay .mk-on') as any;
      if (on && on.getBoundingClientRect) { const b = on.getBoundingClientRect(); at = [b.left + b.width / 2, b.top + b.height / 2]; }
      const pt = svgPt(at[0], at[1]);
      if (pt) anchor.current = { pt, at: client ? at : [r.left + r.width / 2, r.top + r.height / 2] };
    }
    const v = z <= 0 ? 0 : Math.max(0.25, Math.min(4, Math.round(z * 100) / 100)); setZoomRaw(v); store.set(zoomKey, v);
  };
  useLayoutEffect(() => {
    const a = anchor.current, el = canvasRef.current, svg = svgRef.current as any; anchor.current = null;
    if (!a || !el || !svg) return;
    const m = svg.getScreenCTM(); if (!m) return;
    const p = svg.createSVGPoint(); p.x = a.pt[0]; p.y = a.pt[1]; const q = p.matrixTransform(m);
    el.scrollLeft += q.x - a.at[0]; el.scrollTop += q.y - a.at[1];
  }, [zoom]);
  const canvasRef = useRef<HTMLElement>(null);
  const [conn, setConn] = useState<{ on: boolean; from: string | null }>({ on: false, from: null });
  const docRef = useRef(doc); docRef.current = doc;

  const say = (m: string) => { setToast(m); clearTimeout(tRef.current); tRef.current = setTimeout(() => setToast(''), 3400); };
  const setDoc = (patch: Partial<Doc>, key?: string) => h.commit({ ...doc, ...patch }, key);
  const setData = (patch: any, key?: string) => h.commit({ ...doc, data: { ...doc.data, ...patch } }, key);
  const load = (d: any, msg: string) => { h.commit({ ...blankDoc(def), ...d, editor: def.id, data: norm(def, d.data) }); setSel(null); say(msg); };

  useEffect(() => { setNote(store.set(docKey, doc) ? 'Saved in this browser' : 'Not saved: browser storage is full or blocked'); }, [doc]);
  /* another tab saved this editor: take its copy, keep ours one Undo away */
  useEffect(() => {
    const f = (e: StorageEvent) => {
      if (e.key !== docKey || !e.newValue) return;
      try { const d = JSON.parse(e.newValue); if (d && d.v === 1 && JSON.stringify(d) !== JSON.stringify(docRef.current)) { h.commit({ ...d, data: norm(def, d.data) }); say('Updated from another tab. Undo to go back to this copy'); } } catch (err) { /* ignore */ }
    };
    window.addEventListener('storage', f);
    return () => window.removeEventListener('storage', f);
  }, []);
  const refresh = () => listSheets(def.id).then(setSheets);
  useEffect(() => { where().then(setPlace); refresh(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) h.redo(); else h.undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); h.redo(); }
      else if (e.key === 'Escape') { setSel(null); if (conn.on) { setConn({ on: false, from: null }); say('Connect mode off'); } }
      else if (mod && e.key.toLowerCase() === 'd' && sel) { e.preventDefault(); duplicateSel(); }
      else if (e.key.startsWith('Arrow') && sel) {
        const k = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -k : e.key === 'ArrowRight' ? k : 0, dy = e.key === 'ArrowUp' ? -k : e.key === 'ArrowDown' ? k : 0;
        if (nudgeSel(dx, dy)) e.preventDefault();
      }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && sel.kind === 'note') {
        e.preventDefault(); setDoc({ notes: (doc.notes || []).filter(n => n.id !== sel.id) }); setSel(null); say('Deleted. Undo to bring it back');
      }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && def.remove) {
        const patch = def.remove(doc.data, sel);
        if (patch) { e.preventDefault(); setData(patch); setSel(null); say('Deleted. Undo to bring it back'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [h.undo, h.redo, sel, doc, conn]);

  const base = slug(doc.title, def.id);
  async function exp(kind: string) {
    const svg = svgRef.current; if (!svg) return;
    try {
      let blob: Blob, name: string;
      if (kind === 'svg') { blob = svgBlob(svg); name = base + '.svg'; }
      else if (kind === 'png') { blob = await rasterBlob(svg, 'image/png', '#ffffff'); name = base + '.png'; }
      else if (kind === 'tpng') { blob = await rasterBlob(svg, 'image/png', null); name = base + '-transparent.png'; }
      else { blob = await rasterBlob(svg, 'image/jpeg', '#ffffff'); name = base + '.jpg'; }
      say(await saveFile(blob, name));
    } catch (e) { say('Export failed: the sheet could not be drawn'); }
  }
  async function copy(kind: string) {
    const svg = svgRef.current; if (!svg) return;
    try {
      const CI: any = (window as any).ClipboardItem;
      if (!navigator.clipboard || !CI) { say('Copy is not available in this browser'); return; }
      if (kind === 'svg') {
        const text = await svgBlob(svg).text();
        await navigator.clipboard.write([new CI({ 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      } else await navigator.clipboard.write([new CI({ 'image/png': rasterBlob(svg, 'image/png', '#ffffff') })]);
      say(kind === 'svg' ? 'SVG code copied' : 'PNG copied');
    } catch (e) { say('Copy failed: the browser blocked clipboard access'); }
  }
  async function saveProject() {
    say(await saveFile(new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' }), base + '.json'));
  }
  function onFile(e: any) {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result));
        if (!d || d.v !== 1 || !d.data) throw new Error('shape');
        if (d.editor && d.editor !== def.id) { say('That file belongs to another editor (' + d.editor + ')'); return; }
        load(d, 'Opened ' + f.name + '. Undo to go back');
      } catch (err) { say('That file is not a Diagram Workspace project'); }
    };
    r.readAsText(f);
  }
  async function saveHere() {
    const name = vname.trim() || (doc.title || def.name) + ' · ' + new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    say(await saveSheet(def.id, name, doc)); setVname(''); refresh();
  }

  function nudgeSel(dx: number, dy: number) {
    if (!sel) return false;
    if (sel.kind === 'note') {
      setDoc({ notes: (doc.notes || []).map(n => n.id !== sel.id ? n : { ...n, x: n.x + dx, y: n.y + dy, ...(n.kind === 'arrow' ? { x2: n.x2 + dx, y2: n.y2 + dy } : {}) }) }, 'nudge-sel');
      return true;
    }
    const patch = def.nudge ? def.nudge(doc.data, sel, dx, dy) : null;
    if (patch) { setData(patch, 'nudge-sel'); return true; }
    return false;
  }
  function duplicateSel() {
    if (!sel) return;
    if (sel.kind === 'note') {
      const n = (doc.notes || []).find(q => q.id === sel.id); if (!n) return;
      let i = 1; while ((doc.notes || []).some(q => q.id === 'n' + i)) i++;
      const c = { ...n, id: 'n' + i, x: n.x + 16, y: n.y + 16, ...(n.kind === 'arrow' ? { x2: n.x2 + 16, y2: n.y2 + 16 } : {}) };
      setDoc({ notes: [...(doc.notes || []), c] }); setSel({ kind: 'note', id: c.id }); say('Duplicated'); return;
    }
    const r = def.duplicate ? def.duplicate(doc.data, sel) : null;
    if (r) { setData(r.patch); setSel(r.sel); say('Duplicated'); } else say('This item cannot be duplicated');
  }
  function deleteSel() {
    if (!sel) return;
    if (sel.kind === 'note') { setDoc({ notes: (doc.notes || []).filter(n => n.id !== sel.id) }); setSel(null); say('Deleted. Undo to bring it back'); return; }
    const patch = def.remove ? def.remove(doc.data, sel) : null;
    if (patch) { setData(patch); setSel(null); say('Deleted. Undo to bring it back'); }
  }
  /* every selection on the sheet passes through here, so connect mode can catch it */
  const pick = (s: Sel) => {
    if (conn.on && def.connect && s && s.kind === def.connect.kind) {
      if (!conn.from) { setConn({ on: true, from: s.id }); setSel(s); say('Now click the item it points to'); return; }
      if (s.id !== conn.from) {
        const patch = def.connect.make(docRef.current.data, conn.from, s.id);
        if (patch) { setData(patch); say('Connected. Click the next source, or press Esc to stop'); }
        setConn({ on: true, from: null }); setSel(null); return;
      }
    }
    setSel(s);
  };
  /* Ctrl/Cmd + wheel zooms; dragging empty space pans when the sheet is larger than the view */
  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const f = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const svg = svgRef.current; const cur = zoom || (svg ? svg.getBoundingClientRect().width / Math.max(1, +(svg.getAttribute('width') || 1)) : 1);
      setZoom(cur * (e.deltaY < 0 ? 1.1 : 1 / 1.1), [e.clientX, e.clientY]);
    };
    el.addEventListener('wheel', f, { passive: false });
    return () => el.removeEventListener('wheel', f);
  }, [zoom, track]);
  function panDown(e: any) {
    const el = canvasRef.current; if (!el || e.button !== 0) return;
    const t = e.target as Element;
    if (t.closest('.mk-overlay') || t.closest('text') || t.closest('.mk-below') || t.closest('button') || t.closest('input')) return;
    const inSvg = !!t.closest('svg');
    if (inSvg && (def.sheetClick || !zoom)) return;
    const sx = e.clientX, sy = e.clientY, l0 = el.scrollLeft, t0 = el.scrollTop;
    let moved = false;
    const mv = (ev: PointerEvent) => { if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return; moved = true; el.classList.add('mk-panning'); el.scrollLeft = l0 - (ev.clientX - sx); el.scrollTop = t0 - (ev.clientY - sy); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); el.classList.remove('mk-panning'); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  const stats = def.stats ? def.stats(doc.data) : [];
  const click = def.sheetClick ? (pt: [number, number]) => { const patch = def.sheetClick!(doc.data, pt); if (patch) setData(patch); } : undefined;
  const ep: EditProps = { data: doc.data, set: setData, doc, sel, setSel: pick };
  const notes = doc.notes || [], nudges = doc.nudges || {};
  const setNotes = (n: any[], key?: string) => setDoc({ notes: n }, key);
  const onTextClick = (text: string) => {
    const s = def.findText ? def.findText(doc.data, text) : null;
    if (s) { setSel(s); return; }
    setSel(null);
    if (!focusBus.emit(text)) say('“' + text.slice(0, 40) + '” is drawn by the diagram: change it with the settings in the sidebar');
  };

  return (
    <div className="mk-editor">
      <header className="mk-head">
        <div className="mk-head-main">
          <button type="button" className="mk-back" onClick={p.onHome}>← All diagrams</button>
          <span className="sd-kicker">{def.num} · {def.name}</span>
          <input id={'title-' + def.id} className="mk-titlein" value={doc.title} placeholder="Name this figure…" maxLength={90}
            onChange={e => setDoc({ title: e.target.value }, 'title')} aria-label="Figure title" />
        </div>
        <div className="mk-head-side">
          {stats.map(([n, l]) => <span key={l}><strong>{n}</strong> {l}</span>)}
          <em>{note}</em>
          <ThemeSwitch />
        </div>
      </header>
      <aside className="mk-side">
        <S.Panel kicker="Edit" help={def.hint}>
          <div className="sd-row-btns">
            <S.ToolButton compact icon={Undo} disabled={!h.canUndo} onClick={h.undo} title="Undo (Ctrl/Cmd+Z)">Undo</S.ToolButton>
            <S.ToolButton compact icon={Redo} disabled={!h.canRedo} onClick={h.redo} title="Redo (Shift+Ctrl/Cmd+Z)">Redo</S.ToolButton>
          </div>
          {def.connect ? <S.ToolButton on={conn.on} onClick={() => { setConn({ on: !conn.on, from: null }); say(conn.on ? 'Connect mode off' : 'Click the ' + def.connect!.label + ' to start from'); }}>
            {conn.on ? (conn.from ? 'Connecting: click the target' : 'Connecting: click the source') : 'Connect ' + (def.connect.plural || def.connect.label + 's')}</S.ToolButton> : null}
          {sel ? <div className="sd-row-btns">
            <S.ToolButton compact onClick={duplicateSel} title="Ctrl/Cmd+D">Duplicate</S.ToolButton>
            <S.ToolButton compact onClick={deleteSel} title="Delete">Delete</S.ToolButton>
          </div> : null}
          {sel ? <p className="sd-help">Arrow keys move the selection 1 px, Shift + arrow 10 px.</p> : null}
        </S.Panel>
        <def.Controls {...ep} />
        <NotesPanel notes={notes} sel={sel} setSel={setSel} setNotes={setNotes} box={boxRef.current} />
        {Object.keys(nudges).length ? <S.Panel kicker="Moved labels" help={Object.keys(nudges).length + ' label(s) moved by hand.'}><S.ToolButton onClick={() => setDoc({ nudges: {} })}>Put labels back</S.ToolButton></S.Panel> : null}
        <S.Panel kicker="Starting points" help="Loading one replaces the sheet. Undo brings yours back.">
          {[...def.templates, ...(def.blank ? [{ name: 'Blank start', desc: 'An empty sheet to build from', title: 'Untitled figure', data: def.blank }] : [])].map(t => (
            <S.ToolButton key={t.name} onClick={() => { const b = blankDoc(def, t); load({ ...b, font: doc.font }, t.name + ' loaded. Undo to go back'); }}>
              <span className="mk-tpl"><b>{t.name}</b><i>{t.desc}</i></span>
            </S.ToolButton>
          ))}
        </S.Panel>
        <S.Panel kicker="Figure">
          <S.Field id={'num-' + def.id} label="Figure number" value={doc.number} placeholder="e.g. 1" onChange={(e: any) => setDoc({ number: e.target.value }, 'number')} />
          <S.Field id={'cap-' + def.id} label="Caption" multiline rows={3} value={doc.caption} placeholder="e.g. What the reader should notice first…" onChange={(e: any) => setDoc({ caption: e.target.value }, 'caption')} help="Formulas use H_2O, NAD^+, Ca^{2+}." />
        </S.Panel>
        <S.FontPicker value={doc.font} onChange={(f: string) => setDoc({ font: f })} kicker="Diagram font" />
        <S.Panel kicker="Save" help="PNG and JPEG export at 3×. Exports always leave on white paper, without selection marks.">
          <S.ToolButton primary onClick={() => exp('png')}>Save as PNG</S.ToolButton>
          <div className="sd-row-btns">
            <S.ToolButton compact onClick={() => exp('tpng')}>Transparent PNG</S.ToolButton>
          </div>
          <div className="sd-row-btns">
            <S.ToolButton compact onClick={() => exp('svg')}>SVG</S.ToolButton>
            <S.ToolButton compact onClick={() => exp('jpg')}>JPEG</S.ToolButton>
          </div>
          <div className="sd-row-btns">
            <S.ToolButton compact onClick={() => copy('png')}>Copy PNG</S.ToolButton>
            <S.ToolButton compact onClick={() => copy('svg')}>Copy SVG</S.ToolButton>
          </div>
          <div className="sd-row-btns">
            <S.ToolButton compact onClick={saveProject}>Save JSON</S.ToolButton>
            <S.ToolButton compact onClick={() => fileIn.current && fileIn.current.click()}>Open JSON</S.ToolButton>
          </div>
          <input ref={fileIn} type="file" accept=".json,application/json" hidden onChange={onFile} />
        </S.Panel>
        <S.Panel kicker={place === 'workspace' ? 'Saved in this workspace' : 'Saved in this browser'}
          help={place === 'workspace' ? 'Kept in this artifact, visible only to you, on any device.' : (sheets.length ? 'Kept in this browser only.' : 'Name a sheet and save it to come back later.')}>
          <S.Field id={'vname-' + def.id} value={vname} placeholder="e.g. Draft for tutorial" onChange={(e: any) => setVname(e.target.value)} />
          <S.ToolButton onClick={saveHere}>{place === 'workspace' ? 'Save in workspace' : 'Save in browser'}</S.ToolButton>
          {sheets.map(v => (
            <div key={v.id} className="mk-version">
              <button type="button" onClick={() => load(v.doc, 'Opened “' + v.name + '”. Undo to go back')}>{v.name}</button>
              <button type="button" aria-label={'Delete ' + v.name} onClick={async () => { await deleteSheet(v); refresh(); }}>×</button>
            </div>
          ))}
        </S.Panel>
      </aside>
      <main className="mk-canvas" ref={canvasRef as any} onPointerDown={panDown} data-connect={conn.on ? '1' : undefined}>
        <div className="mk-zoom" role="group" aria-label="Zoom">
          <button type="button" onClick={() => setZoom(curZoom() / 1.25)} aria-label="Zoom out">−</button>
          <span>{zoom ? Math.round(zoom * 100) + '%' : 'Fit'}</span>
          <button type="button" onClick={() => setZoom(curZoom() * 1.25)} aria-label="Zoom in">+</button>
          <button type="button" data-on={!zoom ? '1' : '0'} onClick={() => setZoom(0)}>Fit</button>
          <button type="button" data-on={zoom === 1 ? '1' : '0'} onClick={() => setZoom(1)}>100%</button>
          <button type="button" data-on={track ? '1' : '0'} aria-pressed={track} title="Keep the selection, or the middle of the view, in place while zooming" onClick={() => setTrack(!track)}>Auto track</button>
        </div>
        <S.Blueprint className="mk-frame">
          <Sheet zoom={zoom} font={doc.font} title={doc.title} caption={doc.caption} number={doc.caption ? doc.number : ''} svgRef={el => { svgRef.current = el; }}
            onSvgClick={click} notes={notes} nudges={nudges}
            onNudge={(k, d) => setDoc({ nudges: { ...nudges, [k]: d } }, 'nudge-' + k)} onTextClick={onTextClick} onBackground={() => { setSel(null); if (conn.on && conn.from) setConn({ on: true, from: null }); }}
            overlay={(toSvg, box) => { boxRef.current = box; return <>{def.Overlay ? <def.Overlay {...ep} toSvg={toSvg} /> : null}<NotesOverlay notes={notes} sel={sel} setSel={pick} toSvg={toSvg} setNotes={setNotes} /></>; }}>
            <def.Render data={doc.data} doc={doc} sel={sel} />
          </Sheet>
        </S.Blueprint>
        {def.Below ? <div className={'mk-below sd-font-' + doc.font}><def.Below data={doc.data} doc={doc} /></div> : null}
      </main>
      <Toast msg={toast} />
    </div>
  );
}
