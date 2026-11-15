/*
 * SDDiag: ROC curves (33) and Bland-Altman agreement statistics (34).
 * ROC: a case is called positive when its value is at or above the cutoff (flip the sign first when low values mean disease).
 * AUC by the trapezoid rule, which equals the Mann-Whitney statistic. Standard error from Hanley and McNeil (1982).
 */
(function (root) {
  "use strict";
  var SD = root.SDDiag = root.SDDiag || {};
  var Z = 1.959963984540054;

  function nums(a) { return a.map(parseFloat).filter(isFinite); }

  /* pos: values of cases, neg: values of non-cases. Returns the curve and summary. */
  function roc(pos, neg, flip) {
    pos = nums(pos); neg = nums(neg);
    if (flip) { pos = pos.map(function (v) { return -v; }); neg = neg.map(function (v) { return -v; }); }
    var n1 = pos.length, n0 = neg.length;
    if (!n1 || !n0) return null;
    var cuts = pos.concat(neg).sort(function (a, b) { return b - a; }).filter(function (v, i, a) { return !i || v !== a[i - 1]; });
    var pts = [{ fpr: 0, tpr: 0, cut: Infinity }], i, best = null;
    for (i = 0; i < cuts.length; i++) {
      var c = cuts[i], tp = pos.filter(function (v) { return v >= c; }).length, fp = neg.filter(function (v) { return v >= c; }).length;
      var pt = { fpr: fp / n0, tpr: tp / n1, cut: flip ? -c : c };
      pts.push(pt);
      var J = pt.tpr - pt.fpr;
      if (!best || J > best.J + 1e-12) best = { J: J, cut: pt.cut, sens: pt.tpr, spec: 1 - pt.fpr };
    }
    var auc = 0; for (i = 1; i < pts.length; i++) auc += (pts[i].fpr - pts[i - 1].fpr) * (pts[i].tpr + pts[i - 1].tpr) / 2;
    var q1 = auc / (2 - auc), q2 = 2 * auc * auc / (1 + auc);
    var se = Math.sqrt(Math.max(0, (auc * (1 - auc) + (n1 - 1) * (q1 - auc * auc) + (n0 - 1) * (q2 - auc * auc)) / (n1 * n0)));
    var se0 = Math.sqrt((n1 + n0 + 1) / (12 * n1 * n0)), z = (auc - 0.5) / se0;
    return {
      points: pts, auc: auc, se: se, lo: Math.max(0, auc - Z * se), hi: Math.min(1, auc + Z * se),
      p: root.SDSpecial ? root.SDSpecial.normalP2(z) : NaN, best: best, n1: n1, n0: n0
    };
  }

  /* pairs: [{ a, b }] from two methods. mode 'pct' expresses each difference as a percent of the pair mean. */
  function blandAltman(pairs, mode) {
    var ps = pairs.map(function (p) { return { a: parseFloat(p.a), b: parseFloat(p.b) }; }).filter(function (p) { return isFinite(p.a) && isFinite(p.b); });
    var n = ps.length; if (n < 3) return null;
    var pct = mode === 'pct', pts = ps.map(function (p) { var m = (p.a + p.b) / 2; return { m: m, d: pct ? (m !== 0 ? (p.a - p.b) / m * 100 : NaN) : p.a - p.b }; }).filter(function (p) { return isFinite(p.d); });
    n = pts.length; if (n < 3) return null;
    var i, bias = 0; for (i = 0; i < n; i++) bias += pts[i].d; bias /= n;
    var ss = 0; for (i = 0; i < n; i++) ss += Math.pow(pts[i].d - bias, 2);
    var sd = Math.sqrt(ss / (n - 1)), sp = root.SDSpecial, t = sp ? sp.tCrit(n - 1, 0.05) : Z;
    var seBias = sd / Math.sqrt(n), seLoa = sd * Math.sqrt(1 / n + Z * Z / (2 * (n - 1)));
    var loa = { lo: bias - Z * sd, hi: bias + Z * sd };
    /* regression of the difference on the mean: a slope away from 0 means the bias changes with size */
    var mx = 0; for (i = 0; i < n; i++) mx += pts[i].m; mx /= n;
    var sxx = 0, sxy = 0; for (i = 0; i < n; i++) { sxx += Math.pow(pts[i].m - mx, 2); sxy += (pts[i].m - mx) * (pts[i].d - bias); }
    var slope = sxx > 0 ? sxy / sxx : 0, icpt = bias - slope * mx, rss = 0;
    for (i = 0; i < n; i++) rss += Math.pow(pts[i].d - icpt - slope * pts[i].m, 2);
    var seSlope = sxx > 0 && n > 2 ? Math.sqrt(rss / (n - 2) / sxx) : NaN, ts = seSlope > 0 ? slope / seSlope : 0;
    return {
      n: n, points: pts, bias: bias, sd: sd, loa: loa,
      biasCI: { lo: bias - t * seBias, hi: bias + t * seBias },
      loCI: { lo: loa.lo - t * seLoa, hi: loa.lo + t * seLoa }, hiCI: { lo: loa.hi - t * seLoa, hi: loa.hi + t * seLoa },
      slope: slope, intercept: icpt, pSlope: sp && isFinite(ts) ? sp.tP2(ts, n - 2) : NaN,
      pBias: sp ? sp.tP2(bias / seBias, n - 1) : NaN, t: t
    };
  }

  SD.roc = roc; SD.blandAltman = blandAltman;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
