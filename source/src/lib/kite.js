/*
 * SDKite: maths for the belt transect and kite diagram editor (26).
 * A kite is drawn symmetrically about a baseline: at each quadrat the full width equals the count,
 * so half the count sits above the line and half below. Quadrats with a count of 0 pinch to the line.
 */
(function (root) {
  "use strict";
  var SD = root.SDKite = root.SDKite || {};

  /* [x, half width] pairs along the transect, sorted by distance; counts below 0 or not numbers read as 0 */
  function outline(xs, counts) {
    var pts = xs.map(function (x, i) { var c = parseFloat(counts[i]); return [x, isFinite(c) && c > 0 ? c / 2 : 0]; });
    return pts.filter(function (p) { return isFinite(p[0]); }).sort(function (a, b) { return a[0] - b[0]; });
  }
  /* closed polygon as [x, offset] points: upper edge left to right, then lower edge right to left */
  function polygon(xs, counts) {
    var o = outline(xs, counts);
    return o.map(function (p) { return [p[0], -p[1]]; }).concat(o.slice().reverse().map(function (p) { return [p[0], p[1]]; }));
  }
  function area(poly) { var a = 0; for (var k = 0; k < poly.length; k++) { var q = poly[(k + 1) % poly.length]; a += poly[k][0] * q[1] - q[0] * poly[k][1]; } return Math.abs(a) / 2; }

  function total(counts) { return counts.reduce(function (s, c) { c = parseFloat(c); return s + (isFinite(c) && c > 0 ? c : 0); }, 0); }
  /* Shannon index H' = -sum p ln p over species with a count above 0 */
  function shannon(counts) {
    var N = total(counts), h = 0;
    counts.forEach(function (c) { c = parseFloat(c); if (c > 0) { var p = c / N; h -= p * Math.log(p); } });
    return N > 0 ? h : 0;
  }
  /* Simpson's index of diversity 1 - D, D = sum n(n-1) / N(N-1) */
  function simpson(counts) {
    var N = total(counts); if (N < 2) return 0;
    var d = 0; counts.forEach(function (c) { c = parseFloat(c); if (c > 0) d += c * (c - 1); });
    return 1 - d / (N * (N - 1));
  }
  /* Pielou evenness J = H' / ln S */
  function evenness(counts) {
    var s = counts.filter(function (c) { return parseFloat(c) > 0; }).length;
    return s > 1 ? shannon(counts) / Math.log(s) : 0;
  }
  function density(count, areaM2) { return areaM2 > 0 ? count / areaM2 : 0; }
  /* a scale-bar length of 1, 2, 5, 10 ... units that fits under max */
  function scaleBar(max) {
    if (!(max > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(max))), f = max / p;
    return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
  }
  /* y positions for dots in a quadrat drawing: n points on a loose grid, deterministic from a seed */
  function dots(n, seed, cols) {
    var out = [], s = seed >>> 0 || 1;
    function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    var c = cols || Math.max(1, Math.ceil(Math.sqrt(n))), r = Math.max(1, Math.ceil(n / c));
    for (var k = 0; k < n; k++) out.push([((k % c) + 0.25 + 0.5 * rnd()) / c, (Math.floor(k / c) + 0.25 + 0.5 * rnd()) / r]);
    return out;
  }

  SD.outline = outline; SD.polygon = polygon; SD.area = area; SD.total = total; SD.shannon = shannon;
  SD.simpson = simpson; SD.evenness = evenness; SD.density = density; SD.scaleBar = scaleBar; SD.dots = dots;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
