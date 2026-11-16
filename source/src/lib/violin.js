/*
 * SDViolin: Gaussian kernel density for the violin plot editor (49).
 * Bandwidth h = 0.9 min(SD, IQR / 1.34) n^(-1/5) (Silverman's rule of thumb), times a multiplier you can set.
 * The density is evaluated on a grid, either trimmed to the range of the data or extended by 3 h each side.
 */
(function (root) {
  "use strict";
  var SD = root.SDViolin = root.SDViolin || {};

  function bandwidth(vals) {
    var n = vals.length; if (n < 2) return NaN;
    var s = vals.slice().sort(function (a, b) { return a - b; }), m = 0, i; s.forEach(function (v) { m += v; }); m /= n;
    var ss = 0; s.forEach(function (v) { ss += (v - m) * (v - m); });
    var sd = Math.sqrt(ss / (n - 1)), q = function (p) { var h = (n - 1) * p, lo = Math.floor(h), hi = Math.ceil(h); return s[lo] + (h - lo) * (s[hi] - s[lo]); };
    var iqr = q(0.75) - q(0.25), spread = iqr > 0 ? Math.min(sd, iqr / 1.34) : sd;
    if (!(spread > 0)) spread = Math.max(1e-9, Math.abs(m) * 0.05 || 1);
    return 0.9 * spread * Math.pow(n, -0.2);
  }

  /* { xs, ys, h }: density ys at 80 values xs; mult scales the bandwidth, trim limits xs to [min, max] */
  function kde(vals, mult, trim, points) {
    var n = vals.length; if (n < 2) return null;
    var h = bandwidth(vals) * (mult || 1), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (!trim) { lo -= 3 * h; hi += 3 * h; }
    if (!(hi > lo)) { lo -= 1; hi += 1; }
    var N = points || 80, xs = [], ys = [], c = 1 / (n * h * Math.sqrt(2 * Math.PI));
    for (var i = 0; i < N; i++) {
      var x = lo + (hi - lo) * i / (N - 1), d = 0;
      for (var j = 0; j < n; j++) { var z = (x - vals[j]) / h; d += Math.exp(-0.5 * z * z); }
      xs.push(x); ys.push(c * d);
    }
    return { xs: xs, ys: ys, h: h };
  }

  SD.bandwidth = bandwidth; SD.kde = kde;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
