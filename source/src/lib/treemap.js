/*
 * SDTreemap: layout for the treemap editor (27).
 * Squarified treemap (Bruls, Huizing and van Wijk, 2000): tiles are added to a row while the worst
 * aspect ratio in the row improves, so tiles stay close to square. Tile area is proportional to value.
 */
(function (root) {
  "use strict";
  var SD = root.SDTreemap = root.SDTreemap || {};

  function worst(row, sum, side) {
    var mx = Math.max.apply(null, row), mn = Math.min.apply(null, row), s2 = side * side;
    return Math.max(s2 * mx / (sum * sum), sum * sum / (s2 * mn));
  }

  /* rectangles [x, y, w, h] for positive values, in the same order as the values (sort them first for best shapes) */
  function squarify(vals, x, y, w, h) {
    var n = vals.length, out = new Array(n), total = 0, i, j;
    for (i = 0; i < n; i++) total += vals[i];
    if (!n || !(total > 0) || !(w > 0) || !(h > 0)) return vals.map(function () { return [x, y, 0, 0]; });
    var a = vals.map(function (v) { return v * w * h / total; });
    i = 0;
    while (i < n) {
      var side = Math.min(w, h), sum = 0, best = Infinity, row = [];
      for (j = i; j < n; j++) {
        row.push(a[j]);
        var r = worst(row, sum + a[j], side);
        if (j > i && r > best) { row.pop(); break; }
        best = r; sum += a[j];
      }
      var cnt = row.length, k, pos;
      if (w >= h) {                       /* a column down the left edge */
        var cw = sum / h; pos = y;
        for (k = 0; k < cnt; k++) { var ch = row[k] / cw; out[i + k] = [x, pos, cw, ch]; pos += ch; }
        x += cw; w -= cw;
      } else {                            /* a row along the top edge */
        var rh = sum / w; pos = x;
        for (k = 0; k < cnt; k++) { var rw = row[k] / rh; out[i + k] = [pos, y, rw, rh]; pos += rw; }
        y += rh; h -= rh;
      }
      i += cnt;
    }
    return out;
  }

  function positive(v) { v = parseFloat(v); return isFinite(v) && v > 0 ? v : 0; }

  /*
   * groups: [{ id, children: [{ id, value }] }]. Returns [{ id, total, x, y, w, h, children: [{ id, value, x, y, w, h }] }].
   * Group rectangles are proportional to the group totals. Inside a group, `head` leaves room for its title and `pad` a margin,
   * and tiles are proportional to each other. Groups and tiles are sorted largest first unless sort is false.
   */
  function layout(groups, W, H, opt) {
    opt = opt || {};
    var head = opt.head || 0, pad = opt.pad || 0, sort = opt.sort !== false;
    var gs = groups.map(function (g) {
      var ch = (g.children || []).map(function (c) { return { id: c.id, value: positive(c.value) }; }).filter(function (c) { return c.value > 0; });
      if (sort) ch.sort(function (p, q) { return q.value - p.value; });
      var t = 0; ch.forEach(function (c) { t += c.value; });
      return { id: g.id, total: t, children: ch };
    }).filter(function (g) { return g.total > 0; });
    if (sort) gs.sort(function (p, q) { return q.total - p.total; });
    var rects = squarify(gs.map(function (g) { return g.total; }), 0, 0, W, H);
    gs.forEach(function (g, i) {
      var r = rects[i]; g.x = r[0]; g.y = r[1]; g.w = r[2]; g.h = r[3];
      var ix = g.x + pad, iy = g.y + head + pad, iw = g.w - 2 * pad, ih = g.h - head - 2 * pad;
      var cr = squarify(g.children.map(function (c) { return c.value; }), ix, iy, Math.max(0, iw), Math.max(0, ih));
      g.children.forEach(function (c, j) { c.x = cr[j][0]; c.y = cr[j][1]; c.w = cr[j][2]; c.h = cr[j][3]; });
    });
    return gs;
  }

  /* worst width/height ratio over a set of rectangles, as a number of at least 1 */
  function aspect(rects) {
    var m = 1; rects.forEach(function (r) { if (r.w > 0 && r.h > 0) m = Math.max(m, r.w / r.h, r.h / r.w); });
    return m;
  }

  SD.squarify = squarify; SD.layout = layout; SD.aspect = aspect; SD.positive = positive;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
