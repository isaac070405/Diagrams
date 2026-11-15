/*
 * SDPCA: principal component analysis for the PCA plot editor (46).
 * Eigen decomposition of the covariance (or correlation) matrix by the cyclic Jacobi method.
 * Scores are the centred (and optionally scaled) data times the eigenvectors. Loadings are eigenvectors times
 * the square root of the eigenvalue, which are the correlations with the components when the data are scaled.
 */
(function (root) {
  "use strict";
  var SD = root.SDPCA = root.SDPCA || {};

  /* symmetric matrix -> { values (descending), vectors (columns, same order) } */
  function jacobi(A0) {
    var n = A0.length, a = A0.map(function (r) { return r.slice(); }), V = [], i, j, k, sweep;
    for (i = 0; i < n; i++) { V.push(new Array(n).fill(0)); V[i][i] = 1; }
    for (sweep = 0; sweep < 100; sweep++) {
      var off = 0; for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-26) break;
      for (var p = 0; p < n - 1; p++) for (var q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        var th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (k = 0; k < n; k++) { var akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (k = 0; k < n; k++) { var apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (k = 0; k < n; k++) { var vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    var idx = a.map(function (r, i) { return i; }).sort(function (x, y) { return a[y][y] - a[x][x]; });
    return { values: idx.map(function (i) { return a[i][i]; }), vectors: V.map(function (row) { return idx.map(function (j) { return row[j]; }); }) };
  }

  /* rows: array of numeric arrays (observations by variables). Rows with a missing value are dropped. */
  function run(rows, scale) {
    var X = [], keep = [];
    rows.forEach(function (r, i) { if (r.every(isFinite)) { X.push(r.slice()); keep.push(i); } });
    var n = X.length, p = n ? X[0].length : 0, i, j, k;
    if (n < 3 || p < 2) return null;
    var mean = new Array(p).fill(0), sd = new Array(p).fill(1);
    for (j = 0; j < p; j++) { for (i = 0; i < n; i++) mean[j] += X[i][j]; mean[j] /= n; }
    for (j = 0; j < p; j++) { var ss = 0; for (i = 0; i < n; i++) ss += Math.pow(X[i][j] - mean[j], 2); sd[j] = Math.sqrt(ss / (n - 1)); }
    var Z = X.map(function (r) { return r.map(function (v, j) { var c = v - mean[j]; return scale ? (sd[j] > 0 ? c / sd[j] : 0) : c; }); });
    var C = []; for (j = 0; j < p; j++) { C.push([]); for (k = 0; k < p; k++) { var s = 0; for (i = 0; i < n; i++) s += Z[i][j] * Z[i][k]; C[j].push(s / (n - 1)); } }
    var e = jacobi(C), m = Math.min(p, n - 1), vals = e.values.slice(0, m).map(function (v) { return Math.max(0, v); });
    var vec = e.vectors.map(function (row) { return row.slice(0, m); });
    /* sign: the largest loading of each component is positive, so results do not flip between runs */
    for (k = 0; k < m; k++) { var big = 0, bj = 0; for (j = 0; j < p; j++) if (Math.abs(vec[j][k]) > big) { big = Math.abs(vec[j][k]); bj = j; } if (vec[bj][k] < 0) for (j = 0; j < p; j++) vec[j][k] = -vec[j][k]; }
    var total = 0; for (j = 0; j < p; j++) total += C[j][j];
    var scores = Z.map(function (z) { var out = []; for (k = 0; k < m; k++) { var s = 0; for (j = 0; j < p; j++) s += z[j] * vec[j][k]; out.push(s); } return out; });
    var loadings = vec.map(function (row) { return row.map(function (v, k) { return v * Math.sqrt(vals[k]); }); });
    return { n: n, p: p, keep: keep, values: vals, share: vals.map(function (v) { return v / total; }), vectors: vec, scores: scores, loadings: loadings, total: total };
  }

  /* points on the confidence ellipse of a bivariate sample (level 0.95 by default) */
  function ellipse(pts, level, steps) {
    var n = pts.length; if (n < 3) return null;
    var mx = 0, my = 0; pts.forEach(function (p) { mx += p[0]; my += p[1]; }); mx /= n; my /= n;
    var sxx = 0, syy = 0, sxy = 0; pts.forEach(function (p) { sxx += Math.pow(p[0] - mx, 2); syy += Math.pow(p[1] - my, 2); sxy += (p[0] - mx) * (p[1] - my); });
    sxx /= n - 1; syy /= n - 1; sxy /= n - 1;
    var e = jacobi([[sxx, sxy], [sxy, syy]]), q = -2 * Math.log(1 - (level || 0.95)), out = [], N = steps || 60;
    for (var i = 0; i < N; i++) {
      var t = 2 * Math.PI * i / N, a = Math.sqrt(q * Math.max(0, e.values[0])) * Math.cos(t), b = Math.sqrt(q * Math.max(0, e.values[1])) * Math.sin(t);
      out.push([mx + a * e.vectors[0][0] + b * e.vectors[0][1], my + a * e.vectors[1][0] + b * e.vectors[1][1]]);
    }
    return { points: out, mean: [mx, my] };
  }

  SD.jacobi = jacobi; SD.run = run; SD.ellipse = ellipse;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
