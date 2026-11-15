/*
 * SDSurvival: Kaplan-Meier estimate, Greenwood confidence limits, median and the log-rank test (31).
 * A subject is { t: time, e: 1 for the event or 0 for censored }. Confidence limits use the log-log transform.
 */
(function (root) {
  "use strict";
  var SD = root.SDSurvival = root.SDSurvival || {};
  var Z = 1.959963984540054;

  function clean(subs) {
    return subs.map(function (s) { return { t: parseFloat(s.t), e: s.e ? 1 : 0 }; })
      .filter(function (s) { return isFinite(s.t) && s.t >= 0; })
      .sort(function (a, b) { return a.t - b.t || b.e - a.e; });
  }

  /* steps at each time with an event: { t, s, lo, hi, n (at risk), d (events) }, plus censor marks { t, s } and the median */
  function km(subs) {
    var xs = clean(subs), n = xs.length, i = 0, S = 1, gw = 0, steps = [], cens = [];
    var atRisk = n;
    while (i < xs.length) {
      var t = xs[i].t, d = 0, c = 0, j = i;
      while (j < xs.length && xs[j].t === t) { if (xs[j].e) d++; else c++; j++; }
      if (d > 0) {
        S *= 1 - d / atRisk;
        if (atRisk > d) gw += d / (atRisk * (atRisk - d));
        var lo = S, hi = S;
        if (S > 0 && S < 1 && gw > 0) { var se = Math.sqrt(gw) / Math.abs(Math.log(S)); lo = Math.pow(S, Math.exp(Z * se)); hi = Math.pow(S, Math.exp(-Z * se)); }
        steps.push({ t: t, s: S, lo: lo, hi: hi, n: atRisk, d: d });
      }
      if (c > 0) cens.push({ t: t, s: S, c: c });
      atRisk -= d + c; i = j;
    }
    var median = null;
    for (i = 0; i < steps.length; i++) if (steps[i].s <= 0.5) { median = steps[i].t; break; }
    return { steps: steps, cens: cens, n: n, events: steps.reduce(function (a, s) { return a + s.d; }, 0), median: median };
  }

  /* S(t) from the steps: 1 before the first event */
  function at(steps, t) {
    var s = 1; for (var i = 0; i < steps.length && steps[i].t <= t; i++) s = steps[i].s; return s;
  }
  /* subjects still under observation at time t (time >= t) */
  function atRisk(subs, t) { return clean(subs).filter(function (s) { return s.t >= t; }).length; }

  /* solve A x = b by Gaussian elimination with partial pivoting */
  function solve(A, b) {
    var n = b.length, i, j, k, M = A.map(function (r, ri) { return r.concat([b[ri]]); });
    for (i = 0; i < n; i++) {
      var p = i; for (j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
      var tmp = M[i]; M[i] = M[p]; M[p] = tmp;
      if (Math.abs(M[i][i]) < 1e-12) return null;
      for (j = i + 1; j < n; j++) { var f = M[j][i] / M[i][i]; for (k = i; k <= n; k++) M[j][k] -= f * M[i][k]; }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) { var s = M[i][n]; for (j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
    return x;
  }

  /* log-rank test across 2 or more groups: { chi2, df, p, observed, expected } */
  function logrank(groups) {
    var G = groups.map(clean), k = G.length, times = [], i, g;
    if (k < 2) return null;
    G.forEach(function (xs) { xs.forEach(function (s) { if (s.e && times.indexOf(s.t) < 0) times.push(s.t); }); });
    times.sort(function (a, b) { return a - b; });
    var O = new Array(k).fill(0), E = new Array(k).fill(0), V = [], j;
    for (i = 0; i < k; i++) V.push(new Array(k).fill(0));
    times.forEach(function (t) {
      var n = [], d = [], N = 0, D = 0;
      for (g = 0; g < k; g++) {
        var ng = G[g].filter(function (s) { return s.t >= t; }).length, dg = G[g].filter(function (s) { return s.t === t && s.e; }).length;
        n.push(ng); d.push(dg); N += ng; D += dg;
      }
      if (N < 2) return;
      for (g = 0; g < k; g++) { O[g] += d[g]; E[g] += D * n[g] / N; }
      var f = D * (N - D) / (N * N * (N - 1));
      for (i = 0; i < k; i++) for (j = 0; j < k; j++) V[i][j] += f * n[i] * ((i === j ? N : 0) - n[j]);
    });
    var u = [], A = [];
    for (i = 0; i < k - 1; i++) { u.push(O[i] - E[i]); A.push(V[i].slice(0, k - 1)); }
    var x = solve(A, u), chi2 = 0;
    if (!x) return { chi2: 0, df: k - 1, p: 1, observed: O, expected: E };
    for (i = 0; i < k - 1; i++) chi2 += u[i] * x[i];
    var p = root.SDSpecial ? root.SDSpecial.chi2p(chi2, k - 1) : NaN;
    return { chi2: chi2, df: k - 1, p: p, observed: O, expected: E };
  }

  SD.km = km; SD.at = at; SD.atRisk = atRisk; SD.logrank = logrank;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
