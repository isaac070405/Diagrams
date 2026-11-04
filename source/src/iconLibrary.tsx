import { useEffect, useMemo, useRef, useState } from 'react';
import { S } from './sheet';
import { Toast } from './shell';
import { saveFile } from './lib/platform';
import { ThemeSwitch } from './theme';
import { ICON_GROUPS, ICON_LIST } from './lib/iconCatalog';

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

export function IconLibraryPage(p: { onHome: () => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [toast, setToast] = useState('');
  const timer = useRef<any>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const say = (m: string) => { setToast(m); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 3200); };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ICON_LIST.filter(i => (cat === 'All' || i.group === cat) && (!t || `${i.name} ${i.group} ${i.key.replace(/-/g, ' ')}`.toLowerCase().includes(t)));
  }, [q, cat]);
  const sections = ICON_GROUPS.map(g => ({ g, items: shown.filter(i => i.group === g) })).filter(s => s.items.length);

  const download = async (key: string, name: string) => {
    try {
      const r = await fetch(`icons/${key}.png`); if (!r.ok) throw new Error('missing');
      say(await saveFile(await r.blob(), `${key}.png`));
    } catch { say(`Could not download ${name}`); }
  };

  return (
    <div className="mk-lib">
      <div className="mk-pathway-bar">
        <button type="button" className="mk-back" onClick={p.onHome}>← All diagrams</button>
        <span className="sd-kicker">12a · Icon library</span>
        <span className="mk-spacer" />
        <ThemeSwitch />
      </div>
      <div className="mk-lib-body">
        <header className="mk-lib-head">
          <h1>Icon library</h1>
          <p>{ICON_LIST.length} icons for the Biological pathway editor. Download any icon as a PNG, or open the editor and use the <b>Icon library</b> button at the top of its sidebar to place icons on a sheet.</p>
          <div className="mk-lib-tools">
            <input className="mk-lib-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search icons, e.g. kinase, tube, ATP" aria-label="Search icons" />
            <a className="mk-lib-open" href="#biological-pathway">Open Biological pathway →</a>
          </div>
          <div className="mk-chips" role="tablist" aria-label="Filter by group">
            {['All', ...ICON_GROUPS].map(g => (
              <S.ToolButton key={g} compact on={cat === g} onClick={() => setCat(g)}>{g} ({g === 'All' ? ICON_LIST.length : ICON_LIST.filter(i => i.group === g).length})</S.ToolButton>
            ))}
          </div>
          <p className="mk-lib-count" aria-live="polite">{shown.length} of {ICON_LIST.length} icons</p>
        </header>
        {sections.length === 0 ? <p className="mk-lib-empty">No icon matches “{q}”. Try a shorter word or choose All.</p> : null}
        {sections.map(s => (
          <section key={s.g} className="mk-lib-sec">
            <h2 className="sd-kicker">{s.g} · {s.items.length}</h2>
            <div className="mk-lib-grid">
              {s.items.map(i => (
                <button key={i.key} type="button" className="mk-lib-tile" title={`Download ${i.name} (PNG)`} onClick={() => download(i.key, i.name)}>
                  <span className="mk-lib-img" style={{ backgroundImage: `url(icons/${i.key}.png)` }} />
                  <span className="mk-lib-name">{i.name}</span>
                  <span className="mk-lib-dl">Download PNG</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Toast msg={toast} />
    </div>
  );
}
