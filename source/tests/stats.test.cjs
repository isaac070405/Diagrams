// Run: node tests/stats.test.cjs   (the libraries for diagrams 29 to 36)
const assert = require("assert");
const vm = require("vm"), fs = require("fs"), path = require("path");
const box = { Math, Number, String, isFinite, Object, Array, parseFloat, module: { exports: {} } };
box.globalThis = box; vm.createContext(box);
const load = f => vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/lib/" + f), "utf8"), box);
["special.js", "survival.js", "forest.js", "prisma.js", "diagnostic.js", "consort.js", "boxstats.js", "volcano.js", "heatmap.js", "venn.js"].forEach(load);
const { SDSpecial: Sp, SDSurvival: Sv, SDForest: Fo, SDPrisma: Pr, SDDiag: Dg, SDConsort: Co, SDBox: Bx, SDVolcano: Vo, SDHeat: Hm, SDVenn: Vn } = box;
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

t("quantiles (type 7): 1 to 10 gives 3.25, 5.5, 7.75", () => {
  const r = Bx.summary([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); near(r.q1, 3.25, 1e-12); near(r.median, 5.5, 1e-12); near(r.q3, 7.75, 1e-12); near(r.mean, 5.5, 1e-12); near(r.sd, 3.0276504, 1e-6);
});
t("Tukey whiskers stop at the last value inside 1.5 IQR and flag the rest", () => {
  const r = Bx.summary([1, 2, 3, 4, 5, 6, 7, 8, 9, 30]); assert.strictEqual(r.hi, 9); assert.strictEqual(r.lo, 1); assert.deepStrictEqual(Array.from(r.outliers), [30]);
  const m = Bx.summary([1, 2, 3, 4, 5, 6, 7, 8, 9, 30], false); assert.strictEqual(m.hi, 30); assert.strictEqual(m.outliers.length, 0);
});
t("parse accepts commas, spaces and new lines and skips text", () => { assert.deepStrictEqual(Array.from(Bx.parse("1, 2.5\n3;x 4\t5")), [1, 2.5, 3, 4, 5]); });
t("Welch t-test: means 3 and 5, t = -2 on 8 df, p = 0.0805", () => {
  const r = Bx.welch([1, 2, 3, 4, 5], [3, 4, 5, 6, 7]); near(r.stat, -2, 1e-12); near(r.df, 8, 1e-9); near(r.p, 0.08051, 1e-4);
});
t("Mann-Whitney: complete separation of 5 against 5 gives U = 0 and p = 0.0122", () => {
  const r = Bx.mannWhitney([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]); assert.strictEqual(r.stat, 0); near(r.p, 0.01219, 5e-4);
});
t("ANOVA: three groups with F = 13 on 2 and 6 df, p = (1 + 26/6)^-3", () => {
  const r = Bx.anova([[1, 2, 3], [2, 3, 4], [5, 6, 7]]); near(r.stat, 13, 1e-9); near(r.p, Math.pow(1 + 26 / 6, -3), 1e-9);
});
t("Kruskal-Wallis: H = 7.2 on 2 df, p = exp(-3.6)", () => {
  const r = Bx.kruskal([[1, 2, 3], [4, 5, 6], [7, 8, 9]]); near(r.stat, 7.2, 1e-9); near(r.p, Math.exp(-3.6), 1e-9);
});
t("test() picks the two-group or the many-group test", () => {
  assert.strictEqual(Bx.test([[1, 2, 3], [4, 5, 6]], "param").name, "Welch t-test"); assert.strictEqual(Bx.test([[1, 2, 3], [4, 5, 6]], "rank").name, "Mann-Whitney U test");
  assert.strictEqual(Bx.test([[1, 2, 3], [2, 3, 4], [5, 6, 7]], "param").name, "One-way ANOVA"); assert.strictEqual(Bx.test([[1, 2, 3]], "param"), null);
});

t("volcano parse: reads names with spaces, tabs and header lines", () => {
  const r = Vo.parse("gene\tlog2FC\tp\nIL6\t1.8\t0.0003\nPalmitic acid, -0.7, 0.2\nbad, x, y\nTNF 2.1 1e-5"); assert.strictEqual(r.length, 3);
  assert.deepStrictEqual([r[0].name, r[0].fc, r[0].p], ["IL6", 1.8, 0.0003]); assert.strictEqual(r[1].name, "Palmitic acid"); near(r[2].p, 1e-5, 1e-15);
});
t("Benjamini-Hochberg: five p values of 0.01 to 0.05 all become 0.05", () => { Vo.bh([0.01, 0.02, 0.03, 0.04, 0.05]).forEach(q => near(q, 0.05, 1e-12)); });
t("Benjamini-Hochberg keeps input order and enforces monotonicity", () => {
  const q = Vo.bh([0.2, 0.001, 0.04, 0.01]); near(q[0], 0.2, 1e-12); near(q[1], 0.004, 1e-12); near(q[2], 0.2 / 3 * 0.8, 1e-12); near(q[3], 0.02, 1e-12);
});
t("classify: up, down and not significant by fold change and p", () => {
  const c = Vo.classify([{ name: "a", fc: 2, p: 0.001 }, { name: "b", fc: -1.5, p: 0.001 }, { name: "c", fc: 0.4, p: 0.001 }, { name: "d", fc: 3, p: 0.5 }], 1, 0.05, false);
  assert.deepStrictEqual(c.map(x => x.cls), ["up", "down", "ns", "ns"]); near(c[0].y, 3, 1e-12);
});
t("classify can use adjusted p: three raw hits at 0.03 to 0.045 all adjust to 0.06", () => {
  const rows = [{ name: "a", fc: 2, p: 0.03 }, { name: "b", fc: 2, p: 0.04 }, { name: "c", fc: 2, p: 0.045 }, { name: "d", fc: 2, p: 0.9 }];
  assert.deepStrictEqual(Vo.classify(rows, 1, 0.05, false).map(x => x.cls), ["up", "up", "up", "ns"]);
  assert.deepStrictEqual(Vo.classify(rows, 1, 0.05, true).map(x => x.cls), ["ns", "ns", "ns", "ns"]);
});
t("p = 0 plots above the largest finite value", () => {
  const u = Vo.classify([{ name: "a", fc: 2, p: 1e-8 }, { name: "z", fc: 2, p: 0 }], 1, 0.05, false); assert.ok(u[1].y > u[0].y);
});

t("error bars: SD 1.5811, SEM 0.7071 and 95% CI 1.9640 for 1 to 5", () => {
  const v = [1, 2, 3, 4, 5]; near(Bx.errorOf(v, "sd"), 1.5811388, 1e-6); near(Bx.errorOf(v, "sem"), 0.7071068, 1e-6); near(Bx.errorOf(v, "ci"), 2.7764451 * 0.7071068, 1e-6); assert.ok(isNaN(Bx.errorOf([3], "sd")));
});
t("stars: thresholds at 0.05, 0.01 and 0.001", () => { assert.deepStrictEqual([0.2, 0.03, 0.005, 0.0004].map(Bx.stars), ["ns", "*", "**", "***"]); });

t("heatmap parse: tab table with names and a missing value", () => {
  const m = Hm.parse("\ts1\ts2\ts3\ng1\t1\t2\t3\ng2\t4\tNA\t6"); assert.deepStrictEqual(Array.from(m.cols), ["s1", "s2", "s3"]); assert.strictEqual(m.rows.length, 2); assert.ok(isNaN(m.rows[1].vals[1]));
});
t("heatmap parse: comma table", () => { const m = Hm.parse("x,a,b\nr1,1,2\nr2,3,4"); assert.deepStrictEqual(Array.from(m.rows[1].vals), [3, 4]); assert.strictEqual(Hm.parse("only one line"), null); });
t("z-scores of a row have mean 0 and SD 1; a flat row is 0", () => {
  const z = Hm.zRows([{ name: "a", vals: [1, 2, 3, 4, 5] }, { name: "b", vals: [7, 7, 7, 7, 7] }]); near(z[0].vals[0], -1.2649111, 1e-6); near(z[0].vals.reduce((a, b) => a + b, 0), 0, 1e-12); assert.deepStrictEqual(Array.from(z[1].vals), [0, 0, 0, 0, 0]);
});
t("distances: Euclidean 5 for (0,0) and (3,4); correlation distance 0 for a rescaled copy and 2 for a mirror", () => {
  near(Hm.dist([0, 0], [3, 4], "euclid"), 5, 1e-12); near(Hm.dist([1, 2, 3], [2, 4, 6], "corr"), 0, 1e-12); near(Hm.dist([1, 2, 3], [3, 2, 1], "corr"), 2, 1e-12);
});
t("average linkage on 0, 1, 5, 6: merges at 1, 1 and 5", () => {
  const r = Hm.cluster([[0], [1], [5], [6]], "euclid", "average");
  near(r.tree.h, 5, 1e-12); near(r.tree.left.h, 1, 1e-12); near(r.tree.right.h, 1, 1e-12); assert.deepStrictEqual(Array.from(r.order).sort(), [0, 1, 2, 3]);
  assert.ok(Math.abs(r.order.indexOf(0) - r.order.indexOf(1)) === 1 && Math.abs(r.order.indexOf(2) - r.order.indexOf(3)) === 1);
});
t("complete and single linkage give different top heights (6 and 4)", () => {
  near(Hm.cluster([[0], [1], [5], [6]], "euclid", "complete").tree.h, 6, 1e-12); near(Hm.cluster([[0], [1], [5], [6]], "euclid", "single").tree.h, 4, 1e-12);
});
t("one row is its own tree; none is empty", () => { assert.deepStrictEqual(Array.from(Hm.cluster([[1, 2]], "euclid", "average").order), [0]); assert.deepStrictEqual(Array.from(Hm.cluster([], "euclid", "average").order), []); });

t("Venn items: trims, drops blanks and duplicates, optional case folding", () => {
  assert.deepStrictEqual(Array.from(Vn.items(" a, b\nB\n\na ;c", false)), ["a", "b", "B", "c"]); assert.deepStrictEqual(Array.from(Vn.items("a\nA\nb", true)), ["a", "b"]);
});
t("Venn regions for three sets", () => {
  const r = Vn.regions([["a", "b", "c"], ["b", "c", "d"], ["c", "e"]], false);
  assert.deepStrictEqual(Object.keys(r).sort(), ["A", "AB", "ABC", "B", "C"]); assert.deepStrictEqual(Array.from(r.AB), ["b"]); assert.deepStrictEqual(Array.from(r.ABC), ["c"]);
});
t("lens area: equal unit circles at d = 0, 1 and 2", () => { near(Vn.lens(1, 1, 0), Math.PI, 1e-12); near(Vn.lens(1, 1, 1), 2 * Math.PI / 3 - Math.sqrt(3) / 2, 1e-12); near(Vn.lens(1, 1, 2), 0, 1e-12); });
t("solveD recovers the distance from an overlap area, and handles no overlap and containment", () => {
  near(Vn.solveD(1, 1, Vn.lens(1, 1, 0.8)), 0.8, 1e-9); near(Vn.solveD(2, 1, Vn.lens(2, 1, 1.7)), 1.7, 1e-9); assert.strictEqual(Vn.solveD(1, 1, 0), 2); near(Vn.solveD(2, 1, Math.PI), 1, 1e-9);
});
console.log(pass + " tests passed");
