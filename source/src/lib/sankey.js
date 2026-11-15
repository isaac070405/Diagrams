/*
 * SDSankey: layout for the Sankey diagram editor (42).
 * Nodes are placed in columns by the longest path from a source (sinks can be pushed to the last column),
 * node height is proportional to the larger of its inflow and outflow, columns are ordered by the position of
 * their neighbours, and links are stacked on each node side in the order of the node at the other end.
 */
(function (root) {
  "use strict";
  var SD = root.SDSankey = root.SDSankey || {};

  /* lines "source, target, value" (commas, tabs or semicolons); header and bad lines are skipped */
  function parse(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var f = line.split(/[,\t;]+/).map(function (s) { return s.trim(); });
      if (f.length < 3) return;
      var v = parseFloat(f[f.length - 1]);
      if (!isFinite(v) || v <= 0 || !f[0] || !f[1]) return;
      out.push({ s: f[0], t: f[1], v: v });
    });
    return out;
  }

  function layout(links, W, H, opt) {
    opt = opt || {};
    var nodeW = opt.nodeW || 14, pad = opt.pad === undefined ? 14 : opt.pad, justify = opt.justify !== false, i, j;
    var idx = {}, nodes = [];
    var node = function (name) { if (idx[name] === undefined) { idx[name] = nodes.length; nodes.push({ id: nodes.length, name: name, depth: 0, vin: 0, vout: 0, out: [], inn: [] }); } return idx[name]; };
    var L = links.map(function (l) { return { s: node(l.s), t: node(l.t), v: l.v }; });
    var n = nodes.length; if (!n) return { nodes: [], links: [] };
    if (L.some(function (l) { return l.s === l.t; })) return { error: 'A flow cannot start and end at the same node.' };
    /* depth by longest path; still changing after n passes means a cycle */
    var changed = true, pass = 0;
    while (changed && pass <= n) { changed = false; L.forEach(function (l) { if (nodes[l.t].depth < nodes[l.s].depth + 1) { nodes[l.t].depth = nodes[l.s].depth + 1; changed = true; } }); pass++; }
    if (changed) return { error: 'The flows form a loop. A Sankey diagram needs flows that only move forward.' };
    L.forEach(function (l, k) { l.k = k; nodes[l.s].out.push(l); nodes[l.t].inn.push(l); nodes[l.s].vout += l.v; nodes[l.t].vin += l.v; });
    var maxD = 0; nodes.forEach(function (nd) { maxD = Math.max(maxD, nd.depth); });
    if (justify) nodes.forEach(function (nd) { if (!nd.out.length) nd.depth = maxD; });
    nodes.forEach(function (nd) { nd.value = Math.max(nd.vin, nd.vout); });
    var cols = []; for (i = 0; i <= maxD; i++) cols.push([]);
    nodes.forEach(function (nd) { cols[nd.depth].push(nd); });
    var k = Infinity;
    cols.forEach(function (c) { if (!c.length) return; var tot = 0; c.forEach(function (nd) { tot += nd.value; }); k = Math.min(k, (H - pad * (c.length - 1)) / tot); });
    if (!(k > 0)) k = 1;
    nodes.forEach(function (nd) { nd.h = nd.value * k; nd.x = maxD ? nd.depth * (W - nodeW) / maxD : 0; nd.w = nodeW; });
    var stack = function (c) { var tot = 0; c.forEach(function (nd) { tot += nd.h; }); tot += pad * (c.length - 1); var y = (H - tot) / 2; c.forEach(function (nd) { nd.y = y; y += nd.h + pad; }); };
    cols.forEach(stack);
    /* reorder by the value-weighted centre of the connected nodes, forward then backward */
    var center = function (nd, side) { var s = 0, w = 0; (side === 'in' ? nd.inn : nd.out).forEach(function (l) { var o = nodes[side === 'in' ? l.s : l.t]; s += (o.y + o.h / 2) * l.v; w += l.v; }); return w ? s / w : nd.y + nd.h / 2; };
    for (var it = 0; it < (opt.iter === undefined ? 8 : opt.iter); it++) {
      var fwd = it % 2 === 0;
      for (j = fwd ? 1 : cols.length - 2; fwd ? j < cols.length : j >= 0; j += fwd ? 1 : -1) {
        var c = cols[j], key = {}; c.forEach(function (nd) { key[nd.id] = center(nd, fwd ? 'in' : 'out'); });
        c.sort(function (a, b) { return key[a.id] - key[b.id] || a.id - b.id; }); stack(c);
      }
    }
    nodes.forEach(function (nd) {
      var o = nd.out.slice().sort(function (a, b) { return nodes[a.t].y - nodes[b.t].y || a.k - b.k; }), y = nd.y;
      o.forEach(function (l) { l.sy = y + l.v * k / 2; y += l.v * k; });
      var inn = nd.inn.slice().sort(function (a, b) { return nodes[a.s].y - nodes[b.s].y || a.k - b.k; }); y = nd.y;
      inn.forEach(function (l) { l.ty = y + l.v * k / 2; y += l.v * k; });
    });
    L.forEach(function (l) { l.w = l.v * k; l.x0 = nodes[l.s].x + nodeW; l.x1 = nodes[l.t].x; });
    return { nodes: nodes, links: L, columns: cols.length, k: k };
  }

  SD.parse = parse; SD.layout = layout;
  if (typeof module !== "undefined" && module.exports) module.exports = SD;
})(typeof window !== "undefined" ? window : globalThis);
