import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { S } from './sheet';
import { Toast } from './shell';
import { ThemeSwitch } from './theme';
import { editIconOp, loadCustom, readIconFile, resolveLib, saveCustom, uniqueKey } from './lib/customIcons';
import type { CustomLib } from './lib/customIcons';

export const ICON_EDITOR = { id: 'icon-editor', num: '12b', name: 'Icon editor' };

type Img = { w: number; h: number; data: Uint8ClampedArray };
type Rect = { x: number; y: number; w: number; h: number };
type Tool = 'bg' | 'erase' | 'lasso' | 'crop';

const px = () => (window as any).SDIconPixels;
const BTN = { flex: 'none', width: 'auto', padding: '8px 14px' } as const;
const MAX_HISTORY = 40;

/** Key of the icon to edit, from the address: #icon-editor/<key>. */
const keyFromHash = () => {
  const m = (location.hash || '').replace(/^#/, '').split('/');
  try { return m[1] ? decodeURIComponent(m[1]) : ''; } catch { return ''; }
};

function toCanvas(img: Img): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = img.w; c.height = img.h;
  c.getContext('2d')!.putImageData(new ImageData(img.data as any, img.w, img.h), 0, 0);
  return c;
}

/** Decodes an image URL into pixels. Rejects when the browser blocks reading pixels (file:// pages) or the image is missing. */
function decode(url: string): Promise<Img> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onerror = () => reject(new Error('missing'));
    im.onload = () => {
      try {
        const w = im.naturalWidth || 1, h = im.naturalHeight || 1;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d')!; ctx.drawImage(im, 0, 0);
        const d = ctx.getImageData(0, 0, w, h);
        resolve({ w, h, data: d.data });
      } catch (e) { reject(new Error('blocked')); }
    };
    im.src = url;
  });
}

export function IconEditorPage(p: { onBack: () => void }) {
  const key = keyFromHash();
  const [lib] = useState<CustomLib>(loadCustom);
  const { groups, tiles } = useMemo(() => resolveLib(lib), [lib]);
  const tile = tiles.find(t => t.key === key) || null;

  const [toast, setToast] = useState('');
  const [loadMsg, setLoadMsg] = useState('');
  const [tool, setTool] = useState<Tool>('bg');
  const [tol, setTol] = useState(12);
  const [contiguous, setContiguous] = useState(true);
  const [brush, setBrush] = useState(8);
  const [zoom, setZoom] = useState(2);
  const [sel, setSel] = useState<Rect | null>(null);
  const [lasso, setLasso] = useState<number[][]>([]);
  const [rev, setRev] = useState(0);
  const [saveName, setSaveName] = useState('');
  const [saveGroup, setSaveGroup] = useState(tile ? tile.group : groups[0]);

  const cur = useRef<Img | null>(null);
  const orig = useRef<Img | null>(null);
  const past = useRef<Img[]>([]);
  const future = useRef<Img[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; on: boolean }>({ x: 0, y: 0, on: false });
  const timer = useRef<any>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const say = (m: string) => { setToast(m); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 3200); };

  const setImage = useCallback((img: Img, fresh: boolean) => {
    cur.current = img;
    if (fresh) {
      orig.current = px().copy(img); past.current = []; future.current = [];
      setZoom(Math.max(1, Math.min(6, Math.floor(480 / Math.max(img.w, img.h)))));
    }
    setSel(null); setLasso([]); setRev(r => r + 1);
  }, []);

  useEffect(() => {
    if (!tile) return;
    setSaveName(tile.name + ' (edited)');
    decode(tile.data || `icons/${tile.key}.png`).then(
      img => { setLoadMsg(''); setImage(img, true); },
      e => setLoadMsg(e && e.message === 'blocked'
        ? 'This browser blocks reading pixels from a page opened as a local file. Use Open an image file below, or open the workspace from a web address such as GitHub Pages.'
        : 'Could not load this icon. Use Open an image file below.'),
    );
  }, [tile && tile.key]);

  useEffect(() => {
    const c = canvas.current, img = cur.current;
    if (!c || !img) return;
    c.width = img.w; c.height = img.h;
    c.getContext('2d')!.putImageData(new ImageData(img.data as any, img.w, img.h), 0, 0);
  }, [rev]);

  const push = () => {
    past.current.push(px().copy(cur.current)); if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
  };
  const undo = useCallback(() => {
    if (!past.current.length || !cur.current) return;
    future.current.push(cur.current); cur.current = past.current.pop() as Img; setSel(null); setRev(r => r + 1);
  }, []);
  const redo = useCallback(() => {
    if (!future.current.length || !cur.current) return;
    past.current.push(cur.current); cur.current = future.current.pop() as Img; setSel(null); setRev(r => r + 1);
  }, []);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement; if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'range') return;
      e.preventDefault(); if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [undo, redo]);

  const at = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), img = cur.current as Img;
    return [Math.max(0, Math.min(img.w, (e.clientX - r.left) / zoom)), Math.max(0, Math.min(img.h, (e.clientY - r.top) / zoom))];
  };

  const down = (e: React.PointerEvent) => {
    const img = cur.current; if (!img) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const [x, y] = at(e); drag.current = { x, y, on: true };
    if (tool === 'bg') {
      push();
      const n = px().removeColour(img, x, y, tol, contiguous);
      if (!n) { past.current.pop(); say('Nothing to remove there. Click a coloured area.'); } else { say(`Removed ${n} pixel${n === 1 ? '' : 's'}`); setRev(r => r + 1); }
      drag.current.on = false;
    } else if (tool === 'erase') {
      push(); px().eraseCircle(img, x, y, brush / 2); setRev(r => r + 1);
    } else if (tool === 'lasso') {
      setLasso([[x, y]]);
    } else {
      setSel({ x, y, w: 0, h: 0 });
    }
  };
  const move = (e: React.PointerEvent) => {
    const img = cur.current; if (!img || !drag.current.on) return;
    const [x, y] = at(e);
    if (tool === 'erase') { px().eraseLine(img, drag.current.x, drag.current.y, x, y, brush / 2); drag.current.x = x; drag.current.y = y; setRev(r => r + 1); }
    else if (tool === 'lasso') setLasso(l => [...l, [x, y]]);
    else if (tool === 'crop') setSel({ x: Math.min(drag.current.x, x), y: Math.min(drag.current.y, y), w: Math.abs(x - drag.current.x), h: Math.abs(y - drag.current.y) });
  };
  const up = () => {
    const img = cur.current; if (!img || !drag.current.on) return;
    drag.current.on = false;
    if (tool === 'lasso') {
      if (lasso.length >= 3) { push(); const n = px().erasePolygon(img, lasso); if (n) say(`Erased ${n} pixels`); else past.current.pop(); setRev(r => r + 1); }
      setLasso([]);
    }
  };

  const applyCrop = () => {
    const img = cur.current; if (!img || !sel || sel.w < 2 || sel.h < 2) { say('Drag a rectangle over the part to keep first'); return; }
    const o = px().crop(img, sel); if (!o) { say('That rectangle is outside the icon'); return; }
    push(); setImage(o, false); say(`Cropped to ${o.w} × ${o.h} px`);
  };
  const trim = () => {
    const img = cur.current; if (!img) return;
    const o = px().trim(img); if (!o) { say('The icon is empty'); return; }
    if (o.w === img.w && o.h === img.h) { say('No transparent margin to trim'); return; }
    push(); setImage(o, false); say(`Trimmed to ${o.w} × ${o.h} px`);
  };
  const corners = () => {
    const img = cur.current; if (!img) return;
    push(); const n = px().removeFromCorners(img, tol);
    if (!n) { past.current.pop(); say('The corners are already transparent'); } else { say(`Removed ${n} pixels`); setRev(r => r + 1); }
  };
  const reset = () => {
    if (!orig.current) return;
    push(); cur.current = px().copy(orig.current); setSel(null); setRev(r => r + 1);
  };

  const openFile = async (f: File | null) => {
    if (!f) return;
    try {
      const { data } = await readIconFile(f);
      setLoadMsg(''); setImage(await decode(data), true); say(`Opened ${f.name}`);
    } catch (e: any) { say(e && e.message ? e.message : 'Could not open that file'); }
  };

  const result = () => {
    const img = cur.current; if (!img) return null;
    if (px().opaque(img) === 0) { say('The icon is empty. Undo some erasing before saving.'); return null; }
    return { data: toCanvas(img).toDataURL('image/png'), ratio: Math.round((img.w / img.h) * 1000) / 1000 };
  };
  const commit = (next: CustomLib, ok: string) => {
    const err = saveCustom(next); if (err) { say(err); return; }
    say(ok); setTimeout(p.onBack, 400);
  };
  const saveReplace = () => {
    const r = result(); if (!r || !tile) return;
    const op = editIconOp(lib, tile.key, { data: r.data, ratio: r.ratio });
    if (op.error || !op.lib) { say(op.error || 'Could not save'); return; }
    commit(op.lib, `Saved ${tile.name}`);
  };
  const saveNew = () => {
    const r = result(); if (!r) return;
    const name = saveName.trim();
    if (!name) { say('Type a name for the new icon first'); return; }
    commit({ ...lib, icons: [...lib.icons, { key: uniqueKey(lib, name), name, group: saveGroup, ratio: r.ratio, data: r.data }] }, `Saved ${name} as a new icon`);
  };

  const img = cur.current;
  const checker = { backgroundImage: 'linear-gradient(45deg, #d9d9dc 25%, transparent 25%, transparent 75%, #d9d9dc 75%), linear-gradient(45deg, #d9d9dc 25%, transparent 25%, transparent 75%, #d9d9dc 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0, 8px 8px', backgroundColor: '#f4f4f6' };

  return (
    <main className="mk-lib">
      <div className="mk-pathway-bar">
        <a className="mk-back" href="#icon-library" onClick={e => { e.preventDefault(); p.onBack(); }}>← Icon library</a>
        <span className="sd-kicker">12b · Icon editor</span>
        <span className="mk-spacer" />
        <ThemeSwitch />
      </div>
      <div className="mk-lib-body">
        <header className="mk-lib-head">
          <h1>{tile ? tile.name : 'Icon editor'}</h1>
          <p>Crop the edges, erase unwanted parts and remove the background. Nothing is saved until you press Save. Built-in icon files are never changed; a saved edit replaces the icon in this browser only.</p>
        </header>
        {!tile ? (
          <p className="mk-lib-empty">No icon is selected, or it was deleted. Open the <a href="#icon-library">Icon library</a>, press ✎ on a tile, then Edit image.</p>
        ) : (
          <div className="mk-ied">
            <div className="mk-ied-tools">
              <div className="mk-chips" role="group" aria-label="Tool">
                <S.ToolButton compact on={tool === 'bg'} onClick={() => setTool('bg')}>Remove colour</S.ToolButton>
                <S.ToolButton compact on={tool === 'erase'} onClick={() => setTool('erase')}>Eraser</S.ToolButton>
                <S.ToolButton compact on={tool === 'lasso'} onClick={() => setTool('lasso')}>Lasso erase</S.ToolButton>
                <S.ToolButton compact on={tool === 'crop'} onClick={() => setTool('crop')}>Crop</S.ToolButton>
              </div>
              {tool === 'bg' ? (
                <div className="mk-lib-form">
                  <label className="mk-ied-row">Tolerance {tol}%<input type="range" min={0} max={60} value={tol} onChange={e => setTol(+e.target.value)} aria-label="Tolerance" /></label>
                  <label className="mk-ied-row"><input type="checkbox" checked={contiguous} onChange={e => setContiguous(e.target.checked)} /> Only the area touching the click</label>
                  <S.ToolButton compact style={BTN} onClick={corners}>Remove background from corners</S.ToolButton>
                  <span className="mk-lib-hint">Click a colour to make it transparent. Raise the tolerance to take shaded and blurred edges too.</span>
                </div>
              ) : null}
              {tool === 'erase' ? (
                <div className="mk-lib-form">
                  <label className="mk-ied-row">Brush {brush} px<input type="range" min={2} max={60} value={brush} onChange={e => setBrush(+e.target.value)} aria-label="Brush size" /></label>
                  <span className="mk-lib-hint">Drag over the parts to erase.</span>
                </div>
              ) : null}
              {tool === 'lasso' ? (
                <div className="mk-lib-form"><span className="mk-lib-hint">Drag a loop around the part to erase. Release to erase everything inside it.</span></div>
              ) : null}
              {tool === 'crop' ? (
                <div className="mk-lib-form">
                  <S.ToolButton compact style={BTN} on onClick={applyCrop}>Apply crop</S.ToolButton>
                  <S.ToolButton compact style={BTN} onClick={trim}>Trim transparent margins</S.ToolButton>
                  <span className="mk-lib-hint">Drag a rectangle over the part to keep, then Apply crop.{sel && sel.w >= 2 ? ` Selected ${Math.round(sel.w)} × ${Math.round(sel.h)} px.` : ''}</span>
                </div>
              ) : null}
              <div className="mk-lib-form">
                <S.ToolButton compact style={BTN} onClick={undo}>Undo</S.ToolButton>
                <S.ToolButton compact style={BTN} onClick={redo}>Redo</S.ToolButton>
                <S.ToolButton compact style={BTN} onClick={reset}>Reset to start</S.ToolButton>
                <label className="mk-ied-row">Zoom {zoom}×<input type="range" min={1} max={6} value={zoom} onChange={e => setZoom(+e.target.value)} aria-label="Zoom" /></label>
                <span className="mk-lib-hint">Or open another image file to edit instead:</span>
                <input className="mk-lib-file" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" onChange={e => openFile((e.target.files && e.target.files[0]) || null)} aria-label="Open an image file" />
              </div>
              {img ? (
                <div className="mk-lib-form">
                  <S.ToolButton compact style={BTN} on onClick={saveReplace}>Save (replace this icon)</S.ToolButton>
                  <input className="mk-lib-search" value={saveName} onChange={e => setSaveName(e.target.value)} maxLength={60} placeholder="Name for a new icon" aria-label="Name for a new icon" />
                  <select className="mk-lib-search mk-lib-select" value={groups.includes(saveGroup) ? saveGroup : groups[0]} onChange={e => setSaveGroup(e.target.value)} aria-label="Group for a new icon">
                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <S.ToolButton compact style={BTN} on onClick={saveNew}>Save as new icon</S.ToolButton>
                </div>
              ) : null}
            </div>
            <div className="mk-ied-stage">
              {loadMsg ? <p className="mk-lib-empty">{loadMsg}</p> : null}
              {img ? (
                <>
                  <div className="mk-ied-canvas" style={{ ...checker, width: img.w * zoom, height: img.h * zoom, cursor: tool === 'erase' ? 'crosshair' : 'cell' }}
                    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
                    <canvas ref={canvas} style={{ width: img.w * zoom, height: img.h * zoom, imageRendering: zoom > 1 ? 'pixelated' : 'auto', display: 'block' }} aria-label={`Editing ${tile.name}`} role="img" />
                    <svg className="mk-ied-over" width={img.w * zoom} height={img.h * zoom} viewBox={`0 0 ${img.w} ${img.h}`} aria-hidden="true">
                      {sel && sel.w > 0 ? <rect x={sel.x} y={sel.y} width={sel.w} height={sel.h} fill="rgba(89,128,166,.18)" stroke="#416180" strokeWidth={1.5 / zoom} strokeDasharray={`${5 / zoom} ${3 / zoom}`} /> : null}
                      {lasso.length > 1 ? <polyline points={lasso.map(q => q.join(',')).join(' ')} fill="rgba(176,58,46,.15)" stroke="#b03a2e" strokeWidth={1.5 / zoom} /> : null}
                    </svg>
                  </div>
                  <p className="mk-lib-hint">{img.w} × {img.h} px. Checkerboard shows transparent areas.</p>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
      <Toast msg={toast} />
    </main>
  );
}
