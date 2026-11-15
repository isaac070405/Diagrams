/*
 * SDRadar: geometry for the radar chart editor (28).
 * Axes are spaced evenly from the top, clockwise. A value maps to a radius as (value - min) / (max - min), clamped to 0..1.
 */
(function (root) {
  "use strict";
  var SD = root.SDRadar = root.SDRadar || {};

  /* angle of axis i of n, in radians, 0 at the top and increasing clockwise */
  function angle(i, n) { return 2 * Math.PI * i / n; }

  /* fraction of the axis length for a value; non-numbers read as the minimum */
  function frac(v, min, max) {
    v = parseFloat(v);
    if (!isFinite(v) || !(max > min)) return 0;
    return Math.max(0, Math.min(1, (v - min) / (max - min)));
  }

  /* [x, y] of a fraction f on axis i of n, about centre (cx, cy) with outer radius R */
  function point(i, n, f, cx, cy, R) {
    var a = angle(i, n);
    return [cx + Math.sin(a) * R * f, cy - Math.cos(a) * R * f];
  }

  /* area of the polygon as a share of the regular polygon that touches every axis end (0 to 1) */
  function areaShare(fracs) {
    var n = fracs.length, s = 0, i;
    if (n < 3) return 0;
    for (i = 0; i < n; i++) s += fracs[i] * fracs[(i + 1) % n];
    return s;  /* both areas share the factor (1/2) sin(2π/n), so it cancels */
  }
  function areaShareOf(fracs) { return fracs.length < 3 ? 0 : areaShare(fracs) / fracs.length; }

  /* tick values for a ring k of rings (1..rings) on an axis */
  function ringValue(k, rings, min, max) { return min + (max - min) * k / rings; }

  SD.angle = angle; SD.frac = frac; SD.point = point; SD.areaShare = areaShareOf; SD.ringValue = ringValue;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
