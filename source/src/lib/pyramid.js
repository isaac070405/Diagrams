/*
 * SDPyramid: age-sex tables for the population pyramid editor (50).
 * Rows are "age group, males, females". Age groups such as "0-4", "15-19" or "85+" are read as a lower age and a
 * width (to the next integer after the upper age). Median age is interpolated within the group that holds the
 * middle person. Dependency ratios use under 15 and 65 and over against ages 15 to 64 when the groups line up.
 */
(function (root) {
  "use strict";
  var SD = root.SDPyramid = root.SDPyramid || {};

  /* "0-4" -> { lo: 0, hi: 5 }, "85+" -> { lo: 85, hi: Infinity }, "<1" -> { lo: 0, hi: 1 }; null when unreadable */
  function ageRange(label) {
    var s = String(label).trim().replace(/[–—]/g, '-').replace(/\s*(years?|yrs?|y)\s*$/i, '');
    var m = s.match(/^(\d+)\s*\+$/); if (m) return { lo: +m[1], hi: Infinity };
    m = s.match(/^(\d+)\s*-\s*(\d+)$/); if (m && +m[2] >= +m[1]) return { lo: +m[1], hi: +m[2] + 1 };
    m = s.match(/^<\s*(\d+)$/); if (m) return { lo: 0, hi: +m[1] };
    m = s.match(/^(\d+)$/); if (m) return { lo: +m[1], hi: +m[1] + 1 };
    return null;
  }

  function parse(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var f = line.split(/[,\t;]+/).map(function (s) { return s.trim(); });
      if (f.length < 3) return;
      var m = parseFloat(f[f.length - 2].replace(/\s/g, '')), w = parseFloat(f[f.length - 1].replace(/\s/g, ''));
      if (!isFinite(m) || !isFinite(w) || m < 0 || w < 0) return;
      var label = f.slice(0, f.length - 2).join(' ');
      out.push({ label: label, male: m, female: w, range: ageRange(label) });
    });
    return out;
  }

  function summary(rows) {
    var M = 0, F = 0; rows.forEach(function (r) { M += r.male; F += r.female; });
    var N = M + F, res = { male: M, female: F, total: N, pctMale: N ? M / N * 100 : NaN, sexRatio: F ? M / F * 100 : NaN, median: NaN, young: NaN, old: NaN, total_dep: NaN };
    var ok = rows.length && rows.every(function (r) { return r.range; });
    if (!ok || !N) return res;
    var g = rows.map(function (r) { return { lo: r.range.lo, hi: r.range.hi, n: r.male + r.female }; }).sort(function (a, b) { return a.lo - b.lo; });
    var half = N / 2, cum = 0;
    for (var i = 0; i < g.length; i++) {
      if (cum + g[i].n >= half && g[i].n > 0) { var w = isFinite(g[i].hi) ? g[i].hi - g[i].lo : 0; res.median = g[i].lo + (isFinite(g[i].hi) ? (half - cum) / g[i].n * w : 0); break; }
      cum += g[i].n;
    }
    /* dependency ratios need group edges at 15 and 65 */
    var edges = {}; g.forEach(function (x) { edges[x.lo] = 1; if (isFinite(x.hi)) edges[x.hi] = 1; });
    if (edges[15] && edges[65]) {
      var y = 0, w2 = 0, o = 0; g.forEach(function (x) { if (x.hi <= 15) y += x.n; else if (x.lo >= 65) o += x.n; else if (x.lo >= 15 && x.hi <= 65) w2 += x.n; });
      if (w2 > 0) { res.young = y / w2 * 100; res.old = o / w2 * 100; res.total_dep = res.young + res.old; }
    }
    return res;
  }

  SD.ageRange = ageRange; SD.parse = parse; SD.summary = summary;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
