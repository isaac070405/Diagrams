/*
 * SDContour: contour engine for Diagram Workspace editor 25.
 * Regular grid in, contour lines and filled bands out. Each cell is split into two triangles
 * (diagonal alternates in a checkerboard) so lines and fills agree and saddles are unambiguous.
 * Grid layout: z[j * nx + i] is the value at (x0 + i * dx, y0 + j * dy).
 */
(function (root) {
  "use strict";
  var SD = root.SDContour = root.SDContour || {};

  function round12(v) { return +(+v).toPrecision(12); }

  /* a step of 1, 2 or 5 times a power of ten that gives about n intervals over the span */
  function niceStep(span, n) {
    var raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p;
  }
  /* contour levels strictly inside (zmin, zmax) on a nice step */
  function levels(zmin, zmax, count, fixedStep) {
    if (!(zmax > zmin)) return [];
    var step = fixedStep > 0 ? fixedStep : niceStep(zmax - zmin, count), out = [];
    for (var v = Math.ceil(zmin / step - 1e-9) * step; v <= zmax + 1e-9; v += step) {
      var r = round12(v);
      if (r > zmin && r < zmax) out.push(r);
    }
    return out;
  }

  function makeGrid(x0, x1, y0, y1, nx, ny, fn) {
    var z = new Array(nx * ny), dx = (x1 - x0) / (nx - 1), dy = (y1 - y0) / (ny - 1);
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) z[j * nx + i] = fn(x0 + i * dx, y0 + j * dy);
    return { x0: x0, x1: x1, y0: y0, y1: y1, nx: nx, ny: ny, dx: dx, dy: dy, z: z };
  }
  function range(g) {
    var lo = Infinity, hi = -Infinity;
    for (var k = 0; k < g.z.length; k++) { var v = g.z[k]; if (v < lo) lo = v; if (v > hi) hi = v; }
    return [lo, hi];
  }

  /* scattered (x, y, z) points to a grid by inverse distance weighting; power 2 is the usual choice.
   smooth (a fraction of the diagonal) softens the pinpoint bulls-eyes around each point; 0 passes through every point. */
  function idw(points, x0, x1, y0, y1, nx, ny, power, smooth) {
    var eps2 = Math.pow((smooth > 0 ? smooth : 0) * Math.hypot(x1 - x0, y1 - y0), 2);
    var pts = points.filter(function (p) { return isFinite(p.x) && isFinite(p.y) && isFinite(p.z); });
    var pw = power > 0 ? power : 2;
    return makeGrid(x0, x1, y0, y1, nx, ny, function (x, y) {
      var sw = 0, sz = 0;
      for (var k = 0; k < pts.length; k++) {
        var ddx = x - pts[k].x, ddy = y - pts[k].y, d2 = ddx * ddx + ddy * ddy + eps2;
        if (d2 < 1e-18) return pts[k].z;
        var w = 1 / Math.pow(d2, pw / 2); sw += w; sz += w * pts[k].z;
      }
      return sw ? sz / sw : 0;
    });
  }

  /* built-in surfaces, each returning 0 to 1 over the unit square */
  var SURFACES = {
    peak: function (u, v) { return Math.exp(-(Math.pow(u - 0.5, 2) + Math.pow(v - 0.5, 2)) / 0.045); },
    twopeaks: function (u, v) {
      return Math.min(1, Math.exp(-(Math.pow(u - 0.3, 2) + Math.pow(v - 0.35, 2)) / 0.03) + 0.7 * Math.exp(-(Math.pow(u - 0.72, 2) + Math.pow(v - 0.68, 2)) / 0.05));
    },
    saddle: function (u, v) { return 0.5 + 2 * (Math.pow(u - 0.5, 2) - Math.pow(v - 0.5, 2)); },
    ridge: function (u, v) { return 0.5 + 0.5 * Math.sin(3.2 * u + 0.8) * Math.cos(2.4 * v); },
    slope: function (u, v) { return 0.2 + 0.5 * u + 0.3 * Math.sin(5 * v) * 0.4 + 0.1 * v; }
  };
  function surfaceGrid(name, x0, x1, y0, y1, zlo, zhi, nx, ny) {
    var f = SURFACES[name] || SURFACES.peak;
    return makeGrid(x0, x1, y0, y1, nx, ny, function (x, y) { return zlo + f((x - x0) / (x1 - x0), (y - y0) / (y1 - y0)) * (zhi - zlo); });
  }

  /* the two triangles of cell (i, j) as vertex indices into the grid */
  function triangles(g, i, j) {
    var nx = g.nx, a = j * nx + i, b = a + 1, c = a + nx + 1, d = a + nx;
    return (i + j) % 2 === 0 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
  }
  function vx(g, k) { return g.x0 + (k % g.nx) * g.dx; }
  function vy(g, k) { return g.y0 + Math.floor(k / g.nx) * g.dy; }

  /* contour lines at one level, joined into polylines [{ pts: [[x, y], ...], closed }] */
  function lines(g, level) {
    var N = g.nx * g.ny, segs = [];
    function cross(p, q) {
      var lo = Math.min(p, q), hi = Math.max(p, q), zl = g.z[lo], zh = g.z[hi], t = (level - zl) / (zh - zl);
      return { key: lo * N + hi, x: vx(g, lo) + t * (vx(g, hi) - vx(g, lo)), y: vy(g, lo) + t * (vy(g, hi) - vy(g, lo)) };
    }
    for (var j = 0; j < g.ny - 1; j++) for (var i = 0; i < g.nx - 1; i++) {
      var tr = triangles(g, i, j);
      for (var t = 0; t < 2; t++) {
        var v = tr[t], up = [g.z[v[0]] >= level, g.z[v[1]] >= level, g.z[v[2]] >= level], n = up[0] + up[1] + up[2];
        if (n === 0 || n === 3) continue;
        var odd = n === 1 ? up.indexOf(true) : up.indexOf(false), o1 = v[(odd + 1) % 3], o2 = v[(odd + 2) % 3];
        segs.push([cross(v[odd], o1), cross(v[odd], o2)]);
      }
    }
    var at = {}, used = new Array(segs.length);
    segs.forEach(function (s, k) { [s[0].key, s[1].key].forEach(function (key) { (at[key] = at[key] || []).push(k); }); });
    function walk(first, fromKey) {
      var pts = [], key = fromKey, k = first;
      var s = segs[k], start = s[0].key === key ? s[0] : s[1]; pts.push([start.x, start.y]);
      for (;;) {
        used[k] = true; s = segs[k];
        var a = s[0].key === key ? s[0] : s[1], b = s[0].key === key ? s[1] : s[0];
        pts.push([b.x, b.y]); key = b.key;
        var next = (at[key] || []).filter(function (m) { return !used[m]; })[0];
        if (next === undefined) return { pts: pts, closed: key === fromKey };
        k = next; void a;
      }
    }
    var out = [];
    Object.keys(at).forEach(function (key) {
      if (at[key].length === 1 && !used[at[key][0]]) out.push(walk(at[key][0], +key));
    });
    segs.forEach(function (s, k) { if (!used[k]) { var r = walk(k, s[0].key); r.closed = true; out.push(r); } });
    return out;
  }

  /* clip a polygon of [x, y, z] vertices to z >= level (above) or z <= level (not above) */
  function clip(poly, level, above) {
    var out = [];
    for (var k = 0; k < poly.length; k++) {
      var p = poly[k], q = poly[(k + 1) % poly.length], pin = above ? p[2] >= level : p[2] <= level, qin = above ? q[2] >= level : q[2] <= level;
      if (pin) out.push(p);
      if (pin !== qin) { var t = (level - p[2]) / (q[2] - p[2]); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), level]); }
    }
    return out;
  }
  function bandPolys(g, lo, hi) {
    var out = [];
    for (var j = 0; j < g.ny - 1; j++) for (var i = 0; i < g.nx - 1; i++) {
      var tr = triangles(g, i, j);
      for (var t = 0; t < 2; t++) {
        var poly = tr[t].map(function (k) { return [vx(g, k), vy(g, k), g.z[k]]; });
        if (lo > -Infinity) poly = clip(poly, lo, true);
        if (poly.length && hi < Infinity) poly = clip(poly, hi, false);
        if (poly.length >= 3) out.push(poly);
      }
    }
    return out;
  }
  function polyArea(p) { var a = 0; for (var k = 0; k < p.length; k++) { var q = p[(k + 1) % p.length]; a += p[k][0] * q[1] - q[0] * p[k][1]; } return Math.abs(a) / 2; }
  function bandArea(g, lo, hi) { return bandPolys(g, lo, hi).reduce(function (s, p) { return s + polyArea(p); }, 0); }
  /* one SVG path per band; X and Y map data units to sheet units */
  function bandPath(g, lo, hi, X, Y) {
    return bandPolys(g, lo, hi).map(function (p) {
      return "M" + p.map(function (v) { return X(v[0]).toFixed(1) + " " + Y(v[1]).toFixed(1); }).join("L") + "Z";
    }).join("");
  }

  /* where to put a level's label: the middle of its longest line, with the angle kept upright */
  function labelSpot(polys, X, Y, minLen) {
    var best = null, bl = 0;
    polys.forEach(function (pl) {
      var len = 0, acc = [0];
      for (var k = 1; k < pl.pts.length; k++) { len += Math.hypot(X(pl.pts[k][0]) - X(pl.pts[k - 1][0]), Y(pl.pts[k][1]) - Y(pl.pts[k - 1][1])); acc.push(len); }
      if (len > bl) { bl = len; best = { pl: pl, len: len, acc: acc }; }
    });
    if (!best || bl < minLen) return null;
    var h = best.len / 2, k = 1;
    while (k < best.acc.length - 1 && best.acc[k] < h) k++;
    var a = best.pl.pts[k - 1], b = best.pl.pts[k], ax = X(a[0]), ay = Y(a[1]), bx = X(b[0]), by = Y(b[1]);
    var f = best.acc[k] > best.acc[k - 1] ? (h - best.acc[k - 1]) / (best.acc[k] - best.acc[k - 1]) : 0;
    var ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    return { x: ax + f * (bx - ax), y: ay + f * (by - ay), angle: ang };
  }

  /* colour ramps */
  var RAMPS = {
    viridis: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
    ocean: ["#eef6fb", "#bcd9ea", "#7fb4d6", "#3f86ba", "#1c5189", "#0b2a55"],
    heat: ["#fff7ec", "#fdd49e", "#fc8d59", "#d7301f", "#7f0000"],
    diverging: ["#2c6fae", "#a9cbe4", "#f7f7f7", "#f2b6a0", "#c0392b"],
    grey: ["#f4f4f4", "#c9c9c9", "#8d8d8d", "#505050", "#1a1a1a"]
  };
  function hex(s) { return [1, 3, 5].map(function (k) { return parseInt(s.slice(k, k + 2), 16); }); }
  function color(name, t, reverse) {
    var r = RAMPS[name] || RAMPS.viridis; t = Math.max(0, Math.min(1, t)); if (reverse) t = 1 - t;
    var n = r.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i, p = hex(r[i]), q = hex(r[i + 1]);
    return "rgb(" + p.map(function (v, k) { return Math.round(v + (q[k] - v) * f); }).join(",") + ")";
  }

  SD.niceStep = niceStep; SD.levels = levels; SD.makeGrid = makeGrid; SD.range = range; SD.idw = idw;
  SD.SURFACES = SURFACES; SD.surfaceGrid = surfaceGrid; SD.lines = lines; SD.bandPolys = bandPolys;
  SD.bandArea = bandArea; SD.bandPath = bandPath; SD.labelSpot = labelSpot; SD.color = color; SD.RAMPS = RAMPS;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
