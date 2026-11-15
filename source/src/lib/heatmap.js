/*
 * SDHeat: matrix parsing, row scaling and hierarchical clustering for the heatmap editor (38).
 * Clustering is agglomerative (average, complete or single linkage) on Euclidean or 1 - Pearson distances.
 */
(function (root) {
  "use strict";
  var SD = root.SDHeat = root.SDHeat || {};

  /* a table with column names in the first row and row names in the first column; tabs, commas or semicolons */
  function parse(text) {
    var lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (lines.length < 2) return null;
    var sep = lines[0].indexOf('\t') >= 0 ? /\t/ : /[,;]/;
    var split = function (l) { return l.split(sep).map(function (s) { return s.trim(); }); };
    var head = split(lines[0]), cols = head.slice(1), rows = [];
    for (var i = 1; i < lines.length; i++) {
      var f = split(lines[i]); if (f.length < 2) continue;
      var vals = cols.map(function (c, j) { var v = parseFloat(f[j + 1]); return isFinite(v) ? v : NaN; });
      rows.push({ name: f[0], vals: vals });
    }
    return cols.length && rows.length ? { cols: cols, rows: rows } : null;
  }

  /* z-score each row (mean 0, SD 1) ignoring missing values; a flat row becomes 0 */
  function zRows(rows) {
    return rows.map(function (r) {
      var v = r.vals.filter(isFinite), n = v.length, m = 0, s = 0, i;
      for (i = 0; i < n; i++) m += v[i]; m = n ? m / n : 0;
      for (i = 0; i < n; i++) s += (v[i] - m) * (v[i] - m); s = n > 1 ? Math.sqrt(s / (n - 1)) : 0;
      return { name: r.name, vals: r.vals.map(function (x) { return isFinite(x) ? (s > 0 ? (x - m) / s : 0) : NaN; }) };
    });
  }

  function dist(a, b, kind) {
    var i, n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, d = 0;
    for (i = 0; i < a.length; i++) if (isFinite(a[i]) && isFinite(b[i])) { n++; sa += a[i]; sb += b[i]; saa += a[i] * a[i]; sbb += b[i] * b[i]; sab += a[i] * b[i]; d += (a[i] - b[i]) * (a[i] - b[i]); }
    if (!n) return 0;
    if (kind === 'corr') { var cov = sab - sa * sb / n, va = saa - sa * sa / n, vb = sbb - sb * sb / n; return va > 0 && vb > 0 ? 1 - cov / Math.sqrt(va * vb) : 1; }
    return Math.sqrt(d * a.length / n);
  }

  /* vectors: array of numeric arrays. Returns { order, tree } where tree nodes are { leaf } or { left, right, h }. */
  function cluster(vectors, kind, linkage) {
    var n = vectors.length, i, j;
    if (n === 0) return { order: [], tree: null };
    var nodes = vectors.map(function (v, k) { return { leaf: k, size: 1 }; }), D = [];
    for (i = 0; i < n; i++) { D.push([]); for (j = 0; j < n; j++) D[i].push(i === j ? 0 : dist(vectors[i], vectors[j], kind)); }
    var active = nodes.map(function (x, k) { return k; });
    while (active.length > 1) {
      var bi = 0, bj = 1, best = Infinity;
      for (i = 0; i < active.length; i++) for (j = i + 1; j < active.length; j++) { var d = D[active[i]][active[j]]; if (d < best - 1e-12) { best = d; bi = i; bj = j; } }
      var a = active[bi], b = active[bj], na = nodes[a].size, nb = nodes[b].size;
      var merged = { left: nodes[a], right: nodes[b], h: Math.max(0, best), size: na + nb };
      /* the merged cluster reuses slot a; distances follow the linkage */
      for (i = 0; i < active.length; i++) {
        var k = active[i]; if (k === a || k === b) continue;
        var da = D[a][k], db = D[b][k], nd = linkage === 'complete' ? Math.max(da, db) : linkage === 'single' ? Math.min(da, db) : (da * na + db * nb) / (na + nb);
        D[a][k] = D[k][a] = nd;
      }
      nodes[a] = merged; active.splice(bj, 1);
    }
    var tree = nodes[active[0]], order = [];
    (function walk(t) { if (t.leaf !== undefined) order.push(t.leaf); else { walk(t.left); walk(t.right); } })(tree);
    return { order: order, tree: tree };
  }

  SD.parse = parse; SD.zRows = zRows; SD.dist = dist; SD.cluster = cluster;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
