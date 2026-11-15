/*
 * SDCalib: standard (calibration) curves for the editor (43).
 * Models: 'linear' (y = a + b x), 'log' (y = a + b log10 x, the usual qPCR and semi-log fit) and '4pl'
 * (y = d + (a - d) / (1 + (x / c)^b), fitted by Levenberg-Marquardt with c and b kept positive).
 * Unknowns are read back through the inverse of the fitted curve. For the straight-line models the
 * 95% interval for a single new reading uses the classical inverse-prediction standard error.
 */
(function (root) {
  "use strict";
  var SD = root.SDCalib = root.SDCalib || {};

  function clean(pts, model) {
    return pts.filter(function (p) { return isFinite(p[0]) && isFinite(p[1]) && (model === 'linear' ? true : p[0] > 0); });
  }

  function solve(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); }), i, j, k;
    for (i = 0; i < n; i++) {
      var p = i; for (j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
      var t = M[i]; M[i] = M[p]; M[p] = t;
      if (Math.abs(M[i][i]) < 1e-300) return null;
      for (j = i + 1; j < n; j++) { var f = M[j][i] / M[i][i]; for (k = i; k <= n; k++) M[j][k] -= f * M[i][k]; }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) { var s = M[i][n]; for (j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
    return x;
  }

  function fourPL(q, x) { return q[3] + (q[0] - q[3]) / (1 + Math.pow(x / Math.exp(q[2]), Math.exp(q[1]))); }

  function fit4(pts) {
    var s = pts.slice().sort(function (a, b) { return a[0] - b[0]; }), n = s.length; if (n < 5) return null;
    var k = Math.max(1, Math.floor(n / 4)), lo = 0, hi = 0, i;
    for (i = 0; i < k; i++) { lo += s[i][1]; hi += s[n - 1 - i][1]; } lo /= k; hi /= k;
    if (lo === hi) return null;
    var xm = s[Math.floor(n / 2)][0], q = [lo, 0, Math.log(xm), hi];
    var sse = function (p) { var e = 0; for (var i = 0; i < n; i++) { var d = s[i][1] - fourPL(p, s[i][0]); e += d * d; } return e; };
    var cur = sse(q), lam = 1e-2, it;
    for (it = 0; it < 400; it++) {
      var J = [], r = [], j;
      for (i = 0; i < n; i++) {
        var row = [], base = fourPL(q, s[i][0]);
        for (j = 0; j < 4; j++) { var h = 1e-6 * Math.max(1, Math.abs(q[j])), qq = q.slice(); qq[j] += h; row.push((fourPL(qq, s[i][0]) - base) / h); }
        J.push(row); r.push(s[i][1] - base);
      }
      var A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], g = [0, 0, 0, 0], a, b;
      for (i = 0; i < n; i++) for (a = 0; a < 4; a++) { g[a] += J[i][a] * r[i]; for (b = 0; b < 4; b++) A[a][b] += J[i][a] * J[i][b]; }
      var improved = false, tries;
      for (tries = 0; tries < 30; tries++) {
        var Ad = A.map(function (row, ri) { return row.map(function (v, ci) { return ri === ci ? v * (1 + lam) + 1e-12 : v; }); }), dq = solve(Ad, g);
        if (dq) { var nq = q.map(function (v, ii) { return v + dq[ii]; }), e = sse(nq); if (isFinite(e) && e <= cur) { var rel = cur - e; q = nq; cur = e; lam = Math.max(lam / 10, 1e-12); improved = rel > 1e-15 * (1 + cur); break; } }
        lam *= 10;
      }
      if (!improved) break;
    }
    return { q: q, sse: cur };
  }

  /* pts: [[x, y], ...]. Returns null when the model cannot be fitted. */
  function fit(pts, model) {
    pts = clean(pts, model); var n = pts.length;
    if (model === '4pl') {
      var f4 = fit4(pts); if (!f4) return null;
      var q = f4.q, a = q[0], b = Math.exp(q[1]), c = Math.exp(q[2]), d = q[3], my = 0; pts.forEach(function (p) { my += p[1]; }); my /= n;
      var sst = 0; pts.forEach(function (p) { sst += Math.pow(p[1] - my, 2); });
      var lo = Math.min(a, d), hi = Math.max(a, d);
      return {
        model: model, n: n, params: { a: a, b: b, c: c, d: d }, r2: sst > 0 ? 1 - f4.sse / sst : 1, rmse: Math.sqrt(f4.sse / Math.max(1, n - 4)), pts: pts,
        predict: function (x) { return d + (a - d) / (1 + Math.pow(x / c, b)); },
        invert: function (y) { if (!(y > lo && y < hi)) return NaN; return c * Math.pow((a - d) / (y - d) - 1, 1 / b); }
      };
    }
    var tr = model === 'log' ? function (x) { return Math.log(x) / Math.LN10; } : function (x) { return x; };
    var lin = root.SDReg.linear(pts.map(function (p) { return [tr(p[0]), p[1]]; })); if (!lin) return null;
    var inv = model === 'log' ? function (v) { return Math.pow(10, v); } : function (v) { return v; };
    var ybar = lin.my;
    return {
      model: model, n: n, params: { a: lin.intercept, b: lin.slope }, r2: lin.r2, rmse: lin.s, pts: pts, lin: lin,
      efficiency: model === 'log' && lin.slope < 0 ? Math.pow(10, -1 / lin.slope) - 1 : NaN,
      predict: function (x) { return lin.intercept + lin.slope * tr(x); },
      invert: function (y) { if (lin.slope === 0) return NaN; var v = (y - lin.intercept) / lin.slope; return inv(v); },
      /* 95% interval for the x of one new reading y */
      invertCI: function (y) {
        if (lin.slope === 0) return null;
        var x0 = (y - lin.intercept) / lin.slope, se = lin.s / Math.abs(lin.slope) * Math.sqrt(1 + 1 / lin.n + Math.pow(y - ybar, 2) / (lin.slope * lin.slope * lin.sxx));
        return [inv(x0 - lin.t * se), inv(x0 + lin.t * se)];
      }
    };
  }

  SD.fit = fit; SD.fourPL = fourPL;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
