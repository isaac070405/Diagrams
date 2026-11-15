/*
 * SDPrisma: the arithmetic behind the PRISMA 2020 flow diagram (29).
 * Only counts you enter are free. Records screened, reports sought, assessed and included are worked out
 * from them, so the diagram always adds up. `warnings` lists any step that goes below 0.
 */
(function (root) {
  "use strict";
  var SD = root.SDPrisma = root.SDPrisma || {};
  function n(v) { v = parseFloat(v); return isFinite(v) && v > 0 ? Math.round(v) : 0; }

  function calc(d) {
    var r = {}, w = [];
    r.identified = n(d.db) + n(d.reg);
    r.removed = n(d.dup) + n(d.auto) + n(d.otherRem);
    r.screened = r.identified - r.removed;
    r.sought = r.screened - n(d.scrExcl);
    r.assessed = r.sought - n(d.notRet);
    r.otherIdentified = d.other ? n(d.web) + n(d.org) + n(d.cit) : 0;
    r.otherSought = r.otherIdentified;
    r.otherAssessed = d.other ? r.otherSought - n(d.notRetO) : 0;
    r.reasons = (d.reasons || []).map(function (x) { return { text: x.reason || '', n: n(x.n) }; }).filter(function (x) { return x.text || x.n; });
    r.excluded = r.reasons.reduce(function (a, x) { return a + x.n; }, 0);
    r.assessedAll = r.assessed + r.otherAssessed;
    r.included = r.assessedAll - r.excluded;
    if (r.screened < 0) w.push('Records removed before screening are more than the records identified.');
    if (r.sought < 0) w.push('Records excluded are more than the records screened.');
    if (r.assessed < 0) w.push('Reports not retrieved are more than the reports sought.');
    if (d.other && r.otherAssessed < 0) w.push('Other-method reports not retrieved are more than those sought.');
    if (r.included < 0) w.push('Reports excluded are more than the reports assessed.');
    r.warnings = w;
    return r;
  }

  SD.calc = calc; SD.count = n;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
