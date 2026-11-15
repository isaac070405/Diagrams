/*
 * SDReg: simple linear regression, correlation and bands for the scatter plot editor (40).
 * Slope and intercept by least squares, p values and intervals from Student's t with n - 2 df,
 * confidence band for the mean line, prediction band for a new observation, Pearson r with a Fisher interval,
 * and Spearman rho (Pearson on midranks; p from the t approximation).
 */
(function (root) {
  "use strict";
  var SD = root.SDReg = root.SDReg || {};

  function pairs(xs, ys) {
    var out = [];
    for (var i = 0; i < xs.length; i++) { var x = parseFloat(xs[i]), y = parseFloat(ys[i]); if (isFinite(x) && isFinite(y)) out.push([x, y]); }
    return out;
  }

  /* least squares line for [[x, y], ...]; null when fewer than 3 points or no spread in x */
  function linear(pts) {
    var n = pts.length, i; if (n < 3) return null;
    var mx = 0, my = 0; for (i = 0; i < n; i++) { mx += pts[i][0]; my += pts[i][1]; } mx /= n; my /= n;
    var sxx = 0, syy = 0, sxy = 0; for (i = 0; i < n; i++) { var dx = pts[i][0] - mx, dy = pts[i][1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    if (!(sxx > 0)) return null;
    var slope = sxy / sxx, icpt = my - slope * mx, sse = 0;
    for (i = 0; i < n; i++) sse += Math.pow(pts[i][1] - icpt - slope * pts[i][0], 2);
    var df = n - 2, s2 = sse / df, s = Math.sqrt(s2), seSlope = Math.sqrt(s2 / sxx), seIcpt = Math.sqrt(s2 * (1 / n + mx * mx / sxx));
    var sp = root.SDSpecial, t = sp.tCrit(df, 0.05), r = syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
    var tS = seSlope > 0 ? slope / seSlope : Infinity;
    var out = {
      n: n, df: df, mx: mx, my: my, sxx: sxx, slope: slope, intercept: icpt, s: s, t: t, r: r, r2: syy > 0 ? 1 - sse / syy : 1,
      seSlope: seSlope, seIntercept: seIcpt, slopeCI: [slope - t * seSlope, slope + t * seSlope], interceptCI: [icpt - t * seIcpt, icpt + t * seIcpt],
      p: isFinite(tS) ? sp.tP2(tS, df) : 0
    };
    if (n > 3 && Math.abs(r) < 1) { var z = Math.atanh(r), se = 1 / Math.sqrt(n - 3); out.rCI = [Math.tanh(z - 1.959963984540054 * se), Math.tanh(z + 1.959963984540054 * se)]; }
    return out;
  }
  /* predicted value and the half-width of the confidence (mean) or prediction band at x */
  function at(fit, x, kind) {
    var y = fit.intercept + fit.slope * x, lev = 1 / fit.n + Math.pow(x - fit.mx, 2) / fit.sxx;
    return { y: y, half: fit.t * fit.s * Math.sqrt((kind === 'pred' ? 1 : 0) + lev) };
  }

  function midranks(a) {
    var idx = a.map(function (v, i) { return i; }).sort(function (i, j) { return a[i] - a[j]; }), r = new Array(a.length), i = 0;
    while (i < idx.length) { var j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++; for (var k = i; k <= j; k++) r[idx[k]] = (i + j) / 2 + 1; i = j + 1; }
    return r;
  }
  function spearman(pts) {
    var n = pts.length; if (n < 3) return null;
    var rx = midranks(pts.map(function (p) { return p[0]; })), ry = midranks(pts.map(function (p) { return p[1]; }));
    var f = linear(rx.map(function (v, i) { return [v, ry[i]]; })); if (!f) return null;
    var rho = f.r, t = Math.abs(rho) < 1 ? rho * Math.sqrt((n - 2) / (1 - rho * rho)) : Infinity;
    return { rho: rho, p: isFinite(t) ? root.SDSpecial.tP2(t, n - 2) : 0, n: n };
  }

  SD.pairs = pairs; SD.linear = linear; SD.at = at; SD.spearman = spearman;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
