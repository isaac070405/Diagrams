import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { S } from './sheet';
import { loadCustom, resolveLib } from './lib/customIcons';
import type { CustomLib, Tile } from './lib/customIcons';

/** Address of the picture shown for an icon: its replacement image if it has one, else the built-in PNG. */
export const iconUrl = (t: Tile) => t.data || `icons/${t.key}.png`;

export type PickedIcon = { key: string; name: string; group: string; ratio: number; url: string };
export const toPicked = (t: Tile): PickedIcon => ({ key: t.key, name: t.name, group: t.group, ratio: t.ratio, url: iconUrl(t) });

type BrowserProps = {
  lib: CustomLib;
  cat: string;
  onCat: (c: string) => void;
  onTile: (t: Tile) => void;
  /** Title (tooltip) of a tile. */
  tileTitle?: (t: Tile) => string;
  /** Small label under a tile that appears on hover, e.g. "Download PNG" or "Use icon". */
  tileHint?: string;
  /** Extra buttons laid over a tile, such as edit and delete. They must be position: absolute. */
  tileExtras?: (t: Tile) => ReactNode;
  /** Buttons after a group's heading. */
  groupExtras?: (group: string, items: Tile[]) => ReactNode;
  /** Panels between a group's heading and its tiles, such as a rename form. */
  groupPanel?: (group: string, items: Tile[]) => ReactNode;
  /** Show groups that have no icons yet (the library does, a picker does not). */
  showEmptyGroups?: boolean;
  /** Text above the search row: the page heading and its description. */
  intro?: ReactNode;
  /** Buttons beside the search box. */
  toolbar?: ReactNode;
  /** Forms below the search row. */
  forms?: ReactNode;
  emptyGroupText?: string;
};

/**
 * The searchable, grouped icon grid shared by the Icon library (12a), the Icon editor (12b) and the icon picker dialog.
 * It owns the search box. The page owns the library data, the selected group and what a click on a tile does.
 */
export function IconBrowser(p: BrowserProps) {
  const [q, setQ] = useState('');
  const { groups, tiles: list } = useMemo(() => resolveLib(p.lib), [p.lib]);
  const activeCat = p.cat === 'All' || groups.includes(p.cat) ? p.cat : 'All';

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list.filter(i => (activeCat === 'All' || i.group === activeCat) && (!t || `${i.name} ${i.group} ${i.key.replace(/-/g, ' ')}`.toLowerCase().includes(t)));
  }, [q, activeCat, list]);
  const searching = q.trim() !== '';
  const sections = groups.map(g => ({ g, items: shown.filter(i => i.group === g) }))
    .filter(s => s.items.length || (p.showEmptyGroups && !searching && (activeCat === 'All' || activeCat === s.g)));

  return (
    <>
      <header className="mk-lib-head">
        {p.intro}
        <div className="mk-lib-tools">
          <input className="mk-lib-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search icons, e.g. kinase, tube, ATP" aria-label="Search icons" />
          {p.toolbar}
        </div>
        {p.forms}
        <div className="mk-chips" role="group" aria-label="Filter by group">
          {['All', ...groups].map(g => (
            <S.ToolButton key={g} compact on={activeCat === g} onClick={() => p.onCat(g)}>{g} ({g === 'All' ? list.length : list.filter(i => i.group === g).length})</S.ToolButton>
          ))}
        </div>
        <p className="mk-lib-count" aria-live="polite">{shown.length} of {list.length} icons</p>
      </header>
      {sections.length === 0 ? <p className="mk-lib-empty">{searching ? `No icon matches “${q}”. Try a shorter word or choose All.` : 'No groups. Use Add group to create one.'}</p> : null}
      {sections.map(s => (
        <section key={s.g} className="mk-lib-sec">
          <h2 className="sd-kicker">
            {s.g} · {s.items.length}
            {p.groupExtras ? p.groupExtras(s.g, s.items) : null}
          </h2>
          {p.groupPanel ? p.groupPanel(s.g, s.items) : null}
          {s.items.length === 0 ? <p className="mk-lib-empty">{p.emptyGroupText || 'No icons in this group yet.'}</p> : null}
          <div className="mk-lib-grid">
            {s.items.map(i => (
              <div key={i.key} className="mk-lib-cell">
                <button type="button" className="mk-lib-tile" title={p.tileTitle ? p.tileTitle(i) : i.name} onClick={() => p.onTile(i)}>
                  <span className="mk-lib-img" style={{ backgroundImage: `url(${iconUrl(i)})` }} />
                  <span className="mk-lib-name">{i.name}</span>
                  {p.tileHint ? <span className="mk-lib-dl">{p.tileHint}</span> : null}
                </button>
                {p.tileExtras ? p.tileExtras(i) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/**
 * Picks one icon from the library, including the user's own icons and edits. Any diagram that places icons calls
 * <IconPicker onPick={icon => ...} /> and stores icon.key, so a later edit to the icon shows everywhere.
 */
export function IconPicker(p: { onPick: (icon: PickedIcon) => void; hint?: string; intro?: ReactNode }) {
  const [lib] = useState<CustomLib>(loadCustom);
  const [cat, setCat] = useState('All');
  return (
    <div className="mk-pick">
      <IconBrowser lib={lib} cat={cat} onCat={setCat} onTile={t => p.onPick(toPicked(t))} tileHint={p.hint || 'Use icon'}
        tileTitle={t => `${p.hint || 'Use'} ${t.name}`} intro={p.intro} />
    </div>
  );
}

/** The picker in a dialog over the page. Escape, the Close button and a click outside close it. */
export function IconPickerDialog(p: { title?: string; onPick: (icon: PickedIcon) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') p.onClose(); };
    window.addEventListener('keydown', f);
    return () => { window.removeEventListener('keydown', f); prev?.focus?.(); };
  }, []);
  return (
    <div className="mk-pick-back" onMouseDown={e => { if (e.target === e.currentTarget) p.onClose(); }}>
      <div className="mk-pick-box" role="dialog" aria-modal="true" aria-label={p.title || 'Choose an icon'} ref={box}>
        <div className="mk-pick-bar">
          <span className="sd-kicker">{p.title || 'Choose an icon'}</span>
          <S.ToolButton compact style={{ flex: 'none', width: 'auto', padding: '8px 14px' }} onClick={p.onClose}>Close</S.ToolButton>
        </div>
        <div className="mk-pick-scroll"><IconPicker onPick={p.onPick} /></div>
      </div>
    </div>
  );
}
