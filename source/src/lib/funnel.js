/*
 * SDFunnel: Egger's regression test for small-study effects, for the funnel plot editor (44).
 * Each study's standardised effect (y / se) is regressed on its precision (1 / se). The intercept is the
 * asymmetry: 0 for a symmetric funnel. The test uses Student's t with k - 2 df. It has little power below
 * about 10 studies, and asymmetry can come from heterogeneity as well as from bias.
 */
(function (root) {
  "use strict";
  var SD = root.SDFunnel = root.SDFunnel || {};

  /* studies: [{ y, se }] on the analysis scale (log for ratios) */
  function egger(studies) {
    var k = studies.length; if (k < 3) return null;
    var f = root.SDReg.linear(studies.map(function (s) { return [1 / s.se, s.y / s.se]; }));
    if (!f) return null;
    return { k: k, intercept: f.intercept, se: f.seIntercept, ci: f.interceptCI, slope: f.slope, p: f.intercept === 0 && f.seIntercept === 0 ? 1 : (f.seIntercept > 0 ? root.SDSpecial.tP2(f.intercept / f.seIntercept, f.df) : 0), df: f.df, low: k < 10 };
  }
  /* half-width of the pseudo confidence limits at a standard error */
  function limit(se, level) { return (level === 99 ? 2.5758293035489 : 1.959963984540054) * se; }

  SD.egger = egger; SD.limit = limit;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
