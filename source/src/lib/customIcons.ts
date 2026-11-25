// Icons and groups the user adds to the Icon library. Stored in this browser under one key,
// shared by the home page library and the Biological pathway editor (public/pathway.html reads the same key).
import { ICON_GROUPS, ICON_LIST } from './iconCatalog';

export const CUSTOM_ICON_KEY = 'sd-maker:custom-icons';
export type CustomIcon = { key: string; name: string; group: string; ratio: number; data: string };
export type IconOverride = { name?: string; group?: string; data?: string; ratio?: number; hidden?: boolean };
/** over holds changes to the built-in catalogue (rename, move, replace image, delete), so the PNG files stay as shipped. */
export type CustomLib = { groups: string[]; icons: CustomIcon[]; over?: { groups: Record<string, { name?: string; hidden?: boolean }>; icons: Record<string, IconOverride> } };
export type OpResult = { lib?: CustomLib; error?: string; name?: string; moved?: number; deleted?: number };
export type Tile = { key: string; name: string; group: string; ratio: number; data: string | null; custom: boolean; edited: boolean };

/** Pure edit functions from src/lib/iconOps.js. B is the built-in group list, I the built-in icon list. */
export const ops = () => (window as any).SDIconOps;

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

export const resolveLib = (lib: CustomLib): { groups: string[]; tiles: Tile[] } => ops().resolve(lib, ICON_GROUPS, ICON_LIST);
export const addGroupOp = (lib: CustomLib, name: string): OpResult => ops().addGroup(lib, ICON_GROUPS, name);
export const renameGroupOp = (lib: CustomLib, from: string, to: string): OpResult => ops().renameGroup(lib, ICON_GROUPS, from, to);
export const deleteGroupOp = (lib: CustomLib, name: string, moveTo: string): OpResult => ops().deleteGroup(lib, ICON_GROUPS, ICON_LIST, name, moveTo);
export const editIconOp = (lib: CustomLib, key: string, patch: { name?: string; group?: string; data?: string; ratio?: number }): OpResult => ops().editIcon(lib, ICON_GROUPS, ICON_LIST, key, patch);
export const deleteIconOp = (lib: CustomLib, key: string): OpResult => ops().deleteIcon(lib, ICON_LIST, key);
export const restoreIconOp = (lib: CustomLib, key: string): OpResult => ops().restoreIcon(lib, ICON_LIST, key);
export const restoreGroupOp = (lib: CustomLib, orig: string): OpResult => ops().restoreGroup(lib, ICON_LIST, orig);
export const restoreAllOp = (lib: CustomLib): OpResult => ops().restoreAll(lib);
export const deletedBuiltins = (lib: CustomLib): { groups: { orig: string; name: string }[]; icons: { key: string; name: string }[] } => ops().deleted(lib, ICON_GROUPS, ICON_LIST);
export const changeCount = (lib: CustomLib): number => ops().changes(lib);
export const membersOf = (lib: CustomLib, name: string): { builtin: string[]; custom: string[] } => ops().members(lib, ICON_GROUPS, ICON_LIST, name);
export const uniqueKey = (lib: CustomLib, name: string): string => ops().uniqueKey(lib, ICON_LIST, name);

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
