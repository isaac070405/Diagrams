// Icons and groups the user adds to the Icon library. Stored in this browser under one key,
// shared by the home page library and the Biological pathway editor (public/pathway.html reads the same key).
import { ICON_GROUPS, ICON_LIST } from './iconCatalog';

export const CUSTOM_ICON_KEY = 'sd-maker:custom-icons';
export type CustomIcon = { key: string; name: string; group: string; ratio: number; data: string };
export type CustomLib = { groups: string[]; icons: CustomIcon[] };

const MAX_SIDE = 256;

export function loadCustom(): CustomLib {
  try {
    const s = JSON.parse(localStorage.getItem(CUSTOM_ICON_KEY) || 'null');
    if (s && Array.isArray(s.groups) && Array.isArray(s.icons)) return s;
  } catch (e) { /* storage blocked or corrupt: start empty */ }
  return { groups: [], icons: [] };
}

/** Returns an error message when the browser cannot store the library, otherwise ''. */
export function saveCustom(lib: CustomLib): string {
  try { localStorage.setItem(CUSTOM_ICON_KEY, JSON.stringify(lib)); return ''; }
  catch (e) { return 'Browser storage is full. Delete an icon you no longer need, then try again.'; }
}

export function allGroups(lib: CustomLib): string[] {
  return [...ICON_GROUPS, ...lib.groups.filter(g => !ICON_GROUPS.includes(g))];
}

export function groupTaken(lib: CustomLib, name: string): boolean {
  const t = name.trim().toLowerCase();
  return allGroups(lib).some(g => g.toLowerCase() === t);
}

export function uniqueKey(lib: CustomLib, name: string): string {
  const base = 'custom-' + (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'icon');
  const used = new Set([...ICON_LIST.map(i => i.key), ...lib.icons.map(i => i.key)]);
  let k = base, n = 2;
  while (used.has(k)) k = base + '-' + n++;
  return k;
}

/** Reads an image file and scales it so the longest side is at most 256 px, as a PNG data URL. */
export function readIconFile(file: File): Promise<{ data: string; ratio: number }> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read that file'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('That file is not an image the browser can open'));
      im.onload = () => {
        const w0 = im.naturalWidth || 128, h0 = im.naturalHeight || 128;
        const s = Math.min(1, MAX_SIDE / Math.max(w0, h0));
        const w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
        try {
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d')!.drawImage(im, 0, 0, w, h);
          resolve({ data: c.toDataURL('image/png'), ratio: Math.round((w / h) * 1000) / 1000 });
        } catch (e) { reject(new Error('Could not process that image')); }
      };
      im.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}
