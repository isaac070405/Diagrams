import { useEffect, useRef, useState } from 'react';
import { S, Sheet } from './sheet';
import { EditorShell, type EditorDef, Toast, norm } from './shell';
import { askClaude, saveFile, store } from './lib/platform';
import { wheel } from './editors/wheel';
import { phylo } from './editors/phylo';
import { flow } from './editors/flow';
import { pedigree } from './editors/pedigree';
import { foodweb, punnett, pyramid } from './editors/ecology';
import { dkey, iceberg } from './editors/keyice';
import { gradient, scalebar } from './editors/bars';
import { productflow } from './editors/pfd';
import { ThemeSwitch } from './theme';
import { timeline } from './editors/timeline';
import { ternary } from './editors/ternary';
import { doseresponse, pkcurve } from './editors/pharm';
import { pkpd } from './editors/pkpd';
import { sar } from './editors/sar';
import { mechanism } from './editors/mech';
import { popdyn } from './editors/popdyn';
import { ICON_LIBRARY, IconLibraryPage, IconLibraryThumb } from './iconLibrary';

const EDITORS: EditorDef[] = [wheel, phylo, flow, pedigree, foodweb, punnett, pyramid, dkey, iceberg, scalebar, gradient];
const PATHWAY = { id: 'biological-pathway', num: '12', name: 'Biological pathway', field: 'Cells and measurement', blurb: 'Signalling and metabolic pathways with compartments, 80 BioRender icons and a Claude first draft.' };
const ALL: any[] = [...EDITORS, PATHWAY, productflow, timeline, ternary, pkpd, pkcurve, doseresponse, sar, mechanism, popdyn];
const FIELDS = ['All', 'Methods', 'Evolution and genetics', 'Ecology', 'Cells and measurement', 'Pharmacology'];

const WORDS: any = { 15: 'Fifteen', 16: 'Sixteen', 17: 'Seventeen', 18: 'Eighteen', 19: 'Nineteen', 20: 'Twenty', 21: 'Twenty-one', 22: 'Twenty-two' };

function routeId() { const h = (location.hash || '').replace(/^#/, ''); return h === ICON_LIBRARY.id || ALL.some(e => e.id === h) ? h : ''; }

function PathwayThumb() {
  const ins = { role: 'ligand', label: 'Insulin', x: 250, y: 30 }, insr = { role: 'receptor', label: 'INSR', x: 250, y: 84 }, akt = { role: 'kinase', label: 'AKT', x: 250, y: 150, badge: true };
  const glu = { role: 'metabolite', label: 'Glucose', x: 60, y: 220 }, g6p = { role: 'metabolite', label: 'G6P', x: 250, y: 220 }, f6p = { role: 'metabolite', label: 'F6P', x: 430, y: 220 };
  return (
    <>
      <S.Compartment kind="membrane" x={0} y={76} w={500} h={14} label="Plasma membrane" />
      <S.Edge type="activate" from={S.port(ins, 's')} to={S.port(insr, 'n')} />
      <S.Edge type="activate" from={S.port(insr, 's')} to={S.port(akt, 'n')} />
      <S.Edge type="convert" from={S.port(glu, 'e')} to={S.port(g6p, 'w')} label="HK2" labelSide="left" />
      <S.Edge type="convert" from={S.port(g6p, 'e')} to={S.port(f6p, 'w')} label="PGI" labelSide="left" />
      <S.Edge type="induce" from={S.port(akt, 's')} to={[250, 206]} gap={6} />
      {[ins, insr, akt, glu, g6p, f6p].map((n, i) => <S.Node key={i} {...n} />)}
    </>
  );
}

function Card(p: { e: any }) {
  const e = p.e;
  const saved = e.templates ? store.get('sd-maker:doc:' + e.id, null) : null;
  const doc = saved && saved.v === 1 ? saved : e.templates ? { data: e.templates[0].data, title: e.templates[0].title } : null;
  return (
    <S.Blueprint as="article" className="mk-card">
      <a className="mk-card-btn" href={'#' + e.id}>
        <div className="mk-thumb" aria-hidden="true">
          {e.id === ICON_LIBRARY.id ? <IconLibraryThumb /> : <Sheet font="arial" label={e.name}>{e.templates ? <e.Render data={norm(e, doc.data)} doc={doc} /> : <PathwayThumb />}</Sheet>}
        </div>
        <div className="mk-card-text">
          <span className="sd-kicker">{e.num} · {e.field}</span>
          <h2>{e.name}</h2>
          <p>{e.blurb}</p>
          {saved ? <span className="mk-saved">In progress: {saved.title || 'Untitled'}</span> : null}
        </div>
      </a>
    </S.Blueprint>
  );
}

function Home() {
  const [field, setField] = useState(() => store.get('sd-maker:field', 'All'));
  const list = [...ALL, ICON_LIBRARY].filter(e => field === 'All' || e.field === field).sort((a, b) => a.num.localeCompare(b.num));
  return (
    <div className="mk-home">
      <header className="mk-home-head">
        <div className="mk-home-top"><span className="sd-kicker">Scientific Diagram</span><ThemeSwitch /></div>
        <h1>Diagram Workspace</h1>
        <p>{WORDS[ALL.length] || ALL.length} editors for figures in lab reports, essays and slides. Pick one, start from an example, and export on white paper as PNG, SVG or JPEG.</p>
        <div className="mk-chips" role="tablist" aria-label="Filter by field">
          {FIELDS.map(f => <S.ToolButton key={f} compact on={field === f} onClick={() => { setField(f); store.set('sd-maker:field', f); }}>{f}{f === 'All' ? ' (' + (ALL.length + 1) + ')' : ''}</S.ToolButton>)}
        </div>
      </header>
      <section className="mk-grid">
        {list.map(e => <Card key={e.id} e={e} />)}
      </section>
    </div>
  );
}

function PathwayFrame(p: { onHome: () => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [toast, setToast] = useState('');
  useEffect(() => {
    let t: any;
    const say = (m: string) => { setToast(m); clearTimeout(t); t = setTimeout(() => setToast(''), 3200); };
    const onMsg = async (e: MessageEvent) => {
      const w = ref.current && ref.current.contentWindow;
      if (!w || e.source !== w) return;
      const d: any = e.data; if (!d || !d.__sd || !d.id) return;
      const reply = (result: any, error?: string) => w.postMessage({ __sdReply: d.id, result, error }, '*');
      if (d.__sd === 'download') { const m = await saveFile(d.payload.blob, d.payload.name); say(m); reply(m); }
      else if (d.__sd === 'complete') { try { reply(await askClaude(d.payload)); } catch (err: any) { reply(null, String(err && err.message || err)); } }
    };
    window.addEventListener('message', onMsg);
    return () => { window.removeEventListener('message', onMsg); clearTimeout(t); };
  }, []);
  return (
    <div className="mk-pathway">
      <div className="mk-pathway-bar">
        <button type="button" className="mk-back" onClick={p.onHome}>← All diagrams</button>
        <span className="sd-kicker">12 · Biological pathway</span>
        <span className="mk-spacer" />
        <ThemeSwitch />
      </div>
      <iframe ref={ref} src="pathway.html" title="Biological pathway diagram editor" />
      <Toast msg={toast} />
    </div>
  );
}

export default function App() {
  const [id, setId] = useState(routeId());
  useEffect(() => { const f = () => { setId(routeId()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const go = (next: string) => { location.hash = next ? next : ''; setId(next); window.scrollTo(0, 0); };
  if (id === PATHWAY.id) return <PathwayFrame onHome={() => go('')} />;
  if (id === ICON_LIBRARY.id) return <IconLibraryPage onHome={() => go('')} />;
  const def = EDITORS.concat(productflow, timeline, ternary, pkpd, pkcurve, doseresponse, sar, mechanism, popdyn).find(e => e.id === id);
  if (def) return <EditorShell key={def.id} def={def} onHome={() => go('')} />;
  return <Home />;
}
