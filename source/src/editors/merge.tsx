import { S } from '../sheet';
import { Seg } from '../ui';
import type { EditorDef, EditProps } from '../shell';

/* One editor that hosts several existing editors as modes. Data is { mode, [mode]: that editor's own data },
   so each mode keeps its own sheet when you switch. Old editor ids stay valid through `legacy`. */
export interface Part { mode: string; label: string; def: EditorDef; }

const clone = (x: any) => JSON.parse(JSON.stringify(x));
const initial = (d: EditorDef) => clone(d.blank || d.templates[0].data);

export function mergeEditors(meta: { id: string; num: string; name: string; field: string; blurb: string; modeLabel?: string }, parts: Part[]): EditorDef {
  const by = (data: any) => parts.find(p => p.mode === (data && data.mode)) || parts[0];
  const sub = (p: EditProps, part: Part): EditProps => ({
    ...p, data: p.data[part.mode],
    set: (patch, key) => p.set({ [part.mode]: { ...p.data[part.mode], ...patch } }, key),
  });
  const wrap = (data: any, part: Part, patch: any) => patch && { [part.mode]: { ...data[part.mode], ...patch } };
  const templates = parts.flatMap(part => part.def.templates.map(t => ({ ...t, name: part.label + ': ' + t.name, data: { mode: part.mode, [part.mode]: t.data } })));
  const normalize = (data: any) => {
    const out: any = { ...data, mode: by(data).mode };
    parts.forEach(part => { const d = out[part.mode] || initial(part.def); out[part.mode] = part.def.normalize ? part.def.normalize(d) : d; });
    return out;
  };
  return {
    ...meta,
    templates,
    blank: undefined,
    normalize,
    legacy: parts.map(p => ({ id: p.def.id, mode: p.mode })),
    hintFor: data => by(data).def.hint,
    connectFor: data => {
      const part = by(data), c = part.def.connect; if (!c) return undefined;
      return { ...c, make: (d: any, a: string, b: string) => wrap(d, part, c.make(d[part.mode], a, b)) };
    },
    Controls: p => {
      const part = by(p.data), Inner = part.def.Controls;
      return (
        <>
          <S.Panel kicker={meta.modeLabel || 'Type'} help="Each type keeps its own sheet when you switch.">
            <Seg value={part.mode} options={parts.map(x => [x.mode, x.label] as [string, string])}
              onChange={v => { p.setSel(null); p.set({ mode: v, [v]: p.data[v] || initial(parts.find(x => x.mode === v)!.def) }); }} />
          </S.Panel>
          <Inner {...sub(p, part)} />
        </>
      );
    },
    Render: ({ data, doc, sel }) => { const part = by(data), R = part.def.Render; return <R data={data[part.mode]} doc={doc} sel={sel} />; },
    Below: ({ data, doc }) => { const part = by(data), B = part.def.Below; return B ? <B data={data[part.mode]} doc={doc} /> : null; },
    stats: data => { const part = by(data); return part.def.stats ? part.def.stats(data[part.mode]) : []; },
    sheetClick: (data, pt) => { const part = by(data); return part.def.sheetClick ? wrap(data, part, part.def.sheetClick(data[part.mode], pt)) : null; },
    Overlay: p => { const part = by(p.data), O = part.def.Overlay; return O ? <O {...sub(p, part)} toSvg={p.toSvg} /> : null; },
    remove: (data, sel) => { const part = by(data); return part.def.remove ? wrap(data, part, part.def.remove(data[part.mode], sel)) : null; },
    findText: (data, text) => { const part = by(data); return part.def.findText ? part.def.findText(data[part.mode], text) : null; },
    nudge: (data, sel, dx, dy) => { const part = by(data); return part.def.nudge ? wrap(data, part, part.def.nudge(data[part.mode], sel, dx, dy)) : null; },
    duplicate: (data, sel) => {
      const part = by(data), r = part.def.duplicate ? part.def.duplicate(data[part.mode], sel) : null;
      return r ? { patch: wrap(data, part, r.patch), sel: r.sel } : null;
    },
  };
}
