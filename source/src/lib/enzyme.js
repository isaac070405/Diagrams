/*
 * SDEnz: Michaelis-Menten kinetics for the enzyme kinetics editor (41).
 * fit: nonlinear least squares for v = Vmax S / (Km + S) by Levenberg-Marquardt, with standard errors from
 * the Jacobian and t-based 95% intervals. The three straight-line transforms (Lineweaver-Burk, Eadie-Hofstee,
 * Hanes-Woolf) give quick estimates for comparison; they weight the points unevenly, so the nonlinear fit is preferred.
 */
(function (root) {
  "use strict";
  var SD = root.SDEnz = root.SDEnz || {};

  function clean(S, v) {
    var out = [];
    for (var i = 0; i < S.length; i++) { var s = parseFloat(S[i]), y = parseFloat(v[i]); if (isFinite(s) && isFinite(y) && s > 0) out.push([s, y]); }
    return out;
  }
  function sse(pts, V, K) { var e = 0; for (var i = 0; i < pts.length; i++) e += Math.pow(pts[i][1] - V * pts[i][0] / (K + pts[i][0]), 2); return e; }

  /* straight-line estimates from a transform: kind 'lb', 'eh' or 'hw' */
  function lineFit(pts, kind) {
    var xy = pts.filter(function (p) { return p[1] > 0; }).map(function (p) {
      var S = p[0], v = p[1];
      return kind === 'lb' ? [1 / S, 1 / v] : kind === 'eh' ? [v / S, v] : [S, S / v];
    });
    var f = root.SDReg.linear(xy); if (!f) return null;
    var V, K;
    if (kind === 'lb') { V = 1 / f.intercept; K = f.slope * V; }
    else if (kind === 'eh') { V = f.intercept; K = -f.slope; }
    else { V = 1 / f.slope; K = f.intercept * V; }
    return { Vmax: V, Km: K, slope: f.slope, intercept: f.intercept, r2: f.r2, line: f };
  }

  function fit(S, v) {
    var pts = clean(S, v), n = pts.length; if (n < 3) return null;
    var vmaxObs = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
    if (!(vmaxObs > 0)) return null;
    var V = vmaxObs * 1.2, K = pts.map(function (p) { return p[0]; }).sort(function (a, b) { return a - b; })[Math.floor(n / 2)];
    var lb = lineFit(pts, 'lb'); if (lb && lb.Vmax > 0 && lb.Km > 0 && isFinite(lb.Vmax) && isFinite(lb.Km)) { V = lb.Vmax; K = lb.Km; }
    var lam = 1e-3, cur = sse(pts, V, K), it, i;
    for (it = 0; it < 200; it++) {
      var a = 0, b = 0, c = 0, g1 = 0, g2 = 0;
      for (i = 0; i < n; i++) {
        var S0 = pts[i][0], d = K + S0, f1 = S0 / d, f2 = -V * S0 / (d * d), r = pts[i][1] - V * f1;
        a += f1 * f1; b += f1 * f2; c += f2 * f2; g1 += f1 * r; g2 += f2 * r;
      }
      var improved = false, tries;
      for (tries = 0; tries < 30; tries++) {
        var A = a * (1 + lam), C = c * (1 + lam), det = A * C - b * b; if (!(Math.abs(det) > 1e-300)) { lam *= 10; continue; }
        var dV = (C * g1 - b * g2) / det, dK = (A * g2 - b * g1) / det, nV = V + dV, nK = K + dK;
        if (nK > 0 && nV > 0) { var e = sse(pts, nV, nK); if (e <= cur) { var rel = Math.abs(cur - e); V = nV; K = nK; cur = e; lam = Math.max(lam / 10, 1e-12); improved = rel > 1e-14 * (1 + cur); break; } }
        lam *= 10;
      }
      if (!improved) break;
    }
    /* covariance (J'J)^-1 s^2 */
    var ja = 0, jb = 0, jc = 0;
    for (i = 0; i < n; i++) { var S1 = pts[i][0], dd = K + S1, q1 = S1 / dd, q2 = -V * S1 / (dd * dd); ja += q1 * q1; jb += q1 * q2; jc += q2 * q2; }
    var det2 = ja * jc - jb * jb, df = n - 2, s2 = cur / df, seV = NaN, seK = NaN;
    if (det2 > 0 && df > 0) { seV = Math.sqrt(s2 * jc / det2); seK = Math.sqrt(s2 * ja / det2); }
    var my = 0; pts.forEach(function (p) { my += p[1]; }); my /= n;
    var sst = 0; pts.forEach(function (p) { sst += Math.pow(p[1] - my, 2); });
    var t = df > 0 ? root.SDSpecial.tCrit(df, 0.05) : NaN;
    return {
      n: n, Vmax: V, Km: K, seVmax: seV, seKm: seK, df: df, sse: cur, r2: sst > 0 ? 1 - cur / sst : 1, rmse: Math.sqrt(s2),
      VmaxCI: [V - t * seV, V + t * seV], KmCI: [K - t * seK, K + t * seK], pts: pts
    };
  }

  SD.clean = clean; SD.fit = fit; SD.lineFit = lineFit;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
