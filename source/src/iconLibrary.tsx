import { useEffect, useMemo, useRef, useState } from 'react';
import { S } from './sheet';
import { Toast } from './shell';
import { saveFile } from './lib/platform';
import { ThemeSwitch } from './theme';
import { ICON_GROUPS, ICON_LIST } from './lib/iconCatalog';
import { addGroupOp, changeCount, deleteGroupOp, deleteIconOp, deletedBuiltins, editIconOp, loadCustom, readIconFile, renameGroupOp, resolveLib, restoreAllOp, restoreGroupOp, restoreIconOp, saveCustom, uniqueKey } from './lib/customIcons';
import type { CustomLib, OpResult, Tile } from './lib/customIcons';

export const ICON_LIBRARY = { id: 'icon-library', num: '12a', name: 'Icon library', field: 'Cells and measurement', blurb: `${ICON_LIST.length} BioRender icons in ${ICON_GROUPS.length} groups for the Biological pathway editor. Browse, search and download them.` };

/** Home card thumbnail: a 4 × 2 sample of the library. */
export function IconLibraryThumb() {
  const sample = ['gpcr-gprotein', 'dna', 'ribosome', 'th1', 'antibody', 'petri-dish', 'atp-synthase', 'cell'];
  return (
    <div className="mk-libthumb" aria-hidden="true">
      {sample.map(k => <span key={k} style={{ backgroundImage: `url(icons/${k}.png)` }} />)}
    </div>
  );
}

const BTN = { flex: 'none', width: 'auto', padding: '8px 18px' } as const;
const iconUrl = (t: Tile) => t.data || `icons/${t.key}.png`;

export function IconLibraryPage(p: { onHome: () => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [toast, setToast] = useState('');
  const [lib, setLib] = useState<CustomLib>(loadCustom);
  const [form, setForm] = useState<'' | 'icon' | 'group' | 'deleted'>('');
  const [groupName, setGroupName] = useState('');
  const [iconName, setIconName] = useState('');
  const [iconGroup, setIconGroup] = useState(ICON_GROUPS[0]);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [renaming, setRenaming] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [deleting, setDeleting] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [editKey, setEditKey] = useState('');
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const timer = useRef<any>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const say = (m: string) => { setToast(m); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 3200); };

  const { groups, tiles: list } = useMemo(() => resolveLib(lib), [lib]);
  const deleted = useMemo(() => deletedBuiltins(lib), [lib]);
  const nChanges = changeCount(lib);
  const customGroups = new Set(lib.groups);
  const activeCat = cat === 'All' || groups.includes(cat) ? cat : 'All';

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list.filter(i => (activeCat === 'All' || i.group === activeCat) && (!t || `${i.name} ${i.group} ${i.key.replace(/-/g, ' ')}`.toLowerCase().includes(t)));
  }, [q, activeCat, list]);
  const searching = q.trim() !== '';
  const sections = groups.map(g => ({ g, items: shown.filter(i => i.group === g) }))
    .filter(s => s.items.length || (!searching && (activeCat === 'All' || activeCat === s.g)));

  const commit = (next: CustomLib, ok: string) => {
    const err = saveCustom(next);
    if (err) { say(err); return false; }
    setLib(next); say(ok); return true;
  };
  /** Runs the result of an edit: shows its error, or saves the new library. */
  const apply = (r: OpResult, ok: string) => {
    if (r.error || !r.lib) { say(r.error || 'Could not make that change'); return false; }
    return commit(r.lib, ok);
  };
  const closePanels = () => { setRenaming(''); setDeleting(''); setEditKey(''); setEditFile(null); };

  const download = async (t: Tile) => {
    try {
      const r = await fetch(iconUrl(t)); if (!r.ok) throw new Error('missing');
      say(await saveFile(await r.blob(), `${t.key}.png`));
    } catch { say(`Could not download ${t.name}`); }
  };

  const addGroup = () => {
    const r = addGroupOp(lib, groupName);
    if (apply(r, `Added group ${r.name}`)) { setGroupName(''); setForm(''); setIconGroup(r.name as string); }
  };

  const startRename = (g: string) => { closePanels(); setRenaming(g); setRenameTo(g); };
  const saveRename = () => {
    const r = renameGroupOp(lib, renaming, renameTo);
    if (apply(r, r.name === renaming ? 'Group name unchanged' : `Renamed ${renaming} to ${r.name}`)) {
      if (cat === renaming) setCat(r.name as string);
      if (iconGroup === renaming) setIconGroup(r.name as string);
      setRenaming('');
    }
  };

  const startDelete = (g: string) => { closePanels(); setDeleting(g); setMoveTo(groups.find(x => x !== g) || ''); };
  const confirmDelete = (move: boolean) => {
    const r = deleteGroupOp(lib, deleting, move ? moveTo : '');
    const n = r.moved || 0;
    if (apply(r, move ? `Deleted group ${deleting}; moved ${n} icon${n === 1 ? '' : 's'} to ${moveTo}` : `Deleted group ${deleting} and ${n} icon${n === 1 ? '' : 's'}`)) {
      if (cat === deleting) setCat('All');
      if (iconGroup === deleting) setIconGroup(groups.find(x => x !== deleting) || '');
      setDeleting('');
    }
  };

  const addIcon = async () => {
    if (!iconFile) { say('Choose an image file first'); return; }
    const name = iconName.trim() || iconFile.name.replace(/\.[^.]+$/, '');
    try {
      const { data, ratio } = await readIconFile(iconFile);
      const next = { ...lib, icons: [...lib.icons, { key: uniqueKey(lib, name), name, group: iconGroup, ratio, data }] };
      if (commit(next, `Added ${name} to ${iconGroup}`)) { setIconFile(null); setIconName(''); setForm(''); }
    } catch (e: any) { say(e && e.message ? e.message : 'Could not add that icon'); }
  };

  const startEdit = (t: Tile) => { closePanels(); setEditKey(t.key); setEditName(t.name); setEditGroup(t.group); setEditFile(null); };
  const saveEdit = async () => {
    const patch: { name: string; group: string; data?: string; ratio?: number } = { name: editName, group: editGroup };
    try {
      if (editFile) { const r = await readIconFile(editFile); patch.data = r.data; patch.ratio = r.ratio; }
    } catch (e: any) { say(e && e.message ? e.message : 'Could not read that image'); return; }
    const r = editIconOp(lib, editKey, patch);
    if (apply(r, `Saved ${editName.trim()}`)) closePanels();
  };
  const removeIcon = (t: Tile) => {
    const tail = t.custom ? 'This cannot be undone.' : 'You can bring it back from Deleted built-ins.';
    if (!window.confirm(`Delete the icon “${t.name}”? Pathway nodes that use it will show a blank space. ${tail}`)) return;
    if (apply(deleteIconOp(lib, t.key), `Deleted ${t.name}`)) closePanels();
  };
  const restoreIcon = (key: string, name: string) => { apply(restoreIconOp(lib, key), `Restored ${name}`); };
  const restoreGroup = (orig: string, name: string) => { apply(restoreGroupOp(lib, orig), `Restored group ${name}`); };
  const restoreAll = () => {
    if (!window.confirm('Undo every rename, move, new image and deletion on the built-in icons and groups? Icons and groups you added stay.')) return;
    if (apply(restoreAllOp(lib), 'Restored the built-in icons and groups')) closePanels();
  };

  const nDeleted = deleted.groups.length + deleted.icons.length;

  return (
    <main className="mk-lib">
      <div className="mk-pathway-bar">
        <button type="button" className="mk-back" onClick={p.onHome}>← All diagrams</button>
        <span className="sd-kicker">12a · Icon library</span>
        <span className="mk-spacer" />
        <ThemeSwitch />
      </div>
      <div className="mk-lib-body">
        <header className="mk-lib-head">
          <h1>Icon library</h1>
          <p>{list.length} icons for the Biological pathway editor. Download any icon as a PNG, add, rename, move or delete icons and groups, or open the editor and use the <b>Icon library</b> button at the top of its sidebar to place icons on a sheet.</p>
          <div className="mk-lib-tools">
            <input className="mk-lib-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search icons, e.g. kinase, tube, ATP" aria-label="Search icons" />
            <S.ToolButton compact style={BTN} on={form === 'icon'} onClick={() => setForm(form === 'icon' ? '' : 'icon')}>Add icon</S.ToolButton>
            <S.ToolButton compact style={BTN} on={form === 'group'} onClick={() => setForm(form === 'group' ? '' : 'group')}>Add group</S.ToolButton>
            {nChanges ? <S.ToolButton compact style={BTN} on={form === 'deleted'} onClick={() => setForm(form === 'deleted' ? '' : 'deleted')}>Built-in changes ({nChanges})</S.ToolButton> : null}
            <a className="mk-lib-open" href="#biological-pathway">Open Biological pathway →</a>
          </div>
          {form === 'group' ? (
            <div className="mk-lib-form">
              <input className="mk-lib-search" value={groupName} onChange={e => setGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addGroup(); }} placeholder="Group name, e.g. Organelles" maxLength={40} aria-label="Group name" autoFocus />
              <S.ToolButton compact style={BTN} on onClick={addGroup}>Create group</S.ToolButton>
            </div>
          ) : null}
          {form === 'icon' ? (
            <div className="mk-lib-form">
              <input className="mk-lib-file" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" onChange={e => { const f = e.target.files && e.target.files[0]; setIconFile(f || null); if (f && !iconName) setIconName(f.name.replace(/\.[^.]+$/, '')); }} aria-label="Icon image file" />
              <input className="mk-lib-search" value={iconName} onChange={e => setIconName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addIcon(); }} placeholder="Icon name" maxLength={60} aria-label="Icon name" />
              <select className="mk-lib-search mk-lib-select" value={groups.includes(iconGroup) ? iconGroup : groups[0]} onChange={e => setIconGroup(e.target.value)} aria-label="Group for the new icon">
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <S.ToolButton compact style={BTN} on onClick={addIcon}>Add to library</S.ToolButton>
              <span className="mk-lib-hint">PNG, JPEG, SVG, WebP or GIF. Scaled to 256 px and stored in this browser only.</span>
            </div>
          ) : null}
          {form === 'deleted' ? (
            <div className="mk-lib-form">
              <span className="mk-lib-hint" style={{ flex: '1 1 100%' }}>{nChanges} change{nChanges === 1 ? '' : 's'} to the built-in icons and groups, stored in this browser. The icon files themselves are never changed.</span>
              {deleted.groups.map(g => (
                <span key={g.orig} className="mk-lib-restore">Group {g.name}<button type="button" className="mk-lib-del-group" onClick={() => restoreGroup(g.orig, g.name)}>Restore</button></span>
              ))}
              {deleted.icons.map(i => (
                <span key={i.key} className="mk-lib-restore">Icon {i.name}<button type="button" className="mk-lib-del-group" onClick={() => restoreIcon(i.key, i.name)}>Restore</button></span>
              ))}
              {nDeleted === 0 ? <span className="mk-lib-hint" style={{ flex: '1 1 100%' }}>Nothing is deleted. The changes are renames, moves and new images; use Reset on an icon, or restore everything below.</span> : null}
              <S.ToolButton compact style={BTN} on onClick={restoreAll}>Restore all built-ins</S.ToolButton>
            </div>
          ) : null}
          <div className="mk-chips" role="group" aria-label="Filter by group">
            {['All', ...groups].map(g => (
              <S.ToolButton key={g} compact on={activeCat === g} onClick={() => setCat(g)}>{g} ({g === 'All' ? list.length : list.filter(i => i.group === g).length})</S.ToolButton>
            ))}
          </div>
          <p className="mk-lib-count" aria-live="polite">{shown.length} of {list.length} icons</p>
        </header>
        {sections.length === 0 ? <p className="mk-lib-empty">{searching ? `No icon matches “${q}”. Try a shorter word or choose All.` : 'No groups. Use Add group to create one.'}</p> : null}
        {sections.map(s => (
          <section key={s.g} className="mk-lib-sec">
            <h2 className="sd-kicker">
              {s.g} · {s.items.length}
              <button type="button" className="mk-lib-del-group" onClick={() => startRename(s.g)}>Rename group</button>
              <button type="button" className="mk-lib-del-group" style={{ marginLeft: 8 }} onClick={() => startDelete(s.g)}>Delete group</button>
            </h2>
            {renaming === s.g ? (
              <div className="mk-lib-form">
                <input className="mk-lib-search" value={renameTo} onChange={e => setRenameTo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenaming(''); }} maxLength={40} aria-label={`New name for ${s.g}`} autoFocus />
                <S.ToolButton compact style={BTN} on onClick={saveRename}>Save name</S.ToolButton>
                <S.ToolButton compact style={BTN} onClick={() => setRenaming('')}>Cancel</S.ToolButton>
              </div>
            ) : null}
            {deleting === s.g ? (
              <div className="mk-lib-form">
                <span className="mk-lib-hint" style={{ flex: '1 1 100%', fontStyle: 'normal' }}>
                  {s.items.length === 0 ? `Delete the empty group “${s.g}”?` : `“${s.g}” holds ${list.filter(i => i.group === s.g).length} icon${list.filter(i => i.group === s.g).length === 1 ? '' : 's'}. Move them to another group, or delete them with the group.`}
                  {customGroups.has(s.g) ? ' This cannot be undone.' : ' Built-in groups can be restored.'}
                </span>
                {list.some(i => i.group === s.g) && groups.length > 1 ? (
                  <>
                    <select className="mk-lib-search mk-lib-select" value={moveTo} onChange={e => setMoveTo(e.target.value)} aria-label="Move the icons to">
                      {groups.filter(g => g !== s.g).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <S.ToolButton compact style={BTN} on onClick={() => confirmDelete(true)}>Move icons, delete group</S.ToolButton>
                  </>
                ) : null}
                <S.ToolButton compact style={BTN} on onClick={() => confirmDelete(false)}>{list.some(i => i.group === s.g) ? 'Delete group and icons' : 'Delete group'}</S.ToolButton>
                <S.ToolButton compact style={BTN} onClick={() => setDeleting('')}>Cancel</S.ToolButton>
              </div>
            ) : null}
            {s.items.length === 0 ? <p className="mk-lib-empty">No icons in this group yet. Use Add icon and pick this group, or move an icon here with Edit.</p> : null}
            {s.items.some(i => i.key === editKey) ? (() => {
              const t = s.items.find(i => i.key === editKey) as Tile;
              return (
                <div className="mk-lib-form">
                  <span className="mk-lib-edit-img" style={{ backgroundImage: `url(${editFile ? URL.createObjectURL(editFile) : iconUrl(t)})` }} aria-hidden="true" />
                  <input className="mk-lib-search" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') closePanels(); }} maxLength={60} aria-label="Icon name" autoFocus />
                  <select className="mk-lib-search mk-lib-select" value={editGroup} onChange={e => setEditGroup(e.target.value)} aria-label="Move to group">
                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input className="mk-lib-file" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" onChange={e => setEditFile((e.target.files && e.target.files[0]) || null)} aria-label="Replace the image (optional)" />
                  <S.ToolButton compact style={BTN} on onClick={saveEdit}>Save icon</S.ToolButton>
                  <S.ToolButton compact style={BTN} onClick={closePanels}>Cancel</S.ToolButton>
                  {!t.custom && t.edited ? <S.ToolButton compact style={BTN} onClick={() => { if (apply(restoreIconOp(lib, t.key), `Reset ${t.name}`)) closePanels(); }}>Reset to built-in</S.ToolButton> : null}
                  <span className="mk-lib-hint">Choose a file only to replace the image. Moving changes the group, not the icon key, so saved pathways keep working.</span>
                </div>
              );
            })() : null}
            <div className="mk-lib-grid">
              {s.items.map(i => (
                <div key={i.key} className="mk-lib-cell">
                  <button type="button" className="mk-lib-tile" title={`Download ${i.name} (PNG)`} onClick={() => download(i)}>
                    <span className="mk-lib-img" style={{ backgroundImage: `url(${iconUrl(i)})` }} />
                    <span className="mk-lib-name">{i.name}</span>
                    <span className="mk-lib-dl">Download PNG</span>
                  </button>
                  <button type="button" className="mk-lib-edit" aria-label={`Edit ${i.name}`} title={`Edit ${i.name}`} onClick={() => startEdit(i)}>✎</button>
                  <button type="button" className="mk-lib-del" aria-label={`Delete ${i.name}`} title={`Delete ${i.name}`} onClick={() => removeIcon(i)}>×</button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Toast msg={toast} />
    </main>
  );
}
