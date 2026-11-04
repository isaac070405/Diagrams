/*
 * XYAxis: shared Cartesian plot for Diagram Workspace (phase 1 of the
 * Pharmacy Diagram Templates plan). Used by templates 17 (pk-curve) and
 * 18 (dose-response).
 *
 * Loads after the main bundle. Reads React and SciDiagram.ChemText from
 * window, then attaches SciDiagram.XYAxis and SciDiagram.xy (pure helpers).
 * In Node it exports the pure helpers only, for tests.
 */
(function (root) {
  "use strict";

  /* ---------- pure helpers (no React) ---------- */

  var LOG_MINORS = [2, 3, 4, 5, 6, 7, 8, 9];
  var DASHES = ["", "7 4", "2 3", "9 4 2 4", "1.2 2.6", "5 2 1 2"];
  var SAMPLES = 400;

  function isNum(v) { return typeof v === "number" && isFinite(v); }

  // Step of 1, 2, 2.5 or 5 times a power of ten, closest to span/target.
  function niceStep(span, target) {
    if (!(span > 0)) return 1;
    var raw = span / Math.max(1, target || 6);
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / p;
    var m = f < 1.5 ? 1 : f < 2.25 ? 2 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10;
    return m * p;
  }

  // Round to the step's own precision so 0.1 * 3 prints as 0.3.
  function roundTo(v, step) {
    var d = Math.max(0, -Math.floor(Math.log10(step)) + 2);
    return Number(v.toFixed(Math.min(12, d)));
  }

  function linearTicks(lo, hi, target) {
    var step = niceStep(hi - lo, target);
    var start = Math.ceil(lo / step - 1e-9) * step;
    var out = [];
    for (var v = start; v <= hi + step * 1e-9; v += step) out.push(roundTo(v, step));
    // Minor ticks: 5 per major for steps of 1, 2 or 5, 2 per major otherwise.
    var mant = step / Math.pow(10, Math.floor(Math.log10(step)));
    var sub = Math.abs(mant - 2.5) < 1e-9 ? 2 : 5;
    var minor = [];
    var ms = step / sub;
    for (var w = Math.ceil(lo / ms - 1e-9) * ms; w <= hi + ms * 1e-9; w += ms) {
      var r = roundTo(w, ms);
      if (Math.abs(r / step - Math.round(r / step)) > 1e-6) minor.push(r);
    }
    return { major: out, minor: minor, step: step };
  }

  function logTicks(lo, hi) {
    var a = Math.floor(Math.log10(lo) + 1e-9), b = Math.ceil(Math.log10(hi) - 1e-9);
    var major = [], minor = [];
    for (var k = a; k <= b; k++) {
      var base = Math.pow(10, k);
      if (base >= lo * (1 - 1e-9) && base <= hi * (1 + 1e-9)) major.push(base);
      for (var i = 0; i < LOG_MINORS.length; i++) {
        var v = LOG_MINORS[i] * base;
        if (v > lo && v < hi) minor.push(v);
      }
    }
    // Wide ranges: label every 2nd or 3rd decade so labels do not collide.
    var every = major.length > 12 ? 3 : major.length > 7 ? 2 : 1;
    return { major: major, minor: every > 1 ? [] : minor, every: every };
  }

  // Scale: maps a data value to a pixel. Range is [px0, px1].
  function makeScale(type, domain, range) {
    var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
    if (type === "log") {
      if (!(d0 > 0 && d1 > 0)) throw new Error("log axis needs a positive domain");
      var l0 = Math.log10(d0), l1 = Math.log10(d1);
      var f = function (v) { return v > 0 ? r0 + (Math.log10(v) - l0) / (l1 - l0) * (r1 - r0) : NaN; };
      f.invert = function (p) { return Math.pow(10, l0 + (p - r0) / (r1 - r0) * (l1 - l0)); };
      f.type = "log"; f.domain = domain;
      return f;
    }
    var g = function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); };
    g.invert = function (p) { return d0 + (p - r0) / (r1 - r0) * (d1 - d0); };
    g.type = "linear"; g.domain = domain;
    return g;
  }

  // Sample fn(x) at n points. Log x axes sample evenly in log space.
  function sample(fn, domain, type, n) {
    n = n || SAMPLES;
    var pts = [], a = domain[0], b = domain[1];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var x = type === "log" ? Math.pow(10, Math.log10(a) + t * (Math.log10(b) - Math.log10(a))) : a + t * (b - a);
      var y;
      try { y = fn(x); } catch (e) { y = NaN; }
      pts.push([x, y]);
    }
    return pts;
  }

  // One SVG path. Gaps (NaN, or y <= 0 on a log axis) break the line.
  function pathFrom(pts, sx, sy) {
    var d = "", pen = false;
    for (var i = 0; i < pts.length; i++) {
      var px = sx(pts[i][0]), py = sy(pts[i][1]);
      if (!isNum(px) || !isNum(py)) { pen = false; continue; }
      d += (pen ? "L" : "M") + px.toFixed(2) + "," + py.toFixed(2);
      pen = true;
    }
    return d;
  }

  // Closed area between a curve and the x axis, limited to [x0, x1].
  function areaFrom(pts, sx, sy, x0, x1, baseY) {
    var inside = pts.filter(function (p) { return p[0] >= x0 && p[0] <= x1 && isNum(sy(p[1])); });
    if (inside.length < 2) return "";
    var d = "M" + sx(inside[0][0]).toFixed(2) + "," + baseY.toFixed(2);
    inside.forEach(function (p) { d += "L" + sx(p[0]).toFixed(2) + "," + sy(p[1]).toFixed(2); });
    return d + "L" + sx(inside[inside.length - 1][0]).toFixed(2) + "," + baseY.toFixed(2) + "Z";
  }

  // Tick label text in ChemText syntax: 10^{-7}, 0.5, 1500.
  function formatTick(v, type) {
    if (type === "log") {
      var k = Math.round(Math.log10(v));
      if (Math.abs(Math.pow(10, k) - v) / v < 1e-9) return k === 0 ? "1" : k === 1 ? "10" : "10^{" + k + "}";
    }
    if (v === 0) return "0";
    var a = Math.abs(v);
    if (a >= 1e5 || a < 1e-3) {
      var e = Math.floor(Math.log10(a)), m = roundTo(v / Math.pow(10, e), 0.01);
      return (m === 1 ? "" : m + "×") + "10^{" + e + "}";
    }
    return String(v).replace("-", "−");
  }

  // Domain from the data plus 5% headroom when the caller gives none.
  function autoDomain(values, type) {
    var v = values.filter(function (x) { return isNum(x) && (type !== "log" || x > 0); });
    if (!v.length) return type === "log" ? [1, 10] : [0, 1];
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
    if (type === "log") return [Math.pow(10, Math.floor(Math.log10(lo))), Math.pow(10, Math.ceil(Math.log10(hi)))];
    if (lo === hi) { lo -= 1; hi += 1; }
    var pad = (hi - lo) * 0.05;
    lo = lo >= 0 && lo - pad < 0 ? 0 : lo - pad;
    var step = niceStep(hi + pad - lo, 6);
    return [Math.floor(lo / step) * step, Math.ceil((hi + pad) / step) * step];
  }

  var xy = {
    niceStep: niceStep, linearTicks: linearTicks, logTicks: logTicks,
    makeScale: makeScale, sample: sample, pathFrom: pathFrom, areaFrom: areaFrom,
    formatTick: formatTick, autoDomain: autoDomain, DASHES: DASHES, SAMPLES: SAMPLES
  };

  // Node (tests): helpers only. A bundler also defines `module`, so check for a browser first.
  if (typeof window === "undefined" || !root.React) { if (typeof module === "object" && module.exports) module.exports = xy; return; }

  /* ---------- React component ---------- */

  var React = root.React, h = React.createElement;
  var SD = root.SciDiagram = root.SciDiagram || {};
  var ChemText = SD.ChemText || function (p) { var o = Object.assign({}, p); delete o.children; return h("text", o, p.children); };

  var CSS = [
    ".sd-xy text{font:var(--text-scale-label);fill:var(--ink)}",
    ".sd-xy .sd-xy-title{font:var(--text-end-label);fill:var(--ink)}",
    ".sd-xy .sd-xy-ticklab{font:var(--text-edge-label);fill:var(--ink-muted)}",
    ".sd-xy-frame{fill:none;stroke:var(--ink);stroke-width:var(--line-edge)}",
    ".sd-xy-tick{stroke:var(--ink);stroke-width:var(--line-edge)}",
    ".sd-xy-minor{stroke:var(--ink-muted);stroke-width:var(--line-hairline)}",
    ".sd-xy-grid{stroke:var(--rule);stroke-width:var(--line-hairline)}",
    ".sd-xy-series{fill:none;stroke-width:var(--line-flow-medium);stroke-linejoin:round;stroke-linecap:round}",
    ".sd-xy-ref{fill:none;stroke:var(--ink-muted);stroke-width:var(--line-edge);stroke-dasharray:var(--dash-note)}",
    ".sd-xy .sd-xy-reflab{font:var(--text-edge-label);fill:var(--ink-muted)}",
    ".sd-xy-band{fill:var(--accent-200);opacity:.55}",
    ".sd-xy .sd-xy-bandlab{font:var(--text-compartment-label);letter-spacing:.06em;fill:var(--accent-700)}",
    ".sd-xy-area{opacity:.22}",
    ".sd-xy-leader{fill:none;stroke:var(--ink);stroke-width:var(--line-hairline)}",
    ".sd-xy-dot{fill:var(--paper);stroke:var(--ink);stroke-width:var(--line-edge)}",
    ".sd-xy-point{stroke:var(--paper);stroke-width:1}",
    ".sd-xy-halo{paint-order:stroke;stroke:var(--halo);stroke-width:3px;stroke-linejoin:round}",
    ".sd-xy .sd-xy-legend{font:var(--text-legend);fill:var(--ink)}"
  ].join("\n");

  if (root.document && !root.document.getElementById("sd-xy-css")) {
    var tag = root.document.createElement("style");
    tag.id = "sd-xy-css"; tag.textContent = CSS;
    root.document.head.appendChild(tag);
  }

  // Width estimate for a ChemText label at the legend font: sub/superscripts count at 70%.
  function textWidth(s) {
    var str = String(s == null ? "" : s), w = 0, small = 0;
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if ((ch === "_" || ch === "^") && str[i + 1] === "{") { small++; i++; continue; }
      if (ch === "}" && small) { small--; continue; }
      w += (small ? 0.7 : 1) * (/[mwMW]/.test(ch) ? 10 : /[il.,:;'|! ]/.test(ch) ? 3.6 : /[A-Z0-9]/.test(ch) ? 8 : 6.6);
    }
    return w;
  }
  function seriesColor(s, i) { return s.color || "var(--cat-" + (i % 6 + 1) + ")"; }
  function seriesDash(s, i) { return s.dash != null ? s.dash : DASHES[i % DASHES.length]; }

  /*
   * Props
   *  width, height             outer size in px (default 640 x 420)
   *  margin                    {top,right,bottom,left}
   *  x, y                      {type:"linear"|"log", domain:[a,b], title, ticks:n, grid:bool}
   *  scale                     "linear" | "log" | "semilog" shorthand (semilog = log y)
   *  series                    [{id, label, fn(x) | points:[[x,y]], color, dash, markers}]
   *  refLines                  [{axis:"x"|"y", value, label}]
   *  bands                     [{y0, y1, label}]           horizontal shaded band
   *  areas                     [{series:id, x0, x1, label}] fill under a curve (AUC)
   *  callouts                  [{x, y, text, dx, dy}]       label + leader to (x, y)
   *  legend                    true | false | "tl" | "tr" | "bl" | "br"
   *  samples                   points per fn series (default 400)
   */
  function XYAxis(props) {
    var W = props.width || 640, H = props.height || 420;
    var m = Object.assign({ top: 24, right: 28, bottom: 62, left: 78 }, props.margin);
    var xo = Object.assign({ type: "linear" }, props.x);
    var yo = Object.assign({ type: "linear" }, props.y);
    if (props.scale === "log") { xo.type = "log"; yo.type = "log"; }
    if (props.scale === "semilog") { yo.type = "log"; }
    var n = props.samples || SAMPLES;
    var uid = (React.useId ? React.useId() : "x").replace(/[^a-zA-Z0-9_-]/g, "");
    var clipId = "sd-xy-clip-" + uid;

    var px0 = m.left, px1 = W - m.right, py0 = H - m.bottom, py1 = m.top;
    var xDomain = xo.domain;
    if (!xDomain) {
      var xs = [];
      (props.series || []).forEach(function (s) { (s.points || []).forEach(function (p) { xs.push(p[0]); }); });
      xDomain = autoDomain(xs, xo.type);
    }
    var sx = makeScale(xo.type, xDomain, [px0, px1]);

    // Sample function series once; points series pass through.
    var data = (props.series || []).map(function (s) {
      return { s: s, pts: s.fn ? sample(s.fn, xDomain, xo.type, n) : (s.points || []) };
    });
    var yDomain = yo.domain;
    if (!yDomain) {
      var ys = [];
      data.forEach(function (d) { d.pts.forEach(function (p) { ys.push(p[1]); }); });
      (props.refLines || []).forEach(function (r) { if (r.axis === "y") ys.push(r.value); });
      (props.bands || []).forEach(function (b) { ys.push(b.y0, b.y1); });
      yDomain = autoDomain(ys, yo.type);
    }
    var sy = makeScale(yo.type, yDomain, [py0, py1]);

    var out = [];
    var k = 0;
    function key() { return "k" + (k++); }

    // Ticks and grid.
    function axisTicks(o, dom) { return o.type === "log" ? logTicks(dom[0], dom[1]) : linearTicks(dom[0], dom[1], o.ticks || 6); }
    var tx = axisTicks(xo, xDomain), ty = axisTicks(yo, yDomain);

    if (xo.grid) tx.major.forEach(function (v) { out.push(h("line", { key: key(), className: "sd-xy-grid", x1: sx(v), x2: sx(v), y1: py0, y2: py1 })); });
    if (yo.grid) ty.major.forEach(function (v) { out.push(h("line", { key: key(), className: "sd-xy-grid", x1: px0, x2: px1, y1: sy(v), y2: sy(v) })); });

    // Bands sit under everything else in the plot area.
    (props.bands || []).forEach(function (b) {
      var a = sy(b.y1), c = sy(b.y0);
      if (!isNum(a) || !isNum(c)) return;
      a = Math.max(py1, Math.min(py0, a)); c = Math.max(py1, Math.min(py0, c));
      out.push(h("rect", { key: key(), className: "sd-xy-band", x: px0, y: Math.min(a, c), width: px1 - px0, height: Math.abs(c - a), clipPath: "url(#" + clipId + ")" }));
      if (b.label) out.push(h(ChemText, { key: key(), className: "sd-xy-bandlab sd-xy-halo", x: px0 + 8, y: Math.min(a, c) + 14 }, String(b.label)));
    });

    // AUC areas.
    (props.areas || []).forEach(function (ar) {
      var d = data.filter(function (q) { return q.s.id === ar.series; })[0] || data[0];
      if (!d) return;
      var i = data.indexOf(d);
      var x0 = ar.x0 != null ? ar.x0 : xDomain[0], x1 = ar.x1 != null ? ar.x1 : xDomain[1];
      var dd = areaFrom(d.pts, sx, sy, x0, x1, py0);
      if (dd) out.push(h("path", { key: key(), className: "sd-xy-area", d: dd, style: { fill: seriesColor(d.s, i) }, clipPath: "url(#" + clipId + ")" }));
      if (ar.label) {
        var mid = (x0 + x1) / 2;
        out.push(h(ChemText, { key: key(), className: "sd-xy-legend sd-xy-halo", x: sx(xo.type === "log" ? Math.sqrt(x0 * x1) : mid), y: py0 - 14, textAnchor: "middle" }, ar.label));
      }
    });

    // Reference lines.
    (props.refLines || []).forEach(function (r) {
      if (r.axis === "x") {
        var X = sx(r.value);
        if (!isNum(X) || X < px0 - 0.5 || X > px1 + 0.5) return;
        out.push(h("line", { key: key(), className: "sd-xy-ref", x1: X, x2: X, y1: py0, y2: py1 }));
        if (r.label) out.push(h(ChemText, { key: key(), className: "sd-xy-reflab sd-xy-halo", x: X, y: py1 - 6, textAnchor: "middle" }, r.label));
      } else {
        var Y = sy(r.value);
        if (!isNum(Y) || Y > py0 + 0.5 || Y < py1 - 0.5) return;
        out.push(h("line", { key: key(), className: "sd-xy-ref", x1: px0, x2: px1, y1: Y, y2: Y }));
        if (r.label) out.push(h(ChemText, { key: key(), className: "sd-xy-reflab sd-xy-halo", x: px1 - 4, y: Y - 5, textAnchor: "end" }, r.label));
      }
    });

    // Series.
    data.forEach(function (d, i) {
      var col = seriesColor(d.s, i), dash = seriesDash(d.s, i);
      var dd = pathFrom(d.pts, sx, sy);
      if (dd) out.push(h("path", { key: key(), className: "sd-xy-series", d: dd, clipPath: "url(#" + clipId + ")", style: { stroke: col, strokeDasharray: dash || undefined } }));
      if (d.s.markers || (!d.s.fn && d.s.markers !== false)) {
        d.pts.forEach(function (p) {
          var X = sx(p[0]), Y = sy(p[1]);
          if (isNum(X) && isNum(Y)) out.push(h("circle", { key: key(), className: "sd-xy-point", cx: X, cy: Y, r: 3.6, style: { fill: col } }));
        });
      }
    });

    out.push(h("rect", { key: key(), className: "sd-xy-frame", x: px0, y: py1, width: px1 - px0, height: py0 - py1 }));

    // Tick marks and labels.
    tx.major.forEach(function (v, i) {
      var X = sx(v);
      out.push(h("line", { key: key(), className: "sd-xy-tick", x1: X, x2: X, y1: py0, y2: py0 + 6 }));
      if (!tx.every || i % tx.every === 0) out.push(h(ChemText, { key: key(), className: "sd-xy-ticklab", x: X, y: py0 + 21, textAnchor: "middle" }, formatTick(v, xo.type)));
    });
    tx.minor.forEach(function (v) { var X = sx(v); out.push(h("line", { key: key(), className: "sd-xy-minor", x1: X, x2: X, y1: py0, y2: py0 + 3 })); });
    ty.major.forEach(function (v, i) {
      var Y = sy(v);
      out.push(h("line", { key: key(), className: "sd-xy-tick", x1: px0 - 6, x2: px0, y1: Y, y2: Y }));
      if (!ty.every || i % ty.every === 0) out.push(h(ChemText, { key: key(), className: "sd-xy-ticklab", x: px0 - 10, y: Y + 4, textAnchor: "end" }, formatTick(v, yo.type)));
    });
    ty.minor.forEach(function (v) { var Y = sy(v); out.push(h("line", { key: key(), className: "sd-xy-minor", x1: px0 - 3, x2: px0, y1: Y, y2: Y })); });

    // Axis titles.
    if (xo.title) out.push(h(ChemText, { key: key(), className: "sd-xy-title", x: (px0 + px1) / 2, y: H - 14, textAnchor: "middle" }, xo.title));
    if (yo.title) out.push(h(ChemText, { key: key(), className: "sd-xy-title", x: 0, y: 0, textAnchor: "middle", transform: "translate(" + 20 + "," + (py0 + py1) / 2 + ") rotate(-90)" }, yo.title));

    // Callouts: leader from label to a dot on the point.
    (props.callouts || []).forEach(function (c) {
      var X = sx(c.x), Y = sy(c.y);
      if (!isNum(X) || !isNum(Y)) return;
      var dx = c.dx != null ? c.dx : 40, dy = c.dy != null ? c.dy : -34, tw = textWidth(c.text) + 14;
      if (dx >= 0 && X + dx + tw > px1) dx = -Math.abs(dx);
      else if (dx < 0 && X + dx - tw < px0) dx = Math.abs(dx);
      if (Y + dy - 12 < py1) dy = Math.abs(dy);
      var LX = X + dx, LY = Y + dy;
      var anchor = LX >= X ? "start" : "end";
      out.push(h("path", { key: key(), className: "sd-xy-leader", d: "M" + X + "," + Y + "L" + LX + "," + (LY + 4) + "h" + (anchor === "start" ? 4 : -4) }));
      out.push(h("circle", { key: key(), className: "sd-xy-dot", cx: X, cy: Y, r: 3 }));
      out.push(h(ChemText, { key: key(), className: "sd-xy-legend sd-xy-halo", x: LX + (anchor === "start" ? 7 : -7), y: LY + 8, textAnchor: anchor }, c.text));
    });

    // Legend: line sample plus label, so colour never carries meaning alone.
    var named = data.filter(function (d) { return d.s.label; });
    if (props.legend !== false && named.length > 1) {
      var pos = typeof props.legend === "string" ? props.legend : "tr";
      var LW = Math.min(px1 - px0 - 24, Math.max(110, 44 + Math.max.apply(null, named.map(function (d) { return textWidth(d.s.label); })))), rowH = 18, lx = pos[1] === "l" ? px0 + 12 : px1 - LW - 12, ly = pos[0] === "t" ? py1 + 12 : py0 - 12 - named.length * rowH;
      var rows = [h("rect", { key: "bg", x: lx - 6, y: ly - 6, width: LW + 12, height: named.length * rowH + 8, style: { fill: "var(--paper)", stroke: "var(--rule)" } })];
      named.forEach(function (d, j) {
        var i = data.indexOf(d), yy = ly + j * rowH + rowH / 2;
        rows.push(h("line", { key: "l" + j, className: "sd-xy-series", x1: lx, x2: lx + 28, y1: yy, y2: yy, style: { stroke: seriesColor(d.s, i), strokeDasharray: seriesDash(d.s, i) || undefined } }));
        rows.push(h(ChemText, { key: "t" + j, className: "sd-xy-legend", x: lx + 36, y: yy + 4 }, d.s.label));
      });
      out.push(h("g", { key: key() }, rows));
    }

    return h("g", { className: "sd-xy" },
      h("defs", null, h("clipPath", { id: clipId }, h("rect", { x: px0, y: py1, width: px1 - px0, height: py0 - py1 }))),
      out);
  }

  XYAxis.css = CSS;
  SD.XYAxis = XYAxis;
  SD.xy = xy;
})(typeof window !== "undefined" ? window : globalThis);
