// Run: node tests/stats.test.cjs   (the libraries for diagrams 29 to 51)
const assert = require("assert");
const vm = require("vm"), fs = require("fs"), path = require("path");
const box = { Math, Number, String, isFinite, Object, Array, parseFloat, module: { exports: {} } };
box.globalThis = box; vm.createContext(box);
const load = f => vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/lib/" + f), "utf8"), box);
["special.js", "survival.js", "forest.js", "prisma.js", "diagnostic.js", "consort.js", "boxstats.js", "volcano.js", "heatmap.js", "venn.js", "regress.js", "enzyme.js", "sankey.js", "calib.js", "funnel.js", "pie.js", "pca.js", "rarefy.js", "growth.js", "violin.js", "pyramid.js", "epi.js"].forEach(load);
const { SDSpecial: Sp, SDSurvival: Sv, SDForest: Fo, SDPrisma: Pr, SDDiag: Dg, SDConsort: Co, SDBox: Bx, SDVolcano: Vo, SDHeat: Hm, SDVenn: Vn, SDReg: Rg, SDEnz: En, SDSankey: Sk, SDCalib: Cb, SDFunnel: Fu, SDPie: Pi, SDPCA: Pc, SDRare: Ra, SDGrowth: Gr, SDViolin: Vi, SDPyramid: Py, SDEpi: Ep } = box;
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

const xy = [[1, 2], [2, 4], [3, 5], [4, 4], [5, 5]];
t("linear regression: slope 0.6, intercept 2.2, r2 0.6, SE of the slope 0.2828", () => {
  const f = Rg.linear(xy); near(f.slope, 0.6, 1e-12); near(f.intercept, 2.2, 1e-12); near(f.r2, 0.6, 1e-12); near(f.r, Math.sqrt(0.6), 1e-12); near(f.s, Math.sqrt(0.8), 1e-12); near(f.seSlope, Math.sqrt(0.08), 1e-12);
});
t("regression p value: t = 2.1213 on 3 df gives p = 0.1238; the slope interval uses t(3) = 3.1824", () => {
  const f = Rg.linear(xy); near(f.p, 0.1238, 1e-3); near(f.slopeCI[1] - f.slopeCI[0], 2 * 3.1824463 * Math.sqrt(0.08), 1e-5);
});
t("Fisher interval for r encloses r and stays in -1 to 1", () => { const f = Rg.linear(xy); assert.ok(f.rCI[0] < f.r && f.rCI[1] > f.r && f.rCI[0] > -1 && f.rCI[1] < 1); });
t("bands: the prediction band is wider than the confidence band, and both are narrowest at the mean of x", () => {
  const f = Rg.linear(xy), a = Rg.at(f, 3, "mean"), b = Rg.at(f, 3, "pred"), c = Rg.at(f, 5, "mean");
  assert.ok(b.half > a.half && c.half > a.half); near(a.y, 4, 1e-12); near(a.half, 3.1824463 * Math.sqrt(0.8) * Math.sqrt(0.2), 1e-6);
});
t("regression needs 3 points and spread in x", () => { assert.strictEqual(Rg.linear([[1, 1], [2, 2]]), null); assert.strictEqual(Rg.linear([[1, 1], [1, 2], [1, 3]]), null); });
t("Spearman: a monotone curve gives rho = 1; a reversed one gives -1", () => {
  near(Rg.spearman([[1, 1], [2, 4], [3, 9], [4, 16], [5, 100]]).rho, 1, 1e-12); near(Rg.spearman([[1, 5], [2, 4], [3, 3], [4, 2]]).rho, -1, 1e-12);
});

const mmS = [1, 2, 5, 10, 20, 50], mmV = mmS.map(s => 100 * s / (5 + s));
t("Michaelis-Menten: exact data returns Vmax 100, Km 5 and R2 1", () => {
  const f = En.fit(mmS, mmV); near(f.Vmax, 100, 1e-6); near(f.Km, 5, 1e-6); near(f.r2, 1, 1e-9);
});
t("Michaelis-Menten: noisy data lands near the true values and the interval covers them", () => {
  const noise = [1.2, -0.9, 0.7, -1.1, 0.8, -0.5], f = En.fit(mmS, mmV.map((v, i) => v + noise[i]));
  assert.ok(Math.abs(f.Vmax - 100) < 6 && Math.abs(f.Km - 5) < 1.5); assert.ok(f.VmaxCI[0] < 100 && f.VmaxCI[1] > 100); assert.ok(f.seKm > 0 && f.df === 4);
});
t("straight-line transforms recover Vmax 100 and Km 5 from exact data", () => {
  const pts = En.clean(mmS, mmV); ["lb", "eh", "hw"].forEach(k => { const l = En.lineFit(pts, k); near(l.Vmax, 100, 1e-6, k); near(l.Km, 5, 1e-6, k); });
});
t("a competitive inhibitor raises Km and leaves Vmax: fit of v = 100 S / (15 + S)", () => {
  const f = En.fit(mmS, mmS.map(s => 100 * s / (15 + s))); near(f.Vmax, 100, 1e-5); near(f.Km, 15, 1e-5);
});
t("enzyme fit needs 3 positive substrate points", () => { assert.strictEqual(En.fit([1, 2], [1, 2]), null); assert.strictEqual(En.fit([0, 0, 0], [1, 2, 3]), null); });

t("Sankey parse: names with spaces, header skipped, bad rows dropped", () => {
  const r = Sk.parse("from,to,value\nGross energy, Faecal energy, 120\nGross energy,Urine,x\nA,B,-3\nA,B,4"); assert.strictEqual(r.length, 2); assert.strictEqual(r[0].s, "Gross energy"); assert.strictEqual(r[1].v, 4);
});
const diamond = [{ s: "A", t: "B", v: 10 }, { s: "A", t: "C", v: 5 }, { s: "B", t: "D", v: 10 }, { s: "C", t: "D", v: 5 }];
t("Sankey layout: depths, node values and link widths follow the flows", () => {
  const r = Sk.layout(diamond, 600, 300), by = {}; r.nodes.forEach(n => { by[n.name] = n; });
  assert.deepStrictEqual(["A", "B", "C", "D"].map(n => by[n].depth), [0, 1, 1, 2]); near(by.A.value, 15, 1e-12); near(by.D.value, 15, 1e-12);
  r.links.forEach(l => near(l.w, l.v * r.k, 1e-9)); r.nodes.forEach(n => near(n.h, n.value * r.k, 1e-9));
});
t("Sankey layout: nodes in a column never overlap and stay inside the height", () => {
  const r = Sk.layout(diamond, 600, 300);
  [0, 1, 2].forEach(d => { const c = r.nodes.filter(n => n.depth === d).sort((a, b) => a.y - b.y); c.forEach((n, i) => { assert.ok(n.y >= -1e-9 && n.y + n.h <= 300 + 1e-9); if (i) assert.ok(n.y >= c[i - 1].y + c[i - 1].h - 1e-9); }); });
});
t("Sankey layout: link ends stay within their node", () => {
  const r = Sk.layout(diamond, 600, 300); r.links.forEach(l => { const s = r.nodes[l.s], d = r.nodes[l.t]; assert.ok(l.sy - l.w / 2 >= s.y - 1e-9 && l.sy + l.w / 2 <= s.y + s.h + 1e-9); assert.ok(l.ty - l.w / 2 >= d.y - 1e-9 && l.ty + l.w / 2 <= d.y + d.h + 1e-9); });
});
t("Sankey layout: sinks move to the last column when justified, and a loop is rejected", () => {
  const r = Sk.layout([{ s: "A", t: "B", v: 1 }, { s: "A", t: "C", v: 1 }, { s: "B", t: "D", v: 1 }], 600, 300), c = r.nodes.find(n => n.name === "C"); assert.strictEqual(c.depth, 2);
  assert.strictEqual(Sk.layout([{ s: "A", t: "C", v: 1 }, { s: "A", t: "B", v: 1 }, { s: "B", t: "D", v: 1 }], 600, 300, { justify: false }).nodes.find(n => n.name === "C").depth, 1);
  assert.ok(Sk.layout([{ s: "A", t: "B", v: 1 }, { s: "B", t: "A", v: 1 }], 600, 300).error); assert.ok(Sk.layout([{ s: "A", t: "A", v: 1 }], 600, 300).error);
});

t("standard curve, linear: y = 1 + 2x is recovered and inverted; the 95% interval brackets the reading", () => {
  const f = Cb.fit([0, 1, 2, 3, 4, 5].map(x => [x, 1 + 2 * x + (x % 2 ? 0.05 : -0.05)]), "linear");
  near(f.params.b, 2, 0.02); near(f.params.a, 1, 0.06); near(f.invert(11), 5, 0.05); const ci = f.invertCI(11); assert.ok(ci[0] < f.invert(11) && ci[1] > f.invert(11));
});
t("semi-log curve (qPCR): Ct = 38 - 3.32 log10(copies) gives 100% efficiency", () => {
  const f = Cb.fit([10, 100, 1e3, 1e4, 1e5, 1e6].map(x => [x, 38 - Math.log2(10) * Math.log10(x)]), "log"); near(f.params.b, -Math.log2(10), 1e-9); near(f.efficiency, 1, 1e-9); near(f.invert(38 - Math.log2(10) * 4), 1e4, 1e-6);
});
t("four-parameter curve: exact data returns the four parameters and inverts a reading", () => {
  const q = [0.05, 1.2, 30, 2.5], xs = [1, 3, 10, 30, 100, 300, 1000], f = Cb.fit(xs.map(x => [x, q[3] + (q[0] - q[3]) / (1 + Math.pow(x / q[2], q[1]))]), "4pl");
  near(f.params.a, 0.05, 1e-3); near(f.params.b, 1.2, 1e-3); near(f.params.c, 30, 0.05); near(f.params.d, 2.5, 1e-3); near(f.r2, 1, 1e-9); near(f.invert(f.predict(55)), 55, 1e-6);
});
t("four-parameter curve: a reading outside the asymptotes cannot be read back; decreasing curves work", () => {
  const f = Cb.fit([1, 3, 10, 30, 100, 300, 1000].map(x => [x, 0.1 + 2.4 / (1 + Math.pow(x / 40, 1.5))]), "4pl"); assert.ok(isNaN(f.invert(5))); near(f.invert(f.predict(20)), 20, 1e-5);
});
t("standard curve needs 5 points for four parameters and positive x for log models", () => {
  assert.strictEqual(Cb.fit([[1, 1], [2, 2], [3, 3], [4, 4]], "4pl"), null); assert.strictEqual(Cb.fit([[0, 1], [0, 2]], "log"), null);
});

t("Egger: a funnel with y = 0.3 + 1.2 se gives intercept 1.2 and slope 0.3", () => {
  const e = Fu.egger([0.1, 0.2, 0.3, 0.4, 0.5].map(se => ({ y: 0.3 + 1.2 * se, se }))); near(e.intercept, 1.2, 1e-9); near(e.slope, 0.3, 1e-9); assert.strictEqual(e.low, true); assert.strictEqual(e.k, 5);
});
t("Egger: a symmetric funnel has intercept near 0 and a large p", () => {
  const e = Fu.egger([[0.1, 0.02], [0.1, -0.03], [0.2, 0.1], [0.2, -0.12], [0.3, 0.2], [0.3, -0.18], [0.4, 0.05], [0.4, -0.04]].map(([se, d]) => ({ y: -0.2 + d, se }))); assert.ok(Math.abs(e.intercept) < 0.8 && e.p > 0.2);
});
t("pseudo limits: 1.96 se and 2.576 se", () => { near(Fu.limit(0.5, 95), 0.97998, 1e-4); near(Fu.limit(0.5, 99), 1.28791, 1e-4); });
t("Egger needs 3 studies", () => { assert.strictEqual(Fu.egger([{ y: 0, se: 1 }, { y: 1, se: 1 }]), null); });

t("pie slices: fractions sum to 1, angles run once round, bad values are dropped", () => {
  const r = Pi.slices([{ value: 50 }, { value: "x" }, { value: 30 }, { value: 20 }, { value: -4 }], 0, false);
  assert.strictEqual(r.length, 3); near(r.reduce((a, b) => a + b.frac, 0), 1, 1e-12); near(r[2].a1, 2 * Math.PI, 1e-12); near(r[0].a1 - r[0].a0, Math.PI, 1e-12);
});
t("pie slices: sorting puts the largest first and a start angle rotates them", () => {
  const r = Pi.slices([{ value: 1 }, { value: 5 }, { value: 3 }], 90, true); assert.deepStrictEqual(Array.from(r.map(x => x.index)), [1, 2, 0]); near(r[0].a0, Math.PI / 2, 1e-12);
});
t("pie arc: points start at the top, clockwise; a full circle still draws", () => {
  const p = Pi.point(100, 100, 50, 0), q = Pi.point(100, 100, 50, Math.PI / 2); near(p[0], 100, 1e-9); near(p[1], 50, 1e-9); near(q[0], 150, 1e-9); near(q[1], 100, 1e-9);
  assert.ok(/^M/.test(Pi.arc(0, 0, 0, 10, 0, 2 * Math.PI))); assert.ok(Pi.arc(0, 0, 5, 10, 0, 1).indexOf("A5") > 0);
});

t("Jacobi: eigenvalues 11, 2, 1 and A v = lambda v for [[2,0,0],[0,3,4],[0,4,9]]", () => {
  const A = [[2, 0, 0], [0, 3, 4], [0, 4, 9]], e = Pc.jacobi(A); [11, 2, 1].forEach((v, i) => near(e.values[i], v, 1e-9));
  for (let k = 0; k < 3; k++) for (let r = 0; r < 3; r++) near(A[r].reduce((s, a, c) => s + a * e.vectors[c][k], 0), e.values[k] * e.vectors[r][k], 1e-9);
});
t("PCA on two correlated variables: shares (1 + r) / 2 and (1 - r) / 2 of the standardised variance", () => {
  const x = [1, 2, 3, 4, 5, 6], y = [2.1, 3.9, 6.5, 7.6, 10.4, 11.5], mx = 3.5, my = y.reduce((a, b) => a + b) / 6;
  let sxy = 0, sxx = 0, syy = 0; x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; });
  const r = sxy / Math.sqrt(sxx * syy), p = Pc.run(x.map((v, i) => [v, y[i]]), true);
  near(p.share[0], (1 + r) / 2, 1e-9); near(p.share[1], (1 - r) / 2, 1e-9); near(p.total, 2, 1e-9);
});
t("PCA: variance of the scores equals the eigenvalues, scores are uncorrelated, and loadings are correlations when scaled", () => {
  const rows = [[2, 4, 1], [3, 6, 2], [5, 8, 2], [6, 9, 5], [8, 13, 4], [9, 15, 7], [11, 18, 6]], p = Pc.run(rows, true), n = rows.length;
  [0, 1].forEach(k => { const m = p.scores.reduce((a, s) => a + s[k], 0) / n; near(m, 0, 1e-9); near(p.scores.reduce((a, s) => a + (s[k] - m) ** 2, 0) / (n - 1), p.values[k], 1e-9); });
  near(p.scores.reduce((a, s) => a + s[0] * s[1], 0), 0, 1e-8);
  const cor = (j, k) => { const a = rows.map(r => r[j]), b = p.scores.map(s => s[k]), ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
  near(p.loadings[1][0], cor(1, 0), 1e-9); near(p.loadings[2][1], cor(2, 1), 1e-9);
});
t("PCA: rows with a missing value are dropped, and it needs 3 rows and 2 variables", () => {
  const p = Pc.run([[1, 2], [2, NaN], [3, 5], [4, 7], [6, 8]], false); assert.strictEqual(p.n, 4); assert.deepStrictEqual(Array.from(p.keep), [0, 2, 3, 4]); assert.strictEqual(Pc.run([[1, 2], [2, 3]], true), null);
});
t("confidence ellipse: every point has Mahalanobis distance squared of 5.991 for 95%", () => {
  const pts = [[1, 2], [2, 3.5], [3, 3], [4, 6], [5, 5.5], [6, 8], [2.5, 4], [4.5, 4]], e = Pc.ellipse(pts, 0.95, 40), n = pts.length;
  const mx = e.mean[0], my = e.mean[1]; let sxx = 0, syy = 0, sxy = 0; pts.forEach(p => { sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; sxy += (p[0] - mx) * (p[1] - my); }); sxx /= n - 1; syy /= n - 1; sxy /= n - 1;
  const det = sxx * syy - sxy * sxy; e.points.forEach(q => { const dx = q[0] - mx, dy = q[1] - my; near((syy * dx * dx - 2 * sxy * dx * dy + sxx * dy * dy) / det, 5.991465, 1e-4); });
});

t("Hurlbert: counts 5, 3, 2 give E[S_2] = 1.6889, E[S_1] = 1 and E[S_10] = 3", () => {
  near(Ra.hurlbert([5, 3, 2], 2), 1.68889, 1e-4); near(Ra.hurlbert([5, 3, 2], 1), 1, 1e-12); near(Ra.hurlbert([5, 3, 2], 10), 3, 1e-12); near(Ra.hurlbert([0, "x", 4, 6], 10), 2, 1e-12);
});
t("rarefaction curve never falls, starts at 1 and ends at the observed richness", () => {
  const c = Ra.curve([40, 25, 10, 5, 3, 2, 1, 1, 1], 30); for (let i = 1; i < c.length; i++) assert.ok(c[i][1] >= c[i - 1][1] - 1e-12); near(c[0][1], 1, 1e-12); assert.strictEqual(c[c.length - 1][0], 88); near(c[c.length - 1][1], 9, 1e-12);
});
t("Chao1: singletons 2 and doubletons 1 add 0.5 to 5 observed species", () => {
  const c = Ra.chao1([1, 1, 2, 5, 5]); assert.deepStrictEqual([c.observed, c.f1, c.f2], [5, 2, 1]); near(c.estimate, 5.5, 1e-12);
});
t("accumulation: three samples with disjoint species give 2, 4, 6 in every order; an interval brackets the mean", () => {
  const a = Ra.accumulate([[1, 1, 0, 0, 0, 0], [0, 0, 1, 1, 0, 0], [0, 0, 0, 0, 1, 1]], 100, 7); [2, 4, 6].forEach((v, i) => { near(a[i].mean, v, 1e-12); assert.strictEqual(a[i].lo, v); assert.strictEqual(a[i].hi, v); });
  const b = Ra.accumulate([[3, 1, 0], [0, 2, 1], [1, 0, 0], [0, 0, 5]], 200, 3); b.forEach(r => assert.ok(r.lo <= r.mean && r.mean <= r.hi)); near(b[b.length - 1].mean, 3, 1e-12); assert.strictEqual(Ra.accumulate([[1, 2]], 10, 1), null);
});

const vb = (L, K, t0) => t => L * (1 - Math.exp(-K * (t - t0)));
const ages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
t("von Bertalanffy: exact data returns Linf 100, K 0.3, t0 -0.5 with R2 1", () => {
  const f = Gr.fit(ages.map(a => [a, vb(100, 0.3, -0.5)(a)]), "vb"); near(f.q[0], 100, 1e-3); near(f.q[1], 0.3, 1e-4); near(f.q[2], -0.5, 1e-3); near(f.r2, 1, 1e-9); near(f.phi, Math.log10(0.3) + 4, 1e-4);
});
t("Gompertz and logistic: exact data returns the parameters", () => {
  const g = Gr.fit(ages.map(a => [a, 80 * Math.exp(-Math.exp(-0.5 * (a - 4)))]), "gompertz"); near(g.q[0], 80, 1e-3); near(g.q[1], 0.5, 1e-4); near(g.q[2], 4, 1e-3);
  const l = Gr.fit(ages.map(a => [a, 50 / (1 + Math.exp(-0.8 * (a - 6)))]), "logistic"); near(l.q[0], 50, 1e-3); near(l.q[1], 0.8, 1e-4); near(l.q[2], 6, 1e-3);
});
t("growth fit: noisy data gives standard errors, a curve band that widens off the data, and a lower AIC for the true model", () => {
  const noise = [1.4, -2.0, 0.9, -1.1, 2.2, -0.8, 1.0, -1.7, 0.6, -0.3, 1.2, -1.5], pts = ages.map((a, i) => [a, vb(100, 0.3, -0.5)(a) + noise[i]]);
  const f = Gr.fit(pts, "vb"), lg = Gr.fit(pts, "logistic"); assert.ok(f.se.every(v => v > 0)); assert.ok(f.half(30) > f.half(6)); assert.ok(f.aic < lg.aic + 40 && isFinite(f.aic)); near(f.q[0], 100, 6);
});
t("growth fit needs 5 points and a spread of ages", () => { assert.strictEqual(Gr.fit([[1, 2], [2, 3], [3, 4], [4, 5]], "vb"), null); assert.strictEqual(Gr.fit([[1, 2], [1, 3], [1, 4], [1, 5], [1, 6]], "vb"), null); });

t("Silverman bandwidth for 1 to 10 is 0.9 x SD x n^-0.2 = 1.7194", () => { near(Vi.bandwidth([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 0.9 * 3.0276504 * Math.pow(10, -0.2), 1e-5); });
t("kernel density integrates to about 1 and is symmetric for symmetric data", () => {
  const k = Vi.kde([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1, false, 200); let a = 0; for (let i = 1; i < k.xs.length; i++) a += (k.xs[i] - k.xs[i - 1]) * (k.ys[i] + k.ys[i - 1]) / 2; near(a, 1, 0.005);
  const m = k.ys.length - 1; near(k.ys[10], k.ys[m - 10], 1e-9);
});
t("kernel density: two clusters give two peaks, a larger multiplier smooths them into one", () => {
  const v = [1, 1.2, 0.8, 1.1, 0.9, 5, 5.2, 4.8, 5.1, 4.9], peaks = k => { let c = 0; for (let i = 1; i < k.ys.length - 1; i++) if (k.ys[i] > k.ys[i - 1] && k.ys[i] > k.ys[i + 1]) c++; return c; };
  assert.strictEqual(peaks(Vi.kde(v, 1, false, 200)), 2); assert.strictEqual(peaks(Vi.kde(v, 6, false, 200)), 1);
});
t("kernel density trimmed to the data range stays inside it; one value gives null", () => {
  const k = Vi.kde([2, 3, 4], 1, true); near(k.xs[0], 2, 1e-12); near(k.xs[k.xs.length - 1], 4, 1e-12); assert.strictEqual(Vi.kde([3], 1, true), null);
});

t("age ranges: 0-4, 85+, <1 and a single year", () => {
  const r = Py.ageRange; assert.deepStrictEqual([r("0-4").lo, r("0-4").hi], [0, 5]); assert.strictEqual(r("85+").lo, 85); assert.strictEqual(r("85+").hi, Infinity); assert.strictEqual(r("<1").hi, 1); assert.strictEqual(r("65–69").hi, 70); assert.strictEqual(r("abc"), null);
});
t("pyramid parse and totals: males 60, females 60, sex ratio 100, median interpolated to 10", () => {
  const rows = Py.parse("0-4, 5, 5\n5-9, 10, 10\n10-14, 15, 15\nage,m,f"), s = Py.summary(rows);
  assert.strictEqual(rows.length, 3); assert.strictEqual(s.total, 60); near(s.pctMale, 50, 1e-12); near(s.sexRatio, 100, 1e-12); near(s.median, 10, 1e-12);
});
t("dependency ratios: 20 under 15, 60 at 15 to 64 and 10 at 65 and over", () => {
  const s = Py.summary(Py.parse("0-14, 10, 10\n15-64, 30, 30\n65+, 5, 5")); near(s.young, 100 / 3, 1e-9); near(s.old, 100 / 6, 1e-9); near(s.total_dep, 100 / 3 + 100 / 6, 1e-9);
  assert.ok(isNaN(Py.summary(Py.parse("0-4, 1, 1\n5-9, 1, 1")).young)); assert.ok(isNaN(Py.summary(Py.parse("young, 5, 5\nold, 4, 4")).median));
});

t("epi dates: day numbers, formatting, rejects impossible dates, weekdays", () => {
  assert.strictEqual(Ep.day("1970-01-02"), 1); assert.ok(isNaN(Ep.day("2026-02-30"))); assert.ok(isNaN(Ep.day("hello"))); const d = Ep.day("2026-03-01");
  assert.strictEqual(Ep.fmt(d, true), "1 Mar 2026"); assert.strictEqual(Ep.iso(d + 31), "2026-04-01"); assert.strictEqual(Ep.weekday(Ep.day("2026-11-16")), 0);
});
t("epi parse: a count, a category or both after the date", () => {
  const c = Ep.parse("2026-03-01\n2026-03-02, 4\n2026-03-02, Confirmed\n2026-03-03, 2, Probable cases\nbad, 3\n2026-03-04, 0"); assert.strictEqual(c.length, 4);
  assert.deepStrictEqual([c[1].n, c[1].cat, c[2].n, c[2].cat, c[3].n, c[3].cat], [4, "", 1, "Confirmed", 2, "Probable cases"]);
});
t("epi bins: counts are conserved, bins start on the first day, weekly bins can start on a Monday", () => {
  const c = Ep.parse("2026-03-01, 2\n2026-03-02, 3\n2026-03-04, 1\n2026-03-09, 5"), b = Ep.bin(c, 3, "first");
  assert.strictEqual(b.total, 11); assert.strictEqual(b.bins.reduce((a, x) => a + x.total, 0), 11); assert.deepStrictEqual(Array.from(b.bins.map(x => x.total)), [5, 1, 5]); assert.strictEqual(b.bins.length, 3);
  const w = Ep.bin(c, 7, "monday"); assert.strictEqual(Ep.weekday(w.bins[0].start), 0); assert.strictEqual(w.bins.reduce((a, x) => a + x.total, 0), 11);
});
t("epi bins can be extended back to an exposure date, with the first and last onset unchanged", () => {
  const c = Ep.parse("2026-03-15, 2\n2026-03-16, 3"), b = Ep.bin(c, 1, "first", [Ep.day("2026-03-12"), Ep.day("2026-03-18")]);
  assert.strictEqual(b.bins.length, 7); assert.strictEqual(Ep.iso(b.start), "2026-03-12"); assert.strictEqual(b.total, 5); assert.strictEqual(Ep.iso(b.first), "2026-03-15"); assert.strictEqual(Ep.iso(b.last), "2026-03-16"); assert.strictEqual(b.bins[0].total, 0);
});
t("epi summary: peak bin, median onset day and categories", () => {
  const b = Ep.bin(Ep.parse("2026-03-01, 1, A\n2026-03-02, 6, A\n2026-03-02, 2, B\n2026-03-05, 1, B"), 1, "first");
  assert.strictEqual(b.peak.total, 8); assert.strictEqual(Ep.iso(b.median), "2026-03-02"); assert.deepStrictEqual(Array.from(b.cats), ["A", "B"]); assert.deepStrictEqual(Array.from(b.bins[1].by), [6, 2]);
});
console.log(pass + " tests passed");
