// Run: node tests/xyaxis.test.cjs
const assert = require("assert");
// The source is a classic script and the package is ESM, so load it in a sandbox with a CommonJS shim.
const vm = require("vm"), fs = require("fs"), path = require("path");
const box = { module: { exports: {} }, Math, Number, String, isFinite };
box.globalThis = box;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/lib/xyaxis.js"), "utf8"), box);
const xy = box.module.exports;
let pass = 0;
// Arrays come from the sandbox realm, so compare by value.
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b);
function t(name, fn) { fn(); pass++; console.log("ok  " + name); }

t("nice steps are 1, 2, 2.5 or 5 x 10^k", () => {
  assert.strictEqual(xy.niceStep(24, 6), 5);
  assert.strictEqual(xy.niceStep(1, 6), 0.2);
  assert.strictEqual(xy.niceStep(0.007, 5), 0.001);
  assert.strictEqual(xy.niceStep(150, 6), 25);
});

t("linear ticks 0..24 h land on 0,5,..,20 with minors at 1 h", () => {
  const tk = xy.linearTicks(0, 24, 6);
  eq(tk.major, [0, 5, 10, 15, 20]);
  assert.ok(tk.minor.includes(1) && tk.minor.includes(24) && !tk.minor.includes(5));
});

t("linear ticks avoid float noise (0.1 steps)", () => {
  const tk = xy.linearTicks(0, 1, 10);
  eq(tk.major, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
});

t("log ticks 1e-9..1e-4: majors per decade, 8 minors each", () => {
  const tk = xy.logTicks(1e-9, 1e-4);
  assert.strictEqual(tk.major.length, 6);
  assert.strictEqual(tk.minor.length, 40);
});

t("log tick labels use ChemText superscripts", () => {
  assert.strictEqual(xy.formatTick(1e-7, "log"), "10^{-7}");
  assert.strictEqual(xy.formatTick(1, "log"), "1");
  assert.strictEqual(xy.formatTick(100, "log"), "10^{2}");
  assert.strictEqual(xy.formatTick(-2, "linear"), "−2");
});

t("PHASE 1 CHECK: y = 10^x is a straight line on a log y axis", () => {
  const sx = xy.makeScale("linear", [0, 4], [78, 612]);
  const sy = xy.makeScale("log", [1, 1e4], [358, 24]);
  const pts = xy.sample(x => Math.pow(10, x), [0, 4], "linear", 400);
  assert.strictEqual(pts.length, 400);
  const P = pts.map(p => [sx(p[0]), sy(p[1])]);
  // Line through the end points; every sample must sit on it.
  const [a, b] = [P[0], P[P.length - 1]];
  const slope = (b[1] - a[1]) / (b[0] - a[0]);
  const maxDev = Math.max(...P.map(p => Math.abs(p[1] - (a[1] + slope * (p[0] - a[0])))));
  console.log("    max deviation from straight line: " + maxDev.toExponential(2) + " px");
  assert.ok(maxDev < 1e-6);
  // Control: the same curve on a linear y axis is not straight.
  const syl = xy.makeScale("linear", [0, 1e4], [358, 24]);
  const Q = pts.map(p => [sx(p[0]), syl(p[1])]);
  const s2 = (Q[399][1] - Q[0][1]) / (Q[399][0] - Q[0][0]);
  const dev2 = Math.max(...Q.map(p => Math.abs(p[1] - (Q[0][1] + s2 * (p[0] - Q[0][0])))));
  assert.ok(dev2 > 50);
});

t("path breaks at y <= 0 on a log axis", () => {
  const sx = xy.makeScale("linear", [0, 3], [0, 300]);
  const sy = xy.makeScale("log", [1, 100], [300, 0]);
  const d = xy.pathFrom([[0, 10], [1, 0], [2, 10], [3, 20]], sx, sy);
  assert.strictEqual((d.match(/M/g) || []).length, 2);
});

t("log x sampling is even in log space", () => {
  const pts = xy.sample(x => x, [1e-9, 1e-3], "log", 7);
  pts.forEach((p, i) => assert.ok(Math.abs(Math.log10(p[0]) - (-9 + i)) < 1e-9));
});

t("area closes to the baseline inside [x0, x1]", () => {
  const sx = xy.makeScale("linear", [0, 10], [0, 100]);
  const sy = xy.makeScale("linear", [0, 10], [100, 0]);
  const d = xy.areaFrom(xy.sample(x => x, [0, 10], "linear", 11), sx, sy, 2, 6, 100);
  assert.ok(d.startsWith("M20.00,100.00") && d.endsWith("L60.00,100.00Z"));
});

t("auto domain pads and rounds to a nice step", () => {
  eq(xy.autoDomain([0, 3.7], "linear"), [0, 4]);
  eq(xy.autoDomain([0.02, 340], "log"), [0.01, 1000]);
});

console.log(pass + " tests passed");
