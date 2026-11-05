// Run: node tests/contour.test.cjs
const assert = require("assert");
const vm = require("vm"), fs = require("fs"), path = require("path");
const box = { module: { exports: {} }, Math, Number, String, isFinite, Object, Array };
box.globalThis = box;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/lib/contour.js"), "utf8"), box);
const C = box.module.exports;
let pass = 0;
function t(name, fn) { fn(); pass++; console.log("ok  " + name); }
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " " + a + " vs " + b);

t("nice step is 1, 2 or 5 times 10^k", () => {
  assert.strictEqual(C.niceStep(10, 10), 1);
  assert.strictEqual(C.niceStep(100, 10), 10);
  assert.strictEqual(C.niceStep(0.7, 7), 0.1);
  assert.strictEqual(C.niceStep(24, 5), 5);
});

t("levels sit strictly inside the range with no float noise", () => {
  eq(C.levels(0, 1, 5), [0.2, 0.4, 0.6, 0.8]);
  eq(C.levels(-3, 3, 6), [-2, -1, 0, 1, 2]);
  eq(C.levels(5, 5, 5), []);
  eq(C.levels(0, 10, 5, 2.5), [2.5, 5, 7.5]);
});

t("a cone gives one closed circle of the right radius", () => {
  const g = C.makeGrid(-10, 10, -10, 10, 81, 81, (x, y) => 10 - Math.hypot(x, y));
  const ls = C.lines(g, 4); // radius 6
  assert.strictEqual(ls.length, 1);
  assert.ok(ls[0].closed);
  ls[0].pts.forEach(p => near(Math.hypot(p[0], p[1]), 6, 0.03, "radius"));
});

t("a plane gives one open straight line across the grid", () => {
  const g = C.makeGrid(0, 10, 0, 10, 21, 21, (x) => x);
  const ls = C.lines(g, 3.3);
  assert.strictEqual(ls.length, 1);
  assert.ok(!ls[0].closed);
  ls[0].pts.forEach(p => near(p[0], 3.3, 1e-9, "x"));
  const ys = ls[0].pts.map(p => p[1]);
  near(Math.min(...ys), 0, 1e-9); near(Math.max(...ys), 10, 1e-9);
});

t("a saddle level gives two separate curves", () => {
  const g = C.makeGrid(-1, 1, -1, 1, 41, 41, (x, y) => x * x - y * y);
  assert.strictEqual(C.lines(g, 0.25).length, 2);
});

t("filled bands tile the grid area exactly", () => {
  const g = C.surfaceGrid("twopeaks", 0, 8, 0, 6, 0, 10, 50, 40);
  const lv = C.levels(...C.range(g), 8), edges = [-Infinity, ...lv, Infinity];
  let sum = 0; for (let k = 0; k < edges.length - 1; k++) sum += C.bandArea(g, edges[k], edges[k + 1]);
  near(sum, 8 * 6, 1e-6, "area");
});

t("band area follows the surface: half the plane lies above the middle level", () => {
  const g = C.makeGrid(0, 10, 0, 10, 31, 31, (x) => x);
  near(C.bandArea(g, 5, Infinity), 50, 1e-9, "upper half");
});

t("idw returns the data value at a data point and stays inside the data range", () => {
  const pts = [{ x: 0, y: 0, z: 1 }, { x: 10, y: 0, z: 5 }, { x: 5, y: 8, z: 3 }];
  const g = C.idw(pts, 0, 10, 0, 8, 11, 9, 2);
  assert.strictEqual(g.z[0], 1);
  const [lo, hi] = C.range(g); assert.ok(lo >= 1 - 1e-9 && hi <= 5 + 1e-9);
});

t("smoothing keeps values inside the data range and flattens the bulls-eye at a point", () => {
  const pts = [{ x: 0, y: 0, z: 1 }, { x: 10, y: 0, z: 5 }, { x: 5, y: 8, z: 3 }];
  const g0 = C.idw(pts, 0, 10, 0, 8, 11, 9, 2, 0), g1 = C.idw(pts, 0, 10, 0, 8, 11, 9, 2, 0.1);
  const [lo, hi] = C.range(g1); assert.ok(lo >= 1 && hi <= 5);
  assert.ok(g1.z[0] > g0.z[0]); // pulled toward the neighbours
});

t("label spot is upright and on the line", () => {
  const g = C.makeGrid(-10, 10, -10, 10, 61, 61, (x, y) => 10 - Math.hypot(x, y));
  const X = x => x * 10, Y = y => -y * 10;
  const s = C.labelSpot(C.lines(g, 4), X, Y, 30);
  assert.ok(s && s.angle >= -90 && s.angle <= 90);
  near(Math.hypot(s.x, s.y), 60, 1.5, "on ring");
  assert.strictEqual(C.labelSpot(C.lines(g, 4), X, Y, 1e6), null);
});

t("colour ramp ends match the stops and reverse flips them", () => {
  assert.strictEqual(C.color("viridis", 0), "rgb(68,1,84)");
  assert.strictEqual(C.color("viridis", 1), "rgb(253,231,37)");
  assert.strictEqual(C.color("viridis", 0, true), C.color("viridis", 1));
});

console.log(pass + " passed");
