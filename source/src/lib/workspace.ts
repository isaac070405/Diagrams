// Sheets saved in the artifact itself: each viewer's own private list in the artifact's database.
// Falls back to this browser's storage when the database is not available in this view.
import { store } from './platform';

const W: any = window;
export interface SavedSheet { id: string; name: string; editor: string; at: number; doc: any; where: 'workspace' | 'browser'; }

let ctx: Promise<{ db: any; uid: string } | null> | null = null;
function connect() {
  if (!ctx) ctx = (async () => {
    try {
      if (!W.claude || !W.claude.use) return null;
      const [db, user] = await Promise.all([W.claude.use('db'), W.claude.use('user')]);
      if (!db || !user) return null;
      const uid = await user.id();
      return uid ? { db, uid } : null;
    } catch (e) { return null; }
  })();
  return ctx;
}
const col = (c: { db: any; uid: string }) => c.db.collection('data/users/' + c.uid);
const LKEY = (editor: string) => 'sd-maker:versions:' + editor;

export async function where(): Promise<'workspace' | 'browser'> { return (await connect()) ? 'workspace' : 'browser'; }

export async function listSheets(editor: string): Promise<SavedSheet[]> {
  const c = await connect();
  if (c) {
    try {
      const snap = await col(c).where('editor', '==', editor).get();
      return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any), where: 'workspace' })).sort((a: any, b: any) => b.at - a.at);
    } catch (e) { /* fall through to the browser list */ }
  }
  return (store.get(LKEY(editor), []) as any[]).map(v => ({ id: v.key, name: v.name, editor, at: v.at, doc: v.doc, where: 'browser' }));
}

export async function saveSheet(editor: string, name: string, doc: any): Promise<string> {
  const body = { editor, name, at: Date.now(), doc };
  const c = await connect();
  if (c) {
    if (JSON.stringify(body).length > 240000) return 'Too large for the workspace (an uploaded image is over the limit). Use Save project file instead.';
    try {
      /* the same name, in any letter case, replaces the earlier save */
      let id = 's' + Date.now().toString(36);
      try { const old = await col(c).where('editor', '==', editor).get(); const hit = old.docs.find((d: any) => String((d.data() as any).name).toLowerCase() === name.toLowerCase()); if (hit) id = hit.id; } catch (e) { /* new id */ }
      await col(c).doc(id).set(body); return 'Saved “' + name + '” in this workspace';
    }
    catch (e: any) { if (e && e.code === 'quota_exceeded') return 'The workspace is full: delete a saved sheet first'; }
  }
  const list = [{ key: 'v' + Date.now(), name, at: body.at, doc }, ...(store.get(LKEY(editor), []) as any[]).filter(v => String(v.name).toLowerCase() !== name.toLowerCase())].slice(0, 30);
  return store.set(LKEY(editor), list) ? 'Saved “' + name + '” in this browser' : 'Browser storage is full: delete a saved sheet first';
}

export async function deleteSheet(s: SavedSheet) {
  if (s.where === 'workspace') { const c = await connect(); if (c) { try { await col(c).doc(s.id).delete(); } catch (e) { /* ignore */ } } return; }
  store.set(LKEY(s.editor), (store.get(LKEY(s.editor), []) as any[]).filter(v => v.key !== s.id));
}
