import { Fragment } from 'react';
import { S } from '../sheet';
import { num, Range, Rows, Seg, startDrag, Swatches, TextIn, Toggle } from '../ui';
import type { EditorDef, EditProps } from '../shell';
import { ternary, KITES } from './ternary';

/* ================= 49 Macronutrient triangle =================
   The ternary editor with protein, fat and carbohydrate as its corners. Points are foods, diets or
   meals as % of energy; regions mark food groups or recommended ranges. */
export const macronutrient: EditorDef = {
  ...ternary,
  id: 'macronutrient-triangle', num: '49', name: 'Macronutrient triangle', field: 'Nutrition science',
  blurb: 'Foods, meals or diets by % of energy from protein, fat and carbohydrate, with the AU/NZ acceptable range as a shaded region.',
  templates: [
    { name: 'Foods by macronutrient energy', desc: 'Foods by % of energy from protein, fat and carbohydrate', title: 'Where foods sit by macronutrient energy',
      caption: 'Share of energy from each macronutrient (Atwater factors 4, 9 and 4 kcal/g), approximate values per 100 g.',
      data: { nameA: 'Protein', nameB: 'Fat', nameC: 'Carbohydrate', unit: '% of energy', grid: 10, ticks: true, labels: true, pointSize: 6,
        regions: KITES('Mostly // protein', 'Mostly // fat', 'Mostly // carbohydrate', 'var(--swatch-13)', 'var(--swatch-7)', 'var(--swatch-3)'),
        points: [['Chicken breast', 79, 21, 0], ['Canned tuna', 92, 8, 0], ['Salmon', 41, 59, 0], ['Eggs', 36, 62, 2], ['Firm tofu', 42, 50, 8], ['Cheddar', 25, 74, 1],
          ['Whole milk', 21, 48, 31], ['Almonds', 13, 72, 15], ['Lentils', 30, 3, 67], ['Rolled oats', 14, 15, 71], ['White rice', 9, 2, 89], ['Banana', 4, 3, 93]]
          .map(([label, a, b, c]) => ({ label, a, b, c, color: 'var(--ink)' })) } },
    { name: 'Acceptable range (AU/NZ)', desc: 'Adult acceptable macronutrient distribution range with example diets', title: 'Diets against the acceptable macronutrient distribution range',
      caption: 'Shaded region: acceptable macronutrient distribution range for adults (protein 15 to 25 %, fat 20 to 35 %, carbohydrate 45 to 65 % of energy), as set in the NHMRC Nutrient Reference Values for Australia and New Zealand. Diet values are illustrative.',
      data: { nameA: 'Protein', nameB: 'Fat', nameC: 'Carbohydrate', unit: '% of energy', grid: 10, ticks: true, labels: true, pointSize: 6,
        regions: [{ label: 'Acceptable range', verts: '15,20,65; 25,20,55; 25,30,45; 20,35,45; 15,35,50', color: 'var(--swatch-4)', size: 13 }],
        points: [['Typical mixed diet', 17, 32, 51], ['Low-carbohydrate', 25, 62, 13], ['High-carb', 12, 18, 70], ['High-protein', 35, 30, 35]]
          .map(([label, a, b, c]) => ({ label, a, b, c, color: 'var(--ink)' })) } },
    { name: 'Diet change over time', desc: 'Joined points showing a shift in energy sources', title: 'Shift in macronutrient energy across four weeks',
      caption: 'Mean daily energy from each macronutrient at baseline and after each week of the intervention (illustrative values).',
      data: { nameA: 'Protein', nameB: 'Fat', nameC: 'Carbohydrate', unit: '% of energy', grid: 10, ticks: true, labels: true, pointSize: 6, connect: true, regions: [],
        points: [['Baseline', 16, 34, 50], ['Week 1', 20, 30, 50], ['Week 2', 23, 27, 50], ['Week 4', 26, 24, 50]].map(([label, a, b, c]) => ({ label, a, b, c, color: 'var(--accent)' })) } },
  ],
  blank: { nameA: 'Protein', nameB: 'Fat', nameC: 'Carbohydrate', unit: '% of energy', grid: 10, ticks: true, labels: true, pointSize: 7, regions: [], points: [{ label: 'Diet 1', a: 20, b: 30, c: 50 }] },
};

/* ================= 50 Nutritional geometry =================
   Nutrient space as used in nutritional ecology (the geometric framework): amounts of two nutrients
   collected on the two axes. A food is a rail (a ray from the origin whose slope is its nutrient ratio),
   eating moves the animal along a rail, and an intake target is a point in the space. */
const L = 100, T = 28, PW = 480, PH = 420;
const VIR = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];
function viridis(t: number) {
  t = Math.max(0, Math.min(1, t)); const i = Math.min(3, Math.floor(t * 4)), f = t * 4 - i;
  const h = (s: string) => [1, 3, 5].map(k => parseInt(s.slice(k, k + 2), 16));
  const p = h(VIR[i]), q = h(VIR[i + 1]);
  return 'rgb(' + p.map((v, k) => Math.round(v + (q[k] - v) * f)).join(',') + ')';
}
function niceStep(span: number, n: number) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p; }
const sig = (v: number) => +v.toPrecision(3);
const RAIL = ['var(--swatch-2)', 'var(--swatch-5)', 'var(--swatch-9)', 'var(--swatch-14)', 'var(--swatch-3)', 'var(--swatch-7)', 'var(--swatch-12)'];
const railCol = (f: any, i: number) => f.color || RAIL[i % RAIL.length];

/* where a rail leaves the plot: its far end in nutrient units */
function railEnd(f: any, xm: number, ym: number): [number, number] | null {
  const fx = num(f.x, 0), fy = num(f.y, 0);
  if (!(fx > 0) && !(fy > 0)) return null;
  const t = Math.min(fx > 0 ? xm / fx : Infinity, fy > 0 ? ym / fy : Infinity);
  return [fx * t, fy * t];
}

/* a single response-surface value on 0 to 1, used for the colour bar and the labels */
function peakPoints(d: any, level: number, xm: number, ym: number): [number, number][] {
  const ox = num(d.ox, xm / 2), oy = num(d.oy, ym / 2), sx = Math.max(1e-6, num(d.sx, xm * 0.2)), sy = Math.max(1e-6, num(d.sy, ym * 0.2));
  const rho = Math.max(-0.95, Math.min(0.95, num(d.rho, 0))), r = Math.sqrt(-2 * Math.log(level));
  const out: [number, number][] = [];
  for (let k = 0; k < 90; k++) {
    const t = k / 90 * Math.PI * 2, z1 = r * Math.cos(t), z2 = r * Math.sin(t);
    out.push([ox + sx * z1, oy + sy * (rho * z1 + Math.sqrt(1 - rho * rho) * z2)]);
  }
  return out;
}

function NutriSheet({ data }: { data: any }) {
  const out: any[] = []; let n = 0; const k = () => 'g' + n++;
  const xm = Math.max(1e-6, num(data.xmax, 100)), ym = Math.max(1e-6, num(data.ymax, 100));
  const X = (v: number) => L + v / xm * PW, Y = (v: number) => T + PH - v / ym * PH;
  const foods: any[] = data.foods || [], pts: any[] = data.points || [];
  const tg = data.target, strip = (v: string) => String(v).replace(/\s+(collected|intake|eaten|ingested)$/i, ''), nx = data.shortX || strip(data.nameX || 'Nutrient X'), ny = data.shortY || strip(data.nameY || 'Nutrient Y');
  const nxx = data.nameX || 'Nutrient X', nyy = data.nameY || 'Nutrient Y';
  const ink = (kind: string) => ({ fontSize: num(data.text && data.text[kind + 'Size'], NaN) || undefined } as any);
  const poly = (ps: [number, number][]) => ps.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
  const lev = Math.max(1, Math.min(9, Math.round(num(data.levels, 4))));
  const surf = data.surface === 'peak' || data.surface === 'gradient' ? data.surface : 'none';
  const style = data.surfStyle || 'both';

  /* 1. response surface, clipped to the plot */
  if (surf !== 'none') {
    out.push(<clipPath key={k()} id="ng-clip"><rect x={L} y={T} width={PW} height={PH} /></clipPath>);
    const g: any[] = [];
    if (style !== 'lines') g.push(<rect key={k()} x={L} y={T} width={PW} height={PH} style={{ fill: viridis(0.5 / (lev + 1)) }} />);
    if (surf === 'peak') {
      for (let j = 1; j <= lev; j++) {
        const l = j / (lev + 1), ps = peakPoints(data, l, xm, ym);
        if (style !== 'lines') g.push(<polygon key={k()} points={poly(ps)} style={{ fill: viridis((j + 0.5) / (lev + 1)) }} />);
        if (style !== 'bands') g.push(<polygon key={k()} className={"ng-contour" + (style === 'lines' ? ' ng-contour-ink' : '')} points={poly(ps)} />);
      }
    } else {
      const w = Math.max(0, Math.min(1, num(data.gradW, 0.5))), nn = [w, 1 - w], nl = nn[0] * nn[0] + nn[1] * nn[1], dd = [-nn[1], nn[0]];
      const P = (u: number[]): string => X(u[0] * xm).toFixed(1) + ',' + Y(u[1] * ym).toFixed(1);
      for (let j = 1; j <= lev; j++) {
        const l = j / (lev + 1), p0 = [l * nn[0] / nl, l * nn[1] / nl], a = [p0[0] - 20 * dd[0], p0[1] - 20 * dd[1]], b = [p0[0] + 20 * dd[0], p0[1] + 20 * dd[1]];
        if (style !== 'lines') g.push(<polygon key={k()} points={[a, b, [b[0] + 20 * nn[0], b[1] + 20 * nn[1]], [a[0] + 20 * nn[0], a[1] + 20 * nn[1]]].map(P).join(' ')} style={{ fill: viridis((j + 0.5) / (lev + 1)) }} />);
        if (style !== 'bands') g.push(<polyline key={k()} className={"ng-contour" + (style === 'lines' ? ' ng-contour-ink' : '')} points={[a, b].map(P).join(' ')} />);
      }
    }
    out.push(<g key={k()} clipPath="url(#ng-clip)" className="ng-surface" style={{ opacity: style === 'lines' ? 1 : num(data.surfOpacity, 0.55) }}>{g}</g>);
    if (data.contourLabels !== false && style !== 'bands' && surf === 'peak') for (let j = 1; j <= lev; j++) {
      const l = j / (lev + 1), q = peakPoints(data, l, xm, ym)[11];
      if (q[0] >= 0 && q[0] <= xm && q[1] >= 0 && q[1] <= ym) out.push(<text key={k()} className="ng-clabel" x={X(q[0])} y={Y(q[1]) + 4} textAnchor="middle">{+l.toFixed(2)}</text>);
    }
  }

  /* 2. zones of deficit and excess around the target */
  if (tg && data.zones) {
    const tx = X(num(tg.x, 0)), ty = Y(num(tg.y, 0)), z = (x: number, y: number, w: number, h: number, c: string, lab: string, ax: number, ay: number) => {
      out.push(<rect key={k()} className="ng-zone" x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} style={{ fill: c }} />);
      out.push(<text key={k()} className="ng-zlabel" x={ax} y={ay} textAnchor="middle">{lab}</text>);
    };
    z(tx, T, L + PW - tx, ty - T, 'var(--swatch-11)', 'Excess of both', (tx + L + PW) / 2, T + 18);
    z(L, ty, tx - L, T + PH - ty, 'var(--swatch-2)', 'Deficit of both', (L + tx) / 2, T + PH - 10);
    z(L, T, tx - L, ty - T, 'var(--swatch-8)', 'Deficit ' + nx + ', excess ' + ny, (L + tx) / 2, T + 18);
    z(tx, ty, L + PW - tx, T + PH - ty, 'var(--swatch-8)', 'Excess ' + nx + ', deficit ' + ny, (tx + L + PW) / 2, T + PH - 10);
  }

  /* 3. axes and ticks */
  if (data.ticks) {
    const xs = niceStep(xm, 6), ys = niceStep(ym, 6);
    for (let v = 0; v <= xm + 1e-9; v += xs) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={X(r)} y1={T + PH} x2={X(r)} y2={T + PH + 5} /><text x={X(r)} y={T + PH + 19} textAnchor="middle">{r}</text></g>); }
    for (let v = 0; v <= ym + 1e-9; v += ys) { const r = +v.toPrecision(10); out.push(<g key={k()} className="km-tick"><line x1={L - 5} y1={Y(r)} x2={L} y2={Y(r)} /><text x={L - 9} y={Y(r) + 4} textAnchor="end">{r}</text></g>); }
  }
  out.push(<polyline key={k()} className="km-frame" points={[[L, T], [L, T + PH], [L + PW, T + PH]].map(p => p.join(',')).join(' ')} />);
  if (data.frame) out.push(<rect key={k()} className="km-frame" x={L} y={T} width={PW} height={PH} />);
  const xt = nxx + (data.unit ? ' (' + data.unit + ')' : ''), yt = nyy + (data.unit ? ' (' + data.unit + ')' : '');
  out.push(<text key={k()} className="km-title" x={L + PW / 2} y={T + PH + (data.ticks ? 46 : 34)} textAnchor="middle" style={ink('axis')}>{xt}</text>);
  out.push(<text key={k()} className="km-title" x={30} y={T + PH / 2} textAnchor="middle" transform={'rotate(-90 30 ' + (T + PH / 2) + ')'} style={ink('axis')}>{yt}</text>);

  /* 4. guides through the target, equal-energy line */
  if (tg && data.guides) {
    out.push(<line key={k()} className="ng-guide" x1={L} y1={Y(num(tg.y, 0))} x2={L + PW} y2={Y(num(tg.y, 0))} />);
    out.push(<line key={k()} className="ng-guide" x1={X(num(tg.x, 0))} y1={T} x2={X(num(tg.x, 0))} y2={T + PH} />);
  }
  if (tg && data.energyLine) {
    const S0 = num(tg.x, 0) + num(tg.y, 0), x1 = Math.max(0, S0 - ym), x2 = Math.min(xm, S0);
    if (x2 > x1) {
      out.push(<line key={k()} className="ng-energy" x1={X(x1)} y1={Y(S0 - x1)} x2={X(x2)} y2={Y(S0 - x2)} />);
      if (data.energyLabel) out.push(<text key={k()} className="km-note" x={X(x2) - 6} y={Y(S0 - x2) - 8} textAnchor="end">{data.energyLabel}</text>);
    }
  }

  /* 5. rails */
  foods.forEach((f, i) => {
    const e = railEnd(f, xm, ym); if (!e) return;
    const c = railCol(f, i), x2 = X(e[0]), y2 = Y(e[1]);
    out.push(<line key={k()} className="ng-rail" x1={X(0)} y1={Y(0)} x2={x2} y2={y2} style={{ stroke: c }} />);
    if (f.label && data.railLabels !== false) {
      const ang = Math.atan2(y2 - Y(0), x2 - X(0)) * 180 / Math.PI, mx = X(0) + (x2 - X(0)) * 0.97, my = Y(0) + (y2 - Y(0)) * 0.97;
      out.push(<text key={k()} className="ng-rlabel" textAnchor="end" transform={'translate(' + mx.toFixed(1) + ' ' + my.toFixed(1) + ') rotate(' + ang.toFixed(1) + ') translate(-4 -6)'} style={ink('rail')}>{f.label}</text>);
    }
    if (tg && data.railMarks) {
      const fx = num(f.x, 0), fy = num(f.y, 0), tx = num(tg.x, 0), ty = num(tg.y, 0), q: [number, number][] = [];
      if (fx > 0) q.push([tx, tx * fy / fx]); if (fy > 0) q.push([ty * fx / fy, ty]);
      q.filter(p => p[0] >= 0 && p[0] <= xm + 1e-9 && p[1] >= 0 && p[1] <= ym + 1e-9).forEach(p => out.push(<circle key={k()} className="ng-mark" cx={X(p[0])} cy={Y(p[1])} r={5} style={{ stroke: c }} />));
    }
  });

  /* 6. feeding path: each meal moves along its food's rail */
  const meals: any[] = data.meals || [], path: [number, number][] = [[0, 0]];
  meals.forEach(m => { const f = foods.find(q => q.label === m.food), a = num(m.amount, 0), last = path[path.length - 1]; if (f && a > 0) path.push([last[0] + a * num(f.x, 0) / 100, last[1] + a * num(f.y, 0) / 100]); });
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], x1 = X(a[0]), y1 = Y(a[1]), x2 = X(b[0]), y2 = Y(b[1]), ang = Math.atan2(y2 - y1, x2 - x1), s = 9;
    const bx = x2 - Math.cos(ang) * 1, by = y2 - Math.sin(ang) * 1;
    out.push(<line key={k()} className="ng-path" x1={x1} y1={y1} x2={bx - Math.cos(ang) * s * 0.8} y2={by - Math.sin(ang) * s * 0.8} />);
    out.push(<polygon key={k()} className="ng-arrow" points={[[bx, by], [bx - s * Math.cos(ang - 0.4), by - s * Math.sin(ang - 0.4)], [bx - s * Math.cos(ang + 0.4), by - s * Math.sin(ang + 0.4)]].map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')} />);
  }
  if (data.stepDots) for (let i = 1; i < path.length; i++) out.push(<g key={k()}><circle className="ng-step" cx={X(path[i][0])} cy={Y(path[i][1])} r={8} /><text className="ng-steptxt" x={X(path[i][0])} y={Y(path[i][1]) + 3.6} textAnchor="middle">{i}</text></g>);
  if (data.origin !== false) out.push(<circle key={k()} className="ng-origin" cx={X(0)} cy={Y(0)} r={9} />);

  /* 7. marked intakes with their gaps to the target */
  const ext = (key: string, sg: number) => { let bi = -1, bv = 0; pts.forEach((q, j) => { const v = (num(q[key], 0) - num(tg && tg[key], 0)) * sg; if (v > bv + 1e-9) { bv = v; bi = j; } }); return bi; };
  const exX = [ext('x', 1), ext('x', -1)], exY = [ext('y', 1), ext('y', -1)];
  pts.forEach((p, i) => {
    const px = X(num(p.x, 0)), py = Y(num(p.y, 0));
    if (tg && data.gaps) {
      const tx = X(num(tg.x, 0)), ty = Y(num(tg.y, 0)), dx = num(p.x, 0) - num(tg.x, 0), dy = num(p.y, 0) - num(tg.y, 0), c = 'var(--swatch-11)';
      const sx = Math.sign(dx), sy = Math.sign(dy);
      if (Math.abs(px - tx) > 3) {
        out.push(<line key={k()} className="ng-gap" x1={tx} y1={ty} x2={px - sx * 3} y2={ty} />);
        if (exX[dx > 0 ? 0 : 1] === i) out.push(<text key={k()} className="ng-glabel" x={(tx + px) / 2} y={ty - 7} textAnchor="middle" style={{ fill: c }}>{(dx > 0 ? 'Excess ' : 'Deficit ') + nx}</text>);
      }
      if (Math.abs(py - ty) > 3) {
        out.push(<line key={k()} className="ng-gap" x1={tx} y1={ty} x2={tx} y2={py - sy * 3} />);
        if (exY[dy > 0 ? 0 : 1] === i) out.push(<text key={k()} className="ng-glabel" x={tx - 7} y={(ty + py) / 2 + 4} textAnchor="end" style={{ fill: c }}>{(dy > 0 ? 'Excess ' : 'Deficit ') + ny}</text>);
      }
    }
    out.push(<Fragment key={k()}><circle className="ng-pt" cx={px} cy={py} r={num(data.pointSize, 7)} style={{ fill: p.color || 'var(--ink)' }} />
      {p.label && data.pointLabels !== false ? <text className="ng-plabel" x={px + 11} y={py + 14} style={ink('point')}>{p.label}</text> : null}</Fragment>);
  });

  /* 8. intake target: bullseye */
  if (tg) {
    const cx = X(num(tg.x, 0)), cy = Y(num(tg.y, 0)), c = tg.color || 'var(--swatch-11)';
    out.push(<g key={k()} className="ng-target"><circle cx={cx} cy={cy} r={16} style={{ stroke: c, fill: 'var(--paper)' }} /><circle cx={cx} cy={cy} r={10} style={{ stroke: c, fill: 'var(--paper)' }} /><circle cx={cx} cy={cy} r={4} style={{ fill: c, stroke: c }} /></g>);
    if (tg.label) out.push(<text key={k()} className="ng-tlabel" x={cx + 22} y={cy - 12} style={{ fill: c, ...ink('target') }}>{tg.label}</text>);
  }

  /* 9. colour bar for the surface */
  if (surf !== 'none' && data.legend !== false) {
    const lx = L + PW + 28;
    out.push(<text key={k()} className="ng-ltitle" x={lx} y={T + 4}>{data.surfName || 'Performance'}</text>);
    for (let i = 0; i < 40; i++) out.push(<rect key={k()} x={lx} y={T + 14 + (39 - i) * 3.5} width={12} height={3.7} style={{ fill: viridis(i / 39) }} />);
    [0, 0.5, 1].forEach(f => out.push(<text key={k()} className="km-note" x={lx + 18} y={T + 14 + (1 - f) * 136.5 + 4}>{f}</text>));
  }
  return <g className="ng">{out}</g>;
}

function Overlay({ data, set, sel, setSel, toSvg }: EditProps & { toSvg: any }) {
  const xm = Math.max(1e-6, num(data.xmax, 100)), ym = Math.max(1e-6, num(data.ymax, 100));
  const back = (at: [number, number]) => [sig(Math.max(0, Math.min(xm, (at[0] - L) / PW * xm))), sig(Math.max(0, Math.min(ym, (T + PH - at[1]) / PH * ym)))];
  const pts: any[] = data.points || [], tg = data.target;
  return <>
    {tg ? <circle className={'mk-hit' + (sel && sel.kind === 'target' ? ' mk-on' : '')} cx={L + num(tg.x, 0) / xm * PW} cy={T + PH - num(tg.y, 0) / ym * PH} r={20}
      onPointerDown={e => { setSel({ kind: 'target', id: '0' }); startDrag(e, toSvg, (_dx, _dy, at) => { const [x, y] = back(at); set({ target: { ...tg, x, y } }, 'ng-tg'); }); }} /> : null}
    {pts.map((p, i) => <circle key={i} className={'mk-hit' + (sel && sel.kind === 'pt' && sel.id === String(i) ? ' mk-on' : '')} cx={L + num(p.x, 0) / xm * PW} cy={T + PH - num(p.y, 0) / ym * PH} r={13}
      onPointerDown={e => { setSel({ kind: 'pt', id: String(i) }); startDrag(e, toSvg, (_dx, _dy, at) => { const [x, y] = back(at); set({ points: pts.map((q: any, j: number) => j === i ? { ...q, x, y } : q) }, 'ng-pt-' + i); }); }} />)}
  </>;
}

function Controls({ data, set, sel, setSel }: EditProps) {
  const foods: any[] = data.foods || [], pts: any[] = data.points || [], tg = data.target, i = sel && sel.kind === 'pt' ? +sel.id : -1, p = pts[i];
  const surf = data.surface === 'peak' || data.surface === 'gradient' ? data.surface : 'none';
  const nx = data.nameX || 'X', ny = data.nameY || 'Y', xm = num(data.xmax, 100), ym = num(data.ymax, 100);
  const upTg = (patch: any, key?: string) => set({ target: { ...tg, ...patch } }, key);
  const upPt = (patch: any, key?: string) => set({ points: pts.map((x: any, j: number) => j === i ? { ...x, ...patch } : x) }, key);
  return (
    <>
      {p ? (
        <S.Panel kicker="Selected intake" help="Drag it on the sheet, or type the amounts of each nutrient.">
          <TextIn id="ng-plab" label="Label" value={p.label} onChange={v => upPt({ label: v }, 'ng-pl')} />
          <div className="mk-pair"><TextIn id="ng-px" label={nx} value={p.x} onChange={v => upPt({ x: v }, 'ng-px')} /><TextIn id="ng-py" label={ny} value={p.y} onChange={v => upPt({ y: v }, 'ng-py')} /></div>
          <Swatches label="Colour" value={p.color} none="Ink" onChange={v => upPt({ color: v })} />
          <S.ToolButton onClick={() => { set({ points: pts.filter((_: any, j: number) => j !== i) }); setSel(null); }}>Delete intake</S.ToolButton>
        </S.Panel>
      ) : null}
      <S.Panel kicker="Nutrients" help="Both axes are amounts of a nutrient collected. Use the same unit on both axes if you show an equal-energy line.">
        <div className="mk-pair"><TextIn id="ng-nx" label="Horizontal axis" value={data.nameX} placeholder="Nutrient X collected" onChange={v => set({ nameX: v }, 'ng-nx')} /><TextIn id="ng-ny" label="Vertical axis" value={data.nameY} placeholder="Nutrient Y collected" onChange={v => set({ nameY: v }, 'ng-ny')} /></div>
        <div className="mk-pair"><TextIn id="ng-sx2" label="Short name, horizontal" value={data.shortX} placeholder="used in labels" onChange={v => set({ shortX: v }, 'ng-sx2')} /><TextIn id="ng-sy2" label="Short name, vertical" value={data.shortY} placeholder="used in labels" onChange={v => set({ shortY: v }, 'ng-sy2')} /></div>
        <TextIn id="ng-unit" label="Unit (optional)" value={data.unit} placeholder="e.g. g or kJ" onChange={v => set({ unit: v }, 'ng-unit')} />
        <div className="mk-pair"><TextIn id="ng-xm" label="Horizontal maximum" value={data.xmax} onChange={v => set({ xmax: v }, 'ng-xm')} /><TextIn id="ng-ym" label="Vertical maximum" value={data.ymax} onChange={v => set({ ymax: v }, 'ng-ym')} /></div>
        <Toggle on={!!data.ticks} label="Number the axes (off for a conceptual figure)" onChange={v => set({ ticks: v })} />
      </S.Panel>
      <Rows id="ng-foods" kicker="Foods (rails)" help="Nutrient content per 100 g of each food. Only the ratio sets the rail's slope; the amounts set how far each gram of food moves the animal."
        rows={foods} cols={[{ key: 'label', label: 'Food', w: '1.3fr' }, { key: 'x', label: nx.slice(0, 8), type: 'num', w: '0.6fr' }, { key: 'y', label: ny.slice(0, 8), type: 'num', w: '0.6fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ label: 'Food ' + (foods.length + 1), x: 50, y: 50 })} addLabel="+ Add food" onChange={(rows, key) => set({ foods: rows }, key)} />
      <Rows id="ng-meals" kicker="Feeding path" help="Meals in order. Each one moves along its food's rail by amount × content per 100 g. Pick the food by its name, so rename foods before choosing them." rows={data.meals || []}
        cols={[{ key: 'food', label: 'Food', type: 'select', options: foods.map(f => [f.label, f.label] as [any, string]), w: '1.4fr' }, { key: 'amount', label: 'Amount (g)', type: 'num', w: '0.7fr' }]}
        blank={() => ({ food: foods[0] ? foods[0].label : '', amount: 50 })} addLabel="+ Add meal" onChange={(rows, key) => set({ meals: rows }, key)} />
      <S.Panel kicker="Intake target" help="The amounts of both nutrients the animal is aiming for. Drag the bullseye on the sheet.">
        <Toggle on={!!tg} label="Show intake target" onChange={v => set({ target: v ? { x: xm / 2, y: ym / 2, label: 'Intake target' } : undefined })} />
        {tg ? <>
          <TextIn id="ng-tl" label="Label" value={tg.label} onChange={v => upTg({ label: v }, 'ng-tl')} />
          <div className="mk-pair"><TextIn id="ng-tx" label={nx} value={tg.x} onChange={v => upTg({ x: v }, 'ng-tx')} /><TextIn id="ng-ty" label={ny} value={tg.y} onChange={v => upTg({ y: v }, 'ng-ty')} /></div>
          <Toggle on={!!data.guides} label="Dashed guides through the target" onChange={v => set({ guides: v })} />
          <Toggle on={!!data.railMarks} label="Mark where each rail crosses the guides" onChange={v => set({ railMarks: v })} />
          <Toggle on={!!data.zones} label="Shade deficit and excess zones" onChange={v => set({ zones: v })} />
          <Toggle on={!!data.energyLine} label="Equal-energy line through the target" onChange={v => set({ energyLine: v })} />
          {data.energyLine ? <TextIn id="ng-el" label="Equal-energy line label" value={data.energyLabel} placeholder="e.g. Constant kJ" onChange={v => set({ energyLabel: v }, 'ng-el')} /> : null}
        </> : null}
      </S.Panel>
      <Rows id="ng-pts" kicker="Marked intakes" help="Points where an animal or diet ended up. With gaps switched on, each one shows its excess or deficit of each nutrient against the target." rows={pts}
        cols={[{ key: 'label', label: 'Label', w: '1.3fr' }, { key: 'x', label: nx.slice(0, 8), type: 'num', w: '0.6fr' }, { key: 'y', label: ny.slice(0, 8), type: 'num', w: '0.6fr' }, { key: 'color', label: 'Colour', type: 'color' }]}
        blank={() => ({ label: 'Intake ' + (pts.length + 1), x: xm / 2, y: ym / 2 })} addLabel="+ Add intake" onChange={(rows, key) => set({ points: rows }, key)} />
      <S.Panel kicker="Performance landscape" help="A response surface over nutrient space, for growth, reproduction, lifespan or any other performance measure scaled 0 to 1.">
        <Seg wrap value={surf} options={[['none', 'None'], ['peak', 'Peak (optimum)'], ['gradient', 'Gradient (more is better)']]} onChange={v => set({ surface: v })} />
        {surf !== 'none' ? <>
          <Seg value={data.surfStyle || 'both'} options={[['bands', 'Colour'], ['lines', 'Contours'], ['both', 'Both']]} onChange={v => set({ surfStyle: v })} />
          <TextIn id="ng-sn" label="Measure name" value={data.surfName} placeholder="Performance" onChange={v => set({ surfName: v }, 'ng-sn')} />
          <Range id="ng-lev" label="Contour levels" value={num(data.levels, 4)} min={2} max={9} onChange={v => set({ levels: v }, 'ng-lev')} />
          {surf === 'peak' ? <>
            <div className="mk-pair"><TextIn id="ng-ox" label={'Optimum ' + nx} value={data.ox} placeholder={String(xm / 2)} onChange={v => set({ ox: v }, 'ng-ox')} /><TextIn id="ng-oy" label={'Optimum ' + ny} value={data.oy} placeholder={String(ym / 2)} onChange={v => set({ oy: v }, 'ng-oy')} /></div>
            <Range id="ng-sx" label="Width along horizontal axis" value={num(data.sx, xm * 0.2)} min={xm * 0.05} max={xm * 0.6} step={xm / 200} onChange={v => set({ sx: v }, 'ng-sx')} />
            <Range id="ng-sy" label="Width along vertical axis" value={num(data.sy, ym * 0.2)} min={ym * 0.05} max={ym * 0.6} step={ym / 200} onChange={v => set({ sy: v }, 'ng-sy')} />
            <Range id="ng-rho" label="Tilt (correlation)" value={num(data.rho, 0)} min={-0.9} max={0.9} step={0.05} onChange={v => set({ rho: v }, 'ng-rho')} />
            <Toggle on={data.contourLabels !== false} label="Label contour values" onChange={v => set({ contourLabels: v })} />
          </> : <Range id="ng-gw" label="Weight of horizontal nutrient" value={num(data.gradW, 0.5)} min={0} max={1} step={0.05} onChange={v => set({ gradW: v }, 'ng-gw')} />}
          <Range id="ng-op" label="Colour strength" value={num(data.surfOpacity, 0.55)} min={0.15} max={1} step={0.05} onChange={v => set({ surfOpacity: v }, 'ng-op')} />
          <Toggle on={data.legend !== false} label="Colour bar" onChange={v => set({ legend: v })} />
        </> : null}
      </S.Panel>
      <S.Panel kicker="Look">
        <Toggle on={data.railLabels !== false} label="Rail labels" onChange={v => set({ railLabels: v })} />
        <Toggle on={data.pointLabels !== false} label="Intake labels" onChange={v => set({ pointLabels: v })} />
        <Toggle on={!!data.gaps} label="Deficit and excess arrows from the target to each intake" onChange={v => set({ gaps: v })} />
        <Toggle on={!!data.stepDots} label="Number the feeding steps" onChange={v => set({ stepDots: v })} />
        <Toggle on={data.origin !== false} label="Open circle at the origin" onChange={v => set({ origin: v })} />
        <Toggle on={!!data.frame} label="Box around the plot" onChange={v => set({ frame: v })} />
        <Range id="ng-psz" label="Intake point size" value={num(data.pointSize, 7)} min={3} max={14} onChange={v => set({ pointSize: v }, 'ng-psz')} />
      </S.Panel>
    </>
  );
}

const F2 = (label: string, x: number, y: number, color?: string) => ({ label, x, y, color });
const CONC = { nameX: 'Nutrient X collected', nameY: 'Nutrient Y collected', unit: '', xmax: 100, ymax: 100, ticks: false, origin: true };

export const nutrigeo: EditorDef = {
  id: 'nutritional-geometry', num: '50', name: 'Nutritional geometry', field: 'Nutrition science',
  blurb: 'Nutrient space for nutritional ecology: food rails, an intake target, feeding paths, deficit and excess, and performance landscapes.',
  hint: 'Drag the bullseye or a marked intake to move it. Foods, meals and the landscape are set in the sidebar.',
  templates: [
    { name: 'One balanced food', desc: 'A food whose nutrient ratio matches the target', title: 'Eating a single balanced food',
      caption: 'The rail is the food\'s nutrient ratio. Eating moves the animal along the rail; a balanced food runs straight through the intake target.',
      data: { ...CONC, foods: [F2('Balanced food', 50, 50, 'var(--swatch-11)')], meals: [{ food: 'Balanced food', amount: 110 }], target: { x: 55, y: 55, label: 'Intake target' }, points: [] } },
    { name: 'Mixing two foods', desc: 'Two imbalanced foods that together reach the target', title: 'Mixing two complementary foods',
      caption: 'Neither food lies on the target. Switching between a food low in X:Y and a food high in X:Y moves the animal along a zigzag path to the target.',
      data: { ...CONC, foods: [F2('Imbalanced food, low X:Y', 12, 88, 'var(--swatch-2)'), F2('Imbalanced food, high X:Y', 90, 10, 'var(--swatch-5)')],
        meals: [{ food: 'Imbalanced food, high X:Y', amount: 30 }, { food: 'Imbalanced food, low X:Y', amount: 40 }, { food: 'Imbalanced food, high X:Y', amount: 25 }, { food: 'Imbalanced food, low X:Y', amount: 18 }],
        target: { x: 56, y: 56, label: '' }, points: [] } },
    { name: 'Compromise on one food', desc: 'Over-ingest one nutrient or under-ingest the other', title: 'Compromising between overingesting X and underingesting Y',
      caption: 'Confined to one imbalanced food, the animal can match X and fall short of Y (1), eat the amount that balances the two errors (2), or match Y and overeat X (3).',
      data: { nameX: 'Nutrient X collected', nameY: 'Nutrient Y collected', unit: '', xmax: 140, ymax: 45, ticks: false, origin: true, gaps: true, pointLabels: false,
        foods: [F2('', 80, 20, 'var(--swatch-5)')], meals: [], target: { x: 40, y: 30, label: '' },
        points: [{ label: '1', x: 40, y: 10 }, { label: '2', x: 80, y: 20 }, { label: '3', x: 120, y: 30 }] } },
    { name: 'Rules of compromise', desc: 'Many rails, with the point where each crosses the target guides', title: 'Global rules of compromise',
      caption: 'Each rail is a food with a different X:Y ratio. Open circles show where a food would match Y (horizontal guide) or match X (vertical guide), and so how much of the other nutrient it forces the animal to over- or under-eat.',
      data: { ...CONC, guides: true, railMarks: true, railLabels: false,
        foods: [F2('Low X:Y', 20, 80, 'var(--swatch-16)'), F2('', 33, 67, 'var(--swatch-2)'), F2('', 43, 57, 'var(--swatch-3)'), F2('Balanced', 50, 50, 'var(--swatch-11)'), F2('', 57, 43, 'var(--swatch-6)'), F2('', 67, 33, 'var(--swatch-5)'), F2('High X:Y', 80, 20, 'var(--swatch-4)')],
        meals: [], target: { x: 45, y: 45, label: '' }, points: [] } },
    { name: 'Protein vs fat + carbohydrate', desc: 'Energy-scaled axes, equal-energy line and deficit zones', title: 'Navigating to a protein-to-nonprotein energy target',
      caption: 'Energy from protein (horizontal) against energy from fat and carbohydrate (vertical). The diagonal is a constant total energy intake; the shaded zones show deficit and excess of each energy source around the regulatory target.',
      data: { nameX: 'Protein energy intake', nameY: 'Fat and carbohydrate energy intake', unit: 'kJ', xmax: 3000, ymax: 12000, ticks: true, origin: true, zones: true, energyLine: true, shortX: 'protein', shortY: 'fat + carbohydrate', energyLabel: 'Constant energy', pointLabels: true,
        foods: [F2('Low P:(F+C) food', 60, 940, 'var(--swatch-2)'), F2('High P:(F+C) food', 700, 500, 'var(--swatch-5)')],
        meals: [{ food: 'Low P:(F+C) food', amount: 300 }, { food: 'High P:(F+C) food', amount: 70 }, { food: 'Low P:(F+C) food', amount: 300 }, { food: 'High P:(F+C) food', amount: 73 }, { food: 'Low P:(F+C) food', amount: 228 }],
        target: { x: 1500, y: 8500, label: 'P:(F+C) regulatory target' }, points: [] } },
    { name: 'Performance landscape (peak)', desc: 'A performance optimum with food rails and sampled intakes', title: 'Performance landscape across nutrient space',
      caption: 'Contours show a performance measure (scaled 0 to 1, for example growth rate) across the nutrient space. Each rail is a diet of fixed nutrient ratio, and the coloured dots are intakes sampled on it.',
      data: { ...CONC, surface: 'peak', surfStyle: 'both', levels: 4, ox: 58, oy: 50, sx: 22, sy: 18, rho: 0.35, surfName: 'Performance', gaps: false, railLabels: false,
        foods: [F2('', 20, 80, 'var(--swatch-2)'), F2('', 40, 60, 'var(--swatch-3)'), F2('', 50, 50, 'var(--swatch-11)'), F2('', 62, 38, 'var(--swatch-6)'), F2('', 80, 20, 'var(--swatch-5)')],
        meals: [], target: undefined,
        points: [['', 18, 72, 'var(--swatch-2)'], ['', 32, 48, 'var(--swatch-3)'], ['', 52, 52, 'var(--swatch-11)'], ['', 66, 40, 'var(--swatch-6)'], ['', 90, 40, 'var(--swatch-5)']].map(([label, x, y, color]) => ({ label, x, y, color })) } },
    { name: 'Performance landscape (gradient)', desc: 'Performance rises with both nutrients', title: 'Performance rising with intake of both nutrients',
      caption: 'A surface with no interior optimum: performance increases with the amount of either nutrient collected.',
      data: { ...CONC, surface: 'gradient', surfStyle: 'bands', levels: 6, gradW: 0.5, surfName: 'Performance', foods: [F2('', 25, 75, 'var(--ink)'), F2('', 75, 25, 'var(--ink)')], railLabels: false, meals: [], target: undefined, points: [] } },
  ],
  blank: { ...CONC, foods: [F2('Food 1', 25, 75, 'var(--swatch-2)'), F2('Food 2', 75, 25, 'var(--swatch-5)')], meals: [], target: { x: 50, y: 50, label: 'Intake target' }, points: [] },
  stats: d => [[(d.foods || []).length, 'foods'], [(d.meals || []).length, 'meals']],
  Controls, Overlay,
  Render: ({ data }) => <NutriSheet data={data} />,
  findText: (d, text) => { const i = (d.points || []).findIndex((p: any) => p.label && p.label === text.trim()); return i >= 0 ? { kind: 'pt', id: String(i) } : (d.target && d.target.label && d.target.label === text.trim() ? { kind: 'target', id: '0' } : null); },
  remove: (d, sel) => sel.kind === 'pt' ? { points: d.points.filter((_: any, j: number) => j !== +sel.id) } : sel.kind === 'target' ? { target: undefined } : null,
  duplicate: (d, sel) => { const p = sel.kind === 'pt' && d.points[+sel.id]; return p ? { patch: { points: [...d.points, { ...p, label: p.label ? p.label + ' (copy)' : '' }] }, sel: { kind: 'pt', id: String(d.points.length) } } : null; },
  nudge: (d, sel, dx, dy) => {
    const xm = Math.max(1e-6, num(d.xmax, 100)), ym = Math.max(1e-6, num(d.ymax, 100)), mv = (o: any) => ({ x: sig(Math.max(0, Math.min(xm, num(o.x, 0) + dx / PW * xm))), y: sig(Math.max(0, Math.min(ym, num(o.y, 0) - dy / PH * ym))) });
    if (sel.kind === 'target' && d.target) return { target: { ...d.target, ...mv(d.target) } };
    if (sel.kind === 'pt' && d.points[+sel.id]) return { points: d.points.map((o: any, j: number) => j === +sel.id ? { ...o, ...mv(o) } : o) };
    return null;
  },
};
