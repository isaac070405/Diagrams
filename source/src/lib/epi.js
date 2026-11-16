/*
 * SDEpi: onset dates for the epidemic curve editor (51).
 * Lines: "date" or "date, count" or "date, category" or "date, count, category", dates as yyyy-mm-dd.
 * Cases are grouped into bins of a whole number of days that start on the first date (or on a chosen weekday).
 */
(function (root) {
  "use strict";
  var SD = root.SDEpi = root.SDEpi || {};
  var DAY = 86400000, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* "2026-03-01" or "2026/3/1" -> whole days since 1970-01-01, or NaN */
  function day(s) {
    var m = String(s).trim().match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/); if (!m) return NaN;
    var y = +m[1], mo = +m[2], d = +m[3], t = Date.UTC(y, mo - 1, d), c = new Date(t);
    return c.getUTCFullYear() === y && c.getUTCMonth() === mo - 1 && c.getUTCDate() === d ? Math.round(t / DAY) : NaN;
  }
  function fmt(dn, withYear) { var d = new Date(dn * DAY); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + (withYear ? ' ' + d.getUTCFullYear() : ''); }
  function iso(dn) { var d = new Date(dn * DAY); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  /* 0 = Monday ... 6 = Sunday */
  function weekday(dn) { return (new Date(dn * DAY).getUTCDay() + 6) % 7; }

  function parse(text) {
    var cases = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var f = line.split(/[,\t;]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
      if (!f.length) return;
      var d = day(f[0]); if (!isFinite(d)) return;
      var n = 1, cat = '', k = 1;
      if (f.length > k && /^\d+$/.test(f[k])) { n = Math.max(0, +f[k]); k++; }
      if (f.length > k) cat = f.slice(k).join(' ');
      if (n > 0) cases.push({ day: d, n: n, cat: cat });
    });
    return cases;
  }

  /* width in days; align 'first' starts bins on the first onset day, 'monday' on the Monday on or before it.
     extra: other days (an exposure, an event) that the axis must also cover. */
  function bin(cases, width, align, extra) {
    if (!cases.length) return null;
    var w = Math.max(1, Math.round(width || 1)), cats = [];
    cases.forEach(function (c) { if (cats.indexOf(c.cat) < 0) cats.push(c.cat); });
    var first = Math.min.apply(null, cases.map(function (c) { return c.day; })), last = Math.max.apply(null, cases.map(function (c) { return c.day; }));
    var lo = first, hi = last; (extra || []).forEach(function (d) { if (isFinite(d)) { lo = Math.min(lo, d); hi = Math.max(hi, d); } });
    var start = align === 'monday' ? lo - weekday(lo) : lo, nb = Math.floor((hi - start) / w) + 1, bins = [], i;
    for (i = 0; i < nb; i++) bins.push({ start: start + i * w, end: start + (i + 1) * w - 1, total: 0, by: cats.map(function () { return 0; }) });
    cases.forEach(function (c) { var b = bins[Math.floor((c.day - start) / w)]; b.total += c.n; b.by[cats.indexOf(c.cat)] += c.n; });
    var total = 0; bins.forEach(function (b) { total += b.total; });
    var peak = bins.reduce(function (a, b) { return b.total > a.total ? b : a; }, bins[0]);
    /* median onset day, over cases weighted by count */
    var sorted = cases.slice().sort(function (a, b) { return a.day - b.day; }), half = total / 2, cum = 0, med = sorted[0].day;
    for (i = 0; i < sorted.length; i++) { cum += sorted[i].n; if (cum >= half) { med = sorted[i].day; break; } }
    return { bins: bins, cats: cats, total: total, peak: peak, first: first, last: last, median: med, width: w, start: start };
  }

  SD.day = day; SD.fmt = fmt; SD.iso = iso; SD.weekday = weekday; SD.parse = parse; SD.bin = bin;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
