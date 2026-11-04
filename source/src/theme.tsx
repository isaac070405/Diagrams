import { useEffect, useState } from 'react';
import { store } from './lib/platform';

type Mode = 'auto' | 'light' | 'dark';
const KEY = 'sd-maker:theme';
const listeners = new Set<(m: Mode) => void>();
let current: Mode = store.get(KEY, 'auto');

function apply(m: Mode) {
  const r = document.documentElement;
  if (m === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', m);
}
apply(current);

function setMode(m: Mode) { current = m; store.set(KEY, m); apply(m); listeners.forEach(f => f(m)); }

const SUN = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
const MOON = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>;
const AUTO = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></svg>;

/* Light, dark, or follow the device. The sheet and every export stay on white paper. */
export function ThemeSwitch() {
  const [m, setM] = useState<Mode>(current);
  useEffect(() => { listeners.add(setM); return () => { listeners.delete(setM); }; }, []);
  const opts: [Mode, string, any][] = [['light', 'Light', SUN], ['dark', 'Dark', MOON], ['auto', 'Match device', AUTO]];
  return (
    <div className="mk-theme" role="radiogroup" aria-label="Colour theme">
      {opts.map(([v, l, ic]) => (
        <button key={v} type="button" role="radio" aria-checked={m === v} data-on={m === v ? '1' : '0'} title={l} aria-label={l} onClick={() => setMode(v)}>{ic}</button>
      ))}
    </div>
  );
}
