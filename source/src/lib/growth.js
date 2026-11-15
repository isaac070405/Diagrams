/*
 * SDGrowth: growth curve fitting for the editor (48).
 * Models: 'vb' von Bertalanffy L = Linf (1 - exp(-K (t - t0))), 'gompertz' L = Linf exp(-exp(-K (t - ti))),
 * 'logistic' L = Linf / (1 + exp(-K (t - ti))). Fitted by Levenberg-Marquardt from several starting values.
 * Standard errors come from the Jacobian, the confidence band for the curve from the delta method,
 * and AIC = n ln(SSE / n) + 2 (k + 1) lets the models be compared on the same data.
 */
(function (root) {
  "use strict";
  var SD = root.SDGrowth = root.SDGrowth || {};

  var MODELS = {
    vb: function (q, t) { return q[0] * (1 - Math.exp(-q[1] * (t - q[2]))); },
    gompertz: function (q, t) { return q[0] * Math.exp(-Math.exp(-q[1] * (t - q[2]))); },
    logistic: function (q, t) { return q[0] / (1 + Math.exp(-q[1] * (t - q[2]))); }
  };

  function solve(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); }), i, j, k;
    for (i = 0; i < n; i++) {
      var p = i; for (j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
      var t = M[i]; M[i] = M[p]; M[p] = t; if (Math.abs(M[i][i]) < 1e-300) return null;
      for (j = i + 1; j < n; j++) { var f = M[j][i] / M[i][i]; for (k = i; k <= n; k++) M[j][k] -= f * M[i][k]; }
    }
    var x = new Array(n); for (i = n - 1; i >= 0; i--) { var s = M[i][n]; for (j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; } return x;
  }
  function jac(f, q, t) { var base = f(q, t), out = []; for (var j = 0; j < q.length; j++) { var h = 1e-6 * Math.max(1, Math.abs(q[j])), qq = q.slice(); qq[j] += h; out.push((f(qq, t) - base) / h); } return out; }

  function lm(f, q0, pts) {
    var q = q0.slice(), n = pts.length, k = q.length, lam = 1e-2, i, a, b;
    var sse = function (p) { var e = 0; for (var i = 0; i < n; i++) { var d = pts[i][1] - f(p, pts[i][0]); e += d * d; } return e; };
    var cur = sse(q); if (!isFinite(cur)) return null;
    for (var it = 0; it < 300; it++) {
      var A = [], g = new Array(k).fill(0); for (a = 0; a < k; a++) A.push(new Array(k).fill(0));
      for (i = 0; i < n; i++) { var J = jac(f, q, pts[i][0]), r = pts[i][1] - f(q, pts[i][0]); for (a = 0; a < k; a++) { g[a] += J[a] * r; for (b = 0; b < k; b++) A[a][b] += J[a] * J[b]; } }
      var improved = false;
      for (var tries = 0; tries < 30; tries++) {
        var Ad = A.map(function (row, ri) { return row.map(function (v, ci) { return ri === ci ? v * (1 + lam) + 1e-12 : v; }); }), dq = solve(Ad, g);
        if (dq) { var nq = q.map(function (v, ii) { return v + dq[ii]; }); if (nq[0] > 0 && nq[1] > 0) { var e = sse(nq); if (isFinite(e) && e <= cur) { var rel = cur - e; q = nq; cur = e; lam = Math.max(lam / 10, 1e-12); improved = rel > 1e-15 * (1 + cur); break; } } }
        lam *= 10;
      }
      if (!improved) break;
    }
    return { q: q, sse: cur };
  }

  /* pts: [[age, size], ...] */
  function fit(pts, model) {
    pts = pts.filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
    var n = pts.length, f = MODELS[model]; if (!f || n < 5) return null;
    var ts = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var tmin = Math.min.apply(null, ts), tmax = Math.max.apply(null, ts), range = tmax - tmin, ymax = Math.max.apply(null, ys);
    if (!(range > 0) || !(ymax > 0)) return null;
    var best = null, Ks = [0.4, 1.2, 3.5], Ls = [1.05, 1.4];
    Ks.forEach(function (c) { Ls.forEach(function (lm_) {
      var q0 = model === 'vb' ? [ymax * lm_, c / range, tmin - 0.25 * range] : [ymax * lm_, c * 2 / range, tmin + 0.5 * range];
      var r = lm(f, q0, pts); if (r && (!best || r.sse < best.sse)) best = r;
    }); });
    if (!best) return null;
    var q = best.q, k = 3, df = n - k, s2 = best.sse / df, JtJ = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], i, a, b;
    pts.forEach(function (p) { var J = jac(f, q, p[0]); for (a = 0; a < 3; a++) for (b = 0; b < 3; b++) JtJ[a][b] += J[a] * J[b]; });
    var cov = null, inv = [];
    for (a = 0; a < 3; a++) { var e = [0, 0, 0]; e[a] = 1; var col = solve(JtJ, e); if (!col) { inv = null; break; } inv.push(col); }
    if (inv) cov = inv.map(function (row) { return row.map(function (v) { return v * s2; }); });
    var my = 0; ys.forEach(function (v) { my += v; }); my /= n; var sst = 0; ys.forEach(function (v) { sst += Math.pow(v - my, 2); });
    var se = cov ? [Math.sqrt(Math.max(0, cov[0][0])), Math.sqrt(Math.max(0, cov[1][1])), Math.sqrt(Math.max(0, cov[2][2]))] : [NaN, NaN, NaN];
    var tc = df > 0 ? root.SDSpecial.tCrit(df, 0.05) : NaN;
    return {
      model: model, n: n, q: q, se: se, df: df, sse: best.sse, rmse: Math.sqrt(s2), r2: sst > 0 ? 1 - best.sse / sst : 1,
      aic: n * Math.log(Math.max(best.sse, 1e-300) / n) + 2 * (k + 1), t: tc,
      predict: function (t) { return f(q, t); },
      /* 95% confidence half-width of the curve at t, by the delta method */
      half: function (t) { if (!cov) return NaN; var g = jac(f, q, t), v = 0; for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) v += g[a] * cov[a][b] * g[b]; return tc * Math.sqrt(Math.max(0, v)); },
      /* growth performance index, log10 K + 2 log10 Linf (von Bertalanffy) */
      phi: Math.log(q[1]) / Math.LN10 + 2 * Math.log(q[0]) / Math.LN10
    };
  }

  SD.fit = fit; SD.MODELS = MODELS;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
