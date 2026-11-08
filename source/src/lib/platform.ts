// Viewer capabilities: file saves (downloads) and Claude drafts (sample).
const W: any = window;

async function cap(name: string): Promise<any> {
  try { return W.claude && W.claude.use ? await W.claude.use(name) : null; } catch (e) { return null; }
}

export async function saveFile(blob: Blob, filename: string): Promise<string> {
  const dl = await cap('downloads');
  if (!dl) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return 'Saved ' + filename;
    } catch (e) { return 'Could not save ' + filename; }
  }
  try { await dl.save({ filename, data: blob }); return 'Saved ' + filename; }
  catch (e: any) {
    if (e && e.code === 'declined') return 'Save cancelled';
    if (e && e.code === 'rate_limited') return 'A save is already waiting for you; try again in a moment';
    return 'Could not save ' + filename;
  }
}

export const store = {
  get(key: string, fallback: any) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
  set(key: string, value: any) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } },
};
