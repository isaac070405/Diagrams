/*
 * SDRare: rarefaction and species accumulation for the editor (47).
 * hurlbert: the exact expected number of species in a random subsample of n individuals (Hurlbert 1971),
 *   E[S_n] = sum over species of 1 - C(N - Ni, n) / C(N, n), computed as a stable product.
 * accumulate: sample-based accumulation, the mean and 95% interval of richness over random orders of the samples.
 * chao1: the bias-corrected lower bound on total richness from singletons and doubletons.
 */
(function (root) {
  "use strict";
  var SD = root.SDRare = root.SDRare || {};

  function positive(counts) { return counts.map(parseFloat).filter(function (v) { return isFinite(v) && v > 0; }).map(Math.round).filter(function (v) { return v > 0; }); }

  function hurlbert(counts, n) {
    var c = positive(counts), N = 0, i; c.forEach(function (v) { N += v; });
    if (!N || n < 1) return 0;
    if (n >= N) return c.length;
    var e = 0;
    for (i = 0; i < c.length; i++) {
      if (N - c[i] < n) { e += 1; continue; }
      var prod = 1; for (var j = 0; j < n; j++) prod *= (N - c[i] - j) / (N - j);
      e += 1 - prod;
    }
    return e;
  }
  /* expected richness at about `points` sample sizes from 1 to N, always including N */
  function curve(counts, points) {
    var c = positive(counts), N = 0; c.forEach(function (v) { N += v; });
    if (!N) return [];
    var m = Math.min(points || 60, N), ns = [];
    for (var i = 0; i < m; i++) { var n = Math.max(1, Math.round(1 + (N - 1) * i / Math.max(1, m - 1))); if (!ns.length || ns[ns.length - 1] !== n) ns.push(n); }
    return ns.map(function (n) { return [n, hurlbert(c, n)]; });
  }

  function chao1(counts) {
    var c = positive(counts), f1 = 0, f2 = 0;
    c.forEach(function (v) { if (v === 1) f1++; else if (v === 2) f2++; });
    return { observed: c.length, f1: f1, f2: f2, estimate: c.length + f1 * (f1 - 1) / (2 * (f2 + 1)) };
  }

  function rng(seed) { var s = seed || 1; return function () { s = (s * 1664525 + 1013904223) % 4294967296; return (s + 1) / 4294967297; }; }

  /* samples: array of count arrays (one per sample, species in the same columns) */
  function accumulate(samples, perms, seed) {
    var m = samples.length; if (m < 2) return null;
    var S = samples[0].length, u = rng(seed), P = perms || 200, curves = [], p, i, j;
    for (p = 0; p < P; p++) {
      var order = samples.map(function (_, k) { return k; });
      for (i = m - 1; i > 0; i--) { j = Math.floor(u() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
      var seen = new Array(S).fill(false), rich = 0, row = [];
      for (i = 0; i < m; i++) { var smp = samples[order[i]]; for (j = 0; j < S; j++) if (!seen[j] && parseFloat(smp[j]) > 0) { seen[j] = true; rich++; } row.push(rich); }
      curves.push(row);
    }
    var out = [];
    for (i = 0; i < m; i++) {
      var col = curves.map(function (r) { return r[i]; }).sort(function (a, b) { return a - b; }), mean = 0; col.forEach(function (v) { mean += v; }); mean /= P;
      out.push({ n: i + 1, mean: mean, lo: col[Math.floor(0.025 * (P - 1))], hi: col[Math.ceil(0.975 * (P - 1))] });
    }
    return out;
  }

  SD.hurlbert = hurlbert; SD.curve = curve; SD.chao1 = chao1; SD.accumulate = accumulate; SD.positive = positive;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
