import { useEffect, useMemo, useRef, useState } from 'react';
import { S } from './sheet';
import { Toast } from './shell';
import { saveFile } from './lib/platform';
import { ThemeSwitch } from './theme';
import { ICON_GROUPS, ICON_LIST } from './lib/iconCatalog';
import { allGroups, groupTaken, loadCustom, readIconFile, saveCustom, uniqueKey } from './lib/customIcons';
import type { CustomLib } from './lib/customIcons';

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

type Tile = { key: string; name: string; group: string; url: string; custom: boolean };

export function IconLibraryPage(p: { onHome: () => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [toast, setToast] = useState('');
  const [lib, setLib] = useState<CustomLib>(loadCustom);
  const [form, setForm] = useState<'' | 'icon' | 'group'>('');
  const [groupName, setGroupName] = useState('');
  const [iconName, setIconName] = useState('');
  const [iconGroup, setIconGroup] = useState(ICON_GROUPS[0]);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const timer = useRef<any>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const say = (m: string) => { setToast(m); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 3200); };

  const groups = useMemo(() => allGroups(lib), [lib]);
  const list = useMemo<Tile[]>(() => [
    ...ICON_LIST.map(i => ({ key: i.key, name: i.name, group: i.group, url: `icons/${i.key}.png`, custom: false })),
    ...lib.icons.map(i => ({ key: i.key, name: i.name, group: i.group, url: i.data, custom: true })),
  ], [lib]);
  const activeCat = cat === 'All' || groups.includes(cat) ? cat : 'All';

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list.filter(i => (activeCat === 'All' || i.group === activeCat) && (!t || `${i.name} ${i.group} ${i.key.replace(/-/g, ' ')}`.toLowerCase().includes(t)));
  }, [q, activeCat, list]);
  const searching = q.trim() !== '';
  const sections = groups.map(g => ({ g, items: shown.filter(i => i.group === g) }))
    .filter(s => s.items.length || (!searching && lib.groups.includes(s.g) && (activeCat === 'All' || activeCat === s.g)));

  const commit = (next: CustomLib, ok: string) => {
    const err = saveCustom(next);
    if (err) { say(err); return false; }
    setLib(next); say(ok); return true;
  };

  const download = async (t: Tile) => {
    try {
      const r = await fetch(t.url); if (!r.ok) throw new Error('missing');
      say(await saveFile(await r.blob(), `${t.key}.png`));
    } catch { say(`Could not download ${t.name}`); }
  };

  const addGroup = () => {
    const name = groupName.trim();
    if (!name) { say('Type a name for the group first'); return; }
    if (groupTaken(lib, name)) { say(`A group called “${name}” already exists`); return; }
    if (commit({ ...lib, groups: [...lib.groups, name] }, `Added group ${name}`)) { setGroupName(''); setForm(''); setIconGroup(name); }
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

  const removeIcon = (key: string, name: string) => {
    if (!window.confirm(`Delete the icon “${name}”? Pathway nodes that use it will show a blank space.`)) return;
    commit({ ...lib, icons: lib.icons.filter(i => i.key !== key) }, `Deleted ${name}`);
  };
  const removeGroup = (g: string) => {
    const n = lib.icons.filter(i => i.group === g).length;
    if (n && !window.confirm(`Delete the group “${g}” and its ${n} icon${n === 1 ? '' : 's'}?`)) return;
    if (commit({ groups: lib.groups.filter(x => x !== g), icons: lib.icons.filter(i => i.group !== g) }, `Deleted group ${g}`) && cat === g) setCat('All');
  };

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
          <p>{list.length} icons for the Biological pathway editor. Download any icon as a PNG, add your own icons and groups, or open the editor and use the <b>Icon library</b> button at the top of its sidebar to place icons on a sheet.</p>
          <div className="mk-lib-tools">
            <input className="mk-lib-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search icons, e.g. kinase, tube, ATP" aria-label="Search icons" />
            <S.ToolButton compact style={{ flex: 'none', width: 'auto', padding: '8px 18px' }} on={form === 'icon'} onClick={() => setForm(form === 'icon' ? '' : 'icon')}>Add icon</S.ToolButton>
            <S.ToolButton compact style={{ flex: 'none', width: 'auto', padding: '8px 18px' }} on={form === 'group'} onClick={() => setForm(form === 'group' ? '' : 'group')}>Add group</S.ToolButton>
            <a className="mk-lib-open" href="#biological-pathway">Open Biological pathway →</a>
          </div>
          {form === 'group' ? (
            <div className="mk-lib-form">
              <input className="mk-lib-search" value={groupName} onChange={e => setGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addGroup(); }} placeholder="Group name, e.g. Organelles" maxLength={40} aria-label="Group name" autoFocus />
              <S.ToolButton compact style={{ flex: 'none', width: 'auto', padding: '8px 18px' }} on onClick={addGroup}>Create group</S.ToolButton>
            </div>
          ) : null}
          {form === 'icon' ? (
            <div className="mk-lib-form">
              <input className="mk-lib-file" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" onChange={e => { const f = e.target.files && e.target.files[0]; setIconFile(f || null); if (f && !iconName) setIconName(f.name.replace(/\.[^.]+$/, '')); }} aria-label="Icon image file" />
              <input className="mk-lib-search" value={iconName} onChange={e => setIconName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addIcon(); }} placeholder="Icon name" maxLength={60} aria-label="Icon name" />
              <select className="mk-lib-search mk-lib-select" value={iconGroup} onChange={e => setIconGroup(e.target.value)} aria-label="Group for the new icon">
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <S.ToolButton compact style={{ flex: 'none', width: 'auto', padding: '8px 18px' }} on onClick={addIcon}>Add to library</S.ToolButton>
              <span className="mk-lib-hint">PNG, JPEG, SVG, WebP or GIF. Scaled to 256 px and stored in this browser only.</span>
            </div>
          ) : null}
          <div className="mk-chips" role="group" aria-label="Filter by group">
            {['All', ...groups].map(g => (
              <S.ToolButton key={g} compact on={activeCat === g} onClick={() => setCat(g)}>{g} ({g === 'All' ? list.length : list.filter(i => i.group === g).length})</S.ToolButton>
            ))}
          </div>
          <p className="mk-lib-count" aria-live="polite">{shown.length} of {list.length} icons</p>
        </header>
        {sections.length === 0 ? <p className="mk-lib-empty">No icon matches “{q}”. Try a shorter word or choose All.</p> : null}
        {sections.map(s => (
          <section key={s.g} className="mk-lib-sec">
            <h2 className="sd-kicker">
              {s.g} · {s.items.length}
              {lib.groups.includes(s.g) ? <button type="button" className="mk-lib-del-group" onClick={() => removeGroup(s.g)}>Delete group</button> : null}
            </h2>
            {s.items.length === 0 ? <p className="mk-lib-empty">No icons in this group yet. Use Add icon and pick this group.</p> : null}
            <div className="mk-lib-grid">
              {s.items.map(i => (
                <div key={i.key} className="mk-lib-cell">
                  <button type="button" className="mk-lib-tile" title={`Download ${i.name} (PNG)`} onClick={() => download(i)}>
                    <span className="mk-lib-img" style={{ backgroundImage: `url(${i.url})` }} />
                    <span className="mk-lib-name">{i.name}</span>
                    <span className="mk-lib-dl">Download PNG</span>
                  </button>
                  {i.custom ? <button type="button" className="mk-lib-del" aria-label={`Delete ${i.name}`} title={`Delete ${i.name}`} onClick={() => removeIcon(i.key, i.name)}>×</button> : null}
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
