// Run: node tests/stats.test.cjs   (special.js, survival.js, forest.js, prisma.js, diagnostic.js and consort.js)
const assert = require("assert");
const vm = require("vm"), fs = require("fs"), path = require("path");
const box = { Math, Number, String, isFinite, Object, Array, parseFloat, module: { exports: {} } };
box.globalThis = box; vm.createContext(box);
const load = f => vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/lib/" + f), "utf8"), box);
["special.js", "survival.js", "forest.js", "prisma.js", "diagnostic.js", "consort.js"].forEach(load);
const { SDSpecial: Sp, SDSurvival: Sv, SDForest: Fo, SDPrisma: Pr, SDDiag: Dg, SDConsort: Co } = box;
let pass = 0;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " " + a + " vs " + b);
function t(name, fn) { fn(); pass++; console.log("ok  " + name); }

t("chi-square tail: 3.841 at 1 df is 0.05, 5.991 at 2 df is 0.05", () => {
  near(Sp.chi2p(3.841458820694124, 1), 0.05, 1e-9); near(Sp.chi2p(5.991464547107979, 2), 0.05, 1e-9);
});
t("normal two-sided p: z = 1.96 gives 0.05, z = 0 gives 1", () => {
  near(Sp.normalP2(1.959963984540054), 0.05, 1e-9); near(Sp.normalP2(0), 1, 1e-12);
});
t("p text", () => { assert.strictEqual(Sp.fmtP(0.0002), "p < 0.001"); assert.strictEqual(Sp.fmtP(0.0456), "p = 0.05"); assert.strictEqual(Sp.fmtP(0.0042), "p = 0.004"); });

/* Freireich 6-MP leukaemia trial, the standard survival example */
const mp = [[6, 1], [6, 1], [6, 1], [6, 0], [7, 1], [9, 0], [10, 1], [10, 0], [11, 0], [13, 1], [16, 1], [17, 0], [19, 0], [20, 0], [22, 1], [23, 1], [25, 0], [32, 0], [32, 0], [34, 0], [35, 0]].map(([t, e]) => ({ t, e }));
const ctl = [1, 1, 2, 2, 3, 4, 4, 5, 5, 8, 8, 8, 8, 11, 11, 12, 12, 15, 17, 22, 23].map(t => ({ t, e: 1 }));
t("Kaplan-Meier: 6-MP survival is 18/21 at 6 weeks and the median is 23", () => {
  const k = Sv.km(mp);
  near(k.steps[0].s, 18 / 21, 1e-12); assert.strictEqual(k.steps[0].n, 21); assert.strictEqual(k.median, 23); assert.strictEqual(k.events, 9);
  near(k.steps[1].s, 18 / 21 * (1 - 1 / 17), 1e-12);
});
t("Kaplan-Meier: control median is 8 and survival hits 0 at 23", () => {
  const k = Sv.km(ctl); assert.strictEqual(k.median, 8); assert.strictEqual(k.steps[k.steps.length - 1].s, 0);
});
t("censored subjects leave the risk set without a step", () => {
  const k = Sv.km([{ t: 1, e: 1 }, { t: 2, e: 0 }, { t: 3, e: 1 }]);
  near(k.steps[0].s, 2 / 3, 1e-12); near(k.steps[1].s, 2 / 3 * 0, 1e-12); assert.strictEqual(k.cens.length, 1);
});
t("confidence limits enclose the estimate and stay within 0 to 1", () => {
  Sv.km(mp).steps.forEach(s => { assert.ok(s.lo <= s.s + 1e-12 && s.hi >= s.s - 1e-12 && s.lo >= 0 && s.hi <= 1); });
});
t("number at risk counts subjects with time >= t", () => { assert.strictEqual(Sv.atRisk(mp, 0), 21); assert.strictEqual(Sv.atRisk(mp, 10), 15); });
t("S(t) is 1 before the first event and steps down after", () => {
  const st = Sv.km(mp).steps; assert.strictEqual(Sv.at(st, 2), 1); near(Sv.at(st, 6), 18 / 21, 1e-12);
});
t("log-rank for 6-MP against control matches R survdiff (chi-square 16.8, 1 df)", () => {
  const r = Sv.logrank([mp, ctl]); near(r.chi2, 16.79, 0.05); assert.strictEqual(r.df, 1); assert.ok(r.p < 1e-4 && r.p > 1e-5);
  near(r.observed[0], 9, 1e-9); near(r.observed[1], 21, 1e-9); near(r.expected[0], 19.25, 0.01); near(r.expected[1], 10.75, 0.01);
});
t("log-rank of identical groups is 0 with p = 1", () => { const r = Sv.logrank([mp, mp]); near(r.chi2, 0, 1e-9); near(r.p, 1, 1e-9); });
t("log-rank with three groups has 2 df", () => { assert.strictEqual(Sv.logrank([mp, ctl, ctl.map(s => ({ t: s.t + 3, e: 1 }))]).df, 2); });

t("standard error from a ratio interval uses the log scale", () => {
  near(Fo.seFrom(0.5, 2, true), (Math.log(2) - Math.log(0.5)) / 3.919927969, 1e-9); assert.strictEqual(Fo.seFrom(0, 2, true), null); assert.strictEqual(Fo.seFrom(2, 1, false), null);
});
t("fixed effect pool of equal-variance studies is their mean", () => {
  const r = Fo.pool([{ y: 0, se: 1 }, { y: 1, se: 1 }], "fixed"); near(r.est, 0.5, 1e-12); near(r.se, 1 / Math.sqrt(2), 1e-12); near(r.I2, 0, 1e-12);
});
t("heterogeneity: Q = 8, I2 = 0.875, tau2 = 1.75 for effects 0 and 2 with se 0.5", () => {
  const r = Fo.pool([{ y: 0, se: 0.5 }, { y: 2, se: 0.5 }], "fixed");
  near(r.Q, 8, 1e-12); near(r.I2, 0.875, 1e-12); near(r.tau2, 1.75, 1e-12); near(r.pQ, 0.004677735, 1e-8);
});
t("random effects widen the interval and equalise the weights", () => {
  const f = Fo.pool([{ y: 0, se: 0.5 }, { y: 2, se: 0.5 }], "fixed"), r = Fo.pool([{ y: 0, se: 0.5 }, { y: 2, se: 0.5 }], "random");
  near(r.se, 1, 1e-12); assert.ok(r.se > f.se); near(r.weights[0], 0.5, 1e-12);
});
t("weights sum to 1", () => { const r = Fo.pool([{ y: 0.1, se: 0.2 }, { y: 0.3, se: 0.1 }, { y: -0.2, se: 0.4 }], "random"); near(r.weights.reduce((a, b) => a + b, 0), 1, 1e-12); });
t("ratio ticks include 1", () => { assert.ok(Fo.ticks(0.2, 5, true).indexOf(1) >= 0); });

t("PRISMA arithmetic follows the 2020 flow", () => {
  const r = Pr.calc({ db: "1000", reg: "50", dup: "200", auto: "20", otherRem: "10", scrExcl: "700", notRet: "5", reasons: [{ reason: "Wrong population", n: "30" }, { reason: "Wrong outcome", n: "20" }] });
  assert.strictEqual(r.identified, 1050); assert.strictEqual(r.removed, 230); assert.strictEqual(r.screened, 820); assert.strictEqual(r.sought, 120);
  assert.strictEqual(r.assessed, 115); assert.strictEqual(r.excluded, 50); assert.strictEqual(r.included, 65); assert.strictEqual(r.warnings.length, 0);
});
t("PRISMA other-methods column adds to the assessed total", () => {
  const r = Pr.calc({ db: "100", dup: "0", scrExcl: "50", other: true, web: "5", org: "3", cit: "12", notRetO: "2", reasons: [] });
  assert.strictEqual(r.otherIdentified, 20); assert.strictEqual(r.otherAssessed, 18); assert.strictEqual(r.included, 50 + 18);
});
t("PRISMA warns when a step goes below 0", () => { assert.ok(Pr.calc({ db: "10", dup: "20" }).warnings.length > 0); });

t("Student t: critical values for 1, 4 and 10 df, and the matching p", () => {
  near(Sp.tCrit(1, 0.05), 12.7062047, 1e-5); near(Sp.tCrit(4, 0.05), 2.7764451, 1e-6); near(Sp.tCrit(10, 0.05), 2.2281389, 1e-6);
  near(Sp.tP2(2.7764451, 4), 0.05, 1e-8); near(Sp.tP2(0, 7), 1, 1e-12);
});
t("incomplete beta: I_0.5(2, 2) = 0.5 and I_x(1, 1) = x", () => { near(Sp.betaI(0.5, 2, 2), 0.5, 1e-12); near(Sp.betaI(0.3, 1, 1), 0.3, 1e-12); });

t("ROC: AUC of a small tied example is 7.5 / 9", () => {
  const r = Dg.roc([3, 4, 5], [1, 2, 4]); near(r.auc, 7.5 / 9, 1e-12); assert.strictEqual(r.n1, 3); assert.strictEqual(r.n0, 3);
});
t("ROC: Hanley-McNeil standard error for AUC 0.8333 with 3 and 3 is 0.18405", () => { near(Dg.roc([3, 4, 5], [1, 2, 4]).se, 0.18405, 1e-4); });
t("ROC: perfect separation gives AUC 1 and a cutoff at the lowest case", () => {
  const r = Dg.roc([5, 6], [1, 2]); near(r.auc, 1, 1e-12); assert.strictEqual(r.best.cut, 5); assert.strictEqual(r.best.sens, 1); assert.strictEqual(r.best.spec, 1); near(r.hi, 1, 1e-12);
});
t("ROC: identical distributions give AUC 0.5 and the curve runs from (0, 0) to (1, 1)", () => {
  const r = Dg.roc([1, 2, 3, 4], [1, 2, 3, 4]); near(r.auc, 0.5, 1e-12);
  assert.deepStrictEqual([r.points[0].fpr, r.points[0].tpr, r.points[r.points.length - 1].fpr, r.points[r.points.length - 1].tpr], [0, 0, 1, 1]);
});
t("ROC: flipping handles markers where low values mean disease", () => {
  near(Dg.roc([1, 2], [5, 6], true).auc, 1, 1e-12); near(Dg.roc([1, 2], [5, 6], false).auc, 0, 1e-12);
});
t("ROC: returns null without both groups", () => { assert.strictEqual(Dg.roc([1, 2], []), null); });

t("Bland-Altman: bias -0.4, SD 0.8944 and limits for a worked example", () => {
  const r = Dg.blandAltman([1, 2, 3, 4, 5].map((a, i) => ({ a, b: [1, 2, 3, 4, 7][i] })));
  near(r.bias, -0.4, 1e-12); near(r.sd, Math.sqrt(0.8), 1e-12); near(r.loa.hi, -0.4 + 1.959964 * Math.sqrt(0.8), 1e-6); near(r.loa.lo, -0.4 - 1.959964 * Math.sqrt(0.8), 1e-6);
  near(r.biasCI.hi - r.biasCI.lo, 2 * 2.7764451 * Math.sqrt(0.8) / Math.sqrt(5), 1e-6);
});
t("Bland-Altman: no difference gives bias 0 and p = 1 for the bias test", () => {
  const r = Dg.blandAltman([1, 2, 3, 4].map(a => ({ a, b: a + (a % 2 ? 0.5 : -0.5) }))); near(r.bias, 0, 1e-12); near(r.pBias, 1, 1e-9);
});
t("Bland-Altman: a difference that grows with the mean gives slope 0.1 and p near 0", () => {
  const xs = [10, 20, 30, 40, 50, 60]; const r = Dg.blandAltman(xs.map((m, i) => ({ a: m + 0.05 * m + (i % 2 ? 0.02 : -0.02), b: m - 0.05 * m })));
  near(r.slope, 0.1, 0.01); assert.ok(r.pSlope < 1e-4);
});
t("Bland-Altman: percent mode scales the difference by the pair mean", () => {
  const r = Dg.blandAltman([{ a: 11, b: 9 }, { a: 22, b: 18 }, { a: 33, b: 27 }], "pct"); near(r.bias, 20, 1e-9); near(r.sd, 0, 1e-9);
});
t("Bland-Altman: needs 3 pairs", () => { assert.strictEqual(Dg.blandAltman([{ a: 1, b: 2 }, { a: 2, b: 3 }]), null); });

t("CONSORT arithmetic follows the 2010 flow", () => {
  const r = Co.calc({ assessed: "300", reasons: [{ reason: "Not meeting criteria", n: "120" }, { reason: "Declined", n: "30" }],
    arms: [{ name: "A", allocated: "75", notReceived: "3", lost: "5", disc: "4", exclAn: "1" }, { name: "B", allocated: "75", notReceived: "2", lost: "8", disc: "2", exclAn: "0" }] });
  assert.strictEqual(r.excluded, 150); assert.strictEqual(r.randomised, 150); assert.strictEqual(r.allocated, 150);
  assert.strictEqual(r.arms[0].received, 72); assert.strictEqual(r.arms[0].analysed, 69); assert.strictEqual(r.arms[1].analysed, 67); assert.strictEqual(r.warnings.length, 0);
});
t("CONSORT warns when allocation does not match randomisation", () => {
  assert.ok(Co.calc({ assessed: "100", arms: [{ allocated: "40" }, { allocated: "40" }] }).warnings.some(x => /does not equal/.test(x)));
});
console.log(pass + " tests passed");
