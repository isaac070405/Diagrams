// Run: node tests/kite.test.cjs
const assert = require("assert");
const vm = require("vm"), fs = require("fs"), path = require("path");
const box = { module: { exports: {} }, Math, Number, String, isFinite, Object, Array };
box.globalThis = box;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/lib/kite.js"), "utf8"), box);
const K = box.module.exports;
let pass = 0;
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b);
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, a + " vs " + b);
function t(name, fn) { fn(); pass++; console.log("ok  " + name); }

const xs = [0, 5, 10, 15, 20, 25, 30, 35];
t("species A (2 at 0 m and 5 m) is a flat strip of width 2 that pinches at 10 m", () => {
  const o = K.outline(xs, [2, 2, 0, 0, 0, 0, 0, 0]);
  eq(o.slice(0, 3), [[0, 1], [5, 1], [10, 0]]);
});

t("species B (8 at 15 m) is a kite of full width 8 with tips at the neighbouring quadrats", () => {
  const o = K.outline(xs, [0, 0, 0, 8, 0, 0, 0, 0]);
  eq(o[3], [15, 4]); eq(o[2], [10, 0]); eq(o[4], [20, 0]);
});

t("polygon is symmetric about the baseline and its area equals the trapezium sum", () => {
  const counts = [0, 0, 0, 8, 0, 0, 0, 0], p = K.polygon(xs, counts);
  assert.strictEqual(p.length, 16);
  near(K.area(p), 8 * 5, 1e-9); // two triangles of base 5 each side of the 8 wide peak: 2 * (0.5 * 5 * 8)
  p.forEach(([x, y]) => assert.ok(p.some(([x2, y2]) => x2 === x && Math.abs(y2 + y) < 1e-12)));
});

t("points sort by distance and bad counts read as zero", () => {
  eq(K.outline([10, 0, 5], ["4", "x", -3]), [[0, 0], [5, 0], [10, 2]]);
});

t("diversity indices match hand calculation", () => {
  near(K.shannon([5, 5]), Math.log(2), 1e-12);
  near(K.shannon([10, 0, 0]), 0, 1e-12);
  near(K.simpson([5, 5]), 1 - (20 + 20) / 90, 1e-12);
  near(K.evenness([5, 5]), 1, 1e-12);
  assert.strictEqual(K.simpson([1]), 0);
  assert.strictEqual(K.total(["2", 3, "a", -1]), 5);
});

t("density is count over quadrat area", () => {
  assert.strictEqual(K.density(8, 0.25), 32);
  assert.strictEqual(K.density(8, 0), 0);
});

t("scale bar picks 1, 2 or 5 times a power of ten", () => {
  assert.strictEqual(K.scaleBar(8), 5);
  assert.strictEqual(K.scaleBar(1.9), 1);
  assert.strictEqual(K.scaleBar(24), 20);
  assert.strictEqual(K.scaleBar(0), 1);
});

t("dots give n points inside the unit square, repeatable for a seed", () => {
  const a = K.dots(7, 3), b = K.dots(7, 3);
  assert.strictEqual(a.length, 7); eq(a, JSON.parse(JSON.stringify(b)));
  a.forEach(([x, y]) => assert.ok(x > 0 && x < 1 && y > 0 && y < 1));
});

console.log(pass + " passed");
