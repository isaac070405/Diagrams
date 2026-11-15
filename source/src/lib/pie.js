/*
 * SDPie: slice angles and arc paths for the pie and donut chart editor (45).
 * Angles are in radians, 0 at the top and increasing clockwise. Values at or below 0 are dropped.
 */
(function (root) {
  "use strict";
  var SD = root.SDPie = root.SDPie || {};

  /* items: [{ value }] -> [{ index, value, frac, a0, a1 }] */
  function slices(items, startDeg, sort) {
    var tot = 0, rows = [];
    items.forEach(function (it, i) { var v = parseFloat(it.value); if (isFinite(v) && v > 0) { tot += v; rows.push({ index: i, value: v }); } });
    if (sort) rows.sort(function (a, b) { return b.value - a.value || a.index - b.index; });
    var a = (startDeg || 0) * Math.PI / 180;
    rows.forEach(function (r) { r.frac = r.value / tot; r.a0 = a; a += 2 * Math.PI * r.frac; r.a1 = a; });
    return rows;
  }
  function pt(cx, cy, r, a) { return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; }
  /* SVG path for a ring segment (r0 = 0 gives a pie wedge). A full circle is drawn as two halves. */
  function arc(cx, cy, r0, r1, a0, a1) {
    var f = function (v) { return v.toFixed(2); };
    if (a1 - a0 >= 2 * Math.PI - 1e-9) a1 = a0 + 2 * Math.PI - 1e-6;
    var big = a1 - a0 > Math.PI ? 1 : 0, p0 = pt(cx, cy, r1, a0), p1 = pt(cx, cy, r1, a1);
    if (r0 <= 0) return 'M' + f(cx) + ' ' + f(cy) + 'L' + f(p0[0]) + ' ' + f(p0[1]) + 'A' + f(r1) + ' ' + f(r1) + ' 0 ' + big + ' 1 ' + f(p1[0]) + ' ' + f(p1[1]) + 'Z';
    var q1 = pt(cx, cy, r0, a1), q0 = pt(cx, cy, r0, a0);
    return 'M' + f(p0[0]) + ' ' + f(p0[1]) + 'A' + f(r1) + ' ' + f(r1) + ' 0 ' + big + ' 1 ' + f(p1[0]) + ' ' + f(p1[1]) + 'L' + f(q1[0]) + ' ' + f(q1[1]) + 'A' + f(r0) + ' ' + f(r0) + ' 0 ' + big + ' 0 ' + f(q0[0]) + ' ' + f(q0[1]) + 'Z';
  }

  SD.slices = slices; SD.arc = arc; SD.point = pt;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
