// Run: node tests/radar.test.cjs
const assert = require("assert");
const vm = require("vm"), fs = require("fs"), path = require("path");
const box = { module: { exports: {} }, Math, Number, String, isFinite, Object, Array, parseFloat };
box.globalThis = box;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/lib/radar.js"), "utf8"), box);
const R = box.module.exports;
let pass = 0;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " " + a + " vs " + b);
function t(name, fn) { fn(); pass++; console.log("ok  " + name); }

t("first axis points straight up, second of four points right", () => {
  const p = R.point(0, 4, 1, 100, 100, 50), q = R.point(1, 4, 1, 100, 100, 50);
  near(p[0], 100, 1e-9); near(p[1], 50, 1e-9); near(q[0], 150, 1e-9); near(q[1], 100, 1e-9);
});
t("axes run clockwise and are evenly spaced", () => {
  near(R.angle(3, 6), Math.PI, 1e-12); near(R.angle(2, 8), Math.PI / 2, 1e-12);
});
t("fraction scales between min and max and clamps", () => {
  assert.strictEqual(R.frac(5, 0, 10), 0.5);
  assert.strictEqual(R.frac(20, 0, 10), 1);
  assert.strictEqual(R.frac(-3, 0, 10), 0);
  assert.strictEqual(R.frac(15, 10, 20), 0.5);
});
t("bad numbers and empty ranges read as 0", () => {
  assert.strictEqual(R.frac("x", 0, 10), 0);
  assert.strictEqual(R.frac(5, 10, 10), 0);
});
t("zero fraction sits at the centre", () => {
  const p = R.point(2, 5, 0, 70, 80, 60); near(p[0], 70, 1e-12); near(p[1], 80, 1e-12);
});
t("a full polygon has area share 1 and a half-radius one has 0.25", () => {
  near(R.areaShare([1, 1, 1, 1, 1]), 1, 1e-12);
  near(R.areaShare([0.5, 0.5, 0.5, 0.5, 0.5]), 0.25, 1e-12);
});
t("fewer than three axes have no area", () => { assert.strictEqual(R.areaShare([1, 1]), 0); });
t("ring values step evenly from min to max", () => {
  assert.strictEqual(R.ringValue(2, 4, 0, 100), 50);
  assert.strictEqual(R.ringValue(4, 4, 10, 20), 20);
});
console.log(pass + " tests passed");
