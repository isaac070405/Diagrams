// Run: node tests/treemap.test.cjs
const assert = require("assert");
const vm = require("vm"), fs = require("fs"), path = require("path");
const box = { module: { exports: {} }, Math, Number, String, isFinite, Object, Array, parseFloat };
box.globalThis = box;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/lib/treemap.js"), "utf8"), box);
const T = box.module.exports;
let pass = 0;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " " + a + " vs " + b);
function t(name, fn) { fn(); pass++; console.log("ok  " + name); }
const area = r => r[2] * r[3];

t("tiles fill the rectangle exactly", () => {
  const r = T.squarify([6, 6, 4, 3, 2, 2, 1], 0, 0, 600, 400);
  near(r.reduce((s, q) => s + area(q), 0), 240000, 1e-6);
});
t("tile area is proportional to value", () => {
  const v = [9, 5, 3, 2, 1], r = T.squarify(v, 10, 20, 300, 200), tot = 20;
  r.forEach((q, i) => near(area(q), v[i] / tot * 60000, 1e-6, "tile " + i));
});
t("tiles stay inside the rectangle and do not overlap", () => {
  const r = T.squarify([8, 7, 6, 5, 4, 3, 2, 1], 5, 5, 400, 300);
  r.forEach(q => { assert.ok(q[0] >= 5 - 1e-9 && q[1] >= 5 - 1e-9 && q[0] + q[2] <= 405 + 1e-9 && q[1] + q[3] <= 305 + 1e-9); });
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i], b = r[j], ox = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]), oy = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
    assert.ok(ox <= 1e-9 || oy <= 1e-9, "tiles " + i + " and " + j + " overlap");
  }
});
t("the worked example from the paper starts with two 3 x 2 tiles and keeps aspect below 3", () => {
  const q = T.squarify([6, 6, 4, 3, 2, 2, 1], 0, 0, 6, 4);
  assert.deepStrictEqual([Array.from(q[0]), Array.from(q[1])], [[0, 0, 3, 2], [0, 2, 3, 2]]);
  assert.ok(T.aspect(q.map(r => ({ w: r[2], h: r[3] }))) < 3);
});
t("empty or non-positive input returns zero-size tiles", () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.squarify([], 0, 0, 10, 10))), []);
  assert.strictEqual(T.squarify([0, 0], 0, 0, 10, 10)[0][2], 0);
  assert.strictEqual(T.squarify([1], 0, 0, 0, 10)[0][2], 0);
});
t("a single tile takes the whole rectangle", () => {
  const r = T.squarify([5], 1, 2, 30, 40)[0];
  assert.deepStrictEqual(Array.from(r), [1, 2, 30, 40]);
});
t("layout sorts largest first, drops zero values and sums group totals", () => {
  const g = T.layout([{ id: "a", children: [{ id: "a1", value: 1 }, { id: "a2", value: "3" }, { id: "a3", value: 0 }] }, { id: "b", children: [{ id: "b1", value: 10 }] }, { id: "c", children: [{ id: "c1", value: "x" }] }], 600, 400);
  assert.deepStrictEqual(g.map(x => x.id), ["b", "a"]);
  assert.deepStrictEqual(g[1].children.map(x => x.id), ["a2", "a1"]);
  assert.strictEqual(g[1].total, 4);
});
t("group rectangles are proportional to group totals", () => {
  const g = T.layout([{ id: "a", children: [{ id: "a1", value: 30 }] }, { id: "b", children: [{ id: "b1", value: 10 }] }], 400, 300);
  near(area([0, 0, g[0].w, g[0].h]) / area([0, 0, g[1].w, g[1].h]), 3, 1e-9);
});
t("children sit inside their group below the header and inside the padding", () => {
  const g = T.layout([{ id: "a", children: [{ id: "x", value: 5 }, { id: "y", value: 3 }, { id: "z", value: 1 }] }], 300, 200, { head: 20, pad: 3 });
  g[0].children.forEach(c => { assert.ok(c.x >= 3 - 1e-9 && c.y >= 23 - 1e-9 && c.x + c.w <= 297 + 1e-9 && c.y + c.h <= 197 + 1e-9); });
  near(g[0].children.reduce((s, c) => s + c.w * c.h, 0), 294 * 174, 1e-6);
});
t("sort false keeps the entered order", () => {
  const g = T.layout([{ id: "a", children: [{ id: "a1", value: 1 }, { id: "a2", value: 9 }] }, { id: "b", children: [{ id: "b1", value: 20 }] }], 100, 100, { sort: false });
  assert.deepStrictEqual(g.map(x => x.id), ["a", "b"]);
  assert.deepStrictEqual(g[0].children.map(x => x.id), ["a1", "a2"]);
});
console.log(pass + " tests passed");
