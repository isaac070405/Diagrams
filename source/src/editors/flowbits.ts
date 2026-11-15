/* shared by the flow diagrams (PRISMA 29, CONSORT 32): wrapping text inside a box of a given width */
export const CH = 6.3, LH = 15;
export type Line = { t: string; b?: boolean };

/* wrap one line to a box width */
export function wrap(text: string, w: number): string[] {
  const max = Math.max(8, Math.floor((w - 16) / CH)), words = text.split(' '), out: string[] = []; let cur = '';
  words.forEach(wd => { if (cur && (cur + ' ' + wd).length > max) { out.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; });
  if (cur) out.push(cur);
  return out;
}
/* keep "(n = 31)" on one line */
export const nb = (s: string) => s.replace(/\(n = (\d+)\)/g, '(n = $1)');
export const lay = (lines: Line[], w: number) => lines.flatMap(l => wrap(nb(l.t), w).map((t, i) => ({ t, b: l.b && i === 0 })));
/* box height for a set of lines */
export const boxH = (lines: Line[], w: number) => lay(lines, w).length * LH + 14;
