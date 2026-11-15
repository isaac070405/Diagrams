/*
 * SDSpecial: p-value helpers shared by the forest plot (30) and Kaplan-Meier (31) editors.
 * gammaQ is the upper regularised incomplete gamma function (series and continued fraction, Numerical Recipes 6.2).
 */
(function (root) {
  "use strict";
  var SD = root.SDSpecial = root.SDSpecial || {};

  function lnGamma(x) {
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, t = x + 5.5, s = 1.000000000190015, j;
    t -= (x + 0.5) * Math.log(t);
    for (j = 0; j < 6; j++) s += c[j] / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  function gammaQ(a, x) {
    if (!(x > 0)) return 1;
    var gln = lnGamma(a), i;
    if (x < a + 1) {
      var ap = a, sum = 1 / a, del = sum;
      for (i = 0; i < 500; i++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; }
      return 1 - sum * Math.exp(-x + a * Math.log(x) - gln);
    }
    var tiny = 1e-300, b = x + 1 - a, c = 1 / tiny, d = 1 / b, h = d, an, del2;
    for (i = 1; i < 500; i++) {
      an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < tiny) d = tiny;
      c = b + an / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d; del2 = d * c; h *= del2;
      if (Math.abs(del2 - 1) < 1e-14) break;
    }
    return Math.exp(-x + a * Math.log(x) - gln) * h;
  }
  /* upper tail of a chi-square distribution */
  function chi2p(x, df) { return df > 0 && x >= 0 ? gammaQ(df / 2, x / 2) : 1; }
  /* two-sided p for a standard normal z */
  function normalP2(z) { return gammaQ(0.5, z * z / 2); }


  /* regularised incomplete beta I_x(a, b), continued fraction (Numerical Recipes 6.4) */
  function betaI(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    function cf(x, a, b) {
      var tiny = 1e-300, qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap, m, h, aa, del;
      if (Math.abs(d) < tiny) d = tiny; d = 1 / d; h = d;
      for (m = 1; m <= 300; m++) {
        var m2 = 2 * m;
        aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; del = d * c; h *= del;
        if (Math.abs(del - 1) < 1e-14) break;
      }
      return h;
    }
    return x < (a + 1) / (a + b + 2) ? bt * cf(x, a, b) / a : 1 - bt * cf(1 - x, b, a) / b;
  }
  /* two-sided p for Student's t with df degrees of freedom */
  function tP2(t, df) { return df > 0 ? betaI(df / (df + t * t), df / 2, 0.5) : NaN; }
  /* critical t for a two-sided level (0.05 gives the 97.5th percentile), by bisection */
  function tCrit(df, alpha) {
    var lo = 0, hi = 1000, mid, i; alpha = alpha || 0.05;
    for (i = 0; i < 200; i++) { mid = (lo + hi) / 2; if (tP2(mid, df) > alpha) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  /* "p < 0.001" style text for a figure */
  function fmtP(p) { return !isFinite(p) ? '' : p < 0.001 ? 'p < 0.001' : 'p = ' + (p < 0.01 ? p.toFixed(3) : p.toFixed(2)); }

  SD.betaI = betaI; SD.tP2 = tP2; SD.tCrit = tCrit; SD.gammaQ = gammaQ; SD.chi2p = chi2p; SD.normalP2 = normalP2; SD.fmtP = fmtP;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
