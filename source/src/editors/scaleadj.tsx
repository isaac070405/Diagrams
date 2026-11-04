import { S } from '../sheet';
import { num, Range } from '../ui';
import type { EditProps } from '../shell';

/* Display adjustments for the micrograph, like the Display tab in ZEN: brightness, contrast,
   gamma, saturation, hue and a red, green, blue balance. They are an SVG filter on the image
   only, so graphics and the scale bar stay untouched, and PNG, JPEG and SVG exports carry them. */

export interface Adj { br: number; ct: number; ga: number; sa: number; hu: number; r: number; g: number; b: number }
export const ADJ0: Adj = { br: 0, ct: 0, ga: 1, sa: 100, hu: 0, r: 100, g: 100, b: 100 };
export const adjOf = (d: any): Adj => ({ ...ADJ0, ...(d.adj || {}) });
export const isNeutral = (a: Adj) => (Object.keys(ADJ0) as (keyof Adj)[]).every(k => a[k] === ADJ0[k]);

/* H&E tends to look flat on camera: a little more contrast and colour recovers nuclei and eosin */
const PRESETS: [string, Partial<Adj>][] = [
  ['H&E boost', { ct: 15, sa: 130, ga: 0.9 }],
  ['Greyscale', { sa: 0 }],
  ['Lighten', { br: 15, ga: 1.2 }],
];

const f3 = (v: number) => String(Math.round(v * 1000) / 1000);

const FN = ['feFuncR', 'feFuncG', 'feFuncB'] as const;

export function AdjFilter({ id, a, w, h }: { id: string; a: Adj; w: number; h: number }) {
  const k = (100 + a.ct) / 100, o = 0.5 - 0.5 * k + a.br / 200, e = 1 / Math.max(0.05, a.ga);
  const gains = [a.r, a.g, a.b].map(v => v / 100);
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x="0" y="0" width={w} height={h} colorInterpolationFilters="sRGB">
      <feColorMatrix type="hueRotate" values={String(a.hu)} />
      <feColorMatrix type="saturate" values={f3(a.sa / 100)} />
      <feComponentTransfer>{FN.map(T => <T key={T} type="gamma" amplitude="1" exponent={f3(e)} offset="0" />)}</feComponentTransfer>
      <feComponentTransfer>{FN.map((T, i) => <T key={T} type="linear" slope={f3(k * gains[i])} intercept={f3(o)} />)}</feComponentTransfer>
    </filter>
  );
}

export function AdjPanel({ data, set }: EditProps) {
  const a = adjOf(data), neutral = isNeutral(a);
  const up = (patch: Partial<Adj>, key?: string) => set({ adj: { ...a, ...patch } }, key);
  const R = (k: keyof Adj, label: string, min: number, max: number, step = 1) =>
    <Range id={'adj-' + k} label={label} value={num(a[k], ADJ0[k])} min={min} max={max} step={step} onChange={v => up({ [k]: v }, 'adj-' + k)} />;
  return (
    <S.Panel kicker="Stain and colour" help="Display only: these change how the image looks on the sheet and in exports, not the calibration.">
      <div className="sd-row-btns">
        {PRESETS.map(([n, p]) => <S.ToolButton key={n} compact onClick={() => set({ adj: { ...ADJ0, ...p } })}>{n}</S.ToolButton>)}
      </div>
      {R('br', 'Brightness', -100, 100)}
      {R('ct', 'Contrast', -100, 100)}
      {R('ga', 'Gamma', 0.3, 3, 0.05)}
      {R('sa', 'Saturation %', 0, 250)}
      {R('hu', 'Hue shift °', -180, 180)}
      {R('r', 'Red %', 50, 150)}
      {R('g', 'Green %', 50, 150)}
      {R('b', 'Blue %', 50, 150)}
      <S.ToolButton disabled={neutral} onClick={() => set({ adj: undefined })}>Reset colour</S.ToolButton>
    </S.Panel>
  );
}
