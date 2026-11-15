/*
 * SDForest: pooled estimates for the forest plot editor (30).
 * Each study gives an effect and a 95% interval. Ratios (odds, risk, hazard) are pooled on the log scale.
 * Fixed effect: inverse variance. Random effects: DerSimonian-Laird. Heterogeneity: Cochran Q and I squared.
 */
(function (root) {
  "use strict";
  var SD = root.SDForest = root.SDForest || {};
  var Z = 1.959963984540054;

  /* standard error from a 95% interval; null when the interval is unusable */
  function seFrom(lo, hi, ratio) {
    lo = parseFloat(lo); hi = parseFloat(hi);
    if (!isFinite(lo) || !isFinite(hi) || hi <= lo) return null;
    if (ratio) { if (lo <= 0) return null; return (Math.log(hi) - Math.log(lo)) / (2 * Z); }
    return (hi - lo) / (2 * Z);
  }

  /* studies: [{ y, se }] on the analysis scale. Returns the pooled estimate, interval, weights and heterogeneity. */
  function pool(studies, model) {
    var k = studies.length, i;
    if (!k) return null;
    var w = studies.map(function (s) { return 1 / (s.se * s.se); }), W = 0, W2 = 0, num = 0;
    for (i = 0; i < k; i++) { W += w[i]; W2 += w[i] * w[i]; num += w[i] * studies[i].y; }
    var fixed = num / W, Q = 0;
    for (i = 0; i < k; i++) Q += w[i] * Math.pow(studies[i].y - fixed, 2);
    var df = k - 1, tau2 = df > 0 ? Math.max(0, (Q - df) / (W - W2 / W)) : 0, I2 = Q > 0 && df > 0 ? Math.max(0, (Q - df) / Q) : 0;
    var wr = studies.map(function (s) { return 1 / (s.se * s.se + tau2); }), WR = 0, numR = 0;
    for (i = 0; i < k; i++) { WR += wr[i]; numR += wr[i] * studies[i].y; }
    var random = model === 'random', ws = random ? wr : w, Ws = random ? WR : W, est = random ? numR / WR : fixed, se = 1 / Math.sqrt(Ws);
    var sp = root.SDSpecial;
    return {
      est: est, se: se, lo: est - Z * se, hi: est + Z * se, z: est / se,
      p: sp ? sp.normalP2(est / se) : NaN,
      weights: ws.map(function (x) { return x / Ws; }),
      Q: Q, df: df, tau2: tau2, I2: I2, pQ: sp && df > 0 ? sp.chi2p(Q, df) : NaN
    };
  }

  /* ticks for the effect axis: powers of 2 and 5 on a ratio scale, a nice linear step otherwise */
  function ticks(lo, hi, ratio) {
    var out = [], i;
    if (ratio) {
      var base = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
      for (i = 0; i < base.length; i++) if (base[i] >= lo * 0.999 && base[i] <= hi * 1.001) out.push(base[i]);
      return out.length >= 2 ? out : [lo, 1, hi].filter(function (v) { return v >= lo && v <= hi; });
    }
    var span = hi - lo, raw = span / 6, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    var st = (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p;
    for (var v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9; v += st) out.push(+v.toPrecision(10));
    return out;
  }

  SD.seFrom = seFrom; SD.pool = pool; SD.ticks = ticks; SD.Z = Z;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
