import { useEffect, useRef, useState } from 'react';
import { S, Sheet } from './sheet';
import { EditorShell, type EditorDef, Toast, norm } from './shell';
import { saveFile, store } from './lib/platform';
import { wheel } from './editors/wheel';
import { phylo } from './editors/phylo';
import { flowAll, reportingFlow, curveFit, scatterAll, diagnosticPlots, groupCompare } from './editors/merged';
import { pedigree } from './editors/pedigree';
import { foodweb, punnett, pyramid } from './editors/ecology';
import { dkey, iceberg } from './editors/keyice';
import { gradient, scalebar } from './editors/bars';
import { ThemeSwitch } from './theme';
import { timeline } from './editors/timeline';
import { ternary } from './editors/ternary';
import { macronutrient, nutrigeo } from './editors/nutrition';
import { pkpd } from './editors/pkpd';
import { sar } from './editors/sar';
import { mechanism } from './editors/mech';
import { wellplate } from './editors/plate';
import { blot } from './editors/blot';
import { contour } from './editors/contour';
import { transect } from './editors/transect';
import { treemap } from './editors/treemap';
import { radar } from './editors/radar';
import { forest } from './editors/forest';
import { km } from './editors/km';
import { volcano } from './editors/volcano';
import { heatmap } from './editors/heatmap';
import { venn } from './editors/venn';
import { sankey } from './editors/sankey';
import { pie } from './editors/pie';
import { rarefaction } from './editors/rarefaction';
import { ICON_LIBRARY, IconLibraryPage, IconLibraryThumb } from './iconLibrary';
import { ICON_EDITOR, IconEditorPage } from './iconEditor';

const EDITORS: EditorDef[] = [wheel, phylo, flowAll, pedigree, foodweb, punnett, pyramid, dkey, iceberg, scalebar, gradient];
const PATHWAY = { id: 'biological-pathway', num: '12', name: 'Biological pathway', field: 'Cells and measurement', blurb: 'Signalling and metabolic pathways with compartments, 80 BioRender icons and a Claude first draft.' };
const ALL: any[] = [...EDITORS, PATHWAY, timeline, ternary, pkpd, sar, mechanism, wellplate, blot, contour, transect, treemap, radar, reportingFlow, forest, km, curveFit, scatterAll, diagnosticPlots, groupCompare, volcano, heatmap, venn, sankey, pie, rarefaction, macronutrient, nutrigeo];
const FIELDS = ['All', 'Methods', 'Evolution and genetics', 'Ecology', 'Cells and measurement', 'Pharmacology', 'Evidence and clinical', 'Nutrition science'];

const WORDS: any = { 15: 'Fifteen', 16: 'Sixteen', 17: 'Seventeen', 18: 'Eighteen', 19: 'Nineteen', 20: 'Twenty', 21: 'Twenty-one', 22: 'Twenty-two', 23: 'Twenty-three', 24: 'Twenty-four', 25: 'Twenty-five', 26: 'Twenty-six', 27: 'Twenty-seven', 28: 'Twenty-eight', 29: 'Twenty-nine', 30: 'Thirty', 31: 'Thirty-one', 32: 'Thirty-two', 33: 'Thirty-three', 34: 'Thirty-four', 35: 'Thirty-five', 36: 'Thirty-six', 37: 'Thirty-seven', 38: 'Thirty-eight', 39: 'Thirty-nine', 40: 'Forty', 41: 'Forty-one', 42: 'Forty-two', 43: 'Forty-three', 44: 'Forty-four', 45: 'Forty-five', 46: 'Forty-six', 47: 'Forty-seven', 48: 'Forty-eight', 49: 'Forty-nine', 50: 'Fifty', 51: 'Fifty-one' };

/* ids of editors folded into a merged one still open the merged editor */
const unalias = (h: string) => { const m = ALL.find((e: any) => e.legacy && e.legacy.some((l: any) => l.id === h)); return m ? m.id : h; };
/* #icon-editor/<key> opens the icon editor on that icon, so only the part before the slash is the route */
function routeId() { const h = unalias((location.hash || '').replace(/^#/, '').split('/')[0]); return h === ICON_LIBRARY.id || h === ICON_EDITOR.id || ALL.some(e => e.id === h) ? h : ''; }

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
        <div className="mk-chips" role="group" aria-label="Filter by field">
          {FIELDS.map(f => <S.ToolButton key={f} compact on={field === f} onClick={() => { setField(f); store.set('sd-maker:field', f); }}>{f}{f === 'All' ? ' (' + (ALL.length + 1) + ')' : ''}</S.ToolButton>)}
        </div>
      </header>
      <main className="mk-grid">
        {list.map(e => <Card key={e.id} e={e} />)}
      </main>
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
    };
    window.addEventListener('message', onMsg);
    return () => { window.removeEventListener('message', onMsg); clearTimeout(t); };
  }, []);
  return (
    <main className="mk-pathway">
      <div className="mk-pathway-bar">
        <button type="button" className="mk-back" onClick={p.onHome}>← All diagrams</button>
        <span className="sd-kicker" role="heading" aria-level={1}>12 · Biological pathway</span>
        <span className="mk-spacer" />
        <ThemeSwitch />
      </div>
      <iframe ref={ref} src="pathway.html" title="Biological pathway diagram editor" />
      <Toast msg={toast} />
    </main>
  );
}

export default function App() {
  const [id, setId] = useState(routeId());
  const [, bump] = useState(0); /* the icon editor changes only the part of the address after the slash, so the route id stays the same but the page must still redraw */
  useEffect(() => { const f = () => { setId(routeId()); bump(n => n + 1); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const go = (next: string) => { location.hash = next ? next : ''; setId(next); window.scrollTo(0, 0); };
  if (id === PATHWAY.id) return <PathwayFrame onHome={() => go('')} />;
  if (id === ICON_LIBRARY.id) return <IconLibraryPage onHome={() => go('')} />;
  if (id === ICON_EDITOR.id) return <IconEditorPage key={location.hash} onBack={() => go(ICON_LIBRARY.id)} />;
  const def = ALL.find(e => e.id === id && e.templates);
  if (def) return <EditorShell key={def.id} def={def} onHome={() => go('')} />;
  return <Home />;
}
