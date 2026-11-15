/*
 * SDBox: summary statistics and group tests for the box plot editor (35).
 * Quantiles use R's default (type 7). Whiskers reach the furthest value within 1.5 IQR of the box (Tukey),
 * or the minimum and maximum. Tests: Welch t, Mann-Whitney (normal approximation with tie and continuity
 * corrections), one-way ANOVA and Kruskal-Wallis.
 */
(function (root) {
  "use strict";
  var SD = root.SDBox = root.SDBox || {};

  function parse(text) {
    return String(text || '').split(/[\s,;]+/).map(parseFloat).filter(isFinite);
  }
  function sorted(a) { return a.slice().sort(function (x, y) { return x - y; }); }
  function quantile(s, p) {
    var n = s.length; if (!n) return NaN;
    var h = (n - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function variance(a) { var m = mean(a), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return a.length > 1 ? s / (a.length - 1) : NaN; }

  /* five-number summary, whiskers, outliers, mean and SD. tukey false draws whiskers to the min and max. */
  function summary(vals, tukey) {
    var s = sorted(vals), n = s.length; if (!n) return null;
    var q1 = quantile(s, 0.25), med = quantile(s, 0.5), q3 = quantile(s, 0.75), iqr = q3 - q1;
    var loF = tukey === false ? -Infinity : q1 - 1.5 * iqr, hiF = tukey === false ? Infinity : q3 + 1.5 * iqr;
    var inside = s.filter(function (v) { return v >= loF && v <= hiF; });
    return {
      n: n, min: s[0], max: s[n - 1], q1: q1, median: med, q3: q3, iqr: iqr,
      lo: inside.length ? inside[0] : q1, hi: inside.length ? inside[inside.length - 1] : q3,
      outliers: s.filter(function (v) { return v < loF || v > hiF; }),
      mean: mean(s), sd: n > 1 ? Math.sqrt(variance(s)) : NaN
    };
  }

  function welch(a, b) {
    var na = a.length, nb = b.length; if (na < 2 || nb < 2) return null;
    var va = variance(a) / na, vb = variance(b) / nb, se = Math.sqrt(va + vb);
    if (!(se > 0)) return null;
    var t = (mean(a) - mean(b)) / se, df = Math.pow(va + vb, 2) / (va * va / (na - 1) + vb * vb / (nb - 1));
    return { name: 'Welch t-test', stat: t, df: df, p: root.SDSpecial.tP2(t, df), text: 't(' + df.toFixed(1) + ') = ' + t.toFixed(2) };
  }

  /* midranks of the pooled values, and the tie term sum(t^3 - t) */
  function ranks(all) {
    var idx = all.map(function (v, i) { return i; }).sort(function (i, j) { return all[i] - all[j]; }), r = new Array(all.length), i = 0, ties = 0;
    while (i < idx.length) {
      var j = i; while (j + 1 < idx.length && all[idx[j + 1]] === all[idx[i]]) j++;
      var rk = (i + j) / 2 + 1; for (var k = i; k <= j; k++) r[idx[k]] = rk;
      var t = j - i + 1; ties += t * t * t - t; i = j + 1;
    }
    return { r: r, ties: ties };
  }

  function mannWhitney(a, b) {
    var na = a.length, nb = b.length; if (na < 1 || nb < 1) return null;
    var rk = ranks(a.concat(b)), R1 = 0, i; for (i = 0; i < na; i++) R1 += rk.r[i];
    var U1 = R1 - na * (na + 1) / 2, U = Math.min(U1, na * nb - U1), N = na + nb, mu = na * nb / 2;
    var sd = Math.sqrt(na * nb / 12 * ((N + 1) - rk.ties / (N * (N - 1))));
    if (!(sd > 0)) return null;
    var z = (Math.abs(U1 - mu) - 0.5) / sd; z = Math.max(0, z);
    return { name: 'Mann-Whitney U test', stat: U, df: NaN, p: root.SDSpecial.normalP2(z), text: 'U = ' + (+U.toFixed(1)) };
  }

  function anova(groups) {
    var k = groups.length, N = 0, i, grand = 0; if (k < 2) return null;
    groups.forEach(function (g) { N += g.length; g.forEach(function (v) { grand += v; }); }); grand /= N;
    var ssb = 0, ssw = 0;
    groups.forEach(function (g) { var m = mean(g); ssb += g.length * (m - grand) * (m - grand); g.forEach(function (v) { ssw += (v - m) * (v - m); }); });
    var d1 = k - 1, d2 = N - k; if (d2 < 1 || !(ssw > 0)) return null;
    var F = (ssb / d1) / (ssw / d2);
    return { name: 'One-way ANOVA', stat: F, df: d1, df2: d2, p: root.SDSpecial.betaI(d2 / (d2 + d1 * F), d2 / 2, d1 / 2), text: 'F(' + d1 + ', ' + d2 + ') = ' + F.toFixed(2) };
  }

  function kruskal(groups) {
    var k = groups.length; if (k < 2) return null;
    var all = [], sizes = []; groups.forEach(function (g) { sizes.push(g.length); all = all.concat(g); });
    var N = all.length, rk = ranks(all), pos = 0, H = 0;
    sizes.forEach(function (n) { var s = 0; for (var i = 0; i < n; i++) s += rk.r[pos + i]; pos += n; H += s * s / n; });
    H = 12 / (N * (N + 1)) * H - 3 * (N + 1);
    var corr = 1 - rk.ties / (N * N * N - N); if (!(corr > 0)) return null;
    H /= corr;
    return { name: 'Kruskal-Wallis test', stat: H, df: k - 1, p: root.SDSpecial.chi2p(H, k - 1), text: 'H(' + (k - 1) + ') = ' + H.toFixed(2) };
  }

  /* one test for a set of groups of values: 'param' or 'rank' */
  function test(groups, kind) {
    var g = groups.filter(function (x) { return x.length > 0; });
    if (g.length < 2) return null;
    if (g.length === 2) return kind === 'rank' ? mannWhitney(g[0], g[1]) : welch(g[0], g[1]);
    return kind === 'rank' ? kruskal(g) : anova(g);
  }

  SD.parse = parse; SD.quantile = quantile; SD.summary = summary; SD.welch = welch; SD.mannWhitney = mannWhitney; SD.anova = anova; SD.kruskal = kruskal; SD.test = test;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
