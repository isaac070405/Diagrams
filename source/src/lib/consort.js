/*
 * SDConsort: the arithmetic behind the CONSORT 2010 flow diagram (32).
 * Enter the counts that are reported. Randomised, received, and analysed are worked out from them.
 * Analysed = allocated - lost to follow-up - excluded from analysis. Discontinued participants stay in
 * (an intention-to-treat count) unless you also list them as excluded from analysis.
 */
(function (root) {
  "use strict";
  var SD = root.SDConsort = root.SDConsort || {};
  function n(v) { v = parseFloat(v); return isFinite(v) && v > 0 ? Math.round(v) : 0; }

  function calc(d) {
    var w = [], r = {};
    r.assessed = n(d.assessed);
    r.reasons = (d.reasons || []).map(function (x) { return { text: x.reason || '', n: n(x.n) }; }).filter(function (x) { return x.text || x.n; });
    r.excluded = r.reasons.reduce(function (a, x) { return a + x.n; }, 0);
    r.randomised = r.assessed - r.excluded;
    r.arms = (d.arms || []).map(function (a) {
      var o = { name: a.name || '', allocated: n(a.allocated), notReceived: n(a.notReceived), lost: n(a.lost), disc: n(a.disc), exclAn: n(a.exclAn) };
      o.received = o.allocated - o.notReceived;
      o.analysed = o.allocated - o.lost - o.exclAn;
      if (o.received < 0) w.push((o.name || 'An arm') + ': more did not receive the intervention than were allocated.');
      if (o.analysed < 0) w.push((o.name || 'An arm') + ': lost and excluded are more than allocated.');
      return o;
    });
    r.allocated = r.arms.reduce(function (a, x) { return a + x.allocated; }, 0);
    if (r.randomised < 0) w.push('Excluded before randomisation is more than assessed.');
    if (r.arms.length && r.allocated !== r.randomised) w.push('Allocated (' + r.allocated + ') does not equal randomised (' + r.randomised + ').');
    r.warnings = w;
    return r;
  }

  SD.calc = calc; SD.count = n;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
