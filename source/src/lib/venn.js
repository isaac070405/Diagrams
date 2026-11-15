/*
 * SDVenn: set overlaps for the Venn diagram editor (39).
 * Items are compared after trimming (and optionally ignoring case). Two sets can be drawn to scale:
 * circle areas follow the set sizes and the distance between centres is solved so the overlap area matches.
 */
(function (root) {
  "use strict";
  var SD = root.SDVenn = root.SDVenn || {};

  function items(text, ignoreCase) {
    var seen = {}, out = [];
    String(text || '').split(/[\r\n,;\t]+/).forEach(function (s) {
      s = s.trim(); if (!s) return;
      var k = ignoreCase ? s.toLowerCase() : s;
      if (!seen[k]) { seen[k] = 1; out.push(s); }
    });
    return out;
  }

  /* every non-empty combination of sets: key like "AB", the items in exactly those sets, and the count */
  function regions(lists, ignoreCase) {
    var n = lists.length, key = function (s) { return ignoreCase ? s.toLowerCase() : s; };
    var member = {}, label = {};
    lists.forEach(function (l, i) { l.forEach(function (s) { var k = key(s); (member[k] = member[k] || []).push(i); if (!label[k]) label[k] = s; }); });
    var out = {};
    Object.keys(member).forEach(function (k) {
      var id = member[k].map(function (i) { return String.fromCharCode(65 + i); }).join('');
      (out[id] = out[id] || []).push(label[k]);
    });
    return out;
  }

  /* area of overlap of two circles with radii r1, r2 and centre distance d */
  function lens(r1, r2, d) {
    if (d >= r1 + r2) return 0;
    if (d <= Math.abs(r1 - r2)) return Math.PI * Math.pow(Math.min(r1, r2), 2);
    var a = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1)), b = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
    return a + b - 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
  }
  /* centre distance that gives an overlap area, by bisection */
  function solveD(r1, r2, area) {
    var lo = Math.abs(r1 - r2), hi = r1 + r2, i;
    if (area <= 0) return hi;
    if (area >= Math.PI * Math.pow(Math.min(r1, r2), 2) - 1e-12) return lo;
    for (i = 0; i < 80; i++) { var mid = (lo + hi) / 2; if (lens(r1, r2, mid) > area) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  SD.items = items; SD.regions = regions; SD.lens = lens; SD.solveD = solveD;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
