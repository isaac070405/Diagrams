/*
 * SDVolcano: parsing, Benjamini-Hochberg adjustment and classification for the volcano plot editor (36).
 * Rows are "name, log2 fold change, p value" separated by commas, tabs, semicolons or spaces.
 */
(function (root) {
  "use strict";
  var SD = root.SDVolcano = root.SDVolcano || {};

  /* a line such as "GENE1, 1.8, 0.0003"; header lines and bad rows are skipped */
  function parse(text) {
    var rows = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var f = line.trim().split(/[,\t;]+|\s{2,}/).map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
      if (f.length < 3) f = line.trim().split(/\s+/);
      if (f.length < 3) return;
      var fc = parseFloat(f[f.length - 2]), p = parseFloat(f[f.length - 1]);
      if (!isFinite(fc) || !isFinite(p) || p < 0 || p > 1) return;
      rows.push({ name: f.slice(0, f.length - 2).join(' '), fc: fc, p: p });
    });
    return rows;
  }

  /* BH adjusted p values (q values), in the order of the input */
  function bh(ps) {
    var m = ps.length, idx = ps.map(function (p, i) { return i; }).sort(function (a, b) { return ps[a] - ps[b]; }), q = new Array(m), prev = 1, k;
    for (k = m - 1; k >= 0; k--) { var i = idx[k], v = Math.min(prev, ps[i] * m / (k + 1)); q[i] = Math.min(1, v); prev = q[i]; }
    return q;
  }

  /* adds q, y (-log10 of the chosen p, capped) and cls ('up', 'down' or 'ns') to each row */
  function classify(rows, fcT, pT, useQ) {
    var q = bh(rows.map(function (r) { return r.p; })), fin = 0, i;
    var vals = rows.map(function (r, j) { return useQ ? q[j] : r.p; });
    vals.forEach(function (v) { if (v > 0) fin = Math.max(fin, -Math.log(v) / Math.LN10); });
    var cap = fin > 0 ? fin * 1.05 + 0.5 : 5;
    return rows.map(function (r, j) {
      var v = vals[j], y = v > 0 ? -Math.log(v) / Math.LN10 : cap, sig = v < pT && Math.abs(r.fc) >= fcT;
      return { name: r.name, fc: r.fc, p: r.p, q: q[j], y: y, cls: sig ? (r.fc > 0 ? 'up' : 'down') : 'ns' };
    });
  }

  SD.parse = parse; SD.bh = bh; SD.classify = classify;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
